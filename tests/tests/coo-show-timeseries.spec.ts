import type { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

import { expect, oc, test } from '../support/fixtures';

/**
 * Non-deterministic e2e for the OLS <-> COO Perses integration: a troubleshooting-mode
 * prompt triggers a show_timeseries tool call whose result renders a Perses chart in the
 * chat, and the chart can be added to a Perses dashboard.
 *
 * Prerequisites (provided by the COO periodic pipeline):
 * - COO (with the Perses operator) installed
 * - OLS installed and configured with a live LLM provider
 * - the monitoring-plugin console plugin loaded (Perses dashboards UI)
 *
 * To run against a local cluster with a pre-existing OLS installation, just
 * run the suite: the global setup detects the existing installation and
 * reuses it, and the global teardown preserves it (it only removes the role
 * bindings the setup granted). Alternatively use SKIP_OLS_SETUP=true to also
 * skip the browser login and diagnostic collection.
 *
 * Relies on live LLM responses, so responses are not identical across runs. It must
 * never gate PRs.
 */

// Pod counts are available on a fresh cluster from the first kube-state-metrics
// scrape; CPU-rate queries need a warm-up window a minutes-old cluster lacks.
const PROMPT = 'visualize the number of pods in each namespace over the last 15 minutes';

// LLM responses can be slow under CI load or cold-start conditions
const OLS_RESPONSE_TIMEOUT = 120_000;

const DASHBOARD_PROJECT = process.env.COO_NAMESPACE || 'openshift-cluster-observability-operator';
const DASHBOARD_NAME = `ols-test-dashboard-${Math.random().toString(36).substring(2, 8)}`;

// Selectors prefixed with ols-plugin__ are defined in this repo's plugin. The Perses
// chart renders inline in the chat entry via the ols.tool-ui console extension
// (federated monitoring-console-plugin component).
const SEL = {
  chatButton: '[data-test="ols-plugin__popover-button"]',
  chatPanel: '[data-test="ols-plugin__popover"]',
  modeToggle: '[data-test="ols-plugin__mode-toggle"]',
  promptTextarea: '[data-test="ols-plugin__popover"] .ols-plugin__prompt textarea',
  sendButton: '[data-test="ols-plugin__popover"] button[aria-label="Send"]',
  aiResponse: '[data-test="ols-plugin__chat-entry-ai"]',
  toolCallLabel: '[class*="label"]',
  addToDashboard: '[aria-label="Add to dashboard"]',
};

const DASHBOARD_CR = `apiVersion: perses.dev/v1alpha2
kind: PersesDashboard
metadata:
  name: ${DASHBOARD_NAME}
  namespace: ${DASHBOARD_PROJECT}
spec:
  config:
    display:
      name: ${DASHBOARD_NAME}
    duration: 5m
    layouts: []
    panels: {}
`;

const openChat = async (page: Page): Promise<void> => {
  // The popover auto-opens for first-time users, so a blind click can close it.
  // Retry until it is actually open (same pattern as lightspeed.spec.ts).
  const btn = page.locator(SEL.chatButton);
  const panel = page.locator(SEL.chatPanel);
  await expect(btn).toBeVisible();
  await expect(async () => {
    if (!(await panel.isVisible())) {
      await btn.click();
    }
    await expect(panel).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 10_000 });
};

const closeChat = async (page: Page): Promise<void> => {
  await page.locator(SEL.chatButton).click();
  await expect(page.locator(SEL.chatPanel)).toHaveCount(0);
};

// Older console variants (e.g. pattern-fly-5) predate the troubleshooting
// mode toggle; there the prompt is sent in default (ask) mode.
const switchToTroubleshootingMode = async (page: Page): Promise<void> => {
  const modeToggle = page.locator(SEL.modeToggle);
  if (!(await modeToggle.isVisible().catch(() => false))) {
    return;
  }
  await modeToggle.click();
  await page.getByRole('option', { name: 'Troubleshooting' }).click();
  await expect(modeToggle).toContainText('Troubleshooting');
};

const sendPrompt = async (page: Page): Promise<void> => {
  await page.locator(SEL.promptTextarea).fill(PROMPT);
  await page.locator(SEL.sendButton).click();
};

// The AI response containing the tool call is streamed; poll for the
// show_timeseries tool call label to appear in the latest AI chat entry.
// The tool label group renders at most four labels (numLabels) and collapses
// the rest behind a "N more" toggle - expand it so the label is in the DOM.
const waitForShowTimeseriesResponse = async (page: Page): Promise<void> => {
  const response = page.locator(SEL.aiResponse).last();
  await expect
    .poll(
      async () => {
        const label = response.locator(SEL.toolCallLabel).filter({ hasText: 'show_timeseries' });
        if ((await label.count()) === 0) {
          const more = response.getByRole('button', { name: /more/ });
          if (await more.isVisible().catch(() => false)) {
            await more.click().catch(() => undefined);
          }
        }
        return label.count();
      },
      {
        timeout: OLS_RESPONSE_TIMEOUT,
      },
    )
    .toBeGreaterThan(0);
};

const goToDashboard = async (page: Page): Promise<void> => {
  // Navigate by URL: the nav item's i18n key is missing in the GA
  // monitoring-console-plugin, so its label is not reliably clickable
  await page.goto('/monitoring/v2/dashboards');
  const dashboardLink = page.getByRole('link', { name: DASHBOARD_NAME }).first();
  await expect(dashboardLink).toBeVisible({ timeout: OLS_RESPONSE_TIMEOUT });
  await dashboardLink.click();
};

const OLS_NAMESPACE = 'openshift-lightspeed';
const OLS_BACKEND_DEPLOYMENT = 'lightspeed-app-server';
// The lightspeed-service image is large; pulls on fresh clusters can take many minutes
const OLS_BACKEND_TIMEOUT = 20 * 60_000;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const waitForOlsBackend = async (): Promise<void> => {
  const deadline = Date.now() + OLS_BACKEND_TIMEOUT;
  while (Date.now() < deadline) {
    try {
      const status = oc([
        'get',
        'deployment',
        OLS_BACKEND_DEPLOYMENT,
        '-n',
        OLS_NAMESPACE,
        '-o',
        'jsonpath={.status.conditions[?(@.type=="Available")].status}',
      ]);
      if (status.trim() === 'True') {
        return;
      }
    } catch {
      // Deployment or its status may not exist yet
    }
    await sleep(15_000);
  }
  throw new Error(
    `OLS backend deployment ${OLS_BACKEND_DEPLOYMENT} did not become Available within ${OLS_BACKEND_TIMEOUT / 1000}s`,
  );
};

// Tagged @coo: this test needs COO, a global Perses datasource, and a live
// LLM, which only the periodic pipeline provisions. The pre-commit e2e
// excludes it with --grep-invert @coo so it never gates PRs.
test.describe.serial('COO: show_timeseries', { tag: '@coo' }, () => {
  // Opt-in beyond the @coo tag: bare `npx playwright test` (including
  // `npm run test-headless`) must not pick this suite up on standard OLS
  // clusters without COO. The periodic pipeline sets COO_E2E=1.
  test.skip(!process.env.COO_E2E, 'COO e2e requires the periodic pipeline environment (COO_E2E)');

  test.describe.configure({ timeout: OLS_BACKEND_TIMEOUT + OLS_RESPONSE_TIMEOUT * 2, retries: 1 });

  test.beforeAll(() => {
    const crFile = path.join('/tmp', `${DASHBOARD_NAME}.yaml`);
    fs.writeFileSync(crFile, DASHBOARD_CR);
    oc(['apply', '-f', crFile]);
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      // Capture the chat DOM so label/rendering failures are debuggable
      const html = await page
        .locator(SEL.chatPanel)
        .innerHTML()
        .catch(() => 'panel gone');
      // eslint-disable-next-line no-console
      console.log(`CHAT PANEL DOM AT FAILURE:\n${html.slice(0, 5000)}`);
    }
  });

  test.afterAll(() => {
    oc([
      'delete',
      'persesdashboard',
      DASHBOARD_NAME,
      '-n',
      DASHBOARD_PROJECT,
      '--ignore-not-found',
    ]);
  });

  test('renders a Perses chart for a show_timeseries tool call in troubleshooting mode', async ({
    page,
  }) => {
    // The chat panel requires the OLS backend; its 5.2 GB image pull plus service
    // startup can outlast the pipeline's install step, so wait for it here (within
    // this test's timeout; hook timeouts are capped lower).
    await waitForOlsBackend();

    await page.goto('/');
    await openChat(page);
    await switchToTroubleshootingMode(page);
    await sendPrompt(page);

    await waitForShowTimeseriesResponse(page);

    // The chart renders inline in the chat entry via the ols.tool-ui extension
    // (federated monitoring-console-plugin component), not in an iframe
    const chart = page.locator(SEL.aiResponse).last().locator('[class*="MuiPaper"]').first();
    await expect(chart).toBeVisible({ timeout: OLS_RESPONSE_TIMEOUT });
    // The number of rendered series/axis paths varies with the query
    await expect
      .poll(async () => chart.locator('svg path[d]').count(), { timeout: OLS_RESPONSE_TIMEOUT })
      .toBeGreaterThan(0);
    // Case-insensitive: the LLM generates the chart title
    await expect(chart).toContainText(/pod/i, { timeout: OLS_RESPONSE_TIMEOUT });
    await expect(chart).toContainText(/openshift/i, { timeout: OLS_RESPONSE_TIMEOUT });
  });

  test('adds the rendered chart to a Perses dashboard via Add to Dashboard button', async ({
    page,
  }) => {
    // Navigate to the pre-created dashboard so the added panel lands in it
    await page.goto('/');
    await goToDashboard(page);

    await openChat(page);
    await switchToTroubleshootingMode(page);
    await sendPrompt(page);

    await waitForShowTimeseriesResponse(page);

    // The button is rendered by the tool UI in a collapsed/hidden state; the
    // original Cypress spec force-clicked it. dispatchEvent fires the React
    // handler regardless of visibility.
    const addToDashboard = page.locator(SEL.aiResponse).last().locator(SEL.addToDashboard).first();
    await expect
      .poll(async () => (await addToDashboard.count()) > 0, { timeout: OLS_RESPONSE_TIMEOUT })
      .toBe(true);
    await addToDashboard.dispatchEvent('click');

    // Closing the chat panel reveals the dashboard, which enters edit mode with the
    // chart added as a panel (MUI panel header).
    await closeChat(page);
    const panelHeader = page.locator('[data-testid="panel"] h6').first();
    await expect(panelHeader).toBeVisible({ timeout: OLS_RESPONSE_TIMEOUT });

    // Set up the response listener before clicking so a fast save cannot
    // slip past it.
    const saveResponse = page
      .waitForResponse(
        (resp) => resp.request().method() !== 'GET' && /dashboard/i.test(resp.url()),
        { timeout: OLS_RESPONSE_TIMEOUT },
      )
      .catch(() => null);
    await page.getByRole('button', { name: 'Save' }).first().click();

    // The Perses editor may show a "Save Changes" confirmation dialog
    const saveChanges = page.getByRole('button', { name: 'Save Changes' });
    if (await saveChanges.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await saveChanges.click();
    }

    // Wait for the save to complete before reloading: reloading mid-save
    // races the persist request and can fail the test spuriously.
    const response = await saveResponse;
    if (response) {
      // Any 2xx response confirms the save was persisted
      expect(response.ok()).toBeTruthy();
    } else {
      // No matching request observed (e.g. the save is fully local); fall
      // back to the editor leaving edit mode as the completion signal.
      await expect(page.getByRole('button', { name: 'Save' }).first()).toBeHidden({
        timeout: OLS_RESPONSE_TIMEOUT,
      });
    }

    // Verify persistence: reload the dashboard and assert the panel is
    // present outside edit mode (visibility before save proves nothing)
    await page.reload();
    await expect(panelHeader).toBeVisible({ timeout: OLS_RESPONSE_TIMEOUT });
  });
});
