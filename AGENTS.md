## AI Agents Guide

Basic guardrails and quick-start for AI coding agents contributing to this
repository.

### Overview

- This repo is an OpenShift Console dynamic plugin for the OpenShift Lightspeed
  chat UI
- See `README.md` for general project instructions

### Code structure

- Frontend React code lives under `src/` (TypeScript/React)
  - React components in `src/components/`
  - React hooks in `src/hooks/`
  - Redux code in `src/`
- Put images and other assets in `src/assets/`
- Modules and extensions exposed by the plugin are added to
  `console-extensions.json`
- Test-related code lives under `tests/` and `cypress/`

### Coding style

- Use TypeScript and ES6 syntax for all code
- Prefer meaningful, descriptive names and early returns
- Prefer functional coding patterns
- Avoid excessive comments that add little value
- End lines with semicolons
- Prefer single quotes for strings
- Further coding style details are defined in `.eslintrc.yml` and
  `.prettierrc.yml`

### Linting

- Find and fix lint errors with `npm run lint-fix`

### CSS

- Stylelint is used for CSS linting
- Use class names prefixed with `ols-plugin__` for all styling rules
  - Strictly limiting all CSS to styling `ols-plugin__*` classes avoids any
    conflicts with the default PatternFly and web console styles
- We disallow hex colors because PatternFly design tokens should be used instead
- CSS lint rules are defined in `.stylelintrc.yaml`

### i18n

- We use the react-i18next internationalization framework
- i18n JSON files are in `locales/`
- All translations should use the namespace `plugin__lightspeed-console-plugin`
- After adding or changing UI text, update locale files by running
  `npm run i18n`

### Running

- Dependencies are installed by running `npm install`
- To run the project locally:
  - Run `npm run start` in one terminal
    - Starts the dev server for the plugin on port 9001
    - If calling the OLS API locally, set the base URL
      `OLS_API_BASE_URL='http://127.0.0.1:8080' npm run start`
  - Run `npm run start-console` in a second terminal
    - Run the OpenShift web console container connected to your current cluster
    - Requires prior `oc login`

### Tests (Cypress)

- To run all tests: `CYPRESS_BASE_URL='http://localhost:9000' npm run test-headless`
- To run just some tests filtered by tag:
  `CYPRESS_grepTags='@acm' CYPRESS_BASE_URL='http://localhost:9000' npm run test-headless`
- See `tests/README.md` for full details and environment variables

### Do not commit

- Secrets or tokens (e.g., `OLS_API_BEARER_TOKEN`)
- `node_modules/`, build artifacts in `dist/`, or test output in
  `gui_test_screenshots/`

### PR checklist

- Apply lint rules: `npm run lint-fix`
- Update i18n strings: `npm run i18n`
- Ensure build works: `npm run build`
- Ensure tests pass: `CYPRESS_BASE_URL='http://localhost:9000' npm run test-headless`
