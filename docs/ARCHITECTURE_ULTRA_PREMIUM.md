# AdaptiveAI Workspace — Architecture / Design / Features / Ultra-Premium Evolution

**Canonical product:** AdaptiveAI Workspace — `kostasuser01gr/AdaptiveAI-Workspace`  
**Canonical baseline:** `main@ae4582b7ad1d6c458d7033d9865ded3037ac1e81`  
**Reference:** GenOS v2 deployed at `genos-v2.vercel.app`  
**Integration stance:** AdaptiveAI owns the shell, routing and product identity. GenOS supplies product concepts only.

## 1. Verified baseline (2026-11-15)

- Production deployment `adaptiveai-henna.vercel.app` reported READY at the baseline SHA.
- Frontend consists of ~610 KB / 11,965 lines of HTML, CSS and browser JS inside `index.html`.
- Existing capabilities include prompt-driven generative surfaces, command palette, fleet dashboards, reports, tabs, saved state, simulations, agent cards, approvals UI and notification panels.
- `api/generate.js` optionally sends the user's query to Anthropic and requests JSON containing HTML. If its key is missing, the route falls back to templates.
- The baseline contains synthetic fleet/customer metrics, simulated WebSocket telemetry and toast-only action handlers. Do not call these live business operations.
- The Vercel source of GenOS v2 exposes a basic HTML loader/thumbnail rather than a verifiable working agent application. Its README *describes* agent dashboard, conversation, dependency graph, memory browser and tool registry. These descriptions are a feature brief, not runtime proof.

## 2. Operating principles

1. **Preserve** existing AdaptiveAI shell, command flow, core styles, route handlers and live deployment.
2. **Isolate** new functionality under `modules/`, rather than adding another large inline script to `index.html`.
3. **Tell the truth**: local simulation is clearly marked. Runtime, persistent server memory and external tool integrations require actual backend services.
4. **Approval first**: never trigger external state changes without validated scopes, approval and auditable results.
5. **Composable UX**: maintain one familiar sidebar and one canvas/tabs framework; avoid introducing another competing application inside the application.
6. **Accessible by default**: focus states, ARIA labels, readable contrast, reduced motion, mobile layout.

## 3. Delivered in this branch: Agent Studio v1

| Feature | Implementation | Runtime guarantee |
|---|---|---|
| Agent configuration | Four configurable roles in Agent Studio | Local roles, not spawned processes |
| Workflow builder | Add/remove nodes, assign roles, connect dependencies | Graph is locally editable |
| DAG validation | Duplicate, missing dependency and cycle checks; topological ordering | Deterministic core validation |
| Graph visualization | SVG graph of nodes and dependency edges | Real representation of saved graph |
| Approval gates | Dry-run pauses for human decision; approve/reject branches | Never calls external APIs |
| Memory vault | Scoped notes, search, update, delete, browser storage | Device/browser local only |
| Tool registry | Permission-intent toggles and explicit connection status | No connectors are live |
| Audit trail | Local change log, timestamps and clear action | Not a tamper-proof server audit |
| Export | JSON export of local configuration | Browser file download |
| UX integration | Sidebar navigation + Ctrl/Cmd+Shift+G | No replacement of core shell |
| Automated validation | Node native test suite for core engine | Static/unit confidence, not browser E2E |

Files:
```text
index.html                     # existing product; small script/style mount
modules/agent-core.js          # pure deterministic graph + preview engine
modules/agent-studio.js        # UI and state controller, no user HTML injection
modules/agent-studio.css       # isolated visual system
tests/agent-core.test.cjs      # no third-party test dependencies
.github/workflows/...         # CI syntax + unit checks
```

The startup sample workflow is an example of what the UI can preview, not evidence of actual fleet status.

## 4. High-end product vision

### A. Command Center 3.0
- One universal command surface with structured intent routing, optional provider selection and typed tool outcomes.
- Action ledger: what was requested, what was proposed, what was approved, what actually succeeded.
- Canvas layouts: split-pane chat + surface, full focus, comparison, workspace tabs and bookmarkable views.
- Mobile progressive disclosure; persistent desktop command bar; high-density operations view.
- Trust labels on every widget: `LIVE`, `STALE`, `SIMULATED`, `USER INPUT` or `AI GENERATED`.

### B. GenOS-grade agent runtime — future backend phase
- Server-managed agent identities; explicit capabilities, scopes and tool budgets.
- Durable orchestration: queues, idempotency keys, retries with bounded backoff, dead-letter failures and cancellation.
- Human approvals for all mutating actions. Do not equate a client-side toggle with authorization.
- Event-sourced runs and correlation IDs; reproducible inputs, model versions and tool-result provenance.
- Native agent conversation with traceable tool calls; no fabricated "running" states.
- Workflow DSL with typed nodes (`trigger`, `transform`, `condition`, `approval`, `action`, `join`, `report`) and strict graph validation.
- Versioned graphs, dry-run/preview diff, rollback, execution policies and reusable workflow templates.

### C. Memory & knowledge — future backend phase
- Distinguish short-lived chat state, working memory, user-approved saved facts, document knowledge and agent execution history.
- Tenant-isolated, encrypted storage with TTLs, deletion, export and consent/provenance metadata.
- Hybrid keyword/vector retrieval only for authorized documents; prompt-injection boundaries on retrieved content.
- Versioned memory edits, relevance scores, conflicting-fact resolution and retention policy.

### D. Integration fabric — future backend phase
- Adapter registry for Google/Microsoft tools, fleet systems, mail, sheets and developer providers.
- Only use OAuth or sanctioned API permissions. Never reuse browser sessions to bypass SSO.
- Provider health checks, quotas, spend limits, rate limits and circuit breakers.
- Per-tool capability policies and explicit user approval before writes.
- Connector secrets in server-side secret stores; never browser localStorage or client bundles.

### E. Security and operational maturity
- **P0** `api/generate.js` returns model-generated HTML; the current browser renderer assigns it directly through `innerHTML`. Replace with a strict, validated declarative widget schema, or sanitize output with a proven allowlist while migrating.
- **P0** The Anthropic route uses wildcard CORS and currently has no authentication or durable rate limiter. Before enabling paid model calls to public users, add identity/session authorization, provider quotas and robust abuse protection.
- **P0** Separate the simulated connection pill/status bar/agent states from measured network data.
- **P1** CSP rollout needs a planned refactor: the current monolith uses inline scripts/styles and inline event handlers.
- **P1** Introduce request and response schema validation, systematic error reporting, structured audit events and a real accessibility test suite.
- **P2** Break the monolith into feature modules, keeping a compatibility bridge until tests cover existing navigation and surfaces.
- **P2** Replace third-party CDN assets with pinned, integrity-verified or locally bundled dependencies.

## 5. Design system direction

Use the existing AdaptiveAI charcoal/orange identity, not GenOS's placeholder screen.

| Token | Direction |
|---|---|
| App backdrop | Near-black `#050505` |
| Elevated surface | Glassy dark graphite |
| Primary accent | Inherited `--accent` (default amber/orange) |
| Informational | Muted blue |
| Approvals | Warm yellow/orange; never confused with success |
| Success | Subtle green, for confirmed outcomes only |
| Typography | Existing Inter + JetBrains Mono |
| Surface radius | 12–16px |
| Motion | 120–220ms purposeful transitions; reduced-motion fallback |
| Layout | 12-column responsive grid with progressive density |

Do not layer multiple nav systems. Create a focused intelligence workspace within the existing shell and retain direct access to all existing surfaces.

## 6. Delivery phases and acceptance gates

| Phase | Scope | Acceptance criteria |
|---|---|---|
| P0 — truth & security | Accurate simulation/live labels; safe HTML model and API controls | No untrusted executable markup, no unauthenticated billable usage |
| P1 — Agent Studio | This branch's new local workflows and control plane | Cycle detection, approval blocking, navigation, local persistence and tests |
| P2 — modular architecture | Extract shell, state, renderer, router and feature boundaries | Existing saved views/tabs/routes survive; browser E2E passes |
| P3 — real multi-agent engine | Backend storage, auth, job orchestration and tools | Authenticated runs + permissions + traces + idempotency |
| P4 — intelligence & enterprise | Versioned knowledge, forecasting, shared workspaces, audit | Tenant isolation, reliable measurement, export/deletion, UX metrics |

## 7. Mutation safety and rollout

- Work only on `feat/agent-studio-ultra-premium`; open PR against `main`.
- Do not auto-merge or alter the production Vercel project in this change.
- Core module is additive; deleting the three module asset references from `index.html` immediately removes the feature without changing the original app logic.
- CI checks JavaScript syntax and pure engine regressions.
- Follow with browser E2E of initial load, sidebar, command palette, all legacy tabs, mobile navigation, agent storage and download.
- Monitor API security and costs separately; no claim of fully production-grade agent execution from this frontend-only phase.

## 8. Risks and technical debt

- Existing monolithic scripts may contain conflicting event listeners, delayed wrappers or state mutation paths. Avoid rewriting without baseline browser regression evidence.
- Browser-local notes are not cross-device, encrypted at rest or access-controlled. Keep non-sensitive configuration only.
- A local preview intentionally never sends notifications, reads live fleet records or calls cloud AI.
- Large graph layouts need scale/pan/minimap enhancements if workflows exceed dozens of steps.
- A successful Vercel build means the files shipped, **not** that all interactions are verified.

## 9. Validation commands

```bash
node --check modules/agent-core.js
node --check modules/agent-studio.js
node --test tests/agent-core.test.cjs
```
