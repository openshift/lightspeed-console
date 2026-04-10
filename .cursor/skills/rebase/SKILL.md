---
name: rebase
description: >-
  Rebase the current branch onto its base branch, resolve all conflicts, and
  verify lint, i18n, and build pass. Use when the user asks to rebase, update,
  or sync a branch with its upstream base.
---

# Rebase

Rebase the current branch onto its base branch. This skill assumes the local
repo is already up to date (no fetch/pull needed).

## Step 1 — Determine the base branch

Read [release-branches.md](../release/release-branches.md) to get the list of
branches. For each branch, compute the merge-base with HEAD and count the
commits between them:

```sh
mb=$(git merge-base HEAD <branch>)
git rev-list --count "$mb"..HEAD
```

The base branch is whichever has the **lowest** commit count (fewest commits
between the merge-base and HEAD). If counts are tied, prefer `main`.

Tell the user which base branch was detected before proceeding.

## Step 2 — Rebase

```sh
git rebase <base-branch>
```

If the rebase completes cleanly, skip to **Step 3**.

### Resolving conflicts

When conflicts occur, repeat this loop until the rebase finishes:

1. Run `git diff --name-only --diff-filter=U` to list conflicting files.
2. Read each conflicting file, examine the conflict markers (`<<<<<<<`,
   `=======`, `>>>>>>>`), and resolve them by keeping the correct version.
   Prefer incoming (base-branch) changes for dependency updates and lockfile
   entries; prefer the current branch's changes for feature code — but use
   judgment and the surrounding context to decide.
3. Stage resolved files: `git add <files>`.
4. Continue: `git rebase --continue`.
5. If new conflicts appear, go back to substep 1.

## Step 3 — Fix lint, i18n, and build

After the rebase succeeds, run the following commands **in order**, fixing any
errors before moving on:

1. `npm run lint-fix` — fix lint/formatting issues automatically.
2. `npm run i18n` — regenerate locale files.
3. `npm run build` — ensure the project compiles.

If any step produces errors that `lint-fix` did not auto-resolve, fix them
manually and re-run the failing command until it passes.

## Step 4 — Report

Summarize what happened:

- Which base branch was used
- How many conflicts were resolved (and in which files)
- Whether lint, i18n, and build passed cleanly or required fixes
