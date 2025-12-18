Review CSS for coding style and best practices

Reference: https://www.patternfly.org/tokens/all-patternfly-tokens

Arguments: [path] - Optional path to a specific CSS file (default: all CSS in
src/)

1. If a path argument was provided, review just that file. Otherwise, review all
   CSS files in `src/`.

2. Run stylelint first: `npx stylelint "src/**/*.css" --allow-empty-input`

3. Beyond what stylelint catches, manually review the CSS for these issues:

   **PatternFly Variable Consistency:**
   - Flag any use of `--pf-v5-*` or `--pf-v6-*` variables as these should be
     migrated to `--pf-t--*` design tokens
   - Ensure PatternFly design tokens are used instead of hardcoded values for:
     - Colors (use `--pf-t--global--color--*` or
       `--pf-t--global--text--color--*`)
     - Spacing (use `--pf-t--global--spacer--*`)
     - Font sizes (use `--pf-t--global--font--size--*`)
     - Border radius (use `--pf-t--global--border--radius--*`)
     - Box shadows (use `--pf-t--global--box-shadow--*`)

   **Class Naming:**
   - All classes MUST use the `ols-plugin__` prefix
   - Follow BEM-style naming: `ols-plugin__block`,
     `ols-plugin__block--modifier`, `ols-plugin__block__element`

   **Stylelint Disable Comments:**
   - Review any `stylelint-disable` comments to ensure they are necessary
   - Each disable comment should have a clear reason in an adjacent comment

   **Hardcoded Values:**
   - Flag hardcoded values that could use PatternFly design tokens:
     - Spacing (px, rem, em) → `--pf-t--global--spacer--*`
     - Font weights (400, 700, etc.) → `--pf-t--global--font--weight--*`
     - Font families → `--pf-t--global--font--family--*`
     - Z-index values → `--pf-t--global--z-index--*`
     - Border widths (except 1px) → `--pf-t--global--border--width--*`
     - Timing/duration → `--pf-t--global--motion--duration--*`
   - `1px` borders are acceptable, but larger values should use tokens
   - When a hardcoded value is found, search for a matching PatternFly token at
     https://www.patternfly.org/tokens/all-patternfly-tokens and suggest the
     appropriate `--pf-t--*` token replacement

   **Dark Mode Compatibility:**
   - Ensure any background colors work with dark mode
   - Check that text colors use appropriate contrast tokens

4. Report findings grouped by category with severity:
   - ❌ Error: Must fix (violates project rules)
   - ⚠️ Warning: Should fix (inconsistent with best practices)
   - 💡 Suggestion: Consider improving (optional enhancement)

Example output format:

**PatternFly Variable Consistency:**

- ⚠️ `general-page.css:35` uses `--pf-v5-global--spacer--md`, migrate to
  `--pf-t--global--spacer--md`

**Hardcoded Values:**

- 💡 `popover.css:61` uses `border-radius: 12px`, replace with
  `--pf-t--global--border--radius--medium` (value: 12px)
