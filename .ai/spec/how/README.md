# Architecture Specifications (how/)

These specs describe HOW the OLS console plugin is structured -- module boundaries, data flow, design patterns, key abstractions, and implementation decisions. They are grounded in the current TypeScript/React codebase and should be updated when the code changes.

## Spec Index

| Spec | Description |
|------|-------------|
| [project-structure.md](project-structure.md) | Directory layout, module responsibilities, build system, dependencies, dev setup, testing |
| [state-management.md](state-management.md) | Redux store shape, Immutable.js usage, actions, reducer, selectors |
| [streaming.md](streaming.md) | SSE stream processing, event types, buffering, throttled dispatch, abort handling |
| [components.md](components.md) | Component tree, Popover/GeneralPage/Prompt hierarchy, PatternFly Chatbot integration |

## When to Read These

- **Navigating the codebase**: Start with `project-structure.md` to understand where things live.
- **Modifying a subsystem**: Read the relevant `how/` spec to understand the current architecture before making changes.
- **Adding a new attachment type or tool UI**: The `components.md` spec includes extension points.
- **Debugging streaming issues**: The `streaming.md` spec traces the exact event processing path.

## Relationship to what/ Specs

The [`what/` specs](../what/README.md) define behavioral contracts (technology-neutral). These `how/` specs describe the implementation that fulfills those contracts. When the two diverge, the `what/` spec is the source of truth for correct behavior, and the `how/` spec should be updated to reflect the current code.
