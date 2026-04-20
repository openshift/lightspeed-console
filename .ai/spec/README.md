# OpenShift LightSpeed Console Plugin -- Specifications

These specs define the requirements, behaviors, and architecture for the OLS console plugin (lightspeed-console). They are organized into two layers:

- **[`what/`](what/README.md)** -- Behavioral rules: WHAT the plugin must do and WHY. Technology-neutral, testable assertions. Use these to understand requirements, fix bugs, or rebuild components.
- **[`how/`](how/README.md)** -- Architecture specs: HOW the current implementation is structured. Module boundaries, data flow, design patterns. Use these to navigate, modify, and extend the codebase.

## Scope

These specs cover the **lightspeed-console** TypeScript/React dynamic plugin only. The service (lightspeed-service), operator (lightspeed-operator), and RAG content pipeline (lightspeed-rag-content) are separate projects.

## Audience

AI agents (Claude). Specs optimize for precision, unambiguous rules, and machine-parseable structure.

## Quick Start

| I want to... | Read |
|--------------|------|
| Understand what this plugin does | `what/system-overview.md` |
| Fix a bug in chat or streaming | `what/chat.md` + `how/streaming.md` |
| Add a new attachment type | `what/attachments.md` + `how/components.md` |
| Understand tool approval UI | `what/tools.md` |
| Understand the plugin API | `what/plugin-api.md` |
| Navigate the codebase | `how/project-structure.md` |
| Understand state management | `how/state-management.md` |
| See what's planned | Look for `[PLANNED: OLS-XXXX]` in `what/` specs |

## Conventions

- `[PLANNED: OLS-XXXX]` markers in `what/` specs indicate existing rules about to change due to open Jira work
- "Planned Changes" sections list new capabilities not yet in code
- Internal constants are stated as behavioral rules without numeric values; `how/` specs may include specific values
- User-configurable values are referenced by their user settings key path
