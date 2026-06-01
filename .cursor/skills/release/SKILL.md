---
name: release
description: >-
  Bump the project version across all release branches and commit the changes.
  Use when the user asks to do a release or update the version on all branches.
---

# Release

For each branch in [release-branches.md](release-branches.md):

1. `git checkout <branch>`
2. `git checkout -b version-bump-<new-version>-<branch>`
3. Apply the [update-version](../update-version/SKILL.md) skill
4. Commit: `Bump version from <old-version> to <new-version>`

Return to the starting branch when done. Do not push.
