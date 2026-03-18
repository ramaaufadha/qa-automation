import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatTimestamp, nowTimestamp, resolveReportTimezone } from '../../shared/time-utils.mjs';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeStatus(status) {
  if (status === 'passed') return 'PASS';
  if (status === 'skipped') return 'SKIP';
  return 'FAIL';
}

function toBase64(value) {
  if (!value) return '';
  if (Buffer.isBuffer(value)) return value.toString('base64');
  if (value instanceof Uint8Array) return Buffer.from(value).toString('base64');
  if (typeof value === 'string') return Buffer.from(value).toString('base64');
  return '';
}

function buildImageDataUri(artifact) {
  if (!artifact || !(artifact.contentType || '').startsWith('image/')) return '';

  if (artifact.bodyBase64) {
    return `data:${artifact.contentType};base64,${artifact.bodyBase64}`;
  }

  if (artifact.path && fs.existsSync(artifact.path)) {
    const fileBase64 = fs.readFileSync(artifact.path).toString('base64');
    return `data:${artifact.contentType};base64,${fileBase64}`;
  }

  return '';
}

export default class LocalTimestampUiReporter {
  constructor(options = {}) {
    this.options = options;
    this.timezone = resolveReportTimezone();
    this.runStartedAt = '';
    this.results = [];

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    this.outputDir = options.outputDir
      ? path.resolve(process.cwd(), options.outputDir)
      : path.resolve(__dirname, '../../reports/ui');
  }

  onBegin() {
    this.runStartedAt = nowTimestamp(this.timezone);
    this.results = [];
  }

  onTestEnd(test, result) {
    const startDate = result.startTime ? new Date(result.startTime) : new Date();
    const endDate = new Date(startDate.getTime() + result.duration);

    const artifacts = (result.attachments || [])
      .map((attachment) => ({
        name: attachment.name,
        contentType: attachment.contentType,
        path: attachment.path || '',
        bodyBase64: toBase64(attachment.body)
      }));

    this.results.push({
      id: test.title.match(/^UI\d+/)?.[0] || '-',
      testName: test.title,
      suiteName: test
        .titlePath()
        .slice(0, -1)
        .filter((item) => item && item.trim())
        .join(' > '),
      status: normalizeStatus(result.status),
      startedAt: formatTimestamp(startDate, this.timezone),
      endedAt: formatTimestamp(endDate, this.timezone),
      durationMs: result.duration,
      errorMessage: result.error?.message || '',
      artifacts
    });
  }

  onEnd() {
    const runEndedAt = nowTimestamp(this.timezone);

    const totals = {
      total: this.results.length,
      passed: this.results.filter((item) => item.status === 'PASS').length,
      failed: this.results.filter((item) => item.status === 'FAIL').length,
      skipped: this.results.filter((item) => item.status === 'SKIP').length
    };

    fs.mkdirSync(this.outputDir, { recursive: true });

    const jsonPath = path.join(this.outputDir, 'ui-report.json');
    const htmlPath = path.join(this.outputDir, 'ui-report.html');

    const serializableResults = this.results.map((entry) => ({
      ...entry,
      artifacts: entry.artifacts.map((artifact) => ({
        name: artifact.name,
        contentType: artifact.contentType,
        path: artifact.path
      }))
    }));

    const payload = {
      generatedAt: nowTimestamp(this.timezone),
      timezone: this.timezone,
      runStartedAt: this.runStartedAt,
      runEndedAt,
      totals,
      results: serializableResults
    };

    const rows = this.results
      .map((entry) => {
        const screenshotArtifacts = entry.artifacts.filter((artifact) =>
          (artifact.contentType || '').startsWith('image/')
        );

        const screenshots = screenshotArtifacts.length
          ? screenshotArtifacts
              .map((artifact) => {
                const dataUri = buildImageDataUri(artifact);
                if (!dataUri) {
                  return `<div class="screenshot-missing">Screenshot captured but not embeddable</div>`;
                }
                return `<div class="shot-wrap"><div class="shot-label">${escapeHtml(artifact.name)}</div><img class="shot" src="${dataUri}" alt="${escapeHtml(artifact.name)}" /></div>`;
              })
              .join('')
          : '-';

        const artifacts = entry.artifacts.length
          ? `<ul>${entry.artifacts
              .map((artifact) => `<li>${escapeHtml(artifact.name)} (${escapeHtml(artifact.contentType || 'file')})<br>${escapeHtml(artifact.path)}</li>`)
              .join('')}</ul>`
          : '-';

        return `
          <tr>
            <td>${escapeHtml(entry.id)}</td>
            <td>${escapeHtml(entry.testName)}</td>
            <td>${escapeHtml(entry.status)}</td>
            <td>${escapeHtml(entry.startedAt)}</td>
            <td>${escapeHtml(entry.endedAt)}</td>
            <td>${entry.durationMs} ms</td>
            <td><pre>${escapeHtml(entry.errorMessage || '-')}</pre></td>
            <td>${screenshots}</td>
            <td>${artifacts}</td>
          </tr>`;
      })
      .join('\n');

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>UI Automation Report</title>
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
    pre { white-space: pre-wrap; margin: 0; }
    ul { margin: 0; padding-left: 18px; }
    .shot-wrap { margin-bottom: 8px; }
    .shot-label { font-size: 12px; color: #4b5563; margin-bottom: 4px; }
    .shot { width: 220px; border: 1px solid #d1d5db; border-radius: 6px; display: block; }
    .screenshot-missing { font-size: 12px; color: #b45309; }
  </style>
</head>
<body>
  <h1>UI Automation Test Report</h1>
  <p class="meta">Run Start: ${escapeHtml(this.runStartedAt)} | Run End: ${escapeHtml(runEndedAt)} | Timezone: ${escapeHtml(this.timezone)}</p>
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
        <th>Status</th>
        <th>Started At</th>
        <th>Ended At</th>
        <th>Duration</th>
        <th>Error</th>
        <th>Screenshot</th>
        <th>Artifacts</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;

    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
    fs.writeFileSync(htmlPath, html, 'utf8');
  }
}
