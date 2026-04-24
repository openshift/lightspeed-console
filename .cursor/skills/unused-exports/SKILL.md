---
name: unused-exports
description: >-
  Find exported symbols that are never imported by another file. Use when the
  user says "check exports", "unused exports" or asks to clean up exports.
---

# unused-exports

## Step 1: Run ts-unused-exports

Run the tool with no exclusions so every finding is visible:

```sh
npx ts-unused-exports tsconfig.json \
  --findCompletelyUnusedFiles \
  --showLineNumber \
  --searchNamespaces
```

## Step 2: Identify entry points

Read `package.json` field `consolePlugin.exposedModules`. Each value is a module
path relative to `src/` (e.g. `"./flags"` → `src/flags.ts`). These modules are
loaded at runtime by the OpenShift console framework — their exports are used
externally even though nothing inside this repo imports them.

Also read `console-extensions.json`. Each `$codeRef` value has the form
`"ModuleName"` or `"ModuleName.exportName"`. Map the module name back to
`exposedModules` to get the file path, and note which specific export is
referenced. An export is an entry point if:

- It is the **default export** of an exposed module, OR
- It is **named explicitly** in a `$codeRef` (e.g.
  `"OLSFlags.enableLightspeedPluginFlag"` → the named export
  `enableLightspeedPluginFlag` in `src/flags.ts`)

## Step 3: Filter results

For each finding from Step 1, check whether it matches an entry point from
Step 2. Remove it from the report if it does. Keep everything else.

## Step 4: Present results

Group findings into two sections:

**Unused exports** — exports that can safely have their `export` keyword removed
(they are still used locally) or be deleted entirely (dead code).

**Completely unused files** — files where nothing is imported anywhere. These
are candidates for deletion.

If nothing remains after filtering, report that all exports are accounted for.

Do **not** modify any files — only report findings.
