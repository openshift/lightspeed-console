Run Cypress tests filtered by tag.

Arguments: [tag] - Optional tag to filter by (@core, @attach, etc.) or "all" to
run all tests

1. If a tag argument was provided, use it. Otherwise, ask the user which tag to
   filter by (@core, @attach, etc. or "all" to run all tests)
2. If the tag is "all", run the tests using
   `CYPRESS_SKIP_OLS_SETUP='true' npm run test-headless`. Otherwise, run the
   tests using
   `CYPRESS_grepTags='@<tag>' CYPRESS_SKIP_OLS_SETUP='true' npm run test-headless`
3. Report the test results

Output a bullet point list of each test that was run with a ✅, ❌ or ⏭️ to
indicate whether the test passed, failed or was skipped. List the steps without
any title, introduction or summary at the end, etc. If all tests were skipped,
output "⚠️ All tests were skipped" at the end.

See tests/README.md for available tags and environment variables.
