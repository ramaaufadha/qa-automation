# QA Assignment - API Testing (Reqres)

## Target Endpoint
- `GET https://reqres.in/api/users?page=2`

## Deliverables
- Manual API test cases (13 cases): `manual-test/API_Test_Cases_Reqres.csv`
- API automation tests (Node.js): `automation/api-test/run-reqres-api-tests.mjs`
- UI automation tests (Playwright + POM): `automation/ui-test/`

## Manual Coverage
The manual test suite includes:
- Functional scenarios
- Parameter validation (valid, invalid, missing, boundary)
- Response schema and field validation
- Data validation (email format, non-null fields, unique IDs)
- Status code checks
- Edge cases (large page, negative page, case-sensitive and noise params)
- Basic security checks (invalid/suspicious input types)
- Performance validation (response time SLA)

## Automation Coverage
Automated assertions include:
- Status code validation
- Response structure/schema validation
- Field type and non-null checks
- Email format and unique ID validation
- Response time SLA check (`< 2000ms`)
- Method validation (`PUT` negative test)
- Parameter behavior checks (invalid page, case-sensitive key, noise param)
- HTML/JSON reporting with test-level execution details (status code, response time, timestamp)
- Failure log capture per test case under `automation/reports/api/failures/`

## UI Automation Coverage (UI01-UI10)
- `UI01` valid login
- `UI02` filter by name (Z to A)
- `UI03` filter by price (low to high)
- `UI04` add single product to cart
- `UI05` add multiple products to cart
- `UI06` remove product from inventory
- `UI07` remove product from cart page
- `UI08` logout
- `UI09` negative login (invalid credentials)
- `UI10` negative login (empty credentials)

Framework details:
- Page Object Model (POM): reusable selectors and actions
- Explicit waits through Playwright `expect` assertions
- Exact error message validation for negative login cases
- URL and visibility validations for login/cart/inventory pages
- Button state validation (`Add to cart -> Remove -> Add to cart`)

Manual to automation mapping:
- `automation/ui-test/docs/UI01_UI10_Automation_Mapping.md`

## How to Run API Tests
1. Use Node.js 18+ (native `fetch`)
2. Configure environment values in `automation/.env`
   - Supported formats: `KEY=value` or `KEY : value`
   - Required: `REQRES_API_KEY`
   - Optional: `REQRES_BASE_URL`, `REQRES_SLA_MS`, `REPORT_TIMEZONE`
   - `REPORT_TIMEZONE` examples: `Asia/Jakarta` (default), `local`
3. Run:
   - `npm.cmd run test:api`
   - `npm.cmd run test:api:report` (alias)
   - `npm.cmd run api:report` (short alias)
4. (Optional) Open latest API HTML report:
   - `npm.cmd run api:report:open`

API report output:
- Latest HTML report: `automation/reports/api/api-report.html`
- Latest JSON report: `automation/reports/api/api-report.json`
- Failure logs (if any): `automation/reports/api/failures/<TEST_ID>-failure.log`
- On each rerun, old timestamped reports and old failure logs are auto-cleaned to avoid report spam.
- Timestamp format in report: `yyyy-mm-dd hh:mm:ss`

## How to Run UI Tests
1. Install dependencies:
   - `npm.cmd install`
2. Install Playwright browser:
   - `npx.cmd playwright install chromium`
3. Run UI suite:
   - `npm.cmd run test:ui`
4. (Optional) Run headed:
   - `npm.cmd run test:ui:headed`
5. (Optional) Open HTML report:
   - `npm.cmd run test:ui:report`
6. (Optional) Open custom UI timestamp report:
   - `npm.cmd run ui:report:open`

UI timestamp report output:
- `automation/reports/ui/ui-report.html`
- `automation/reports/ui/ui-report.json`
- Timestamp format in report: `yyyy-mm-dd hh:mm:ss`
- Screenshot evidence is embedded per test case (`UI01`-`UI10`) in `ui-report.html`

## Notes
- Reqres currently requires `x-api-key` for endpoint access.
- Without `REQRES_API_KEY`, authenticated scenarios are marked as skipped by design.
- Some environments may be blocked by Cloudflare challenge and will also be marked as skipped.
- Invalid query inputs are validated as safe behavior by ensuring no `5xx` response.
- For invalid inputs, API may return either sanitized `200` or `4xx` depending on provider behavior.
