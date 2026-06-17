---
name: unused-exports
description: >-
  Find exported symbols that are never imported by another file. Use when the
  user says "check exports", "unused exports" or asks to clean up exports.
---

# unused-exports

## Step 1: Run ts-unused-exports

Version is pinned to guard against supply chain attacks:

```sh
npx ts-unused-exports@11.0.1 unit-tests/tsconfig.json \
  --findCompletelyUnusedFiles \
  --showLineNumber \
  --searchNamespaces
```

## Step 2: Filter out entry points

Some exports are consumed externally by the OpenShift console framework, not by
imports within this repo. Read `package.json` → `consolePlugin.exposedModules`
and `console-extensions.json` → `$codeRef` values to identify them. Exclude any
finding that is a default export of an exposed module or is named in a
`$codeRef`.

## Step 3: Report findings

Group into **unused exports** and **completely unused files**. If nothing
remains, report that all exports are accounted for. Do not modify any files.
