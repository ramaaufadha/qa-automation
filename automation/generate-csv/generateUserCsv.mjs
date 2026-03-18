import fs from 'node:fs';
import { nowTimestamp } from '../shared/time-utils.mjs';

function loadLocalEnv() {
  const envPath = new URL('../.env', import.meta.url);
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.includes('=') ? '=' : line.includes(':') ? ':' : null;
    if (!separator) continue;

    const splitIndex = line.indexOf(separator);
    const key = line.slice(0, splitIndex).trim();
    const value = line.slice(splitIndex + 1).trim();
    if (!key || process.env[key]) continue;

    process.env[key] = value;
  }
}

loadLocalEnv();

const BASE_URL = process.env.REQRES_BASE_URL || 'https://reqres.in/api/users';
const API_KEY = (process.env.REQRES_API_KEY || '').trim();
const OUTPUT_DIR = new URL('../data/', import.meta.url);

async function fetchUsers(page = 2) {
  const url = new URL(BASE_URL);
  url.searchParams.set('page', page);

  const headers = { Accept: 'application/json' };
  if (API_KEY) headers['x-api-key'] = API_KEY;

  const response = await fetch(url, { method: 'GET', headers });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const body = await response.json();
  return body.data || [];
}

function saveToCSV(users) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const timestamp = nowTimestamp().replace(/[: ]/g, '-');
  const filePath = new URL(`users-${timestamp}.csv`, OUTPUT_DIR);

  let csv = "First Name,Last Name,Email\n";

  for (const user of users) {
    csv += `${user.first_name},${user.last_name},${user.email}\n`;
  }

  fs.writeFileSync(filePath, csv, 'utf8');

  console.log(`CSV created: ${filePath.pathname}`);
  console.log(`Total users: ${users.length}`);
}
async function main() {
  try {
    if (!API_KEY) {
      console.warn('REQRES_API_KEY not set');
    }

    const users = await fetchUsers(2);

    if (!users.length) {
      console.log('No data to save');
      return;
    }

    saveToCSV(users);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();