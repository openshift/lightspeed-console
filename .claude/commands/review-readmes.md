---
name: review-readmes
description: >-
  Review all README.md files in the repo for typos, errors, and outdated
  information. Use when the user asks to review READMEs, check documentation
  accuracy, or audit docs.
---

# Review READMEs

Audit every `README.md` in the repository for language quality and factual
accuracy against the current codebase.

## Step 1 — Collect README files

Find all README files:

```sh
find . -name 'README.md' -not -path '*/node_modules/*'
```

Read each file in full.

## Step 2 — Check language quality

For each README, look for:

- Spelling mistakes and typos
- Grammatical errors
- Awkward phrasing or unclear sentences
- Broken Markdown formatting
- Unnecessary verbosity — tighten wordy passages without losing meaning

## Step 3 — Cross-reference with the codebase

Verify that claims in the READMEs still hold by checking the actual code. Do not
guess — confirm every claim against the source.

## Step 4 — Fix

Apply all fixes directly to the README files. For each file, briefly summarize
what was changed and why.
