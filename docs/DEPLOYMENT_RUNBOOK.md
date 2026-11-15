# AdaptiveAI v3 — Production Deployment & Security Runbook

**Primary product:** https://adaptiveai-henna.vercel.app/  
**Repo:** https://github.com/kostasuser01gr/AdaptiveAI-Workspace  
**Feature branch:** feat/agent-studio-ultra-premium  
**Baseline main:** ae4582b7ad1d6c458d7033d9865ded3037ac1e81

## Current verified state

The existing Vercel project has **no environment variables configured**. Its original production deployment has not been overwritten during this feature implementation. The only visible Supabase project, smart-rental-station-room, was inactive and belongs to a different application; **no changes were made to it**.

New Agent Studio features and graph previews work without a backend. Cloud identity, persistent runs, cross-device workspace sync and AI responses require a dedicated database and environment configuration. The preview build is not proof of live cloud credentials.

## Components

| Layer | Implementation |
|---|---|
| UI shell | Original AdaptiveAI index.html with minimal compatibility edits |
| Premium Studio | modules/agent-studio.js + agent-studio.css |
| Graph state and previews | modules/agent-core.js |
| Safe model renderer | modules/safe-surface.js, modules/safe-surface.css |
| API contract validation | server/surface-contract.js |
| Identity / sessions | api/auth.js + server/backend.js |
| Cloud console | modules/cloud-console.js |
| Workspace sync | api/workspace.js |
| Persisted approval runs | api/run.js |
| AI generation | api/generate.js, authenticated and quota gated |
| Truthful runtime status | api/capabilities.js, modules/runtime-badge.js |
| Database schema | db/adaptiveai.sql |
| Test suites | tests/*.test.cjs + tests/e2e/studio.spec.cjs |

## Dedicated Supabase project

1. Select or create a dedicated **AdaptiveAI** Supabase project in the intended organization. Do not reuse the unrelated station project.
2. Open db/adaptiveai.sql in the SQL Editor. Review the full transaction before executing.
3. Apply it only to that dedicated project. It creates owner-scoped workspaces, user-owned preview runs, server-only AI quota rows, RLS policies, and a server-only quota RPC.
4. Confirm Data API exposure and policy behavior: authenticated users can see only their own rows, anonymous access is denied and cross-user writes fail.
5. Run the Supabase Security and Performance Advisors and address critical findings before activating customer data.
6. Enable email/password sign-in in Supabase Auth. Verify the correct email confirmation and allowed redirect origins.

The SQL file is **prepared but not applied** because a dedicated Supabase project is not available for this product.

## Configure Vercel (server-only)

Under adaptiveai → Settings → Environment Variables, set:

| Name | Required? | Notes |
|---|---|---|
| SUPABASE_URL | For cloud | HTTPS project URL |
| SUPABASE_PUBLISHABLE_KEY | For cloud | Public-scoped API key used server-side |
| SUPABASE_SERVICE_ROLE_KEY | For AI | Secret; server-side quota RPC ONLY |
| ANTHROPIC_API_KEY | Optional | Secret; enables verified AI calls |
| ANTHROPIC_MODEL | Optional | Defaults to configured model identifier |

Never commit or print secrets, and never move service-role credentials into the client bundle or browser storage. Review variable scopes for Preview and Production independently.

## Auth and data integrity

- Browser sign-in and sign-up use Supabase Auth through the same-origin Vercel API.
- Access/refresh tokens are set only in Secure, HttpOnly, SameSite=Strict cookies. Refresh scope is limited to /api/auth.
- All state-changing APIs require a matching Origin, JSON POST, and bounded request sizes.
- Authenticated API access verifies the session against the identity provider. It never trusts a client-supplied owner ID.
- User data calls use the user-scoped publishable client authorization and Row Level Security.
- Cloud save and restore are explicit, not silent overwrites.
- Native browser-local data continues working without network services.

## AI privacy and cost safeguards

- Provider calls are **disabled** if Supabase authentication, service-role quota verification or Anthropic credentials are missing.
- The server verifies a real user and atomically claims a quota (15 calls per UTC day, at least 12 seconds apart) before creating a billable request.
- The model returns declarative JSON only. The schema validator limits fields, lengths, rows, and widget types.
- Rendering uses inert DOM text nodes, never model-generated HTML.
- Source indicators say AI DRAFT / UNVERIFIED. Fake telemetry in the old static showcase is explicitly labeled DEMO or SIMULATED.
- The application-level quota does not imply zero cloud cost; actual provider usage depends on account plans and traffic.

## Server-side workflows

- Save a valid Agent Studio workflow to cloud while authenticated.
- Start it from Cloud Sync. The server fetches the workflow from the authenticated user's own row.
- The run graph is validated, assigned an idempotency key and stored with the current status.
- Approval/rejection is server-recorded with optimistic status matching, preventing duplicate updates.
- This is a real **persistent preview/control plane**, not execution of live fleet tools. No autonomous external action, email send, reservation write, or real GPS lookup is triggered.

## Validation gates

From repository root:

    node --check modules/agent-core.js
    node --check modules/agent-studio.js
    node --check modules/safe-surface.js
    node --check modules/cloud-console.js
    for file in api/*.js server/*.js; do node --check "$file"; done
    node --test tests/*.test.cjs

GitHub Actions additionally runs pinned Chromium Playwright regression tests on a static server, checking the legacy shell, Agent Studio navigation, local graph workflow, human approval, persistence after reload, XSS-safe rendering, the cloud unconfigured state, and mobile keyboard shortcut.

Before any production release, verify CI success at the exact merge commit, preview READY status, no unexpected runtime errors, and true per-user data isolation when cloud authentication is enabled.

## Explicit remaining enterprise gates

1. Provision an isolated database, configure credentials, and test live authentication and sync.
2. Implement real OAuth adapters for Microsoft, Google, fleet operations and approved service providers.
3. Provision a durable background jobs/queue runtime, real agents, retries, cancellation and side-effect audit.
4. Add multi-user organizations, policy-based permissions, invitation management and tenant-specific data segregation.
5. Remove remaining legacy inline scripts and handlers in a staged CSP refactor; validate all inherited surfaces.
6. Run external penetration testing and security review before processing sensitive business data.

## Rollback

Keep pre-change production deployment mapped to the original domain until all release checks pass. The new modules can be disabled by removing their script/style includes from index.html and redeploying. Reverting the feature PR restores the original interface. Database migrations, once applied, must be managed separately rather than dropping user data.

**Status definitions**: CI pass = tested code paths; Vercel READY = build completed; local demo = browser-level preview; cloud configured = requires verified project and API credentials; production ready = all security, data and integration gates satisfied.
