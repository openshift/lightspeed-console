/* eslint-disable no-console */
import { chromium, type FullConfig } from '@playwright/test';
import { execFileSync, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { oc } from './fixtures';

const MINUTE = 60 * 1000;
const AUTH_DIR = path.join(__dirname, '..', '.auth');
const STATE_FILE = path.join(AUTH_DIR, 'state.json');

const globalSetup = async (config: FullConfig) => {
  const baseURL = config.projects[0].use.baseURL!;
  const username = process.env.LOGIN_USERNAME || 'kubeadmin';
  const KUBECONFIG = process.env.KUBECONFIG_PATH;

  fs.mkdirSync(AUTH_DIR, { recursive: true });

  oc(['adm', 'policy', 'add-cluster-role-to-user', 'cluster-admin', username]);
  oc(['adm', 'policy', 'add-cluster-role-to-user', 'lightspeed-operator-query-access', username]);

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
          - name: gpt-4o-mini
  ols:
    defaultModel: gpt-4o-mini
    defaultProvider: openai
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
        'deployment/lightspeed-operator-controller-manager',
        '--namespace',
        OLS_NAMESPACE,
      ]);

      const csvJson = oc(['get', csvName, '--namespace', OLS_NAMESPACE, '-o', 'json']);
      const csv = JSON.parse(csvJson);

      const argToRelatedImage: Record<string, string> = {
        '--console-image-pf5': 'lightspeed-console-plugin-pf5',
        '--console-image-4-19': 'lightspeed-console-plugin-4-19',
        '--console-image=': 'lightspeed-console-plugin',
      };

      const args = csv.spec.install.spec.deployments[0].spec.template.spec.containers[0].args;
      const relatedImages = csv.spec.relatedImages;

      const relatedImageOps: { op: string; path: string; value: string }[] = [];
      for (const arg of args) {
        for (const [prefix, riName] of Object.entries(argToRelatedImage)) {
          if (arg.startsWith(prefix)) {
            const idx = relatedImages.findIndex((ri: { name: string }) => ri.name === riName);
            if (idx !== -1) {
              relatedImageOps.push({
                op: 'replace',
                path: `/spec/relatedImages/${idx}/image`,
                value: process.env.CONSOLE_IMAGE!,
              });
            }
          }
        }
      }

      const updatedArgs = args.map((arg: string) =>
        arg.startsWith('--console-image')
          ? arg.replace(/=.*/, `=${process.env.CONSOLE_IMAGE}`)
          : arg,
      );

      const patch = JSON.stringify([
        ...relatedImageOps,
        {
          op: 'replace',
          path: '/spec/install/spec/deployments/0/spec/template/spec/containers/0/args',
          value: updatedArgs,
        },
      ]);
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
        'deployment/lightspeed-operator-controller-manager',
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
