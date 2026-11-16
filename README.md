# AdaptiveAI Workspace v5 — Generative Operations & Agent Studio

A premium generative-UI command center for fleet and operational workspaces. AdaptiveAI is the **primary product**. GenOS v2 concepts have been integrated as a separate, modular Agent Studio rather than replacing the original AdaptiveAI application.

## Current capabilities

- Original AdaptiveAI command shell: workspace tabs, on-demand demo surfaces, command palette, fleet/map/analytics examples, reports and local history.
- Ultra-premium **Agent Studio**: agent roles, editable workflow graphs, dependency validation, human approval gates, simulation previews and local audit history.
- Scoped **Memory Vault**: local notes, search, editing, deletion and configuration export.
- **Tool Registry** with honest connected/offline status; no false tool-execution claims.
- **Cloud Sync Console**: email/password authentication, save/restore workspace and persisted server-side workflow previews when a dedicated Supabase project is configured.
- **Safe generative UI**: AI response contract supports metrics, tables, percentage bars and explanatory insights, rendered through inert DOM nodes, never raw model HTML.
- **Authenticated AI**: requires identity verification, atomic quota checking and an optional provider key; otherwise defaults to a functioning demo without provider calls.
- **Truthful status**: synthetic fleet KPIs and WebSocket demonstrations are explicitly marked SIMULATED/DEMO, with no fabricated uptime or latency claims.

## Architecture

Existing 600 KB+ static index.html remains the shell. New functionality is isolated in modules/, server/, api/, db/ and tests/.

| Component | Description |
|---|---|
| modules/agent-core.js | Pure DAG validation, preview planning and approval state machine |
| modules/agent-studio.js | Six Agent Studio screens including Cloud Sync |
| modules/safe-surface.js | DOM-only declarative generative UI renderer |
| modules/cloud-console.js | Browser auth/sync and persisted preview controls |
| server/backend.js | Same-origin guard, verified sessions and RLS-aware provider requests |
| server/surface-contract.js | Output validation and deterministic size limits |
| api/auth.js | Authentication, refresh and session lifecycle |
| api/workspace.js | User-owned state sync |
| api/run.js | Persisted server-side previews and approval consistency |
| api/generate.js | Authenticated and quota-gated Anthropic surface generation |
| db/adaptiveai.sql | Prepared owner-scoped PostgreSQL schema (not yet installed) |

**No live connectors are configured.** The original fleet datasets are illustrative, not authoritative operations records. The Cloud Console requires a dedicated database. Real external-action agents, OAuth connectors, multi-tenant teams and durable job queues are future integrations.

## Data Intelligence v4 — user-owned, real-data dashboards

Open **Enterprise → Data Intelligence** or press **Ctrl/Cmd + Shift + D**.

- Import CSV/TSV via picker, drag/drop or paste; browser-only parsing with strict resource bounds and malformed-row diagnostics.
- IndexedDB dataset library, column profiling, completeness, missing-value and potentially sensitive-column warnings.
- Grouped analysis: count, sum, average, median, min and max, with explicit EU/US number formats.
- Paged explorer, text filters, JSON exports and formula-hardened CSV downloads.
- **Dashboard** creates a genuine, dataset-derived surface in existing AdaptiveAI workspace tabs using the safe UI renderer, with **LOCAL DATA · USER-PROVIDED · UNVERIFIED** provenance.
- No uploaded content is sent to an external service or AI provider. Local IndexedDB is not encrypted or cross-device synchronized.

See [Data Intelligence v4 Architecture & Privacy](docs/DATA_INTELLIGENCE_V4.md). Node and Chromium tests run in CI.

## Workspace OS v5 — Ultra-Premium Command Deck

Open **Enterprise → Workspace OS** or press **Ctrl/Cmd + Shift + O**.

- A responsive, visually unified premium Workspace OS within the original AdaptiveAI navigation and tabs.
- Product-wide premium styling across the original dark-theme sidebar, tab strip, composer and launch experience; light theme behavior is preserved.
- Configurable boards, real editable tasks/notes/shortcuts, drag reordering, arrow controls, in-app module routing and local activity.
- Deterministic slash commands: /agents, /data, /cloud, /chat, /task NAME, /note NAME, /board NAME, /export.
- Bounded undo/redo, validated JSON import/export, comfortable/compact density and mobile interaction.
- True on-device module counts and cloud configuration state; no fabricated agent execution or live fleet metrics.
- Zero new npm dependencies and no billable AI calls for Workspace OS actions.

**Data is browser-local and not encrypted.** Avoid credentials and customer records in personal boards on shared devices.

See [Workspace OS v5 Architecture](docs/WORKSPACE_OS_V5.md).

## Try Agent Studio

Open **Enterprise → Agent Studio** in the sidebar or press **Ctrl/Cmd + Shift + G**.

The workflow editor, memory notes, export and local previews work without a cloud connection. With a configured backend and authenticated session, Cloud Sync can persist configuration and record server-validated preview runs; these are **not** live business-system mutations.

## Verify

Run from the repository root:

    node --check modules/agent-core.js
    node --check modules/agent-studio.js
    node --check modules/safe-surface.js
    node --check modules/cloud-console.js
    for file in api/*.js server/*.js; do node --check "$file"; done
    node --test tests/*.test.cjs

GitHub Actions additionally runs Chromium Playwright regression tests on a local static server.

## Release and security

- [Ultra-Premium Architecture & Roadmap](docs/ARCHITECTURE_ULTRA_PREMIUM.md)
- [Deployment, Auth and RLS Runbook](docs/DEPLOYMENT_RUNBOOK.md)
- The committed feature is delivered via a separate reviewable GitHub PR. Production release should follow CI + browser checks.
- No provider keys, database service credentials or customer records are committed to this repository.

## Maintainer

Konstantinos Foskolakis — Full-stack Engineer, Greece  
https://github.com/kostasuser01gr

---

**Product rule:** Prefer functional, verifiable capabilities over simulated "connected" labels. Local previews, cloud services and production integrations must always be distinguished explicitly.
