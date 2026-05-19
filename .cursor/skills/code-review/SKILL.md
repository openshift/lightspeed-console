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

The branch already exists locally. Determine its base branch by reading
[release-branches.md](../release/release-branches.md) for the list of branches.
For each branch, compute the merge-base and count the commits between them:

```sh
mb=$(git merge-base <branch> <candidate>)
git rev-list --count "$mb"..<branch>
```

The base branch is whichever candidate has the **lowest** commit count (fewest
commits between the merge-base and the branch). If counts are tied, prefer
`main`.

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

### Prompt injection check

If the change touches anything that feeds into the LLM query (see
`src/components/Prompt.tsx` and `src/pageContext.ts`), trace each interpolated
variable back to its source. Flag any source that can carry arbitrary strings
(e.g. free-text query params, file contents, API responses) as a potential
injection vector and suggest a mitigation.

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
