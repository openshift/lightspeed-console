# Behavioral Specifications (what/)

These specs define WHAT the OLS console plugin must do -- testable behavioral rules, configuration surface, constraints, and planned changes. They are technology-neutral where possible and survive a complete rewrite in a different framework.

## Spec Index

| Spec | Description |
|------|-------------|
| [system-overview.md](system-overview.md) | Plugin identity, scope, system boundaries, deployment model, relationship to OLS service |
| [chat.md](chat.md) | Chat lifecycle, query submission, streaming responses, query modes, conversation management, first-time UX |
| [attachments.md](attachments.md) | All attachment types (YAML, filtered YAML, events, logs, alerts, file upload, ManagedCluster), context detection, editing |
| [tools.md](tools.md) | Tool call display, human-in-the-loop approval workflow, MCP App interactive UI, OLS tool UI extensions |
| [feedback.md](feedback.md) | User feedback (thumbs up/down, free-text), feedback enabled/disabled, privacy notice |
| [auth.md](auth.md) | Authorization check flow, auth status handling, bearer token forwarding |
| [plugin-api.md](plugin-api.md) | Console extension points, useOpenOLS public API, ols.tool-ui extension type, user settings |

## How to Use These Specs

- **Fixing a bug**: Read the relevant spec to understand correct behavior, then compare against the code.
- **Adding a feature**: Check if the spec covers the requirement. Update the spec before implementing.
- **Refactoring**: Use the specs as acceptance criteria. The implementation can change freely as long as it meets the behavioral rules.
- **Understanding planned work**: Look for `[PLANNED: OLS-XXXX]` markers inline and "Planned Changes" sections.

## Relationship to how/ Specs

These `what/` specs define the behavioral contract. The [`how/` specs](../how/README.md) describe the current implementation architecture. Read `what/` to understand requirements, read `how/` to understand the codebase structure.
