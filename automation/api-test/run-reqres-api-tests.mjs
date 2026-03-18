import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { nowTimestamp, resolveReportTimezone } from '../shared/time-utils.mjs';

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
const PERF_SLA_MS = Number(process.env.REQRES_SLA_MS || 2000);
const REPORT_DIR = new URL('../reports/api/', import.meta.url);
const FAILURE_DIR = new URL('../reports/api/failures/', import.meta.url);
const REPORT_TIMEZONE = resolveReportTimezone();

let activeTestEntry = null;

class SkipError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SkipError';
  }
}

async function sendRequest({ method = 'GET', query = [], apiKey = API_KEY } = {}) {
  const url = new URL(BASE_URL);
  url.search = '';

  for (const [key, value] of query) {
    url.searchParams.set(key, String(value));
  }

  const headers = { Accept: 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;

  const startedAt = Date.now();
  const response = await fetch(url, { method, headers });
  const durationMs = Date.now() - startedAt;

  const contentType = response.headers.get('content-type') || '';
  const rawBody = await response.text();

  let body = null;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    body = null;
  }

  const isCloudflareChallenge =
    response.status === 403 &&
    ((response.headers.get('cf-mitigated') || '').toLowerCase() === 'challenge' ||
      /just a moment/i.test(rawBody) ||
      /enable javascript and cookies/i.test(rawBody));

  if (activeTestEntry) {
    activeTestEntry.requests.push({
      method,
      url: url.toString(),
      statusCode: response.status,
      responseTimeMs: durationMs,
      contentType,
      timestamp: nowTimestamp(REPORT_TIMEZONE),
      responseSnippet: rawBody.slice(0, 400)
    });
  }

  return { response, body, contentType, durationMs, isCloudflareChallenge };
}

function requireApiKey() {
  if (!API_KEY) {
    throw new SkipError('Set REQRES_API_KEY to run authenticated test scenarios.');
  }
}

function skipIfCloudflare(result) {
  if (result.isCloudflareChallenge) {
    throw new SkipError('Blocked by Cloudflare challenge in this execution environment.');
  }
}

function assertEnvelope(body) {
  assert.ok(body && typeof body === 'object', 'Body must be a JSON object');
  for (const key of ['page', 'per_page', 'total', 'data']) {
    assert.ok(Object.prototype.hasOwnProperty.call(body, key), `Missing field: ${key}`);
  }
  assert.ok(Array.isArray(body.data), 'data must be an array');
}

function assertEmailFormat(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  assert.match(email, emailRegex, `Invalid email format: ${email}`);
}

function assertAuthFailure(status) {
  assert.ok([401, 403].includes(status), `Expected auth failure status, got: ${status}`);
}

const scenarios = [
  {
    id: 'API01',
    name: 'Valid request page=2',
    run: async () => {
      requireApiKey();
      const result = await sendRequest({ query: [['page', 2]] });
      skipIfCloudflare(result);
      assert.equal(result.response.status, 200);
      assertEnvelope(result.body);
      assert.ok(result.body.data.length > 0, 'Expected data to be returned');
    }
  },
  {
    id: 'API02',
    name: 'Validate response structure',
    run: async () => {
      requireApiKey();
      const result = await sendRequest({ query: [['page', 2]] });
      skipIfCloudflare(result);
      assert.equal(result.response.status, 200);
      assertEnvelope(result.body);
    }
  },
  {
    id: 'API03',
    name: 'Validate data count',
    run: async () => {
      requireApiKey();
      const result = await sendRequest({ query: [['page', 2]] });
      skipIfCloudflare(result);
      assert.equal(result.response.status, 200);
      assertEnvelope(result.body);
      assert.equal(result.body.data.length, result.body.per_page);
    }
  },
  {
    id: 'API04',
    name: 'Validate email format',
    run: async () => {
      requireApiKey();
      const result = await sendRequest({ query: [['page', 2]] });
      skipIfCloudflare(result);
      assert.equal(result.response.status, 200);
      for (const user of result.body.data) {
        assertEmailFormat(String(user.email || ''));
      }
    }
  },
  {
    id: 'API05',
    name: 'Validate ID uniqueness',
    run: async () => {
      requireApiKey();
      const result = await sendRequest({ query: [['page', 2]] });
      skipIfCloudflare(result);
      assert.equal(result.response.status, 200);
      const ids = result.body.data.map((u) => u.id);
      assert.equal(new Set(ids).size, ids.length, 'Duplicate IDs found');
    }
  },
  {
    id: 'API06',
    name: 'Validate non-null fields',
    run: async () => {
      requireApiKey();
      const result = await sendRequest({ query: [['page', 2]] });
      skipIfCloudflare(result);
      assert.equal(result.response.status, 200);
      for (const user of result.body.data) {
        assert.notEqual(user.id, null, 'id is null');
        assert.notEqual(user.email, null, 'email is null');
        assert.notEqual(user.first_name, null, 'first_name is null');
      }
    }
  },
  {
    id: 'API07',
    name: 'Invalid api key',
    run: async () => {
      const result = await sendRequest({ query: [['page', 2]], apiKey: 'salah123' });
      skipIfCloudflare(result);
      assertAuthFailure(result.response.status);
    }
  },
  {
    id: 'API08',
    name: 'Invalid method',
    run: async () => {
      requireApiKey();
      const result = await sendRequest({ method: 'PUT', query: [['page', 2]] });
      skipIfCloudflare(result);
      assert.equal(result.response.status, 404);
    }
  },
  {
    id: 'API09',
    name: 'Invalid page(9999)',
    run: async () => {
      requireApiKey();
      const result = await sendRequest({ query: [['page', 9999]] });
      skipIfCloudflare(result);
      assert.equal(result.response.status, 200);
      assert.ok(Array.isArray(result.body.data), 'data must be array');
      assert.equal(result.body.data.length, 0, 'Expected empty data');
    }
  },
  {
    id: 'API10',
    name: 'Case Sensitive Param',
    run: async () => {
      requireApiKey();
      const result = await sendRequest({ query: [['Page', 2]] });
      skipIfCloudflare(result);
      assert.equal(result.response.status, 200);
      assertEnvelope(result.body);
      assert.equal(result.body.page, 1, 'Expected fallback/default page 1');
    }
  },
  {
    id: 'API11',
    name: 'Add Noise Param',
    run: async () => {
      requireApiKey();
      const result = await sendRequest({ query: [['page', 2], ['test', 2]] });
      skipIfCloudflare(result);
      assert.equal(result.response.status, 200);
      assertEnvelope(result.body);
      assert.ok(result.body.data.length > 0, 'Expected data with noise param');
    }
  },
  {
    id: 'API12',
    name: 'Response time check',
    run: async () => {
      requireApiKey();
      const result = await sendRequest({ query: [['page', 2]] });
      skipIfCloudflare(result);
      assert.ok(result.durationMs < PERF_SLA_MS, `Response ${result.durationMs}ms >= ${PERF_SLA_MS}ms`);
    }
  },
  {
    id: 'API13',
    name: 'page params = -2',
    run: async () => {
      requireApiKey();
      const result = await sendRequest({ query: [['page', -2]] });
      skipIfCloudflare(result);
      assert.equal(result.response.status, 200);
      assert.ok(Array.isArray(result.body.data), 'data must be array');
      assert.equal(result.body.data.length, 0, 'Expected empty data');
    }
  }
];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function statusClass(status) {
  if (status === 'PASS') return 'status-pass';
  if (status === 'FAIL') return 'status-fail';
  return 'status-skip';
}

function writeFailureLog(entry) {
  fs.mkdirSync(FAILURE_DIR, { recursive: true });
  const filename = `${entry.id}-failure.log`;
  const filePath = new URL(filename, FAILURE_DIR);

  const content = [
    `Test Case: ${entry.id} - ${entry.name}`,
    `Status: ${entry.status}`,
    `Started: ${entry.startedAt}`,
    `Ended: ${entry.endedAt}`,
    `Duration: ${entry.durationMs} ms`,
    `Error: ${entry.errorMessage || 'N/A'}`,
    '',
    'Captured Requests:',
    ...entry.requests.flatMap((request, index) => [
      `#${index + 1}`,
      `  Method: ${request.method}`,
      `  URL: ${request.url}`,
      `  Status Code: ${request.statusCode}`,
      `  Response Time: ${request.responseTimeMs} ms`,
      `  Content-Type: ${request.contentType}`,
      `  Timestamp: ${request.timestamp}`,
      `  Response Snippet: ${request.responseSnippet}`,
      ''
    ])
  ].join('\n');

  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

function cleanupOldApiReports() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const files = fs.readdirSync(REPORT_DIR, { withFileTypes: true });
  for (const file of files) {
    if (!file.isFile()) continue;

    const isTimestampedReport = /^api-report-\d{8}-\d{6}\.(html|json)$/i.test(file.name);
    if (isTimestampedReport) {
      fs.rmSync(new URL(file.name, REPORT_DIR), { force: true });
    }
  }

  if (fs.existsSync(FAILURE_DIR)) {
    fs.rmSync(FAILURE_DIR, { recursive: true, force: true });
  }
}

function buildHtmlReport({ runStartedAt, runEndedAt, results, totals, timezone }) {
  const rows = results
    .map((entry) => {
      const latestRequest = entry.requests[entry.requests.length - 1] || null;
      const requestSummary = latestRequest
        ? `${latestRequest.method} | ${latestRequest.statusCode} | ${latestRequest.responseTimeMs} ms`
        : 'N/A';

      const details = entry.requests.length
        ? `<details><summary>Request Details (${entry.requests.length})</summary><pre>${escapeHtml(
            JSON.stringify(entry.requests, null, 2)
          )}</pre></details>`
        : 'N/A';

      return `
        <tr>
          <td>${escapeHtml(entry.id)}</td>
          <td>${escapeHtml(entry.name)}</td>
          <td><span class="${statusClass(entry.status)}">${escapeHtml(entry.status)}</span></td>
          <td>${escapeHtml(requestSummary)}</td>
          <td>${entry.durationMs} ms</td>
          <td>${escapeHtml(entry.responseValidationResult)}</td>
          <td>${escapeHtml(entry.errorMessage || '-')}</td>
          <td>${details}</td>
        </tr>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>API Automation Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
    h1 { margin-bottom: 8px; }
    .meta { margin: 0 0 16px 0; color: #4b5563; }
    .summary { display: flex; gap: 12px; margin: 16px 0 24px 0; flex-wrap: wrap; }
    .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 10px 14px; min-width: 140px; }
    .card strong { display: block; font-size: 20px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { border: 1px solid #d1d5db; padding: 10px; vertical-align: top; text-align: left; }
    th { background: #f3f4f6; }
    .status-pass { color: #065f46; font-weight: 700; }
    .status-fail { color: #991b1b; font-weight: 700; }
    .status-skip { color: #92400e; font-weight: 700; }
    pre { white-space: pre-wrap; word-break: break-word; margin: 8px 0 0 0; }
  </style>
</head>
<body>
  <h1>API Automation Test Report</h1>
  <p class="meta">Run Start: ${escapeHtml(runStartedAt)} | Run End: ${escapeHtml(runEndedAt)} | Timezone: ${escapeHtml(timezone)}</p>
  <div class="summary">
    <div class="card">Total Tests<strong>${totals.total}</strong></div>
    <div class="card">Passed<strong>${totals.passed}</strong></div>
    <div class="card">Failed<strong>${totals.failed}</strong></div>
    <div class="card">Skipped<strong>${totals.skipped}</strong></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Test ID</th>
        <th>Test Name</th>
        <th>Result</th>
        <th>HTTP Details</th>
        <th>Exec Time</th>
        <th>Response Validation</th>
        <th>Error</th>
        <th>Request Log</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;
}

function writeReports({ runStartedAt, runEndedAt, results, totals }) {
  cleanupOldApiReports();
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const latestJsonFile = new URL('api-report.json', REPORT_DIR);
  const latestHtmlFile = new URL('api-report.html', REPORT_DIR);

  const payload = {
    generatedAt: nowTimestamp(REPORT_TIMEZONE),
    timezone: REPORT_TIMEZONE,
    runStartedAt,
    runEndedAt,
    totals,
    results
  };

  const htmlContent = buildHtmlReport({ runStartedAt, runEndedAt, results, totals, timezone: REPORT_TIMEZONE });
  fs.writeFileSync(latestJsonFile, JSON.stringify(payload, null, 2), 'utf8');
  fs.writeFileSync(latestHtmlFile, htmlContent, 'utf8');

  return {
    latestHtmlFilePath: fileURLToPath(latestHtmlFile),
    latestJsonFilePath: fileURLToPath(latestJsonFile)
  };
}

async function main() {
  const runStartedAt = nowTimestamp(REPORT_TIMEZONE);
  const results = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const scenario of scenarios) {
    const startedAt = nowTimestamp(REPORT_TIMEZONE);
    const caseStartedTs = Date.now();
    const resultEntry = {
      id: scenario.id,
      name: scenario.name,
      status: 'PASS',
      startedAt,
      endedAt: '',
      durationMs: 0,
      errorMessage: '',
      responseValidationResult: 'PASS',
      requests: [],
      failureLog: ''
    };

    activeTestEntry = resultEntry;
    try {
      await scenario.run();
      passed += 1;
      console.log(`[PASS] ${scenario.id} - ${scenario.name}`);
    } catch (error) {
      if (error instanceof SkipError) {
        skipped += 1;
        resultEntry.status = 'SKIP';
        resultEntry.responseValidationResult = 'SKIP';
        resultEntry.errorMessage = error.message;
        console.log(`[SKIP] ${scenario.id} - ${scenario.name}`);
        console.log(`       ${error.message}`);
      } else {
        failed += 1;
        resultEntry.status = 'FAIL';
        resultEntry.responseValidationResult = 'FAIL';
        resultEntry.errorMessage = error?.message || 'Unknown error';
        resultEntry.failureLog = fileURLToPath(writeFailureLog(resultEntry));
        console.log(`[FAIL] ${scenario.id} - ${scenario.name}`);
        console.log(`       ${error.message}`);
      }
    } finally {
      resultEntry.endedAt = nowTimestamp(REPORT_TIMEZONE);
      resultEntry.durationMs = Date.now() - caseStartedTs;
      results.push(resultEntry);
      activeTestEntry = null;
    }
  }

  const runEndedAt = nowTimestamp(REPORT_TIMEZONE);
  const totals = {
    total: scenarios.length,
    passed,
    failed,
    skipped
  };
  const reportPaths = writeReports({ runStartedAt, runEndedAt, results, totals });

  console.log('\n=== API TEST SUMMARY ===');
  console.log(`Total: ${totals.total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Report (latest HTML): ${reportPaths.latestHtmlFilePath}`);
  console.log(`Report (latest JSON): ${reportPaths.latestJsonFilePath}`);

  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('Unexpected execution failure:', error);
  process.exit(1);
});
