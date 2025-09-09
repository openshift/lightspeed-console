import '../../cypress/support/commands';
import { operatorHubPage } from '../views/operator-hub-page';
import { listPage, pages } from '../views/pages';

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
const clearChatButton = `${popover} .ols-plugin__popover-clear-chat`;
const userChatEntry = `${popover} .ols-plugin__chat-entry--user`;
const aiChatEntry = `${popover} .ols-plugin__chat-entry--ai`;
const attachments = `${popover} .ols-plugin__chat-prompt-attachments`;
const attachMenuButton = `${popover} .ols-plugin__attach-menu`;
const attachMenu = `${popover} .ols-plugin__context-menu`;
const fileInput = 'input[type="file"]';
const promptInput = `${popover} textarea`;
const userFeedback = `${popover} .ols-plugin__feedback`;
const responseAction = `${userFeedback} .ols-plugin__response-action`;
const copyButton = `${userFeedback} #ols-plugin-copy-button`;
const userFeedbackInput = `${userFeedback} textarea`;
const userFeedbackSubmit = `${userFeedback} button.pf-m-primary`;
const modal = '.ols-plugin__modal';

const podNamePrefix = 'console';

const MINUTE = 60 * 1000;

const CONVERSATION_ID = '5f424596-a4f9-4a3a-932b-46a768de3e7c';

const PROMPT_SUBMITTED = 'What is OpenShift?';
const PROMPT_NOT_SUBMITTED = 'Test prompt that should not be submitted';
const USER_FEEDBACK_SUBMITTED = 'Good answer!\nMultiple lines\n\n(@#$%^&*) 😀 文字';

const POPOVER_TITLE = 'Red Hat OpenShift Lightspeed';
const FOOTER_TEXT = 'Always review AI generated content prior to use.';
const PRIVACY_TEXT =
  "OpenShift Lightspeed uses AI technology to help answer your questions. Do not include personal information or other sensitive information in your input. Interactions may be used to improve Red Hat's products or services.";

const CLEAR_CHAT_TEXT =
  'Are you sure you want to erase the current chat conversation and start a new chat? This action cannot be undone.';
const CLEAR_CHAT_CONFIRM_BUTTON = 'Erase and start new chat';

const READINESS_TITLE = 'Waiting for OpenShift Lightspeed service';
const READINESS_TEXT =
  'The OpenShift Lightspeed service is not yet ready to receive requests. If this message persists, please check the OLSConfig.';

const USER_FEEDBACK_TITLE = 'Why did you choose this rating?';
const USER_FEEDBACK_TEXT =
  "Do not include personal information or other sensitive information in your feedback. Feedback may be used to improve Red Hat's products or services.";
const USER_FEEDBACK_RECEIVED_TEXT = 'Thank you for your feedback!';
const THUMBS_DOWN = -1;
const THUMBS_UP = 1;

const WAITING_FOR_RESPONSE_TEXT = 'Waiting for LLM provider...';

const MOCK_STREAMED_RESPONSE_TEXT = 'Mock OLS response';

describe('Lightspeed related features', () => {
  before(() => {
    cy.adminCLI(
      `oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`,
    );
    // Getting the oauth url for hypershift cluster login
    cy.exec(
      `oc get oauthclient openshift-browser-client -o go-template --template="{{index .redirectURIs 0}}" --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
    ).then((result) => {
      if (result.stderr === '') {
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
        String(oauthorigin),
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
      ).then((result) => {
        if (result.stderr === '') {
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
      });
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

    cy.get('body').then(($body) => {
      if ($body.find('.pf-v5-c-alert:contains("Web console update is available")').length > 0) {
        cy.get('.pf-v5-c-alert', { timeout: 2 * MINUTE })
          .contains('Web console update is available', { timeout: 2 * MINUTE })
          .should('exist');
      } else {
        cy.get(mainButton, { timeout: 5 * MINUTE }).should('exist');
      }
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

  it('OpenShift Lightspeed popover UI is loaded and basic functionality is working', () => {
    cy.visit('/');

    cy.get(mainButton, { timeout: 5 * MINUTE })
      .should('exist')
      .click();

    // Test that popover UI was opened
    cy.get(popover)
      .should('exist')
      .should('include.text', FOOTER_TEXT)
      .should('include.text', PRIVACY_TEXT)
      .should('include.text', READINESS_TITLE)
      .should('include.text', READINESS_TEXT)
      .find('h1')
      .should('include.text', POPOVER_TITLE);

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
      })
      .should('include.text', FOOTER_TEXT)
      .should('include.text', PRIVACY_TEXT)
      .should('include.text', READINESS_TITLE)
      .should('include.text', READINESS_TEXT);

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

    cy.interceptQuery('queryStub', PROMPT_SUBMITTED);
    cy.get(promptInput).type(`${PROMPT_SUBMITTED}{enter}`);
    cy.get(popover).contains(WAITING_FOR_RESPONSE_TEXT);
    cy.wait('@queryStub');

    // Prompt should now be empty
    cy.get(promptInput).should('have.value', '');

    // Our prompt should now be shown in the chat history along with a response from OLS
    cy.get(userChatEntry).contains(PROMPT_SUBMITTED);
    cy.get(aiChatEntry).should('exist').contains(MOCK_STREAMED_RESPONSE_TEXT);

    // Sending a second prompt should now send the conversation_id along with the prompt
    const PROMPT_SUBMITTED_2 = 'Test prompt 2';
    cy.interceptQuery('queryWithConversationIdStub', PROMPT_SUBMITTED_2, CONVERSATION_ID);
    cy.get(promptInput).type(`${PROMPT_SUBMITTED_2}{enter}`);
    cy.get(popover).contains(WAITING_FOR_RESPONSE_TEXT);
    cy.wait('@queryWithConversationIdStub');

    cy.get(promptInput).should('have.value', '');
    cy.get(userChatEntry).contains(PROMPT_SUBMITTED_2);
    cy.get(aiChatEntry).should('exist').contains(MOCK_STREAMED_RESPONSE_TEXT);

    // The clear chat action should clear the current conversation, but leave any text in the prompt
    cy.get(promptInput).type(PROMPT_NOT_SUBMITTED);
    cy.get(clearChatButton).should('exist').contains('Clear chat').click();
    cy.get(modal).should('exist').contains(CLEAR_CHAT_TEXT);
    cy.get(modal).find('button').contains(CLEAR_CHAT_CONFIRM_BUTTON).click();
    cy.get(userChatEntry).should('not.exist');
    cy.get(aiChatEntry).should('not.exist');
    cy.get(popover)
      .should('include.text', FOOTER_TEXT)
      .should('include.text', PRIVACY_TEXT)
      .find('h1')
      .should('include.text', POPOVER_TITLE);
    cy.get(promptInput).should('have.value', PROMPT_NOT_SUBMITTED);
  });

  it('Test user feedback form', () => {
    cy.visit('/search/all-namespaces');
    cy.get(mainButton).click();

    cy.interceptQuery('queryStub', PROMPT_SUBMITTED);
    cy.get(promptInput).type(`${PROMPT_SUBMITTED}{enter}`);
    cy.get(popover).contains(WAITING_FOR_RESPONSE_TEXT);
    cy.wait('@queryStub');

    // Should have 3 response action buttons (thumbs up, thumbs down, and copy)
    cy.get(responseAction).should('have.lengthOf', 3);

    // Clicking a user feedback button should select it and open the user feedback form
    cy.get(responseAction)
      .eq(0)
      .should('not.have.class', 'ols-plugin__response-action--selected')
      .click()
      .should('have.class', 'ols-plugin__response-action--selected');
    cy.get(popover).contains(USER_FEEDBACK_TITLE);
    cy.get(popover).contains(USER_FEEDBACK_TEXT);

    // Clicking the other user feedback button should select that instead and leave the user
    // feedback form open
    cy.get(responseAction)
      .eq(1)
      .should('not.have.class', 'ols-plugin__response-action--selected')
      .click()
      .should('have.class', 'ols-plugin__response-action--selected');
    cy.get(popover).contains(USER_FEEDBACK_TITLE);
    cy.get(popover).contains(USER_FEEDBACK_TEXT);

    // Clicking the same button again should deselect it and close the user feedback form
    cy.get(responseAction)
      .eq(1)
      .click()
      .should('not.have.class', 'ols-plugin__response-action--selected');
    cy.get(popover)
      .should('not.contain', USER_FEEDBACK_TITLE)
      .should('not.contain', USER_FEEDBACK_TEXT);

    // Reopen the form and submit some feedback
    cy.interceptFeedback(
      'userFeedbackStub',
      CONVERSATION_ID,
      THUMBS_UP,
      USER_FEEDBACK_SUBMITTED,
      `${PROMPT_SUBMITTED}\n---\nThe attachments that were sent with the prompt are shown below.\n[]`,
    );

    cy.get(responseAction).eq(0).click();
    cy.get(userFeedbackInput).type(USER_FEEDBACK_SUBMITTED);
    cy.get(userFeedbackSubmit).click();
    cy.wait('@userFeedbackStub');
    cy.get(popover).contains(USER_FEEDBACK_RECEIVED_TEXT);

    // It should also be possible to submit user feedback without a comment
    cy.interceptFeedback(
      'userFeedbackWithoutCommentStub',
      CONVERSATION_ID,
      THUMBS_DOWN,
      '',
      `${PROMPT_SUBMITTED}\n---\nThe attachments that were sent with the prompt are shown below.\n[]`,
    );

    cy.get(responseAction).eq(1).click();
    cy.get(userFeedbackInput).clear();
    cy.get(userFeedbackSubmit).click();
    cy.wait('@userFeedbackWithoutCommentStub');
    cy.get(popover).contains(USER_FEEDBACK_RECEIVED_TEXT);
  });

  it('Test copy response functionality', () => {
    cy.visit('/search/all-namespaces');
    cy.get(mainButton).click();

    cy.interceptQuery('queryStub', PROMPT_SUBMITTED);
    cy.get(promptInput).type(`${PROMPT_SUBMITTED}{enter}`);
    cy.get(popover).contains(WAITING_FOR_RESPONSE_TEXT);
    cy.wait('@queryStub');

    cy.get(copyButton)
      .should('exist')
      .should('have.class', 'ols-plugin__response-action')
      .should('not.have.class', 'ols-plugin__response-action--selected');
    cy.window().focus();
    cy.get(copyButton).click();

    // Verify that none of the response action buttons changed state
    cy.get(copyButton).should('not.have.class', 'ols-plugin__response-action--selected');
    cy.get(responseAction).eq(0).should('not.have.class', 'ols-plugin__response-action--selected');
    cy.get(responseAction).eq(1).should('not.have.class', 'ols-plugin__response-action--selected');
  });

  it('Test attach options on pods list page', () => {
    pages.goToPodsList('openshift-console');
    cy.get(mainButton).click();
    cy.get(popover).should('exist');

    // The only attach option should be the upload file option
    cy.get(attachMenuButton).click();
    cy.get(attachMenu)
      .should('include.text', 'Upload from computer')
      .should('not.include.text', 'YAML')
      .should('not.include.text', 'Events')
      .should('not.include.text', 'Logs');
  });

  it('Test attach options on pod details page', () => {
    // Navigate to the pod details page
    pages.goToPodsList();

    cy.get(mainButton).click();
    cy.get(popover).should('exist');

    listPage.filter.byName(podNamePrefix);
    cy.get('[data-test-rows="resource-row"]', { timeout: 2 * MINUTE }).should(
      'have.length.at.least',
      1,
    );

    // The only attach option should be the upload file option
    cy.get(attachMenuButton).click();
    cy.get(attachMenu)
      .should('include.text', 'Upload from computer')
      .should('not.include.text', 'YAML')
      .should('not.include.text', 'Events')
      .should('not.include.text', 'Logs');
  });

  it('Test attach options on pod details page', () => {
    pages.goToPodDetails('openshift-console', podNamePrefix);
    cy.get(mainButton).click();
    cy.get(popover).should('exist');

    // There should be not prompt attachments initially
    cy.get(attachments).should('be.empty');

    // Test that the context menu now has options
    cy.get(attachMenuButton).click();
    cy.get(attachMenu, { timeout: MINUTE })
      .should('include.text', 'Full YAML file')
      .should('include.text', 'Filtered YAML')
      .should('include.text', 'Events')
      .should('include.text', 'Logs')
      .should('include.text', 'Upload from computer');
  });

  it('Test attaching YAML (OLS-745)', () => {
    pages.goToPodDetails('openshift-console', podNamePrefix);
    cy.get(mainButton).click();
    cy.get(popover).should('exist');

    // Test attaching pod YAML
    cy.get(attachMenuButton).click();
    cy.get(attachMenu).find('li:first-of-type button').contains('Full YAML file').click();
    cy.get(attachments)
      .should('include.text', podNamePrefix)
      .should('include.text', 'YAML')
      .find('button')
      .contains(podNamePrefix)
      .should('have.lengthOf', 1)
      .click();
    cy.get(modal)
      .should('include.text', 'Preview attachment')
      .should('include.text', podNamePrefix)
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
      .should('include.text', podNamePrefix)
      .should('include.text', 'YAML')
      .find('button')
      .contains(podNamePrefix)
      .should('have.lengthOf', 1)
      .click();
    cy.get(modal)
      .should('include.text', 'Preview attachment')
      .should('include.text', podNamePrefix)
      .should('include.text', 'kind: Pod')
      .should('not.contain', 'apiVersion: v1')
      .find('button')
      .contains('Dismiss')
      .click();
    cy.get(promptInput).type('Test{enter}');
  });

  it('Test attaching events (OLS-746)', () => {
    pages.goToPodDetails('openshift-lightspeed', podNamePrefix);
    cy.get(mainButton).click();
    cy.get(popover).should('exist');

    cy.get(attachMenuButton).click();
    cy.get(attachMenu).find('button').contains('Events').click();
    cy.get(modal).should('include.text', 'Configure events attachment');
    cy.get(modal).find('button').contains('Attach').click();
    cy.get(attachments)
      .should('include.text', podNamePrefix)
      .should('include.text', 'Events')
      .find('button')
      .contains(podNamePrefix)
      .should('have.lengthOf', 1)
      .click();
    cy.get(modal)
      .should('include.text', 'Preview attachment')
      .should('include.text', podNamePrefix)
      .should('include.text', 'kind: Event')
      .find('button')
      .contains('Dismiss')
      .click();
    cy.interceptQuery(
      'queryStub',
      PROMPT_SUBMITTED,
      null,
      // eslint-disable-next-line camelcase
      [{ attachment_type: 'event', content_type: 'application/yaml' }],
    );
    cy.get(promptInput).type(`${PROMPT_SUBMITTED}{enter}`);
    cy.wait('@queryStub');

    // Submitting user feedback should now include the attachment information
    cy.interceptFeedback(
      'userFeedbackWithAttachmentStub',
      CONVERSATION_ID,
      THUMBS_UP,
      USER_FEEDBACK_SUBMITTED,
      `${PROMPT_SUBMITTED}\n---\nThe attachments that were sent with the prompt are shown below.\n[\n  {\n    "attachment_type": "event",\n    "content": "- kind: Event`,
    );

    cy.get(responseAction).eq(0).click();
    cy.get(userFeedbackInput).type(USER_FEEDBACK_SUBMITTED);
    cy.get(userFeedbackSubmit).click();
    cy.wait('@userFeedbackWithAttachmentStub');
    cy.get(popover).contains(USER_FEEDBACK_RECEIVED_TEXT);
  });

  it('Test attaching logs (OLS-747)', () => {
    pages.goToPodDetails('openshift-console', podNamePrefix);
    cy.get(mainButton).click();
    cy.get(popover).should('exist');

    cy.get(attachMenuButton).click();
    cy.get(attachMenu).find('button').contains('Logs').click();
    cy.get(modal)
      .should('include.text', 'Configure log attachment')
      .should('include.text', 'Most recent 25 lines')
      .find('button')
      .contains('Attach')
      .click();
    cy.get(attachments)
      .should('include.text', podNamePrefix)
      .should('include.text', 'Log')
      .find('button')
      .contains(podNamePrefix)
      .should('have.lengthOf', 1)
      .click();
    cy.get(modal)
      .should('include.text', 'Preview attachment')
      .should('include.text', podNamePrefix)
      .should('include.text', 'Most recent lines from the log for')
      .find('button')
      .contains('Dismiss')
      .click();
    cy.interceptQuery(
      'queryStub',
      PROMPT_SUBMITTED,
      null,
      // eslint-disable-next-line camelcase
      [{ attachment_type: 'log', content_type: 'text/plain' }],
    );
    cy.get(promptInput).type(`${PROMPT_SUBMITTED}{enter}`);
    cy.wait('@queryStub');
  });

  it('Test file upload', () => {
    const MAX_FILE_SIZE_KB = 500;

    cy.visit('/search/all-namespaces');
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

  it('Test attach cluster info for ManagedCluster', () => {
    // Mock ManagedCluster details page
    cy.visit(
      '/k8s/ns/test-cluster/cluster.open-cluster-management.io~v1~ManagedCluster/test-cluster',
    );
    cy.get(mainButton).click();
    cy.get(popover).should('exist');

    // Test that the attach menu shows "Attach cluster info" option for ManagedCluster
    cy.get(attachMenuButton).click();
    cy.get(attachMenu)
      .should('include.text', 'Attach cluster info')
      .should('include.text', 'Upload from computer')
      .should('not.include.text', 'Full YAML file')
      .should('not.include.text', 'Filtered YAML')
      .should('not.include.text', 'Events')
      .should('not.include.text', 'Logs');

    // Mock the API calls for ManagedCluster and ManagedClusterInfo
    cy.intercept(
      'GET',
      '/api/kubernetes/apis/cluster.open-cluster-management.io/v1/managedclusters/test-cluster',
      {
        statusCode: 200,
        body: {
          kind: 'ManagedCluster',
          apiVersion: 'cluster.open-cluster-management.io/v1',
          metadata: {
            name: 'test-cluster',
            namespace: 'test-cluster',
          },
          spec: {
            hubAcceptsClient: true,
          },
          status: {
            conditions: [
              {
                type: 'ManagedClusterConditionAvailable',
                status: 'True',
              },
            ],
          },
        },
      },
    ).as('getManagedCluster');

    cy.intercept(
      'GET',
      '/api/kubernetes/apis/internal.open-cluster-management.io/v1beta1/namespaces/test-cluster/managedclusterinfos/test-cluster',
      {
        statusCode: 200,
        body: {
          kind: 'ManagedClusterInfo',
          apiVersion: 'internal.open-cluster-management.io/v1beta1',
          metadata: {
            name: 'test-cluster',
            namespace: 'test-cluster',
          },
          status: {
            distributionInfo: {
              type: 'OCP',
              ocp: {
                version: '4.14.0',
              },
            },
            nodeList: [
              {
                name: 'master-0',
                conditions: [
                  {
                    type: 'Ready',
                    status: 'True',
                  },
                ],
              },
            ],
          },
        },
      },
    ).as('getManagedClusterInfo');

    // Click "Attach cluster info" button
    cy.get(attachMenu).find('button').contains('Attach cluster info').click();

    // Wait for both API calls
    cy.wait('@getManagedCluster');
    cy.wait('@getManagedClusterInfo');

    // Verify that both ManagedCluster and ManagedClusterInfo attachments are added
    cy.get(attachments)
      .should('include.text', 'test-cluster')
      .should('include.text', 'YAML')
      .find('button')
      .should('have.length', 2); // Should have both ManagedCluster and ManagedClusterInfo attachments

    // Test the ManagedCluster attachment preview
    cy.get(attachments).find('button').contains('test-cluster').first().click();
    cy.get(modal)
      .should('include.text', 'Preview attachment')
      .should('include.text', 'test-cluster')
      .should('include.text', 'kind: ManagedCluster')
      .should('include.text', 'apiVersion: cluster.open-cluster-management.io/v1')
      .find('button')
      .contains('Dismiss')
      .click();

    // Test the ManagedClusterInfo attachment preview
    cy.get(attachments).find('button').contains('test-cluster').last().click();
    cy.get(modal)
      .should('include.text', 'Preview attachment')
      .should('include.text', 'test-cluster')
      .should('include.text', 'kind: ManagedClusterInfo')
      .should('include.text', 'apiVersion: internal.open-cluster-management.io/v1beta1')
      .should('include.text', 'distributionInfo')
      .find('button')
      .contains('Dismiss')
      .click();

    // Test submitting a prompt with cluster attachments
    cy.interceptQuery('queryStub', PROMPT_SUBMITTED, null, [
      { attachmentType: 'yaml', contentType: 'application/yaml' },
      { attachmentType: 'yaml', contentType: 'application/yaml' },
    ]);
    cy.get(promptInput).type(`${PROMPT_SUBMITTED}{enter}`);
    cy.wait('@queryStub');
  });

  it('Test ManagedCluster attachment error handling', () => {
    // Mock ManagedCluster details page
    cy.visit(
      '/k8s/ns/test-cluster/cluster.open-cluster-management.io~v1~ManagedCluster/test-cluster',
    );
    cy.get(mainButton).click();
    cy.get(popover).should('exist');

    // Mock successful ManagedCluster API call but failed ManagedClusterInfo call
    cy.intercept(
      'GET',
      '/api/kubernetes/apis/cluster.open-cluster-management.io/v1/managedclusters/test-cluster',
      {
        statusCode: 200,
        body: {
          kind: 'ManagedCluster',
          apiVersion: 'cluster.open-cluster-management.io/v1',
          metadata: {
            name: 'test-cluster',
            namespace: 'test-cluster',
          },
        },
      },
    ).as('getManagedCluster');

    cy.intercept(
      'GET',
      '/api/kubernetes/apis/internal.open-cluster-management.io/v1beta1/namespaces/test-cluster/managedclusterinfos/test-cluster',
      {
        statusCode: 404,
        body: {
          kind: 'Status',
          message:
            'managedclusterinfos.internal.open-cluster-management.io "test-cluster" not found',
        },
      },
    ).as('getManagedClusterInfoError');

    // Click "Attach cluster info" button
    cy.get(attachMenuButton).click();
    cy.get(attachMenu).find('button').contains('Attach cluster info').click();

    // Wait for API calls
    cy.wait('@getManagedCluster');
    cy.wait('@getManagedClusterInfoError');

    // Verify error is displayed
    cy.get(attachMenu).should('include.text', 'Error fetching cluster info');
  });
});
