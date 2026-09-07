# Spec health report

Last evaluated: 2026-08-31
Trigger: post-milestone: spec-drift alignment sweep
Layout: software (.ai/spec/)

## Stale

Fixed in this pass:

- **`what/system-overview.md` rule 13** — readiness was described as the
  `/readyz` endpoint returning a non-2xx status. Actual code
  (`src/components/ReadinessAlert.tsx`) polls `/readiness` via
  `consoleFetchJSON` and checks a JSON `{ ready: boolean }` body, re-polling
  every 10s until ready. Endpoint name and mechanism corrected.

- **`what/chat.md` rule 8 event table** — listed `reasoning` and
  `skill_selected` events as "consumed with no-op handling — payload is never
  rendered, logged, or passed to `console.warn`." No handler for these events
  exists anywhere in `src/` (never has, per `git log -S`); they fall through to
  the default `console.warn` branch in `Prompt.tsx`. Rows removed; added a note
  that any unlisted event is treated as unrecognized and warned.

- **`what/tools.md` Planned Changes** — OLS-1556 (tool display), OLS-2598 (MCP
  Apps), OLS-2722 (OLS Tool UI extensibility) are all shipped and documented as
  current behavior (rules 1-7, 15-27; code: `ResponseTools.tsx`, `MCPApp.tsx`,
  `OlsToolUIs.tsx`, `useToolUIMapping.ts`, `ols.tool-ui` extension). Removed
  from planned.

- **`what/system-overview.md` Planned Changes** — removed OLS-2598 and
  OLS-2722 (shipped, see above) and OLS-2816 / OLS-2826 (shipped:
  `useOpenOLS` implements `submitImmediately` + `hidePrompt`; chat.md rules 28
  and 29 document them as current).

- **`what/attachments.md` Planned Changes** — removed OLS-2116 (ManagedCluster
  "Attach cluster info" + ManagedClusterInfo fetch shipped in `Prompt.tsx`;
  rule 13 documents it) and OLS-1896 (ACM Application/ApplicationSet detection
  shipped in `useLocationContext.ts`; rule 1 documents it).

- **`how/streaming.md` module map** — attributed the `QUERY_ENDPOINT` constant
  to `src/config.ts`. It is actually defined in `src/components/Prompt.tsx`
  (`getApiUrl('/v1/streaming_query')`); `config.ts` only provides `getApiUrl`.
  Corrected.

- **`how/components.md` module map** — listed a `Modal.tsx` "reusable modal
  wrapper" that does not exist. Replaced with the actual generic dialog,
  `ConfirmationModal.tsx` (used by `ImportAction.tsx`).

## Missing

Fixed in this pass:

- **`how/project-structure.md` Plugin -> OLS Service table** — the `/readiness`
  endpoint (polled by `ReadinessAlert`) was absent. Added a `GET /readiness`
  row.

## Structural concerns

None. what/ vs how/ separation is clean; no behavioral rules leaked into how/
files and vice versa.

## Findability issues

None. README quick-start, cross-reference, and what//how/ index tables list
every spec file that exists (7 what/, 4 how/). The `decisions/` ADR directory
is self-describing.

## No issues (verified current)

- `what/plugin-api.md` — console-extensions.json matches (5 extensions: flag,
  context-provider, dashboards detail, redux-reducer, action/provider);
  `useOpenOLS` signature matches rule 5.
- `how/state-management.md` — 27 actions in the `ActionType` enum match the
  "27 actions" claim; state shape and action table match `redux-reducers.ts`.
- `how/streaming.md` event dispatch — matches the `Prompt.tsx` event chain
  (start, token, end, tool_call, approval_required, tool_result,
  history_compression_start/end, error, default warn) including the
  `tool_meta.ui.resourceUri` / `tool_meta.olsUi.id` extraction.
- API endpoint constants across `config.ts` consumers verified against code.
- Still-accurate PLANNED items left untouched: OLS-2743 (rebrand), OLS-2700
  (agent mode), OLS-2608 / OLS-2609 (PromQL embeds), OLS-2065 (ACM policy
  violations), OLS-2284 (cluster info on Nodes/Add-ons tabs) — none of these
  are present in the code.

## Deliberately NOT changed

- `how/components.md` module map is a curated subset of the component tree
  (chat/tool/attachment focus). Utility components like `ReadinessAlert`,
  `WelcomeNotice`, `CopyAction`, `OverviewDetail`, etc. are intentionally
  omitted there and fully listed in `how/project-structure.md`. Not drift.
- `what/tools.md` rule 15 phrasing ("uiResourceUri and serverName in its
  `tool_meta`") — `serverName` actually comes from the top-level `server_name`
  field, not `tool_meta`. This is a how/ detail already documented correctly in
  `streaming.md`; the behavioral intent (both must be present) holds, so the
  what/ rule was left as-is to avoid leaking implementation detail.
