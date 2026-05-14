import { defineConfig } from 'cypress';
import { plugin as cypressGrepPlugin } from '@cypress/grep/plugin';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as console from 'console';

const ARTIFACTS_DIR = './gui_test_screenshots/artifacts';
const OLS_NAMESPACE = 'openshift-lightspeed';
const OC_TIMEOUT = 30000;

const CLUSTER_RESOURCES = [
  'pods',
  'services',
  'deployments',
  'replicasets',
  'routes',
  'rolebindings',
  'serviceaccounts',
  'olsconfig',
  'clusterserviceversion',
  'installplan',
  'configmap',
];

function runOC(args: string[], kubeconfigPath: string): string | null {
  const argv = kubeconfigPath ? [...args, '--kubeconfig', kubeconfigPath] : args;
  try {
    return execFileSync('oc', argv, {
      encoding: 'utf-8',
      timeout: OC_TIMEOUT,
    });
  } catch (e: unknown) {
    console.error(`oc ${args.slice(0, 3).join(' ')} failed: ${e}`);
    return null;
  }
}

function gatherClusterArtifacts(kubeconfigPath: string) {
  const clusterDir = path.join(ARTIFACTS_DIR, 'cluster');
  const podLogsDir = path.join(clusterDir, 'podlogs');
  fs.mkdirSync(podLogsDir, { recursive: true });

  for (const resource of CLUSTER_RESOURCES) {
    const output = runOC(['get', resource, '-n', OLS_NAMESPACE, '-o', 'yaml'], kubeconfigPath);
    if (output) {
      fs.writeFileSync(path.join(clusterDir, `${resource}.yaml`), output);
    }
  }

  // Pod logs
  const podsJson = runOC(['get', 'pods', '-n', OLS_NAMESPACE, '-o', 'json'], kubeconfigPath);
  if (podsJson) {
    try {
      const pods = JSON.parse(podsJson);
      for (const pod of pods.items || []) {
        const podName = pod.metadata?.name;
        const containers = (pod.spec?.containers || []).map((c: { name: string }) => c.name);
        for (const container of containers) {
          const logs = runOC(
            ['logs', `pod/${podName}`, '-c', container, '-n', OLS_NAMESPACE],
            kubeconfigPath,
          );
          if (logs) {
            fs.writeFileSync(path.join(podLogsDir, `${podName}-${container}.log`), logs);
          }
        }
      }
    } catch (e: unknown) {
      console.error(`Failed to parse pod JSON: ${e}`);
    }
  }

  console.log(`Cluster artifacts gathered in ${clusterDir}`);
}

export default defineConfig({
  screenshotsFolder: './gui_test_screenshots/cypress/screenshots',
  screenshotOnRunFailure: true,
  trashAssetsBeforeRuns: true,
  videosFolder: './gui_test_screenshots/cypress/videos',
  video: true,
  videoCompression: false,
  reporter: 'mocha-junit-reporter',
  reporterOptions: {
    mochaFile: './gui_test_screenshots/junit_cypress-[hash].xml',
    toConsole: false,
  },
  expose: {
    grepFilterSpecs: true,
  },
  fixturesFolder: 'fixtures',
  defaultCommandTimeout: 30000,
  retries: {
    runMode: 0,
    openMode: 0,
  },
  viewportWidth: 1440,
  viewportHeight: 900,
  e2e: {
    baseUrl: 'http://localhost:9000',
    setupNodeEvents(on, config) {
      on(
        'before:browser:launch',
        (
          browser = {
            name: '',
            family: 'chromium',
            channel: '',
            displayName: '',
            version: '',
            majorVersion: '',
            path: '',
            isHeaded: false,
            isHeadless: false,
          },
          launchOptions,
        ) => {
          if (browser.family === 'chromium' && browser.name !== 'electron') {
            // Auto open devtools
            launchOptions.args.push('--enable-precise-memory-info');
            if (browser.isHeadless) {
              launchOptions.args.push('--no-sandbox');
              launchOptions.args.push('--disable-gl-drawing-for-tests');
              launchOptions.args.push('--disable-gpu');
            }
          }

          return launchOptions;
        },
      );
      // `on` is used to hook into various events Cypress emits
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
        logError(message) {
          console.error(message);
          return null;
        },
        logTable(data) {
          console.table(data);
          return null;
        },
      });
      cypressGrepPlugin(config);
      on('after:spec', (spec: Cypress.Spec, results: CypressCommandLine.RunResult) => {
        if (results && results.video) {
          // Do we have failures for any retry attempts?
          const failures = results.tests.some((test) =>
            test.attempts.some((attempt) => attempt.state === 'failed'),
          );
          if (!failures && fs.existsSync(results.video)) {
            // Delete the video if the spec passed and no tests retried
            fs.unlinkSync(results.video);
          }
        }
        console.log('Gathering cluster artifacts...');
        gatherClusterArtifacts(config.env.KUBECONFIG_PATH || '');
      });
      return config;
    },
    supportFile: './cypress/support/e2e.js',
    specPattern: 'tests/**/*.cy.{js,jsx,ts,tsx}',
    numTestsKeptInMemory: 1,
    testIsolation: false,
    experimentalModifyObstructiveThirdPartyCode: true,
    experimentalOriginDependencies: true,
    experimentalMemoryManagement: true,
  },
});
