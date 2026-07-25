# Spec Verification Report: lightspeed-console

**Date:** 2026-07-24
**Verifier:** Independent spec verification agent
**Spec path:** `.ai/spec/what/`
**Files verified:** system-overview.md, chat.md, auth.md, feedback.md, attachments.md, plugin-api.md, tools.md

---

## Pass 1: Acceptance Criteria

No `- [ ]` acceptance criteria found in any what/ file. The specs use numbered behavioral rules, not checkbox-style criteria.

**Result: N/A (0 criteria to check)**

---

## Pass 2: Constraint Compliance

Shared constraints from `/Users/xavi/street/github.com/AI/ols/.ai/spec/constraints.md` checked against all 7 what/ files.

| # | Constraint | Result | Notes |
|---|---|---|---|
| 1 | Fork-based workflow | PASS | Process constraint; not in scope of behavioral specs |
| 2 | Commit messages start with OLS-XXXX | PASS | Process constraint; Planned Changes tables consistently use OLS-XXXX keys |
| 3 | Squash commits before pushing | PASS | Process constraint; not in scope of behavioral specs |
| 4 | Project key is OLS on redhat.atlassian.net | PASS | All Jira references use OLS-XXXX format |
| 5 | Classic OLS CRDs use ols.openshift.io/v1alpha1 | PASS | Not applicable (console plugin defines no CRDs) |
| 6 | Agentic OLS CRDs use agentic.openshift.io/v1alpha1 | PASS | Not applicable (console plugin defines no CRDs) |
| 7 | All components deploy into openshift-lightspeed namespace | PASS | Console plugin runs inside the console, not as a separate deployment; no conflicting namespace mentioned |
| 8 | Embedding model for RAG must match build and query time | PASS | Not applicable (console plugin has no RAG) |

**Result: 0 violations**

---

## Pass 3: Term Consistency

Skipped (no glossary file exists).

---

## Pass 4: Internal Reference Accuracy

### Cross-references found in what/ files

| Source | Reference | Target exists? | Content correct? | Result |
|---|---|---|---|---|
| system-overview.md:90 | "see chat.md rule 6" | Yes | chat.md rule 6 defines `mode` field as `ask` or `troubleshooting` -- matches the claim | PASS |
| system-overview.md:93 | "rules 14-15" (self-reference) | Yes | Rules 14-15 in system-overview.md define query modes and troubleshooting label | PASS |

### Cross-references in README.md

| Reference | Exists? | Result |
|---|---|---|
| what/system-overview.md | Yes | PASS |
| what/chat.md | Yes | PASS |
| what/attachments.md | Yes | PASS |
| what/tools.md | Yes | PASS |
| what/feedback.md | Yes | PASS |
| what/auth.md | Yes | PASS |
| what/plugin-api.md | Yes | PASS |
| how/project-structure.md | Yes | PASS |
| how/state-management.md | Yes | PASS |
| how/streaming.md | Yes | PASS |
| how/components.md | Yes | PASS |

### Cross-reference table (README.md) content accuracy

| what/ file | Claimed how/ mapping | Mapping makes sense? | Result |
|---|---|---|---|
| system-overview.md | project-structure.md | Yes -- system overview maps to project structure | PASS |
| chat.md | streaming.md, components.md | Yes -- chat behavior maps to streaming impl and component tree | PASS |
| attachments.md | components.md | Yes -- attachment behavior maps to attachment components | PASS |
| tools.md | components.md | Yes -- tool behavior maps to ResponseTools/MCPApp/ToolApproval components | PASS |
| feedback.md | state-management.md | Yes -- feedback state is per-entry in Redux, documented in state-management.md | PASS |
| auth.md | project-structure.md | Yes -- auth hook documented in project-structure.md hooks section | PASS |
| plugin-api.md | project-structure.md, state-management.md | Yes -- extensions in project-structure.md, Redux scope in state-management.md | PASS |

**Result: 0 reference issues**

---

## Additional Findings: Internal Spec Consistency

### FINDING 1: Proxy-only constraint contradicts development mode description

**Severity:** Low (wording inconsistency, not a behavioral bug)

**system-overview.md Constraint 2** (line 154-155):
> "Proxy-only API access. All OLS API communication goes through the console's plugin proxy. The plugin never connects directly to the OLS service."

**system-overview.md Configuration table** (line 147):
> "OLS_API_BEARER_TOKEN | Bearer token for direct API access (bypasses console proxy auth)"

**auth.md rule 7** (line 45-47):
> "For development without the console proxy, the plugin supports injecting a bearer token via the `OLS_API_BEARER_TOKEN` environment variable."

The constraint uses absolute language ("never connects directly") but the same file and auth.md acknowledge a development mode that operates "without the console proxy." The constraint should either be qualified with "In production" or the config/auth descriptions should clarify that the proxy network path is still used even with the bearer token.

---

## Summary

| Category | Result |
|---|---|
| Acceptance criteria | N/A (no `- [ ]` criteria) |
| Constraint violations (shared) | 0 |
| Reference issues | 0 |
| Additional findings | 1 (low severity wording inconsistency) |

**Overall: CLEAN** -- No failures, no violations, no broken references. One low-severity wording inconsistency identified between system-overview.md Constraint 2 and auth.md rule 7 regarding absolute vs. qualified proxy-only language.
