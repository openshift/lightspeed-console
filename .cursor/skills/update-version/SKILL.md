---
name: update-version
description: >-
  Update the project version number across all files that contain it.
---

# Update Version

## Steps

1. **Determine the new version.** If the user didn't specify one, read the
   current version from `package.json` and bump the patch version number.

2. **Update `package.json`** — replace the version string in both the top-level
   `version` field and the `consolePlugin.version` field. Both must match.

3. **Update `src/components/OverviewDetail.tsx`** — replace the old version
   string in the JSX with the new one.

4. **Sync the lockfile** — run `npm install` to propagate the version change
   into `package-lock.json`.

5. **Verify** — search the workspace for the old version string to confirm no
   stale references remain (ignore `node_modules/` and `dist/`). Report any
   unexpected occurrences to the user.

## Version format

This project uses semver (`MAJOR.MINOR.PATCH`)
