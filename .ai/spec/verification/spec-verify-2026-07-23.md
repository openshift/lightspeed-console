# Verification Report: lightspeed-console Spec
Verified: 2026-07-23
Spec root: /Users/xavi/street/github.com/AI/ols/lightspeed-console/.ai/spec/

## Summary
1 broken or inaccurate internal reference
2 internal inconsistencies
4 completeness gaps
3 cross-repo alignment issues

## Reference Issues

1. **`olsToolUiID` wire format mismatch.** `tools.md` rule 24 says the tool result "includes an `olsToolUiID` in its `tool_meta`" when the actual wire-format field is `tool_meta.olsUi.id`, and `olsToolUiID` is the plugin's internal property name after extraction. The streaming spec (`streaming.md:93`) confirms the actual path is `tool_meta?.olsUi?.id`. The what/ spec is inaccurate about the wire format.

## Internal Inconsistencies

1. **`olsToolUiID` naming inconsistency between `tools.md` and `plugin-api.md`.** `tools.md` rule 24 describes the field as `olsToolUiID` in `tool_meta`. `plugin-api.md` rule 9 says the extension `id` matches the `olsToolUiID` value. But `plugin-api.md` rule 11 says the match is against `tool_meta.olsUi.id`. These describe the same lookup but name the source field differently. The what/ specs should consistently distinguish the wire format path (`tool_meta.olsUi.id`) from the internal property name (`olsToolUiID`).

2. **Copy conversation format vs. rebrand.** `chat.md` rule 22 hard-codes the copy format as `You: ... / OpenShift Lightspeed: ...`. `system-overview.md` planned-change OLS-2743 flags a rebrand to "Red Hat OpenShift Intelligent Assistant." When OLS-2743 lands, `chat.md` rule 22 becomes incorrect unless both specs are updated together.

## Completeness Gaps

1. **No behavioral spec for `ReadinessAlert`.** The component tree shows `ReadinessAlert` rendered in the chat content area, and `project-structure.md` lists `ReadinessAlert.tsx` as "Alert shown when OLS service is not ready." No what/ spec describes when this alert appears, what triggers it, or what message it shows.

2. **No glossary.** Terms like "workload kinds," "composite key," "MCP App," "HITL" are used but not defined in a shared glossary. Some are defined inline; others are assumed knowledge.

3. **No decision records.** `decisions/README.md` exists but no ADRs have been written. The tool correlation workaround (name+args composite key, `tools.md` constraint 4) is a canonical example of a decision that warrants an ADR.

4. **`agent` mode not specified.** `system-overview.md` planned change OLS-2700 references "Allow users to choose agent mode (PF6 only)" but no spec describes what agent mode is, how it differs from ask/troubleshooting, or what UI changes it requires.

## Cross-Repo Alignment Issues

1. **Missing `reasoning` event handling.** Parent `query-pipeline.md` line 74 says "Reasoning events are already rendered by the console — no changes needed" and lists `reasoning` as a streaming event. However, `chat.md` rule 8 event table does not include `reasoning`, and `streaming.md` has no `reasoning` event dispatch case. Either the console handles it silently or the parent spec claim is incorrect.

2. **Missing `skill_selected` event handling.** Parent `query-pipeline.md` lists `skill_selected` as a streaming event. The console's `chat.md` rule 8 event table does not include `skill_selected`. There is no mention of `skill_selected` anywhere in the console spec. Needs explicit documentation of intentional non-rendering, or handling added.

3. **History sidebar claim.** Parent `query-pipeline.md` step 35 says "The conversation is added to the user's history sidebar." But `system-overview.md` constraint 3 says no persistent client-side storage, and constraint 6 says single conversation per session. No history sidebar exists in the console spec. The parent spec claim appears incorrect or aspirational.

## Files Checked

### what/
- system-overview.md — 22 rules, 6 constraints, 7 planned changes
- chat.md — 29 rules, 4 constraints
- attachments.md — 23 rules, 5 constraints, 4 planned changes
- tools.md — 27 rules, 4 constraints, 3 planned changes
- feedback.md — 14 rules, 3 constraints
- auth.md — 8 rules, 3 constraints
- plugin-api.md — 16 rules, 4 constraints

### how/
- components.md, project-structure.md, state-management.md, streaming.md

### Other
- decisions/README.md (no actual ADRs)
- README.md
- No constraints.md (distributed by design)
- No glossary.md

### Cross-repo
- /Users/xavi/street/github.com/AI/ols/.ai/spec/what/query-pipeline.md
