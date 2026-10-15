/* eslint-disable no-console */
import { chromium, type FullConfig } from '@playwright/test';
import { execFileSync, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import {
  buildConsoleImagePatch,
  CLASSIC_OPERATOR_DEPLOYMENT,
  CONSOLE_PLUGIN_CONTAINER,
  CONSOLE_PLUGIN_DEPLOYMENT,
} from './csv';
import { oc } from './fixtures';

const MINUTE = 60 * 1000;
const AUTH_DIR = path.join(__dirname, '..', '.auth');
const STATE_FILE = path.join(AUTH_DIR, 'state.json');

// Confirms the operator actually reconciled the candidate image, so a substitution that silently
// did nothing fails the run instead of testing the published image
const waitForConsolePluginImage = (expectedImage: string, namespace: string) => {
  const deadline = Date.now() + 5 * MINUTE;
  let lastSeen = 'deployment not found';

  while (Date.now() < deadline) {
    try {
      const deployment = JSON.parse(
        oc([
          'get',
          'deployment',
          CONSOLE_PLUGIN_DEPLOYMENT,
          '--namespace',
          namespace,
          '-o',
          'json',
        ]),
      );
      const container = deployment.spec.template.spec.containers.find(
        ({ name }: { name: string }) => name === CONSOLE_PLUGIN_CONTAINER,
      );
      if (container?.image === expectedImage) {
        console.log(`Console plugin is running the candidate image ${expectedImage}`);
        return;
      }
      lastSeen = container?.image ?? `no ${CONSOLE_PLUGIN_CONTAINER} container`;
    } catch {
      lastSeen = 'deployment not found';
    }
    execSync('sleep 5');
  }

  throw new Error(
    `Console plugin did not adopt CONSOLE_IMAGE ${expectedImage} within 5 minutes ` +
      `(last seen: ${lastSeen})`,
  );
};

const globalSetup = async (config: FullConfig) => {
  const baseURL = config.projects[0].use.baseURL!;
  const username = process.env.LOGIN_USERNAME || 'kubeadmin';
  const KUBECONFIG = process.env.KUBECONFIG_PATH;

  fs.mkdirSync(AUTH_DIR, { recursive: true });

  oc(['adm', 'policy', 'add-cluster-role-to-user', 'cluster-admin', username]);
  oc(['adm', 'policy', 'add-cluster-role-to-user', 'lightspeed-operator-query-access', username]);

  try {
    const oauthResult = oc([
      'get',
      'oauthclient',
      'openshift-browser-client',
      '-o',
      'go-template',
      '--template={{index .redirectURIs 0}}',
    ]);
    const oauthOrigin = new URL(oauthResult.trim().replace(/"/g, '')).origin;
    console.log(`OAuth origin: ${oauthOrigin}`);
  } catch {
    console.log('oauthclient not available on this cluster, skipping OAuth origin lookup');
  }

  const OLS_NAMESPACE = 'openshift-lightspeed';
  const OLS_CONFIG_KIND = 'OLSConfig';
  const OLS_CONFIG_NAME = 'cluster';

  const OLS_CONFIG_YAML = `apiVersion: ols.openshift.io/v1alpha1
kind: ${OLS_CONFIG_KIND}
metadata:
  name: ${OLS_CONFIG_NAME}
spec:
  llm:
    providers:
      - type: openai
        name: openai
        credentialsSecretRef:
          name: openai-api-keys
        url: https://api.openai.com/v1
        models:
          - name: gpt-5.4-mini
  ols:
    defaultModel: gpt-5.4-mini
    defaultProvider: openai
    introspectionEnabled: false
    logLevel: INFO`;

  // Check if operator is already installed
  let operatorAlreadyInstalled = false;
  try {
    const csvCheck = oc(['get', 'csv', '--namespace', OLS_NAMESPACE]);
    operatorAlreadyInstalled =
      csvCheck.trim() !== '' && !csvCheck.toLowerCase().includes('no resources found');
  } catch {
    operatorAlreadyInstalled = false;
  }

  if (operatorAlreadyInstalled) {
    if (process.env.CONSOLE_IMAGE) {
      throw new Error(
        `Operator is already installed in ${OLS_NAMESPACE}, so CONSOLE_IMAGE cannot be injected ` +
          'into the CSV. The tests would exercise the published console image instead of the ' +
          'candidate one.',
      );
    }
    console.log(`Operator already installed in ${OLS_NAMESPACE}. Skipping installation.`);
  } else {
    console.log('Operator not found. Proceeding with installation.');

    try {
      oc(['get', 'ns', OLS_NAMESPACE]);
    } catch {
      oc(['create', 'ns', OLS_NAMESPACE]);
    }
    oc([
      'label',
      'namespaces',
      OLS_NAMESPACE,
      'openshift.io/cluster-monitoring=true',
      '--overwrite=true',
    ]);

    const bundleImage =
      process.env.BUNDLE_IMAGE || 'quay.io/openshift-lightspeed/lightspeed-operator-bundle:latest';
    try {
      const result = execFileSync(
        'operator-sdk',
        [
          'run',
          'bundle',
          '--timeout=10m',
          '--namespace',
          OLS_NAMESPACE,
          bundleImage,
          '--kubeconfig',
          KUBECONFIG!,
        ],
        { encoding: 'utf-8', timeout: 12 * MINUTE },
      );
      console.log(`operator-sdk run bundle stdout:\n${result}`);
    } catch (err: unknown) {
      const error = err as { stdout?: string; stderr?: string };
      console.error(`operator-sdk run bundle failed:\n${error.stdout}\n${error.stderr}`);
      throw err;
    }

    // Replace console image in CSV if CONSOLE_IMAGE is set
    if (process.env.CONSOLE_IMAGE) {
      const csvName = oc([
        'get',
        'clusterserviceversion',
        '--namespace',
        OLS_NAMESPACE,
        '-o',
        'name',
      ])
        .trim()
        .split('\n')
        .filter(Boolean)[0];

      oc([
        'scale',
        '--replicas=0',
        `deployment/${CLASSIC_OPERATOR_DEPLOYMENT}`,
        '--namespace',
        OLS_NAMESPACE,
      ]);

      const csvJson = oc(['get', csvName, '--namespace', OLS_NAMESPACE, '-o', 'json']);
      const patch = JSON.stringify(
        buildConsoleImagePatch(JSON.parse(csvJson), process.env.CONSOLE_IMAGE),
      );

      const patchFile = '/tmp/ols-csv-patch.json';
      fs.writeFileSync(patchFile, patch);
      oc([
        'patch',
        csvName,
        '--namespace',
        OLS_NAMESPACE,
        '--type=json',
        '--patch-file',
        patchFile,
      ]);
      oc([
        'scale',
        '--replicas=1',
        `deployment/${CLASSIC_OPERATOR_DEPLOYMENT}`,
        '--namespace',
        OLS_NAMESPACE,
      ]);
    }
  }

  // Handle OLSConfig
  let configExists = false;
  try {
    const configCheck = oc(['get', OLS_CONFIG_KIND, OLS_CONFIG_NAME, '-o', 'json']);
    const existingConfig = JSON.parse(configCheck);
    if (existingConfig.metadata.deletionTimestamp) {
      console.log('OLSConfig is being deleted. Waiting for deletion...');
      const deadline = Date.now() + 3 * MINUTE;
      while (Date.now() < deadline) {
        try {
          oc(['get', OLS_CONFIG_KIND, OLS_CONFIG_NAME]);
        } catch {
          break;
        }
        console.log('Waiting for deletion...');
        execSync('sleep 5');
      }
      configExists = false;
    } else {
      console.log('OLSConfig already exists. Using existing config.');
      configExists = true;
    }
  } catch {
    configExists = false;
  }

  if (!configExists) {
    console.log('Creating OLSConfig...');
    const configFile = '/tmp/ols-config.yaml';
    fs.writeFileSync(configFile, OLS_CONFIG_YAML);
    oc(['create', '-f', configFile]);
  }

  // Create secret if it doesn't exist
  try {
    oc(['get', 'secret', 'openai-api-keys', '-n', OLS_NAMESPACE]);
    console.log('Secret openai-api-keys already exists.');
  } catch {
    console.log('Creating secret openai-api-keys...');
    oc([
      'create',
      'secret',
      'generic',
      'openai-api-keys',
      '--from-literal=apitoken=empty',
      '-n',
      OLS_NAMESPACE,
    ]);
  }

  // The operator only creates the console plugin once an OLSConfig exists, so verify here
  if (process.env.CONSOLE_IMAGE) {
    waitForConsolePluginImage(process.env.CONSOLE_IMAGE, OLS_NAMESPACE);
  }

  // Log in via browser and save storageState
  const browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  await page.goto(baseURL);

  // Perform login
  const idp = process.env.LOGIN_IDP || 'kube:admin';
  const password = process.env.LOGIN_PASSWORD!;

  // Select IDP if the login page shows identity provider selection
  const idpLink = page.locator(`a:has-text("${idp}")`);
  if (await idpLink.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await idpLink.click();
  }

  await page.locator('#inputUsername').fill(username);
  await page.locator('#inputPassword').fill(password);
  await page.locator('button[type=submit]').click();

  // Wait for console to load
  await page.waitForURL('**/');

  // Dismiss guided tour and set localStorage to prevent it reappearing
  const tourSettings = {
    'console.guidedTour': { admin: { completed: true } },
  };
  await page.evaluate((settings) => {
    localStorage.setItem('console-user-settings', JSON.stringify(settings));
  }, tourSettings);

  const tourDismiss = page.locator('[data-test="tour-step-footer-secondary"]');
  if (await tourDismiss.isVisible({ timeout: 5000 }).catch(() => false)) {
    await tourDismiss.click();
  }

  // Dismiss the "Welcome to the new OpenShift experience" tour modal (4.19+)
  const skipTour = page.getByRole('button', { name: 'Skip tour' });
  if (await skipTour.isVisible({ timeout: 5000 }).catch(() => false)) {
    await skipTour.click();
  }

  // Wait for the OLS button to confirm plugin is loaded, re-checking after
  // any page reloads triggered by operator installation.
  const olsButton = page.locator('[data-test="ols-plugin__popover-button"]');
  await olsButton.waitFor({ timeout: 5 * MINUTE });

  // After initial detection, wait for the page to stabilize (no further
  // reloads) by confirming the button remains present after a brief interval.
  // The console can reload multiple times after operator installation, so we
  // wait until the button has been continuously visible for a few consecutive
  // checks before considering the page settled.
  const LOAD_MAX_POLLS = 36;
  const LOAD_POLL_INTERVAL = 10_000;
  const LOAD_REQUIRED_POLLS = 12;
  let stableCount = 0;
  for (let i = 0; i < LOAD_MAX_POLLS; i++) {
    await page.waitForTimeout(LOAD_POLL_INTERVAL);
    if (await olsButton.isVisible().catch(() => false)) {
      if (++stableCount >= LOAD_REQUIRED_POLLS) {
        break;
      }
      continue;
    }
    stableCount = 0;
    // Page reloaded — wait for the button again
    await olsButton.waitFor({ timeout: 2 * MINUTE });
  }

  // Dismiss any tour modals that appeared after stabilization reloads
  if (await skipTour.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await skipTour.click();
  }

  // Re-capture auth state after stabilization so cookies/tokens are fresh
  await context.storageState({ path: STATE_FILE });
  await browser.close();

  console.log(`Auth state saved to ${STATE_FILE}`);
};

export default globalSetup;
