# OpenShift Lightspeed Console Tests

These console tests install the OpenShift Lightspeed Operator in the specified
cluster and then run a series of Cypress e2e tests against the UI.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18

## Install dependencies

All required dependencies are defined in `package.json`. Run `npm install` to
install the dependencies in the `node_modules` folder.

## Export necessary variables

Test behavior can be customized by setting environment variables.

If you are running the OpenShift Lightspeed UI locally (with login disabled),
you normally just need to set `CYPRESS_BASE_URL`. For example, run
`CYPRESS_BASE_URL='http://localhost:9000' npm run test` to run all the tests
in the Cypress GUI.

If you are not running the OpenShift Lightspeed UI locally or otherwise need to
customize how the tests run, you can use the following environment variables.

- `CYPRESS_BASE_URL=<UI base URL>`
  - Normally `http://localhost:9000` when running locally
- `CYPRESS_grepTags`
  - Limits which tests are run
  - For example, set `CYPRESS_grepTags='@core @acm'` to run only the core
    functionality and ACM tests
- `KUBECONFIG_PATH=/path/to/kubeconfig`
- `LOGIN_IDP=kube:admin`
  - Use `flexy-htpasswd-provider` when running tests on flexy installed clusters
    and using any user other than kubeadmin. Use `kube:admin` when running tests
    as kubeadmin.
- `LOGIN_USERNAME`
  - e.g. `LOGIN_USERNAME=kubeadmin`
- `LOGIN_PASSWORD=<password>`
- `UI_INSTALL=true`
  - If set, the tests will start by installing the OpenShift Lightspeed operator
    through the UI
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

We can either open the Cypress GUI (`npm run test`) or run Cypress in
headless mode (`npm run test-headless`).

For example,
`CYPRESS_grepTags='@acm' CYPRESS_BASE_URL=http://localhost:9000 npm run test-headless`
runs just the ACM tests in headless mode.

Artifacts (screenshots/videos) are saved in `gui_test_screenshots/cypress/`.
