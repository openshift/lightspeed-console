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

const popover = '.ols-plugin__popover';
const mainButton = '.ols-plugin__popover-button';
const minimizeButton = `${popover} .ols-plugin__popover-control[title=Minimize]`;
const expandButton = `${popover} .ols-plugin__popover-control[title=Expand]`;
const collapseButton = `${popover} .ols-plugin__popover-control[title=Collapse]`;
const userChatEntry = `${popover} .ols-plugin__chat-entry--user`;
const aiChatEntry = `${popover} .ols-plugin__chat-entry--ai`;
const attachments = `${popover} .ols-plugin__chat-prompt-attachments`;
const attachMenuButton = `${popover} .ols-plugin__attach-menu`;
const attachMenu = `${popover} .ols-plugin__context-menu`;
const fileInput = 'input[type="file"]';
const promptInput = `${popover} textarea`;
const modal = '.ols-plugin__modal';

const podName = 'lightspeed-console-plugin';

const MINUTE = 60 * 1000;

const CONVERSATION_ID = '5f424596-a4f9-4a3a-932b-46a768de3e7c';
const POPOVER_TITLE = 'Red Hat OpenShift Lightspeed';
const PROMPT_SUBMITTED = 'What is OpenShift?';
const PROMPT_NOT_SUBMITTED = 'Test prompt that should not be submitted';

const FOOTER_TEXT = 'Always review AI generated content prior to use.';
const PRIVACY_TEXT =
  "OpenShift Lightspeed uses AI technology to help answer your questions. Do not include personal information or other sensitive information in your input. Interactions may be used to improve Red Hat's products or services.";

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
    // If UI_install exists, install via UI
    // If running in nudges or pre-release, install with BUNDLE_IMAGE
    // Otherwise install the latest operator
    if (Cypress.env('UI_INSTALL')) {
      operatorHubPage.installOperator(OLS.packageName, 'redhat-operators');
      cy.get('.co-clusterserviceversion-install__heading', { timeout: 5 * MINUTE }).should(
        'include.text',
        'ready for use',
      );
    } else if (Cypress.env('BUNDLE_IMAGE')) {
      cy.exec(
        `oc create namespace ${OLS.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );
      cy.exec(
        `oc label namespaces ${OLS.namespace} openshift.io/cluster-monitoring=true --overwrite=true --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );
      cy.exec(
        `operator-sdk run bundle --timeout=20m --namespace ${OLS.namespace} ${Cypress.env('BUNDLE_IMAGE')} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} --verbose `,
        { timeout: 6 * MINUTE },
      );
    } else {
      cy.exec(
        `oc create namespace ${OLS.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );
      cy.exec(
        `oc label namespaces ${OLS.namespace} openshift.io/cluster-monitoring=true --overwrite=true --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );
      cy.exec(
        `operator-sdk run bundle --timeout=20m --namespace ${OLS.namespace} quay.io/openshift-lightspeed/lightspeed-operator-bundle:latest --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} --verbose `,
        { timeout: 6 * MINUTE },
      );
    }
    // If the console image exists, replace image in csv and restart operator
    // Console pod will restart automatically.
    if (Cypress.env('CONSOLE_IMAGE')) {
      cy.exec(
        `oc get clusterserviceversion --namespace=${OLS.namespace} -o name --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        (result) => {
          if (expect(result.stderr).to.be.empty) {
            const csvname = result.stdout;
            // If console image exists, replace it in csv
            cy.exec(
              `oc scale --replicas=0 deployment/lightspeed-operator-controller-manager --namespace=${OLS.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
            );
            cy.exec(
              `oc patch ${csvname} --namespace=${OLS.namespace} --type='json' -p='[{"op": "replace", "path": "/spec/relatedImages/1/image", "value":"${Cypress.env('CONSOLE_IMAGE')}"}]' --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
            );
            cy.exec(
              `oc patch ${csvname} --namespace=${OLS.namespace} --type='json' -p='[{"op": "replace", "path": "/spec/install/spec/deployments/0/spec/template/spec/containers/0/args/6", "value":"--console-image=${Cypress.env('CONSOLE_IMAGE')}"}]' --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
            );
            cy.exec(
              `oc scale --replicas=1 deployment/lightspeed-operator-controller-manager --namespace=${OLS.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
            );
          } else {
            throw new Error(`Getting csv name failed
              Exit code: ${result.code}
              Stdout:\n${result.stdout}
              Stderr:\n${result.stderr}`);
          }
        },
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
          - name: gpt-4o-mini
  ols:
    defaultModel: gpt-4o-mini
    defaultProvider: openai
    logLevel: INFO`;
    cy.exec(`echo '${config}' | oc create -f - --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

    cy.get('.pf-v5-c-alert')
      .contains('Web console update is available', { timeout: 2 * MINUTE })
      .should('exist');
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

  it('OpenShift Lightspeed popover UI is loaded and basic functionality is working', () => {
    cy.visit('/');

    cy.get(mainButton, { timeout: 5 * MINUTE })
      .should('exist')
      .click();

    // Test that popover UI was opened
    cy.get(popover).should('exist').find('h1').should('include.text', POPOVER_TITLE);
    cy.get(popover)
      .should('exist')
      .should('include.text', FOOTER_TEXT)
      .should('include.text', PRIVACY_TEXT);

    // Test that we can submit a prompt
    cy.get(promptInput).should('exist').type(`${PROMPT_SUBMITTED}{enter}`);
    cy.get(userChatEntry).contains(PROMPT_SUBMITTED).should('exist');
    cy.get(aiChatEntry).should('exist');

    // Populate the prompt input, but don't submit it
    cy.get(promptInput).type(PROMPT_NOT_SUBMITTED);

    // Minimize the popover UI
    cy.get(minimizeButton).click();
    cy.get(popover).should('not.exist');

    // Open the popover UI again
    // Previous messages and text in the prompt input should have been preserved
    cy.get(mainButton).click();
    cy.get(userChatEntry).contains(PROMPT_SUBMITTED).should('exist');
    cy.get(aiChatEntry).should('exist');
    cy.get(promptInput).contains(PROMPT_NOT_SUBMITTED).should('exist');

    // When expanded, the popover width should fill most of the viewport
    const isExpanded = (popoverElement) =>
      Cypress.config('viewportWidth') - popoverElement.getBoundingClientRect().width < 200;

    // When collapsed, the popover width should be less than half the viewport width
    const isCollapsed = (popoverElement) =>
      popoverElement.getBoundingClientRect().width < Cypress.config('viewportWidth') / 2;

    // Expand UI button
    cy.get(expandButton).click();
    cy.get(popover)
      .should('exist')
      .should((els) => {
        expect(isExpanded(els[0])).to.be.true;
      });

    // Minimize the popover UI
    cy.get(minimizeButton).click();
    cy.get(popover).should('not.exist');

    // Reopen the UI by clicking the main OLS button
    cy.get(mainButton).click();
    cy.get(popover).should('exist');

    // Main OLS button should toggle between closed and open states and preserve the expanded state
    cy.get(mainButton).click();
    cy.get(popover).should('not.exist');
    cy.get(mainButton).click();
    cy.get(popover)
      .should('exist')
      .should((els) => {
        expect(isExpanded(els[0])).to.be.true;
      });

    // Collapse UI button
    cy.get(collapseButton).click();
    cy.get(popover)
      .should('exist')
      .should((els) => {
        expect(isCollapsed(els[0])).to.be.true;
      });

    // Main OLS button should toggle between closed and open states and preserve the collapsed state
    cy.get(mainButton).click();
    cy.get(popover).should('not.exist');
    cy.get(mainButton).click();
    cy.get(popover)
      .should('exist')
      .should((els) => {
        expect(isCollapsed(els[0])).to.be.true;
      });

    // Previous messages and text in the prompt input should have been preserved
    cy.get(userChatEntry).contains(PROMPT_SUBMITTED).should('exist');
    cy.get(aiChatEntry).should('exist');
    cy.get(promptInput).contains(PROMPT_NOT_SUBMITTED).should('exist');
  });

  it('Test submitting a prompt and fetching the streamed response', () => {
    cy.visit('/search/all-namespaces');
    cy.get(mainButton).click();

    const mockStreamedResponseBody = `
data: {"event": "start", "data": {"conversation_id": "${CONVERSATION_ID}"}}

data: {"event": "token", "data": {"id": 0, "token": "Mock"}}

data: {"event": "token", "data": {"id": 1, "token": " OLS"}}

data: {"event": "token", "data": {"id": 2, "token": " response"}}

data: {"event": "end", "data": {"referenced_documents": [], "truncated": false}}
`;

    cy.intercept(
      'POST',
      '/api/proxy/plugin/lightspeed-console-plugin/ols/v1/streaming_query',
      (request) => {
        expect(request.body.attachments).to.deep.equal([]);
        expect(request.body.conversation_id).to.equal(null);
        expect(request.body.media_type).to.equal('application/json');
        expect(request.body.query).to.equal(PROMPT_SUBMITTED);
        request.reply({ body: mockStreamedResponseBody, delay: 1000 });
      },
    ).as('promptStub');

    cy.get(promptInput).type(`${PROMPT_SUBMITTED}{enter}`);
    cy.get(popover).contains('Waiting for LLM provider...');
    cy.wait('@promptStub');

    // Prompt should now be empty
    cy.get(promptInput).should('have.value', '');

    // Our prompt should now be shown in the chat history along with a response from OLS
    cy.get(userChatEntry).contains(PROMPT_SUBMITTED);
    cy.get(aiChatEntry).should('exist').contains('Mock OLS response');

    // Sending a second prompt should now send the conversation_id along with the prompt
    const PROMPT_SUBMITTED_2 = 'Test prompt 2';
    cy.intercept(
      'POST',
      '/api/proxy/plugin/lightspeed-console-plugin/ols/v1/streaming_query',
      (request) => {
        expect(request.body.attachments).to.deep.equal([]);
        expect(request.body.conversation_id).to.equal(CONVERSATION_ID);
        expect(request.body.media_type).to.equal('application/json');
        expect(request.body.query).to.equal(PROMPT_SUBMITTED_2);
        request.reply({ body: mockStreamedResponseBody, delay: 1000 });
      },
    ).as('promptStub2');

    cy.get(promptInput).type(`${PROMPT_SUBMITTED_2}{enter}`);
    cy.get(popover).contains('Waiting for LLM provider...');
    cy.wait('@promptStub2');

    cy.get(promptInput).should('have.value', '');
    cy.get(userChatEntry).contains(PROMPT_SUBMITTED_2);
    cy.get(aiChatEntry).should('exist').contains('Mock OLS response');
  });

  it('Test OpenShift Lightspeed with pod (OLS-743)', () => {
    // Navigate to the pod details page
    Pages.gotoPodsList();

    cy.get(mainButton).click();
    cy.get(popover).should('exist');

    searchPage.searchBy(podName);
    cy.get('[data-test-rows="resource-row"]', { timeout: 2 * MINUTE }).should(
      'have.length.at.least',
      1,
    );

    cy.get('[data-test-rows="resource-row"]:first-of-type [id="name"] a').click();

    // There should be not prompt attachments initially
    cy.get(attachments).should('be.empty');

    // Test that the context menu now has options
    cy.get(attachMenuButton).click();
    cy.get(attachMenu, { timeout: MINUTE })
      .should('include.text', 'Full YAML file')
      .should('include.text', 'Filtered YAML')
      .should('include.text', 'Events')
      .should('include.text', 'Logs');
  });

  it('Test attaching YAML (OLS-745)', () => {
    // Test attaching pod YAML
    cy.get(attachMenu).find('li:first-of-type button').contains('Full YAML file').click();
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
    cy.get(attachMenu).find('button').contains('Filtered YAML').click();
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
      .should('not.contain', 'apiVersion: v1')
      .find('button')
      .contains('Dismiss')
      .click();
    cy.get(promptInput).type('Test{enter}');
  });

  it('Test attaching events (OLS-746)', () => {
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
  });

  it('Test attaching logs (OLS-747)', () => {
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
  });

  it('Test file upload', () => {
    const MAX_FILE_SIZE_KB = 500;

    cy.visit('/');
    cy.get(mainButton).click();
    cy.get(attachMenuButton).click();
    cy.contains('Upload from computer').click();

    // File with invalid YAML
    cy.get(fileInput).selectFile(
      {
        contents: Cypress.Buffer.from(`abc`),
      },
      // Use `force: true` because the input is display:none
      { force: true },
    );
    cy.get(attachMenu).contains('Uploaded file is not valid YAML');

    // File that is too large
    const largeFileContent = 'a'.repeat(MAX_FILE_SIZE_KB * 1024 + 1);
    cy.get(fileInput).selectFile(
      {
        contents: Cypress.Buffer.from(largeFileContent),
      },
      { force: true },
    );
    cy.get(attachMenu).contains(`Uploaded file is too large. Max size is ${MAX_FILE_SIZE_KB} KB.`);

    // Valid YAML Upload
    cy.get(fileInput).selectFile(
      {
        contents: Cypress.Buffer.from(`
kind: Pod
metadata:
  name: my-test-pod
  namespace: test-namespace
`),
      },
      { force: true },
    );
  });
});
