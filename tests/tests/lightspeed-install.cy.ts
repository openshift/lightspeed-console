import { CONVERSATION_ID } from '../../cypress/support/commands';
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

const OLS_CONFIG_YAML = `apiVersion: ols.openshift.io/v1alpha1
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

const popover = '[data-test="ols-plugin__popover"]';
const mainButton = '[data-test="ols-plugin__popover-button"]';
const minimizeButton = '[data-test="ols-plugin__popover-minimize-button"]';
const expandButton = '[data-test="ols-plugin__popover-expand-button"]';
const collapseButton = '[data-test="ols-plugin__popover-collapse-button"]';
const clearChatButton = '[data-test="ols-plugin__clear-chat-button"]';
const userChatEntry = '[data-test="ols-plugin__chat-entry-user"]';
const aiChatEntry = '[data-test="ols-plugin__chat-entry-ai"]';
const attachments = `${popover} .ols-plugin__chat-prompt-attachments`;
const attachButton = `${popover} .ols-plugin__attach-menu`;
const attachMenu = `${popover} .ols-plugin__context-menu`;
const promptAttachment = `${attachments} .ols-plugin__context-label`;
const fileInput = '[data-test="ols-plugin__file-upload"]';
const promptInput = `${popover} textarea`;
const userFeedback = `${popover} .ols-plugin__feedback`;
const responseAction = `${userFeedback} .ols-plugin__response-action`;
const copyConversationButton = '[data-test="ols-plugin__copy-conversation-button"]';
const copyResponseButton = `${responseAction}[aria-label="Copy to clipboard"]`;
const copyButton = `${userFeedback} #ols-plugin-copy-button`;
const userFeedbackInput = `${userFeedback} textarea`;
const userFeedbackSubmit = `${userFeedback} button.pf-m-primary`;
const modal = '.ols-plugin__modal';
const tooltip = '.pf-v5-c-tooltip';
const toolApprovalCard = `${popover} .ols-plugin__tool-call`;
const toolLabel = `${popover} .pf-v5-c-label`;

const podNamePrefix = 'console';

const MINUTE = 60 * 1000;

const PROMPT_SUBMITTED = 'What is OpenShift?';
const PROMPT_NOT_SUBMITTED = 'Test prompt that should not be submitted';
const USER_FEEDBACK_SUBMITTED = 'Good answer!\nMultiple lines\n\n(@#$%^&*) 😀 文字';

const POPOVER_TITLE = 'Red Hat OpenShift Lightspeed';
const FOOTER_TEXT = 'Always review AI generated content prior to use.';
const PRIVACY_TEXT =
  "OpenShift Lightspeed uses AI technology to help answer your questions. Do not include personal information or other sensitive information in your input. Interactions may be used to improve Red Hat's products or services.";
const WELCOME_TEXT = 'Welcome to OpenShift Lightspeed';

const CLEAR_CHAT_TEXT =
  'Are you sure you want to erase the current chat conversation and start a new chat? This action cannot be undone.';
const CLEAR_CHAT_CONFIRM_BUTTON = 'Erase and start new chat';

const READINESS_TITLE = 'Waiting for OpenShift Lightspeed service';
const READINESS_TEXT =
  'The OpenShift Lightspeed service is not yet ready to receive requests. If this message persists, please check the OLSConfig.';

const ACM_ATTACH_CLUSTER_TEXT = 'Attach cluster info';

const USER_FEEDBACK_TITLE = 'Why did you choose this rating?';
const USER_FEEDBACK_TEXT =
  "Do not include personal information or other sensitive information in your feedback. Feedback may be used to improve Red Hat's products or services.";
const USER_FEEDBACK_RECEIVED_TEXT = 'Thank you for your feedback!';
const THUMBS_DOWN = -1;
const THUMBS_UP = 1;

const WAITING_FOR_RESPONSE_TEXT = 'Waiting for LLM provider...';

const MOCK_STREAMED_RESPONSE_TEXT = 'Mock OLS response';
const MOCK_PARTIAL_RESPONSE_TEXT = 'Partial response';
const MOCK_ERROR_MESSAGE = 'Service temporarily unavailable';

describe('OLS UI', () => {
  before(() => {
    if (Cypress.env('SKIP_OLS_SETUP')) {
      cy.task('log', 'Skip OLS install and configuration because CYPRESS_SKIP_OLS_SETUP is true');
    } else {
      cy.adminCLI(
        `oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`,
      );

      // Grant OLS query access permissions
      cy.adminCLI(
        `oc adm policy add-cluster-role-to-user lightspeed-operator-query-access ${Cypress.env('LOGIN_USERNAME')}`,
      );

      // Get OAuth URL for HyperShift cluster login
      cy.exec(
        `oc get oauthclient openshift-browser-client -o go-template --template="{{index .redirectURIs 0}}" --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      ).then((result) => {
        if (result.stderr === '') {
          const oauthurl = new URL(result.stdout);
          const oauthorigin = oauthurl.origin;
          cy.task('log', `oauthorigin: "${oauthorigin}"`);
          cy.wrap(oauthorigin).as('oauthorigin');
        } else {
          throw new Error(`Execution of oc get oauthclient failed
          Exit code: ${result.exitCode}
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

      // Check if operator is already installed by verifying csv exists
      // We check any csv in the namespace and not by name due to csv being suffixed with version
      cy.exec(
        `oc get csv --namespace=${OLS.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        { failOnNonZeroExit: false },
      ).then((subscriptionCheck) => {
        cy.task('log', `CSV check exit code: ${subscriptionCheck.exitCode}`);
        cy.task('log', `CSV check stdout: ${subscriptionCheck.stdout}`);
        cy.task('log', `CSV check stderr: ${subscriptionCheck.stderr}`);

        const operatorAlreadyInstalled =
          subscriptionCheck.exitCode === 0 &&
          subscriptionCheck.stdout.trim() !== '' &&
          !subscriptionCheck.stdout.toLowerCase().includes('no resources found');

        if (operatorAlreadyInstalled) {
          cy.task(
            'log',
            `Operator subscription already exists in ${OLS.namespace} namespace. Skipping installation and image substitution.`,
          );
        } else {
          cy.task('log', 'Operator not found. Proceeding with installation.');

          // If UI_INSTALL exists, install via UI
          // If running in nudges or pre-release, install with BUNDLE_IMAGE
          // Otherwise install the latest operator
          if (Cypress.env('UI_INSTALL')) {
            operatorHubPage.installOperator(OLS.packageName, 'redhat-operators');
            cy.get('.co-clusterserviceversion-install__heading', { timeout: 5 * MINUTE }).should(
              'include.text',
              'ready for use',
            );
          } else {
            cy.exec(
              `oc get ns ${OLS.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} || oc create ns ${OLS.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
            );
            cy.exec(
              `oc label namespaces ${OLS.namespace} openshift.io/cluster-monitoring=true --overwrite=true --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
            );
            const bundleImage =
              Cypress.env('BUNDLE_IMAGE') ||
              'quay.io/openshift-lightspeed/lightspeed-operator-bundle:latest';
            cy.exec(
              `operator-sdk run bundle --timeout=10m --namespace ${OLS.namespace} ${bundleImage} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
              { failOnNonZeroExit: false, timeout: 12 * MINUTE },
            ).then((result) => {
              cy.task('log', `\n"operator-sdk run bundle" stdout:\n${result.stdout}\n`)
                .task('log', `"operator-sdk run bundle" stderr:\n${result.stderr}\n`)
                .then(() => {
                  if (result.exitCode !== 0) {
                    throw new Error(
                      `"operator-sdk run bundle" failed with exit code ${result.exitCode}`,
                    );
                  }
                });
            });
          }

          // If the console image exists, replace image in CSV and restart operator
          // Console pod will restart automatically.
          if (Cypress.env('CONSOLE_IMAGE')) {
            cy.exec(
              `oc get clusterserviceversion --namespace=${OLS.namespace} -o name --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
            ).then((result) => {
              if (result.stderr === '') {
                const csvName = result.stdout.trim().split('\n').filter(Boolean)[0];
                // Fetch the CSV, discover the relatedImages index for the
                // console image dynamically, then apply a single atomic patch
                // that updates both relatedImages and the console-image arg.
                cy.exec(
                  `oc scale --replicas=0 deployment/lightspeed-operator-controller-manager --namespace=${OLS.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
                );
                cy.exec(
                  `oc get ${csvName} --namespace=${OLS.namespace} -o json --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
                ).then((csvResult) => {
                  if (csvResult.stderr !== '') {
                    throw new Error(`Getting csv failed
                  Exit code: ${csvResult.exitCode}
                  Stdout:\n${csvResult.stdout}
                  Stderr:\n${csvResult.stderr}`);
                  }

                  const csv = JSON.parse(csvResult.stdout);

                  // Map --console-image* arg prefixes to their relatedImages names
                  const argToRelatedImage: Record<string, string> = {
                    '--console-image-pf5': 'lightspeed-console-plugin-pf5',
                    '--console-image-4-19': 'lightspeed-console-plugin-4-19',
                    '--console-image=': 'lightspeed-console-plugin',
                  };

                  const args =
                    csv.spec.install.spec.deployments[0].spec.template.spec.containers[0].args;
                  const relatedImages = csv.spec.relatedImages;

                  // Collect relatedImages indices that match any console-image arg
                  const relatedImageOps: { op: string; path: string; value: string }[] = [];
                  for (const arg of args) {
                    for (const [prefix, riName] of Object.entries(argToRelatedImage)) {
                      if (arg.startsWith(prefix)) {
                        const idx = relatedImages.findIndex(
                          (ri: { name: string }) => ri.name === riName,
                        );
                        if (idx !== -1) {
                          relatedImageOps.push({
                            op: 'replace',
                            path: `/spec/relatedImages/${idx}/image`,
                            value: Cypress.env('CONSOLE_IMAGE'),
                          });
                        }
                      }
                    }
                  }

                  const updatedArgs = args.map((arg: string) =>
                    arg.startsWith('--console-image')
                      ? arg.replace(/=.*/, `=${Cypress.env('CONSOLE_IMAGE')}`)
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
                  cy.exec(
                    `oc patch ${csvName} --namespace=${OLS.namespace} --type='json' -p='${patch}' --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
                  );

                  cy.exec(
                    `oc scale --replicas=1 deployment/lightspeed-operator-controller-manager --namespace=${OLS.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
                  );
                });
              } else {
                throw new Error(`Getting CSV name failed
              Exit code: ${result.exitCode}
              Stdout:\n${result.stdout}
              Stderr:\n${result.stderr}`);
              }
            });
          }
        }
      });

      // Check if OLSConfig exists and handle accordingly
      cy.exec(
        `oc get ${OLS.config.kind} ${OLS.config.name} -o json --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        { failOnNonZeroExit: false },
      ).then((configCheck) => {
        if (configCheck.exitCode === 0) {
          // OLSConfig exists, check if it's being deleted
          const existingConfig = JSON.parse(configCheck.stdout);
          if (existingConfig.metadata.deletionTimestamp) {
            cy.task(
              'log',
              `OLSConfig is being deleted. Waiting for deletion to complete before recreating...`,
            );
            // Wait for deletion to complete (check every 5 seconds for up to 3 minutes)
            cy.exec(
              `timeout 180 bash -c 'until ! oc get ${OLS.config.kind} ${OLS.config.name} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} 2>/dev/null; do echo "Waiting for deletion..."; sleep 5; done'`,
              { timeout: 4 * MINUTE },
            ).then(() => {
              cy.task('log', 'OLSConfig deleted. Creating new OLSConfig...');
              cy.exec(
                `echo '${OLS_CONFIG_YAML}' | oc create -f - --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
              );
            });
          } else {
            cy.task('log', `OLSConfig already exists and is not deleting. Using existing config.`);
          }
        } else {
          // OLSConfig doesn't exist, create it
          cy.task('log', 'OLSConfig not found. Creating new OLSConfig...');
          cy.exec(
            `echo '${OLS_CONFIG_YAML}' | oc create -f - --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
          );
        }
      });

      // Create secret if it doesn't exist
      cy.exec(
        `oc get secret openai-api-keys -n ${OLS.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        { failOnNonZeroExit: false },
      ).then((secretCheck) => {
        if (secretCheck.exitCode === 0) {
          cy.task('log', 'Secret openai-api-keys already exists. Skipping creation.');
        } else {
          cy.task('log', 'Creating secret openai-api-keys...');
          cy.exec(
            `oc create secret generic openai-api-keys --from-literal=apitoken=empty -n ${OLS.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
          );
        }
      });

      cy.visit('/');
      cy.get(mainButton, { timeout: 5 * MINUTE }).should('exist');
    }
  });

  after(() => {
    if (Cypress.env('SKIP_OLS_SETUP')) {
      cy.task('log', 'Skip OLS uninstall because CYPRESS_SKIP_OLS_SETUP is true');
    } else {
      // Delete config first, making sure the Cypress timeout is longer than the oc --timeout
      cy.exec(
        `oc delete --timeout=2m ${OLS.config.kind} ${OLS.config.name} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
        { failOnNonZeroExit: false, timeout: 3 * MINUTE },
      );

      // Delete entire namespace to delete operator and ensure everything else is cleaned up
      cy.adminCLI(`oc delete namespace ${OLS.namespace}`, {
        failOnNonZeroExit: false,
        timeout: 5 * MINUTE,
      });

      cy.adminCLI(
        `oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`,
      );

      // Remove OLS query access permissions
      cy.adminCLI(
        `oc adm policy remove-cluster-role-from-user lightspeed-operator-query-access ${Cypress.env('LOGIN_USERNAME')}`,
      );
    }
  });

  describe('Core functionality', { tags: ['@core'] }, () => {
    it('OpenShift Lightspeed popover UI is loaded and basic functionality is working', () => {
      // Mock readiness endpoint to ensure the readiness warning is always shown
      cy.intercept('GET', '/api/proxy/plugin/lightspeed-console-plugin/ols/readiness', {
        statusCode: 200,
        body: { ready: false },
      });

      cy.visit('/');

      // Wait for the popover to auto-open for first-time users
      cy.get(mainButton).should('exist');
      cy.get(popover)
        .should('exist')
        .should('include.text', FOOTER_TEXT)
        .should('include.text', PRIVACY_TEXT)
        .should('include.text', READINESS_TITLE)
        .should('include.text', READINESS_TEXT)
        .should('include.text', WELCOME_TEXT)
        .find('h1')
        .should('include.text', POPOVER_TITLE);

      // Test that we can submit a prompt
      cy.get(promptInput).should('exist').type(`${PROMPT_SUBMITTED}{enter}`);
      cy.get(userChatEntry).should('contain', PROMPT_SUBMITTED);
      cy.get(aiChatEntry).should('exist');

      // Populate the prompt input, but don't submit it
      cy.get(promptInput).type(PROMPT_NOT_SUBMITTED);

      // Minimize the popover UI
      cy.get(minimizeButton).click();
      cy.get(popover).should('not.exist');

      // Open the popover UI again
      // Previous messages and text in the prompt input should have been preserved
      cy.get(mainButton).click();
      cy.get(userChatEntry).should('contain', PROMPT_SUBMITTED);
      cy.get(aiChatEntry).should('exist');
      cy.get(promptInput).should('contain', PROMPT_NOT_SUBMITTED);

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
      cy.get(userChatEntry).should('contain', PROMPT_SUBMITTED);
      cy.get(aiChatEntry).should('exist');
      cy.get(promptInput).should('contain', PROMPT_NOT_SUBMITTED);
    });
  });

  describe('Streamed response', { tags: ['@response'] }, () => {
    it('Test submitting a prompt and fetching the streamed response', () => {
      cy.visit('/search/all-namespaces');
      cy.get('h1').contains('Search').should('exist');
      cy.get(mainButton).click();

      cy.interceptQuery('queryStub', PROMPT_SUBMITTED);
      cy.get(promptInput).type(`${PROMPT_SUBMITTED}{enter}`);
      cy.get(popover).should('contain', WAITING_FOR_RESPONSE_TEXT);
      cy.wait('@queryStub');

      // Prompt should now be empty
      cy.get(promptInput).should('have.value', '');

      // Our prompt should now be shown in the chat history along with a response from OLS
      cy.get(userChatEntry).should('contain', PROMPT_SUBMITTED);
      cy.get(aiChatEntry).should('contain', MOCK_STREAMED_RESPONSE_TEXT);

      // Sending a second prompt should now send the conversation_id along with the prompt
      const PROMPT_SUBMITTED_2 = 'Test prompt 2';
      cy.interceptQuery('queryWithConversationIdStub', PROMPT_SUBMITTED_2, CONVERSATION_ID);
      cy.get(promptInput).type(`${PROMPT_SUBMITTED_2}{enter}`);
      cy.get(popover).should('contain', WAITING_FOR_RESPONSE_TEXT);
      cy.wait('@queryWithConversationIdStub');

      cy.get(promptInput).should('have.value', '');
      cy.get(userChatEntry).should('contain', PROMPT_SUBMITTED_2);
      cy.get(aiChatEntry).should('contain', MOCK_STREAMED_RESPONSE_TEXT);

      // The clear chat action should clear the current conversation, but leave any text in the prompt
      cy.get(promptInput).type(PROMPT_NOT_SUBMITTED);
      cy.get(clearChatButton).should('exist').click();
      cy.get(modal).should('contain', CLEAR_CHAT_TEXT);
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

    it('Test response with error, partial response text and tool call', () => {
      cy.visit('/search/all-namespaces');
      cy.get('h1').contains('Search').should('exist');
      cy.get(mainButton).click();

      cy.interceptQueryWithError('queryWithErrorStub', PROMPT_SUBMITTED, MOCK_ERROR_MESSAGE);
      cy.get(promptInput).type(`${PROMPT_SUBMITTED}{enter}`);
      cy.get(popover).should('contain', WAITING_FOR_RESPONSE_TEXT);
      cy.wait('@queryWithErrorStub');

      cy.get(aiChatEntry).should('contain', MOCK_PARTIAL_RESPONSE_TEXT);
      cy.get(aiChatEntry)
        .find('.pf-m-danger')
        .should('exist')
        .should('contain', MOCK_ERROR_MESSAGE);

      // Verify that the tool call label is displayed
      cy.get(aiChatEntry).find('.ols-plugin__references').should('contain', 'ABC');
    });
  });

  describe('Tool approval (HITL)', { tags: ['@hitl'] }, () => {
    it('Test approval card is shown and tool can be approved', () => {
      cy.visit('/search/all-namespaces');
      cy.get('h1').contains('Search').should('exist');
      cy.get(mainButton).click();

      cy.interceptQueryWithApproval('queryWithApproval', PROMPT_SUBMITTED);
      cy.interceptToolApproval('approvalStub', true);
      cy.get(promptInput).type(`${PROMPT_SUBMITTED}{enter}`);
      cy.wait('@queryWithApproval');

      cy.get(toolApprovalCard).should('exist');
      cy.get(toolApprovalCard).should('contain', 'Review required');
      cy.get(toolApprovalCard).should('contain', 'This action will list pods in the cluster.');
      cy.get(toolApprovalCard).find('button').contains('Approve').should('exist');
      cy.get(toolApprovalCard).find('button').contains('Reject').should('exist');

      cy.get(toolApprovalCard).contains('View action details').click();
      cy.get(toolApprovalCard).should('contain', 'mock_tool');
      cy.get(toolApprovalCard).should('contain', 'namespace');

      cy.get(toolApprovalCard).find('button').contains('Approve').click();
      cy.wait('@approvalStub');
      cy.get(toolApprovalCard).should('not.exist');
      cy.get(toolLabel).should('contain', 'mock_tool');

      cy.get(toolLabel).contains('mock_tool').click();
      cy.get(modal).should('contain', 'Tool output');
      cy.get(modal).should('contain', 'mock_tool');
      cy.get(modal).should('contain', 'Status');
      cy.get(modal).should('contain', 'pending');
      cy.get(modal).should('not.contain', 'Tool call rejected');
      cy.get(modal).find('button[title="Close"]').click();
    });

    it('Test tool can be rejected', () => {
      cy.visit('/search/all-namespaces');
      cy.get('h1').contains('Search').should('exist');
      cy.get(mainButton).click();

      cy.interceptQueryWithApproval('queryWithApproval', PROMPT_SUBMITTED);
      cy.interceptToolApproval('denialStub', false);
      cy.get(promptInput).type(`${PROMPT_SUBMITTED}{enter}`);
      cy.wait('@queryWithApproval');

      cy.get(toolApprovalCard).should('exist');
      cy.get(toolApprovalCard).find('button').contains('Reject').click();
      cy.wait('@denialStub');
      cy.get(toolApprovalCard).should('not.exist');
      cy.get(toolLabel).should('contain', 'mock_tool');
      cy.get(toolLabel).contains('mock_tool').click();
      cy.get(modal).should('contain', 'Tool call rejected');
      cy.get(modal).should('contain', 'mock_tool');
      cy.get(modal).should('not.contain', 'Status');
      cy.get(modal).should('not.contain', 'Content');
      cy.get(modal).find('button[title="Close"]').click();
    });
  });

  describe('User feedback', { tags: ['@feedback'] }, () => {
    it('Test user feedback form', () => {
      cy.visit('/search/all-namespaces');
      cy.get('h1').contains('Search').should('exist');
      cy.get(mainButton).click();

      cy.interceptQuery('queryStub', PROMPT_SUBMITTED);
      cy.get(promptInput).type(`${PROMPT_SUBMITTED}{enter}`);
      cy.get(popover).should('contain', WAITING_FOR_RESPONSE_TEXT);
      cy.wait('@queryStub');

      // Should have 3 response action buttons (thumbs up, thumbs down, and copy)
      cy.get(responseAction).should('have.lengthOf', 3);

      // Clicking a user feedback button should select it and open the user feedback form
      cy.get(responseAction)
        .eq(0)
        .should('not.have.class', 'ols-plugin__response-action--selected')
        .click()
        .should('have.class', 'ols-plugin__response-action--selected');
      cy.get(popover).should('contain', USER_FEEDBACK_TITLE);
      cy.get(popover).should('contain', USER_FEEDBACK_TEXT);

      // Clicking the other user feedback button should select that instead and leave the user
      // feedback form open
      cy.get(responseAction)
        .eq(1)
        .should('not.have.class', 'ols-plugin__response-action--selected')
        .click()
        .should('have.class', 'ols-plugin__response-action--selected');
      cy.get(popover).should('contain', USER_FEEDBACK_TITLE);
      cy.get(popover).should('contain', USER_FEEDBACK_TEXT);

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
      cy.get(popover).should('contain', USER_FEEDBACK_RECEIVED_TEXT);

      // Submit negative feedback with no comment
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
      cy.get(popover).should('contain', USER_FEEDBACK_RECEIVED_TEXT);
    });
  });

  describe('Copy to clipboard', { tags: ['@clipboard'] }, () => {
    it('Test copy response functionality', () => {
      cy.visit('/search/all-namespaces');
      cy.get('h1').contains('Search').should('exist');
      cy.get(mainButton).click();

      cy.interceptQuery('queryStub', PROMPT_SUBMITTED);
      cy.get(promptInput).type(`${PROMPT_SUBMITTED}{enter}`);
      cy.get(popover).should('contain', WAITING_FOR_RESPONSE_TEXT);
      cy.wait('@queryStub');

      cy.get(copyResponseButton).should('exist');
      cy.window().focus();
      cy.get(copyResponseButton).click();

      // Verify that none of the response action buttons changed state
      cy.get(copyButton).should('not.have.class', 'ols-plugin__response-action--selected');
      cy.get(responseAction)
        .eq(0)
        .should('not.have.class', 'ols-plugin__response-action--selected');
      cy.get(responseAction)
        .eq(1)
        .should('not.have.class', 'ols-plugin__response-action--selected');
    });

    it('Test copy conversation functionality', () => {
      cy.visit('/search/all-namespaces');
      cy.get('h1').contains('Search').should('exist');
      cy.get(mainButton).click();

      // Submit first prompt and wait for response
      cy.interceptQuery('queryStub1', PROMPT_SUBMITTED);
      cy.get(promptInput).type(`${PROMPT_SUBMITTED}{enter}`);
      cy.wait('@queryStub1');

      // Submit second prompt to create a conversation
      const PROMPT_SUBMITTED_2 = 'Second test prompt';
      cy.interceptQuery('queryStub2', PROMPT_SUBMITTED_2, CONVERSATION_ID);
      cy.get(promptInput).type(`${PROMPT_SUBMITTED_2}{enter}`);
      cy.wait('@queryStub2');

      // Verify both messages are in the chat history
      cy.get(userChatEntry).should('contain', PROMPT_SUBMITTED);
      cy.get(userChatEntry).should('contain', PROMPT_SUBMITTED_2);
      cy.get(aiChatEntry).should('have.length', 2);

      cy.get(copyConversationButton).should('exist').trigger('mouseenter');
      cy.get(tooltip).should('be.visible').should('contain.text', 'Copy conversation');

      cy.window().focus();
      cy.get(copyConversationButton).click();

      // Tooltip text should change, then revert back after a timeout
      cy.get(tooltip).should('be.visible').should('contain.text', 'Copied');
      cy.get(tooltip).should('contain.text', 'Copy conversation');

      // Copy conversation button should not exist when there is no chat history
      cy.get(clearChatButton).click();
      cy.get(modal).find('button').contains('Erase and start new chat').click();
      cy.get(copyConversationButton).should('not.exist');
    });
  });

  describe('Attach menu', { tags: ['@attach'] }, () => {
    it('Test attach options on pods list page', () => {
      pages.goToPodsList('openshift-console');
      cy.get(mainButton).click();
      cy.get(popover).should('exist');

      // Confirm that the pod we are using for testing is present
      listPage.filter.byName(podNamePrefix);
      cy.get('[data-test-rows="resource-row"]', { timeout: 2 * MINUTE }).should(
        'have.length.at.least',
        1,
      );

      // The only attach option should be the upload file option
      cy.get(attachButton).click();
      cy.get(attachMenu)
        .should('include.text', 'Upload from computer')
        .should('not.include.text', 'YAML')
        .should('not.include.text', 'Events')
        .should('not.include.text', 'Logs');
    });

    it('Test attaching YAML', () => {
      pages.goToPodDetails('openshift-console', podNamePrefix);
      cy.get(mainButton).click();
      cy.get(popover).should('exist');

      // There should be no prompt attachments initially
      cy.get(attachments).should('be.empty');

      cy.get(attachButton).click();
      cy.get(attachMenu)
        .should('include.text', 'Full YAML file')
        .should('include.text', 'Filtered YAML')
        .should('include.text', 'Events')
        .should('include.text', 'Logs')
        .should('include.text', 'Upload from computer');

      cy.get(attachMenu).find('button').contains('Full YAML file').click();
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

      cy.get(attachButton).click();
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

    it('Test modifying attached YAML (OLS-1541)', () => {
      pages.goToPodDetails('openshift-console', podNamePrefix);
      cy.get(mainButton).click();
      cy.get(popover).should('exist');

      cy.get(attachButton).click();
      cy.get(attachMenu).find('button').contains('Full YAML file').click();
      cy.get(promptAttachment).click();
      cy.get(modal).find('button').contains('Dismiss').click();
      cy.get(promptAttachment).click();
      cy.get(modal).find('button').contains('Edit').click();
      cy.get(modal).find('button').contains('Cancel').click();
      cy.get(modal).find('button').contains('Edit').click();
      cy.get(modal)
        .find('.ols-plugin__code-block__title')
        .should('be.visible')
        .and('contain.text', podNamePrefix);
      cy.get(modal)
        .find('.pf-v5-c-code-editor__code textarea')
        .type('Test modifying YAML', { force: true });
      cy.get(modal).find('button').contains('Save').click();
      cy.get(promptAttachment).click();
      cy.get(modal)
        .find('.ols-plugin__code-block-code')
        .should('be.visible')
        .and('contain.text', 'Test modifying YAML');
    });

    it('Test attaching events', () => {
      pages.goToPodDetails('openshift-lightspeed', podNamePrefix);
      cy.get(mainButton).click();
      cy.get(popover).should('exist');

      cy.get(attachButton).click();
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
      cy.get(popover).should('contain', USER_FEEDBACK_RECEIVED_TEXT);
    });

    it('Test attaching logs', () => {
      pages.goToPodDetails('openshift-console', podNamePrefix);
      cy.get(mainButton).click();
      cy.get(popover).should('exist');

      cy.get(attachButton).click();
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
      const MAX_FILE_SIZE_MB = 1;

      cy.visit('/search/all-namespaces');
      cy.get('h1').contains('Search').should('exist');
      cy.get(mainButton).click();
      cy.get(popover).should('exist');
      cy.get(attachButton).click();
      cy.get(attachMenu).find('button').contains('Upload from computer').click();

      // File with invalid YAML
      cy.get(fileInput).selectFile(
        {
          contents: Cypress.Buffer.from('abc'),
        },
        // Use `force: true` because the input is display:none
        { force: true },
      );
      cy.get(popover).should('contain', 'Uploaded file is not valid YAML');

      // File that is too large
      const largeFileContent = 'a'.repeat(MAX_FILE_SIZE_MB * 1024 * 1024 + 1);
      cy.get(fileInput).selectFile(
        {
          contents: Cypress.Buffer.from(largeFileContent),
        },
        { force: true },
      );
      cy.get(popover).should(
        'contain',
        `Uploaded file is too large. Max size is ${MAX_FILE_SIZE_MB} MB.`,
      );

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

  describe('ACM', { tags: ['@acm'] }, () => {
    it.skip('Test attach cluster info for ManagedCluster', () => {
      cy.visit(
        '/k8s/ns/test-cluster/cluster.open-cluster-management.io~v1~ManagedCluster/test-cluster',
      );
      cy.get(mainButton).click();
      cy.get(popover).should('exist');

      // Test that the attach menu shows the option for ManagedCluster
      cy.get(attachButton).click();
      cy.get(attachMenu)
        .should('include.text', ACM_ATTACH_CLUSTER_TEXT)
        .should('include.text', 'Upload from computer')
        .should('not.include.text', 'Full YAML file')
        .should('not.include.text', 'Filtered YAML')
        .should('not.include.text', 'Events')
        .should('not.include.text', 'Logs');

      // Mock the API call for ManagedCluster
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

      // Mock the API call for ManagedClusterInfo
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

      cy.get(attachMenu).find('button').contains(ACM_ATTACH_CLUSTER_TEXT).click();

      // Wait for both API calls
      cy.wait('@getManagedCluster');
      cy.wait('@getManagedClusterInfo');

      // Verify that both ManagedCluster and ManagedClusterInfo attachments are added
      cy.get(attachments)
        .should('include.text', 'test-cluster')
        .should('include.text', 'YAML')
        .find('button')
        .should('have.length', 2);

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
        // eslint-disable-next-line camelcase
        { attachment_type: 'yaml', content_type: 'application/yaml' },
        // eslint-disable-next-line camelcase
        { attachment_type: 'yaml', content_type: 'application/yaml' },
      ]);
      cy.get(promptInput).type(`${PROMPT_SUBMITTED}{enter}`);
      cy.wait('@queryStub');
    });

    it.skip('Test ManagedCluster attachment error handling', () => {
      cy.visit(
        '/k8s/ns/test-cluster/cluster.open-cluster-management.io~v1~ManagedCluster/test-cluster',
      );
      cy.get(mainButton).click();
      cy.get(popover).should('exist');

      // Mock successful ManagedCluster API call
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

      // Mock failed ManagedClusterInfo API call
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

      cy.get(attachButton).click();
      cy.get(attachMenu).find('button').contains(ACM_ATTACH_CLUSTER_TEXT).click();

      // Wait for API calls
      cy.wait('@getManagedCluster');
      cy.wait('@getManagedClusterInfoError');

      // Verify error is displayed
      cy.get(attachMenu).should('include.text', 'Error fetching cluster info');
    });

    it.skip('Test ACM search resources page context for Pod', () => {
      cy.visit('/multicloud/search/resources?kind=Pod&name=test-pod&namespace=test-namespace');

      // Mock successful pod API call
      cy.intercept('GET', '/api/kubernetes/api/v1/namespaces/test-namespace/pods/test-pod', {
        statusCode: 200,
        body: {
          kind: 'Pod',
          metadata: {
            name: 'test-pod',
            namespace: 'test-namespace',
          },
        },
      }).as('getManagedCluster');

      cy.get(mainButton).click();
      cy.get(popover).should('exist');

      cy.get(attachButton).click();
      cy.get(attachMenu)
        .should('include.text', 'Upload from computer')
        .should('include.text', 'Full YAML file')
        .should('include.text', 'Filtered YAML')
        .should('include.text', 'Events')
        .should('include.text', 'Logs')
        .should('not.include.text', ACM_ATTACH_CLUSTER_TEXT);
    });

    it.skip('Test ACM search resources page context for VirtualMachine', () => {
      cy.visit(
        '/multicloud/search/resources?kind=VirtualMachine&name=test-vm&namespace=test-namespace',
      );

      // Mock successful VirtualMachine API call
      cy.intercept(
        'GET',
        '/api/kubernetes/apis/kubevirt.io/v1/namespaces/test-namespace/virtualmachines/test-vm',
        {
          statusCode: 200,
          body: {
            kind: 'VirtualMachine',
            apiVersion: 'kubevirt.io/v1',
            metadata: {
              name: 'test-vm',
              namespace: 'test-namespace',
            },
          },
        },
      ).as('getVirtualMachine');

      cy.get(mainButton).click();
      cy.get(popover).should('exist');

      cy.get(attachButton).click();
      cy.get(attachMenu)
        .should('include.text', 'Upload from computer')
        .should('include.text', 'Full YAML file')
        .should('include.text', 'Filtered YAML')
        .should('include.text', 'Events')
        .should('include.text', 'Logs')
        .should('not.include.text', ACM_ATTACH_CLUSTER_TEXT);
    });
  });

  describe('MCP Iframe Rendering', { tags: ['@mcp', '@mcp-mocked', '@iframe'] }, () => {
    const mcpAppIframe = '.ols-plugin__mcp-app-iframe';
    const mcpAppCard = '.ols-plugin__mcp-app';
    const mcpAppLoading = `${mcpAppCard} .pf-v5-c-spinner`;
    const mcpAppError = '.ols-plugin__alert';

    const MCP_PROMPT = 'Show me the dashboard';
    const MCP_TOOL_NAME = 'dashboard';
    const MCP_UI_RESOURCE_URI = 'mcp://test-server/resources/dashboard';

    const SAMPLE_MCP_HTML = `<!DOCTYPE html>
<html>
  <body>
    <h1>MCP Dashboard</h1>
    <h2>Resource Dashboard</h2>
    <p>CPU Usage</p>
    <p>45%</p>
  </body>
</html>`;

    beforeEach(() => {
      // Mock readiness endpoint to prevent polling delays
      cy.intercept('GET', '/api/proxy/plugin/lightspeed-console-plugin/ols/readiness', {
        statusCode: 200,
        body: { ready: true },
      });

      // Mock authorization endpoint for clean test runs
      cy.intercept('POST', '/api/proxy/plugin/lightspeed-console-plugin/ols/authorized', {
        statusCode: 200,
        /* eslint-disable camelcase */
        body: { user_id: 'test-user-id', username: 'test-user', skip_user_id_check: false },
        /* eslint-enable camelcase */
      });

      cy.visit('/');
      cy.get(mainButton).click();
      cy.get(popover).should('be.visible');
      // Wait for authorization to complete and prompt to be ready
      cy.get(promptInput, { timeout: 10000 }).should('be.visible').should('be.enabled');
    });

    it('renders iframe when MCP response includes uiResourceUri', { tags: ['@core'] }, () => {
      cy.interceptMCPQuery('mcpQuery', MCP_PROMPT, MCP_TOOL_NAME, MCP_UI_RESOURCE_URI);
      cy.interceptMCPResources('mcpResources', SAMPLE_MCP_HTML, 'test-server', MCP_UI_RESOURCE_URI);

      cy.get(promptInput).type(`${MCP_PROMPT}{enter}`);

      cy.wait('@mcpQuery', { timeout: 3 * MINUTE });
      cy.wait('@mcpResources', { timeout: 3 * MINUTE });

      cy.get(mcpAppIframe, { timeout: 10000 })
        .should('exist')
        .scrollIntoView()
        .should('be.visible');
      cy.get(mcpAppIframe).should('have.attr', 'sandbox', 'allow-scripts');
      cy.get(mcpAppCard).should('exist');
    });

    it('iframe srcDoc contains expected HTML content', { tags: ['@core'] }, () => {
      cy.interceptMCPQuery('mcpQuery', MCP_PROMPT, MCP_TOOL_NAME, MCP_UI_RESOURCE_URI);
      cy.interceptMCPResources('mcpResources', SAMPLE_MCP_HTML, 'test-server', MCP_UI_RESOURCE_URI);

      cy.get(promptInput).type(`${MCP_PROMPT}{enter}`);

      cy.wait('@mcpQuery', { timeout: 3 * MINUTE });
      cy.wait('@mcpResources', { timeout: 3 * MINUTE });

      cy.get(mcpAppIframe, { timeout: 10000 }).should(($iframe) => {
        const srcDoc = $iframe.attr('srcDoc');
        expect(srcDoc).to.exist;
        expect(srcDoc).to.contain('MCP Dashboard');
        expect(srcDoc).to.contain('Resource Dashboard');
        expect(srcDoc).to.contain('CPU Usage');
        expect(srcDoc).to.contain('45%');
        expect(srcDoc).to.contain('data-theme=');
      });
    });

    it('displays loading state while fetching MCP resources', () => {
      cy.interceptMCPQuery('mcpQuery', MCP_PROMPT, MCP_TOOL_NAME, MCP_UI_RESOURCE_URI);
      cy.intercept('POST', '**/v1/mcp-apps/resources', (request) => {
        request.reply({ body: { content: SAMPLE_MCP_HTML }, delay: 2000 });
      }).as('mcpResourcesDelayed');

      cy.get(promptInput).type(`${MCP_PROMPT}{enter}`);

      cy.wait('@mcpQuery', { timeout: 3 * MINUTE });

      cy.get(mcpAppLoading, { timeout: 5000 }).should('exist');

      cy.wait('@mcpResourcesDelayed', { timeout: 5000 });

      cy.get(mcpAppLoading).should('not.exist');
      cy.get(mcpAppIframe).should('exist').scrollIntoView().should('be.visible');
    });

    it('displays error when resource fetch fails', () => {
      cy.interceptMCPQuery('mcpQuery', MCP_PROMPT, MCP_TOOL_NAME, MCP_UI_RESOURCE_URI);

      cy.intercept('POST', '**/v1/mcp-apps/resources', {
        statusCode: 500,
        body: { error: 'Failed to fetch MCP resource' },
      }).as('mcpResourcesError');

      cy.get(promptInput).type(`${MCP_PROMPT}{enter}`);

      cy.wait('@mcpQuery', { timeout: 3 * MINUTE });
      cy.wait('@mcpResourcesError', { timeout: 3 * MINUTE });

      cy.get(mcpAppError, { timeout: 10000 }).should('exist').should('contain', 'MCP App Error');
      cy.get(mcpAppIframe).should('not.exist');
    });

    it('does not render iframe when uiResourceUri is missing', () => {
      const responseWithoutURI = `data: {"event": "start", "data": {"conversation_id": "${CONVERSATION_ID}"}}

data: {"event": "token", "data": {"id": 0, "token": "Here"}}

data: {"event": "token", "data": {"id": 1, "token": " is"}}

data: {"event": "token", "data": {"id": 2, "token": " your"}}

data: {"event": "token", "data": {"id": 3, "token": " data"}}

data: {"event": "tool_call", "data": {"id": 1, "name": "get_data", "server_name": "test-server", "args": {}}}

data: {"event": "tool_result", "data": {"id": 1, "content": "Data retrieved", "status": "success"}}

data: {"event": "end", "data": {"referenced_documents": [], "truncated": false}}
`;

      cy.intercept('POST', '**/v1/streaming_query', (request) => {
        expect(request.body.query).to.equal(MCP_PROMPT);
        request.reply({ body: responseWithoutURI, delay: 1000 });
      }).as('queryWithoutURI');

      cy.get(promptInput).type(`${MCP_PROMPT}{enter}`);

      cy.wait('@queryWithoutURI', { timeout: 3 * MINUTE });

      cy.get(aiChatEntry, { timeout: 10000 }).should('exist');
      cy.get(mcpAppIframe).should('not.exist');
    });

    it('handles multiple MCP iframes in conversation', () => {
      const SECOND_PROMPT = 'Show me another dashboard';
      const SECOND_TOOL_NAME = 'metrics';
      const SECOND_URI = 'mcp://test-server/resources/metrics';

      const SECOND_HTML = `<!DOCTYPE html>
<html lang="en">
<head><title>Metrics</title></head>
<body><div class="metrics">Metrics Dashboard</div></body>
</html>`;

      cy.interceptMCPQuery('mcpQuery1', MCP_PROMPT, MCP_TOOL_NAME, MCP_UI_RESOURCE_URI);
      cy.interceptMCPResources(
        'mcpResources1',
        SAMPLE_MCP_HTML,
        'test-server',
        MCP_UI_RESOURCE_URI,
      );

      cy.get(promptInput).type(`${MCP_PROMPT}{enter}`);
      cy.wait('@mcpQuery1', { timeout: 3 * MINUTE });
      cy.wait('@mcpResources1', { timeout: 3 * MINUTE });

      cy.get(mcpAppIframe).should('have.length', 1);

      cy.interceptMCPQuery(
        'mcpQuery2',
        SECOND_PROMPT,
        SECOND_TOOL_NAME,
        SECOND_URI,
        CONVERSATION_ID,
      );
      cy.interceptMCPResources('mcpResources2', SECOND_HTML, 'test-server', SECOND_URI);

      cy.get(promptInput).type(`${SECOND_PROMPT}{enter}`);
      cy.wait('@mcpQuery2', { timeout: 3 * MINUTE });
      cy.wait('@mcpResources2', { timeout: 3 * MINUTE });

      cy.get(mcpAppIframe).should('have.length', 2);
    });
  });
});
