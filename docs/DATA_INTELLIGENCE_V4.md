# AdaptiveAI v4 — Data Intelligence Platform

## Architecture decision

**AdaptiveAI Workspace remains the canonical application and UI.** This release adds a strictly modular, browser-local **Data Intelligence Studio** and preserves the existing generative command center, Agent Studio, cloud authentication boundaries and all previous UI interactions.

### Data flow

```text
CSV / TSV / delimited text (≤2 MB)
  -> deterministic parser -> validated rows + import diagnostics
  -> browser IndexedDB dataset library (no external upload)
  -> column profile / completeness / sensitive-header heuristics
  -> search + paginate / grouping + aggregate / CSV + JSON export
  -> safe declarative surface -> original AdaptiveAI workspace tab
```

The generated dashboard is **not an AI hallucination**. All numerical values derive from the imported rows; source provenance is labeled `LOCAL DATA · USER-PROVIDED · UNVERIFIED`. The data is not independently verified against external fleet systems.

### Shipped modules

| Module | Contract |
| --- | --- |
| `modules/data-core.js` | Pure CSV parser, numeric locale rules, data profiler, grouping/aggregations, safe CSV export |
| `modules/data-studio.js` | Browser interactions, import, IndexedDB, data exploration and real-data dashboard generation |
| `modules/data-studio.css` | Isolated responsive premium presentation with reduced-motion support |
| `modules/safe-surface.js` | Existing safe renderer, provenance-aware `user_dataset` mode |
| `tests/data-core.test.cjs` | Import, validation, aggregation and export security regressions |
| `tests/e2e/data-studio.spec.cjs` | Chromium end-to-end verification of navigation, browser data, analytics and XSS inertness |

### Feature detail

- Upload via file picker, paste and drag/drop.
- Inputs: CSV, TSV, semicolon- or pipe-delimited text; quoted fields including embedded line breaks, escaped quotes and UTF-8 BOM.
- Limit: at most 2 MiB input characters, 5,000 records, 32 columns and 800 characters per cell.
- Malformed rows with unequal column count are *rejected and reported*, not silently accepted.
- Duplicate/empty headers and malformed quoting are rejected.
- Profile: missing and filled cells, distinct values, numeric column likelihood, min/max, completeness and regex-based potential personal-data column labels.
- Analytics: deterministic group-by with `count`, `sum`, `avg`, `median`, `min`, `max` and text filtering; explicit `eu` / `us` number parsing.
- Explorer: filter by any column, 40-row pagination, CSV and JSON exports.
- Dashboard action: injects a real-data metric/table/chart surface using the existing DOM-only safe renderer; no HTML from user input is executed.
- CSV exports prefix suspicious formula-leading cells to reduce spreadsheet formula interpretation; JSON export preserves source cells.

## Boundaries and privacy

- Datasets are stored in this browser's **IndexedDB** and are not synchronized to Supabase or shared between users/devices.
- IndexedDB is **not encrypted by this feature**. Device and browser profile security still apply. Do not import confidential customer records into an unmanaged or shared browser.
- If IndexedDB is blocked, the UI explicitly marks the in-memory fallback as nonpersistent.
- There are **no network requests** in Data Studio itself. Only the rest of the existing app may communicate with its existing endpoints.
- The privacy classification is a heuristic based on header names. It cannot guarantee that a dataset is free of personal information.
- The dataset provenance label `USER-PROVIDED · UNVERIFIED` must never be upgraded to `LIVE` without an authenticated, provenance-checked provider.

## Quality gates

```bash
node --check modules/data-core.js
node --check modules/data-studio.js
node --test tests/*.test.cjs
npx playwright test --config=playwright.config.cjs
```

All browser test runs require the base shell, Agent Studio and Data Intelligence suite to pass. Run a preview deployment and verify resource loading before merging.

## The enterprise backlog (not shipped by v4)

- Dedicated Supabase project setup, approved database schema and tested user separation.
- Production OAuth connectors for Google and Microsoft and a permitted, auditable fleet data adapter.
- Server-side durable agents, queues and persistent jobs with idempotent, approval-gated effects.
- Cloud-hosted, access-controlled dataset ingestion with encryption, retention, data deletion and provenance.
- Workspace teams/roles, policy evaluation and secure sharing.
- Content Security Policy migration, security tests under real authenticated sessions, performance budgets for large datasets.
- Zero-config AI provider availability is **not** possible without provider credentials/quotas. Do not make such claims.

## Rollback

Remove the three new data asset references from `index.html` and roll back the provenance-specific renderer label if necessary. No database migrations or external service mutations were made by this branch. Local datasets remain in the browser until the user deletes them using its application/browser controls.
