---
name: backport
description: >-
  Backport commits or PRs from main to pattern-fly-5. Use when the user asks to
  backport, cherry-pick, or port changes between these branches, or when
  resolving conflicts from a cherry-pick onto pattern-fly-5.
---

# Backport to pattern-fly-5

## Branch differences

- **main**: PatternFly 6 + PatternFly Chatbot extension
- **pattern-fly-5**: PatternFly 5, no Chatbot extension

Components, props, and CSS differ between branches as a result. PF6 also
introduced design tokens (`--pf-t--*` CSS variables) that don't exist in PF5.
When incoming code references Chatbot extension components, PF6-specific APIs,
or design tokens, find and use the PF5 equivalent on the target branch.

## Key principle

The pattern-fly-5 branch structure is authoritative. The source commit provides
_intent_. Express that intent using the target branch's patterns and components.

## Workflow

1. Create a branch off `pattern-fly-5` prefixed with `pf5-` (e.g.
   `pf5-<source-branch>`).
2. Read the source commit (`git show <commit>`) to understand the intent.
3. Attempt `git cherry-pick <commit>`. If conflicts are trivial, resolve them.
   If the cherry-pick fails badly, abort (`git cherry-pick --abort`) and
   manually apply the changes instead.
4. Adapt incoming changes to the target branch's code structure — search the
   target branch for equivalents when needed.
5. Verify no conflict markers remain.
6. Run the following **in order**, fixing any errors _you introduced_ before
   moving on (ignore pre-existing build failures):
   1. `npm run lint-fix`
   2. `npm run i18n`
   3. `npm run build`
7. Ensure the final commit title is prefixed with "PF5: ":
   - If cherry-pick succeeded: amend the commit message title (e.g.
     `git commit --amend`).
   - If changes were applied manually: create a new commit with the original
     message, prefixed with "PF5: ".
