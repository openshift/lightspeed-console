# OpenShift Lightspeed Console Tests

These console tests install the OpenShift Lightspeed Operator in the specified
cluster and then run a series of Playwright e2e tests against the UI.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 22

## Install dependencies

All required dependencies are defined in `package.json`. Run `npm install` to
install the dependencies in the `node_modules` folder. Then run
`npx playwright install` to download the browser binaries (required because
`.npmrc` sets `ignore-scripts=true`).

## Export necessary variables

Test behavior can be customized by setting environment variables.

If you are running the OpenShift Lightspeed UI locally (with login disabled),
you normally just need to run `npm run test` to run all the tests in the
Playwright UI.

If you are not running the OpenShift Lightspeed UI locally or otherwise need to
customize how the tests run, you can use the following environment variables.

- `BASE_URL=<UI base URL>`
  - Defaults to `http://localhost:9000`, which is the default base URL when
    running locally
- `SKIP_OLS_SETUP=true`
  - Skip login and operator installation, which is generally what you want when
    testing locally
- `KUBECONFIG_PATH=/path/to/kubeconfig`
- `LOGIN_IDP=kube:admin`
  - Use `flexy-htpasswd-provider` when running tests on flexy-installed clusters
    and using any user other than kubeadmin. Use `kube:admin` when running tests
    as kubeadmin.
- `LOGIN_USERNAME`
  - e.g. `LOGIN_USERNAME=kubeadmin`
- `LOGIN_PASSWORD=<password>`
- `BUNDLE_IMAGE=<Konflux bundle image>`
  - If set, the tests will start by installing the OpenShift Lightspeed operator
    using the given Konflux bundle image
  - Use this if you are running the tests on a HyperShift cluster
  - The bundle image can be taken from
    [Konflux's bundle image](https://console.redhat.com/application-pipeline/workspaces/crt-nshift-lightspeed/applications/ols-bundle/components/test-bundle)
- `CONSOLE_IMAGE=<Konflux OpenShift Lightspeed console plugin image>`
  - If set, the OpenShift Lightspeed UI image installed by the operator will be
    replaced with this image before the tests are run

## Run tests

You can either open the Playwright UI (`npm run test`) or run Playwright in
headless mode (`npm run test-headless`).

You can limit which tests are run by tag using `--grep "<@tags>"`.

For example, `npm run test-headless -- --grep "@core|@attach"` runs the core
functionality and attachment-related tests in headless mode.

Artifacts (screenshots/videos/reports) are saved in `gui_test_screenshots/`.
