---
name: code-review
description: >-
  Review a pull request for code quality, correctness, and project conventions.
  Use when the user asks to review a PR, code review, or examine changes on a
  branch. Accepts a GitHub PR URL, PR number, or local branch name.
---

# Code Review

Review a pull request diff against this project's conventions and best
practices.

## Step 1 — Obtain the diff

The user will provide one of the following:

### A) GitHub PR URL

Extract the remote and PR number from the URL.

- `https://github.com/openshift/lightspeed-console/pull/123` → remote
  **upstream**, PR **123**

Then fetch and diff:

```sh
git fetch <remote> pull/<number>/head:pr-<number>
git diff <remote>/main...pr-<number>
```

### B) PR number (bare number)

Assume the PR is on **upstream** (`openshift/lightspeed-console`).

```sh
git fetch upstream pull/<number>/head:pr-<number>
git diff upstream/main...pr-<number>
```

### C) Branch name

The branch already exists locally. Determine its base branch (`main` or
`pattern-fly-5`) using the same heuristic as the rebase skill:

```sh
mb_main=$(git merge-base <branch> main)
mb_pf5=$(git merge-base <branch> pattern-fly-5)
count_main=$(git rev-list --count "$mb_main"..<branch>)
count_pf5=$(git rev-list --count "$mb_pf5"..<branch>)
```

Then diff against the detected base:

```sh
git diff <base-branch>...<branch>
```

In all cases, also run `git log --oneline <base>...<ref>` to see the commit
messages.

## Step 2 — Review

Read the diff and surrounding context in changed files. Check for correctness,
security, project conventions (see `AGENTS.md`), React/Redux patterns, test
coverage, and maintainability.

## Step 3 — Report

Present findings grouped by severity:

- 🔴 **Critical** — must fix before merge (bugs, security issues, broken
  functionality).
- 🟡 **Suggestion** — would improve the code (style, performance, readability).
- 🟢 **Nit** — optional, minor stylistic preferences.

For each finding:

1. Reference the file and line(s).
2. Explain _why_ it's an issue (not just _what_).
3. Suggest a concrete fix or alternative when possible.
