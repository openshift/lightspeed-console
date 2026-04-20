---
name: rebase
description: >-
  Rebase the current branch onto its base branch, resolve all conflicts, and
  verify lint, i18n, and build pass. Use when the user asks to rebase, update,
  or sync a branch with its upstream base.
---

# Rebase

Rebase the current branch onto its base branch.

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

## Step 2 — Check if base branch is up to date

Run `git fetch upstream <base-branch>` to update the remote tracking ref (this
is read-only and does not change any local branches), then compare:

```sh
git fetch upstream <base-branch>
git rev-list --count <base-branch>..upstream/<base-branch>
```

If the count is **0**, the local base branch is up to date — skip ahead to
**Step 3**.

If the count is **greater than 0**, tell the user how many commits their local
base branch is behind the remote and **ask whether they want to pull**. Do NOT
pull without the user's consent.

- If the user says **yes**, run `git checkout <base-branch> && git merge --ff-only upstream/<base-branch> && git checkout -` then continue to Step 3.
- If the user says **no** (or to skip), continue to Step 3 using the local
  base branch as-is.

## Step 3 — Rebase

Save the current commit hash before rebasing so it can be used for comparison
later:

```sh
pre_rebase_head=$(git rev-parse HEAD)
git rebase <base-branch>
```

If the rebase completes cleanly, skip to **Step 4**.

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

## Step 4 — Fix lint, i18n, and build

After the rebase succeeds, run the following commands **in order**, fixing any
errors before moving on:

1. `npm run lint-fix` — fix lint/formatting issues automatically.
2. `npm run i18n` — regenerate locale files.
3. Before building, check whether `npm install` needs to be run. Compare the
   current `package-lock.json` against the saved pre-rebase commit:
   ```sh
   git diff "$pre_rebase_head" -- package-lock.json
   ```
   If there are changes, run `npm install` before continuing.
4. `npm run build` — ensure the project compiles.

If any step produces errors that `lint-fix` did not auto-resolve, fix them
manually and re-run the failing command until it passes.

## Step 5 — Report

Summarize what happened:

- Which base branch was used
- How many conflicts were resolved (and in which files)
- Whether lint, i18n, and build passed cleanly or required fixes
