# OpenShift LightSpeed Console Plugin — Specifications

The OLS console plugin is an OpenShift Console dynamic plugin that provides an AI chat assistant UI. These specs define what the plugin must do (behavioral rules) and how the current implementation is structured (codebase navigation).

## Structure

| Layer | Path | Purpose |
|---|---|---|
| **what/** | `.ai/spec/what/` | Behavioral rules. What the system must do. Implementation-agnostic. |
| **how/** | `.ai/spec/how/` | Codebase navigation. How the code is organized. Implementation-specific. |

## Scope

These specs cover the **lightspeed-console** TypeScript/React dynamic plugin only. The service (lightspeed-service), operator (lightspeed-operator), and RAG content pipeline (lightspeed-rag-content) are separate projects.

## Audience

AI agents. Content is optimized for precision and machine consumption.

## Quick Start

| Task | Start here |
|---|---|
| Understand what this plugin does | `what/system-overview.md` |
| Fix a bug in chat or streaming | `what/chat.md` + `how/streaming.md` |
| Add a new attachment type | `what/attachments.md` + `how/components.md` |
| Understand tool approval UI | `what/tools.md` |
| Understand the plugin API | `what/plugin-api.md` |
| Navigate the codebase | `how/project-structure.md` |
| Understand state management | `how/state-management.md` |
| See what's planned | Look for `[PLANNED: OLS-XXXX]` in `what/` specs |

## What/ — Behavioral Specs

These specs define WHAT the plugin must do — testable behavioral rules, configuration surface, constraints, and planned changes. They are technology-neutral where possible and survive a complete rewrite in a different framework.

| Spec | Description |
|------|-------------|
| [system-overview.md](what/system-overview.md) | Plugin identity, scope, system boundaries, deployment model, relationship to OLS service |
| [chat.md](what/chat.md) | Chat lifecycle, query submission, streaming responses, query modes, conversation management, first-time UX |
| [attachments.md](what/attachments.md) | All attachment types (YAML, filtered YAML, events, logs, alerts, file upload, ManagedCluster), context detection, editing |
| [tools.md](what/tools.md) | Tool call display, human-in-the-loop approval workflow, MCP App interactive UI, OLS tool UI extensions |
| [feedback.md](what/feedback.md) | User feedback (thumbs up/down, free-text), feedback enabled/disabled, privacy notice |
| [auth.md](what/auth.md) | Authorization check flow, auth status handling, bearer token forwarding |
| [plugin-api.md](what/plugin-api.md) | Console extension points, useOpenOLS public API, ols.tool-ui extension type, user settings |

**How to use what/ specs:**
- **Fixing a bug**: Read the relevant spec to understand correct behavior, then compare against the code.
- **Adding a feature**: Check if the spec covers the requirement. Update the spec before implementing.
- **Refactoring**: Use the specs as acceptance criteria. The implementation can change freely as long as it meets the behavioral rules.

## How/ — Architecture Specs

These specs describe HOW the plugin is structured — module boundaries, data flow, design patterns, key abstractions, and implementation decisions. They are grounded in the current TypeScript/React codebase and should be updated when the code changes.

| Spec | Description |
|------|-------------|
| [project-structure.md](how/project-structure.md) | Directory layout, module responsibilities, build system, dependencies, dev setup, testing |
| [state-management.md](how/state-management.md) | Redux store shape, Immutable.js usage, actions, reducer, selectors |
| [streaming.md](how/streaming.md) | SSE stream processing, event types, buffering, throttled dispatch, abort handling |
| [components.md](how/components.md) | Component tree, Popover/GeneralPage/Prompt hierarchy, PatternFly Chatbot integration |

**When to read how/ specs:**
- **Navigating the codebase**: Start with `project-structure.md` to understand where things live.
- **Modifying a subsystem**: Read the relevant spec to understand the current architecture before making changes.
- **Debugging streaming issues**: The `streaming.md` spec traces the exact event processing path.

## Cross-Reference

| what/ | how/ |
|---|---|
| `what/system-overview.md` | `how/project-structure.md` |
| `what/chat.md` | `how/streaming.md`, `how/components.md` |
| `what/attachments.md` | `how/components.md` |
| `what/tools.md` | `how/components.md` |
| `what/feedback.md` | `how/state-management.md` |
| `what/auth.md` | `how/project-structure.md` |
| `what/plugin-api.md` | `how/project-structure.md`, `how/state-management.md` |

## Conventions

- **Rule numbering:** behavioral rules are numbered sequentially within each what/ file.
- **Planned changes:** unimplemented behavior is marked with `[PLANNED]` or `[PLANNED: OLS-XXXX]` inline next to the rule it affects.
- **Constraints:** component-specific and cross-cutting constraints go in the relevant what/ file's Constraints section, co-located with behavioral rules. Development conventions go in CLAUDE.md.
- **Authority:** what/ specs are authoritative for behavior. how/ specs are authoritative for implementation. When they conflict, what/ wins.
- **When to create a new file vs. extend an existing one:** if the new concern has its own lifecycle, configuration surface, and can be understood independently, it gets its own file. If it's a capability added to an existing component, it goes in that component's file.
