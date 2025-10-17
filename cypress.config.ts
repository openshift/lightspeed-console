import { defineConfig } from 'cypress';
import * as fs from 'fs';
import * as console from 'console';

export default defineConfig({
  screenshotsFolder: './gui_test_screenshots/cypress/screenshots',
  screenshotOnRunFailure: true,
  trashAssetsBeforeRuns: true,
  videosFolder: './gui_test_screenshots/cypress/videos',
  video: true,
  videoCompression: false,
  reporter: './node_modules/cypress-multi-reporters',
  reporterOptions: {
    configFile: 'reporter-config.json',
  },
  env: {
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
        readFileIfExists(filename) {
          if (fs.existsSync(filename)) {
            return fs.readFileSync(filename, 'utf8');
          }
          return null;
        },
      });
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
          const skipped = results.tests.some((test) =>
            test.attempts.some((attempt) => attempt.state === 'skipped'),
          );
          // Force fail tests if any test is skipped
          // Tests are skipped whenever there's a failure in the before hook but the job succeeds
          // Need to be rethinked if we start purposedly skipping tests
          if (skipped) {
            throw new Error('Test skipped, failing pipeline');
          }
        }
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
