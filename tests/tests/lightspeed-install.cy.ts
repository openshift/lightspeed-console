import { operatorHubPage } from '../views/operator-hub-page';
import { Pages } from '../views/pages';
import { searchPage } from '../views/search';

const OLS = {
  namespace: 'openshift-lightspeed',
  packageName: 'lightspeed-operator',
  operatorName: 'OpenShift Lightspeed Operator',
  config: {
    kind: 'OLSConfig',
    name: 'cluster',
  },
};

const popover = '.ols-plugin__popover-container';
const attachments = `${popover} .ols-plugin__chat-prompt-attachments`;
const attachMenuButton = `${popover} .ols-plugin__attach-menu`;
const attachMenu = `${popover} .ols-plugin__context-menu`;
const promptInput = `${popover} textarea`;
const modal = '.ols-plugin__modal';

const podName = 'lightspeed-console-plugin';

describe('Lightspeed related features', () => {
  before(() => {
    cy.adminCLI(
      `oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`,
    );
    // Getting the oauth url for hypershift cluster login
    cy.exec(
      `oc get oauthclient openshift-browser-client -o go-template --template="{{index .redirectURIs 0}}" --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
    ).then((result) => {
      if (expect(result.stderr).to.be.empty) {
        const oauth = result.stdout;
        // Trimming the origin part of the url
        const oauthurl = new URL(oauth);
        const oauthorigin = oauthurl.origin;
        cy.log(oauthorigin);
        cy.wrap(oauthorigin).as('oauthorigin');
      } else {
        throw new Error(`Execution of oc get oauthclient failed
          Exit code: ${result.code}
          Stdout:\n${result.stdout}
          Stderr:\n${result.stderr}`);
      }
    });
    cy.get('@oauthorigin').then((oauthorigin) => {
      cy.login(
        Cypress.env('LOGIN_IDP'),
        Cypress.env('LOGIN_USERNAME'),
        Cypress.env('LOGIN_PASSWORD'),
        oauthorigin,
      );
    });
  });

  after(() => {
    // Delete entire namespace to delete operator and ensure everything else is cleaned up
    cy.adminCLI(`oc delete namespace ${OLS.namespace}`, { failOnNonZeroExit: false });

    // Delete config
    cy.exec(
      `oc delete ${OLS.config.kind} ${OLS.config.name} -n ${OLS.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
    );

    cy.adminCLI(
      `oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`,
    );
  });

  it(
    '(OLS-427,jfula,Lightspeed) Deploy OpenShift Lightspeed operator via web console',
    { tags: ['e2e', 'admin', '@smoke'] },
    () => {
      if (Cypress.env('BUNDLE_IMAGE')) {
        cy.exec(
          `oc create namespace ${OLS.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        );
        cy.exec(
          `operator-sdk run bundle --timeout=5m --namespace ${OLS.namespace} ${Cypress.env('BUNDLE_IMAGE')} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} --verbose `,
          { timeout: 6 * 60 * 1000 },
        );
      } else {
        operatorHubPage.installOperator(OLS.packageName, 'redhat-operators');
        cy.get('.co-clusterserviceversion-install__heading', { timeout: 5 * 60 * 1000 }).should(
          'include.text',
          'ready for use',
        );
      }

      const config = `apiVersion: ols.openshift.io/v1alpha1
kind: ${OLS.config.kind}
metadata:
  name: ${OLS.config.name}
spec:
  llm:
    providers:
      - type: openai
        name: openai
        credentialsSecretRef:
          name: openai-api-keys
        url: https://api.openai.com/v1
        models:
          - name: gpt-3.5-turbo
  ols:
    defaultModel: gpt-3.5-turbo
    defaultProvider: openai
    logLevel: INFO`;
      cy.exec(`echo '${config}' | oc create -f - --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

      cy.get('.pf-v5-c-alert', { timeout: 2 * 60 * 1000 }).should(
        'include.text',
        'Web console update is available',
      );

      //Install the OpenShift Lightspeed catalog source
      // lightUtils.installOperator(OLS.namespace, OLS.packageName, "redhat-operators", catalogSource.channel(OLS.packageName), catalogSource.version(OLS.packageName), false, OLS.operatorName);
      //Install the OpenShift Lightspeed Operator with console plugin
    },
  );

  it(
    '(OLS-743,anpicker,Lightspeed) Test OpenShift Lightspeed with pod',
    { tags: ['e2e', 'admin', '@smoke'] },
    () => {
      Pages.gotoPodsList();

      cy.get('.ols-plugin__popover-button', { timeout: 5 * 30 * 1000 })
        .should('exist')
        .click();

      // Test that popover UI was opened
      cy.get(popover)
        .should('exist')
        .find('h1')
        .should('include.text', 'Red Hat OpenShift Lightspeed');

      // Test that we can submit a prompt
      cy.get(promptInput).should('exist').type('What is OpenShift?{enter}');
      cy.get(popover).find('.ols-plugin__chat-entry--ai').should('exist');

      // Test that the context menu has no context for the pods list page
      cy.get(attachMenuButton).should('be.disabled');

      // Navigate to the pod details page
      searchPage.searchBy(podName);
      cy.get('[data-test-rows="resource-row"]', { timeout: 30 * 1000 }).should(
        'have.length.at.least',
        1,
      );

      cy.get('[data-test-rows="resource-row"]:first-of-type [id="name"] a', {
        timeout: 30 * 1000,
      }).click();

      // There should be not prompt attachments initially
      cy.get(attachments).should('be.empty');

      // Test that the context menu now has options
      cy.get(attachMenuButton).click();
      cy.get(attachMenu)
        .should('include.text', 'YAML')
        .should('include.text', 'status')
        .should('include.text', 'Events')
        .should('include.text', 'Logs');
    },
  );

  it(
    '(OLS-745,anpicker,Lightspeed) Test attaching YAML',
    { tags: ['e2e', 'admin', '@smoke'] },
    () => {
      // Test attaching pod YAML
      cy.get(attachMenu).find('li:first-of-type button').contains('YAML').click();
      cy.get(attachments)
        .should('include.text', podName)
        .should('include.text', 'YAML')
        .find('button')
        .contains(podName)
        .should('have.lengthOf', 1)
        .click();
      cy.get(modal)
        .should('include.text', 'Preview attachment')
        .should('include.text', podName)
        .should('include.text', 'kind: Pod')
        .should('include.text', 'apiVersion: v1')
        .find('button')
        .contains('Dismiss')
        .click();
      cy.get(promptInput).type('Test{enter}');

      // Test attaching pod YAML status section
      cy.get(attachMenuButton).click();
      cy.get(attachMenu).find('button').contains('status').click();
      cy.get(attachments)
        .should('include.text', podName)
        .should('include.text', 'YAML Status')
        .find('button')
        .contains(podName)
        .should('have.lengthOf', 1)
        .click();
      cy.get(modal)
        .should('include.text', 'Preview attachment')
        .should('include.text', podName)
        .should('include.text', 'kind: Pod')
        .should('not.contain', 'apiVersion: v1')
        .find('button')
        .contains('Dismiss')
        .click();
      cy.get(promptInput).type('Test{enter}');
    },
  );

  it(
    '(OLS-746,anpicker,Lightspeed) Test attaching events',
    { tags: ['e2e', 'admin', '@smoke'] },
    () => {
      cy.get(attachMenuButton).click();
      cy.get(attachMenu).find('button').contains('Events').click();
      cy.get(modal).should('include.text', 'Configure events attachment');
      cy.get(modal).find('button').contains('Attach').click();
      cy.get(attachments)
        .should('include.text', podName)
        .should('include.text', 'Events')
        .find('button')
        .contains(podName)
        .should('have.lengthOf', 1)
        .click();
      cy.get(modal)
        .should('include.text', 'Preview attachment')
        .should('include.text', podName)
        .should('include.text', 'kind: Event')
        .find('button')
        .contains('Dismiss')
        .click();
      cy.get(promptInput).type('Test{enter}');
    },
  );

  it(
    '(OLS-747,anpicker,Lightspeed) Test attaching logs',
    { tags: ['e2e', 'admin', '@smoke'] },
    () => {
      cy.get(attachMenuButton).click();
      cy.get(attachMenu).find('button').contains('Logs').click();
      cy.get(modal)
        .should('include.text', 'Configure log attachment')
        .should('include.text', 'Most recent 25 lines')
        .find('button')
        .contains('Attach')
        .click();
      cy.get(attachments)
        .should('include.text', podName)
        .should('include.text', 'Log')
        .find('button')
        .contains(podName)
        .should('have.lengthOf', 1)
        .click();
      cy.get(modal)
        .should('include.text', 'Preview attachment')
        .should('include.text', podName)
        .should('include.text', 'Most recent lines from the log for')
        .find('button')
        .contains('Dismiss')
        .click();
      cy.get(promptInput).type('Test{enter}');
    },
  );
});
