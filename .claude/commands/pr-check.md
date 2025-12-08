Run PR checklist:

1. Install dependencies: `npm install`
2. Apply lint rules: `npm run lint-fix`
3. Update i18n strings: `npm run i18n`
4. Ensure build works: `npm run build`

At the end, output a bullet point list of the steps with a ✅ or ❌ to indicate
whether the step passed or failed. If the step passed, no additional explanation
is required, but if the step failed, report any errors or issues found. Just
list the steps without any title at the beginning or summary at the end, etc.
