# ADR 0001: COO Periodic Test Pipeline for OLS + Perses Chart Integration

- Status: Accepted
- Date: 2026-11-09 (revised 2026-11-10: test ported from Cypress to Playwright)
- Jira: [OLS-3801](https://redhat.atlassian.net/browse/OLS-3801) (pipeline),
  [OLS-3802](https://redhat.atlassian.net/browse/OLS-3802) (scenarios + CronJobs)

## Context

The integration between OLS's `show_timeseries` tool call and COO's Perses
dashboards is validated end-to-end by the Playwright test
`tests/tests/coo-show-timeseries.spec.ts` in this repository (ported from the
Cypress test `coo_lightspeed_show_timeseries.cy.ts` in
`openshift/monitoring-plugin`, which remains there for prow-based runs). The
test is non-deterministic — it depends on live LLM
responses — so it must never gate PRs. We need it to run daily against all
three lightspeed-console variants (main, 4-19, pf5) on Konflux.

### The test is a Playwright port, not monitoring-plugin's Cypress spec

The pipeline originally ran monitoring-plugin's Cypress spec, but its
`cy.origin()`-based OAuth login cannot follow the HyperShift OAuth redirect
chain on Konflux ephemeral clusters (the OAuth server lives on the management
cluster domain with an explicit `:443` port; instrumented runs showed the
browser never reaches the origin under Cypress). This repo's own Playwright
suite logs in via `page.goto()` + form fill in `global-setup.ts`, which is
proven on the same clusters, so the OLS-specific assertions were ported to
`tests/tests/coo-show-timeseries.spec.ts`. Monitoring-plugin's own dashboard
CRUD UI is not re-tested here (covered by its prow suite); the port covers
the chat → show_timeseries chart render and the Add to Dashboard handoff,
with the target dashboard created via `oc` instead of the UI.

## Decisions

### The pipeline lives in this repo; scenarios and CronJobs live in konflux-release-data

The Tekton pipeline is `.tekton/integration-tests/coo-periodic/coo-lightspeed-periodic.yaml`,
resolved by Konflux via the git resolver. The `IntegrationTestScenario`
resources and the periodic `CronJob`s that trigger them are GitOps-managed in
the internal `konflux-release-data` repo under
`tenants-config/cluster/stone-prd-rh01/tenants/crt-nshift-lightspeed-tenant/`
(scenarios in `applications/ols/integration-test-scenarios/`, CronJobs in
`periodics/`), following the hcc-platex-services-tenant pattern. They must not
be committed to this repo.

### Explicit `component-name` pipeline param

Konflux snapshots are of the `ols` application and contain all console
components. Each scenario passes a different `component-name`
(`lightspeed-console`, `lightspeed-console-4-19`, `lightspeed-console-pf5`);
the pipeline extracts that component's image from the snapshot and deploys it
under test. `test-name` stays purely for Konflux identification. (Chosen over
parsing the component out of `test-name` — explicit beats brittle.)

### Real LLM credentials

Unlike the pre-commit Playwright setup (which creates the `openai-api-keys`
secret with `apitoken=empty`), this pipeline creates the secret with the real
token from the `openai` tenant-namespace secret — the test depends on live LLM
responses.

### Non-gating failure semantics

The Playwright step runs with `onError: continue`, artifacts (test results,
videos, cluster resources) are gathered and pushed regardless, and only a
final `assert-playwright-succeeded` step turns the captured exit code into task
failure. The scenarios carry only the `disabled` context, so they never run on
PRs or post-merge — only via the CronJobs' snapshot labels
(`test.appstudio.openshift.io/run=<scenario-name>`).

### CronJobs use the upstream scheduler script

The CronJobs run `quay.io/konflux-ci/appstudio-utils:latest` executing the
`integration-tests-scheduler.sh` script from
`konflux-ci/tekton-integration-catalog`, which finds the latest auto-released
push snapshot for the component and labels it. Schedules are staggered
(1:00 / 4:00 / 7:00 UTC) to avoid the existing periodic jobs at 0:00 and
3:00 UTC.

### `konflux-bot-0` RBAC stays out-of-band

The CronJobs use the existing `konflux-bot-0` ServiceAccount, whose narrow
Role (snapshots get/list/watch/update/patch, plus read-only on
releases/pipelineruns/pods/secrets) was created out-of-band on the cluster.
Importing it into konflux-release-data is not currently possible: repo policy
enforces an allowlist of Konflux roles for RoleBindings, which rejects custom
Roles.

## Implementation notes

- Cluster provisioning matches the pre-commit pipeline: generic-claim
  ephemeral cluster (hypershift-hostedcluster-workflow, aws-konflux-prod,
  OCP 4.22 stable); deprovisioning via owner references, no explicit task.
- COO is installed via an OLM subscription from `redhat-operators`
  (`cluster-observability-operator`), with a defensive check-and-patch for
  `--openshift.enabled=true` (catalog installs normally enable OpenShift mode
  by default; only bundle installs require the flag).
- OLS is installed via `operator-sdk run bundle
  quay.io/openshift-lightspeed/lightspeed-operator-bundle:latest`; the CSV is
  patched to deploy the console image under test using the
  `--console-image` / `--console-image-4-19` / `--console-image-pf5` arg
  mapping (same approach as `tests/support/global-setup.ts`).
- The Playwright test runs in `mcr.microsoft.com/playwright:v1.64.1-noble`
  (matching the repo's pre-commit e2e setup). The tests are cloned from this
  repo at the commit under test — from the snapshot commit by default, or the
  `console-repo` / `console-ref` params for pre-merge runs against a fork
  branch. `global-setup.ts` skips OLS installation when the pipeline has
  already installed it.
- Artifacts are pushed to
  `quay.io/openshift-lightspeed/ols-console-artifacts:coo-tests-<console-commit-sha>-<pipeline-run-name>` (one small artifact per run; a shared per-commit tag accumulates every run's logs and media, and the push stepaction's download-and-remerge of it OOM-kills the push step at scale).
