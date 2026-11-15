# AdaptiveAI Workspace — Generative UI Command Center

> Multi-model AI command center with generative UI — dynamic interface generation, model routing, and conversational workspace.

## Features

- Generative UI: panels generated on-demand by the AI layer
- Multi-model router: switch between providers and models
- Command center: unified input for queries, tasks, and workflow triggers
- Persistent conversation threads with memory and branching
- Extensible tool palette: code, search, analysis

## Tech

Single-file HTML — zero dependencies, zero build step.

## Author

**Konstantinos Foskolakis** — Full-stack engineer, Heraklion Crete  
[github.com/kostasuser01gr](https://github.com/kostasuser01gr)

## Agent Studio (GenOS-inspired, separate feature branch)

The **Agent Studio** integrates into the original AdaptiveAI command center without replacing its shell. Open it from the **Enterprise → Agent Studio** sidebar entry, or use **Ctrl/Cmd + Shift + G**.

The new studio includes agent-role configuration, editable DAG workflows, a dependency graph, approval-gated dry runs, scoped local notes, a tool registry, configuration export and a local audit trail.

**Execution boundary:** This is a browser-local workflow planning and validation environment, **not** a cloud agent runner. The connectors are not authenticated or live. Workflow previews do not perform remote operations. Do not store credentials or sensitive customer data in local notes.

### Developer validation

```bash
node --check modules/agent-core.js
node --check modules/agent-studio.js
node --test tests/agent-core.test.cjs
```

See [Ultra-Premium Architecture & Roadmap](docs/ARCHITECTURE_ULTRA_PREMIUM.md) for the verified baseline, design direction, P0 security issues and future integration plan.

---

*AdaptiveAI remains the primary product. Real agent backends and external connections are future phases.*
