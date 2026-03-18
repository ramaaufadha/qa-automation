export function resolveReportTimezone() {
  const configured = (process.env.REPORT_TIMEZONE || 'Asia/Jakarta').trim();
  const normalized = configured.toLowerCase();

  if (normalized === 'local') {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }

  if (normalized === 'jakarta') {
    return 'Asia/Jakarta';
  }

  return configured || 'Asia/Jakarta';
}

export function formatTimestamp(value, timezone = resolveReportTimezone()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
}

export function nowTimestamp(timezone = resolveReportTimezone()) {
  return formatTimestamp(new Date(), timezone);
}
