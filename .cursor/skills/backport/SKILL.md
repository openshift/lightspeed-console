---
name: backport
description: >-
  Backport commits or PRs from main to a release branch. Use when the user asks
  to backport, cherry-pick, or port changes between branches, or when resolving
  conflicts from a cherry-pick onto a release branch.
---

# Backport to a release branch

The release branches are listed in
[release-branches.md](../release/release-branches.md). Read that file to
determine the available target branches.

## Key principle

The target release branch's structure is authoritative. The source commit
provides _intent_. Express that intent using the target branch's patterns and
components.

## Workflow

1. Determine the target release branch. If the user doesn't specify, ask.
2. Create a branch off the target release branch with a short prefix derived
   from the branch name (e.g. `pf5-<topic>` for pattern-fly-5, `4.19-<topic>` for
   release-4.19).
3. Read the source commit (`git show <commit>`) to understand the intent.
4. Attempt `git cherry-pick <commit>`. If conflicts are trivial, resolve them.
   If the cherry-pick fails badly, abort (`git cherry-pick --abort`) and
   manually apply the changes instead.
5. Adapt incoming changes to the target branch's code structure — search the
   target branch for equivalents when needed. See the branch-specific notes
   below for known differences.
6. Verify no conflict markers remain.
7. Run the following **in order**, fixing any errors _you introduced_ before
   moving on (ignore pre-existing build failures):
   1. `npm run lint-fix`
   2. `npm run i18n`
   3. `npm run build`
8. Prefix the final commit title to identify the target branch (e.g. "PF5: " for
   pattern-fly-5, "4.19: " for release-4.19):
   - If cherry-pick succeeded: amend the commit message title (e.g.
     `git commit --amend`).
   - If changes were applied manually: create a new commit with the original
     message, prefixed appropriately.

## Branch-specific notes

### pattern-fly-5

Components, props, and CSS differ between main and pattern-fly-5 because of the
PatternFly 5 → 6 migration. PF6 introduced design tokens (`--pf-t--*` CSS
variables) that don't exist in PF5. When incoming code references Chatbot
extension components, PF6-specific APIs, or design tokens, find and use the PF5
equivalent on the target branch.
