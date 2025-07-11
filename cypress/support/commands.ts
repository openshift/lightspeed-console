/* eslint-disable @typescript-eslint/no-use-before-define */
import * as _ from 'lodash';

import Loggable = Cypress.Loggable;
import Timeoutable = Cypress.Timeoutable;
import Withinable = Cypress.Withinable;
import Shadow = Cypress.Shadow;

export {};
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      byTestID(
        selector: string,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<Element>;
      byTestActionID(selector: string): Chainable<JQuery<HTMLElement>>;
      byLegacyTestID(
        selector: string,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<JQuery<HTMLElement>>;
      byButtonText(selector: string): Chainable<JQuery<HTMLElement>>;
      byDataID(selector: string): Chainable<JQuery<HTMLElement>>;
      byTestSelector(
        selector: string,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<JQuery<HTMLElement>>;
      byTestDropDownMenu(selector: string): Chainable<JQuery<HTMLElement>>;
      byTestOperatorRow(
        selector: string,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<JQuery<HTMLElement>>;
      byTestSectionHeading(selector: string): Chainable<JQuery<HTMLElement>>;
      byTestOperandLink(selector: string): Chainable<JQuery<HTMLElement>>;
      cliLogin(username?, password?, hostapi?);
      cliLogout();
      adminCLI(command: string, options?);
      login(
        provider?: string,
        username?: string,
        password?: string,
        oauthurl?: string,
      ): Chainable<Element>;
      interceptFeedback(
        alias: string,
        conversationId: string,
        sentiment: number,
        userFeedback: string,
        userQuestionStartsWith: string,
      ): Chainable<Element>;
      interceptQuery(
        alias: string,
        query: string,
        conversationId?: string | null,
        attachments?: Array<{ attachment_type: string; content_type: string }>,
      ): Chainable<Element>;
    }
  }
}

// Any command added below, must be added to global Cypress interface above

Cypress.Commands.add(
  'byTestID',
  (selector: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    cy.get(`[data-test="${selector}"]`, options);
  },
);

Cypress.Commands.add('byTestActionID', (selector: string) =>
  cy.get(`[data-test-action="${selector}"]:not([disabled])`),
);

// Deprecated!  new IDs should use 'data-test', ie. `cy.byTestID(...)`
Cypress.Commands.add(
  'byLegacyTestID',
  (selector: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    cy.get(`[data-test-id="${selector}"]`, options);
  },
);

Cypress.Commands.add('byButtonText', (selector: string) => {
  cy.get('button[type="button"]').contains(`${selector}`);
});

Cypress.Commands.add('byDataID', (selector: string) => {
  cy.get(`[data-id="${selector}"]`);
});

Cypress.Commands.add(
  'byTestSelector',
  (selector: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    cy.get(`[data-test-selector="${selector}"]`, options);
  },
);

Cypress.Commands.add('byTestDropDownMenu', (selector: string) => {
  cy.get(`[data-test-dropdown-menu="${selector}"]`);
});

Cypress.Commands.add('byTestOperatorRow', (selector: string, options?: object) => {
  cy.get(`[data-test-operator-row="${selector}"]`, options);
});

Cypress.Commands.add('byTestSectionHeading', (selector: string) => {
  cy.get(`[data-test-section-heading="${selector}"]`);
});

Cypress.Commands.add('byTestOperandLink', (selector: string) => {
  cy.get(`[data-test-operand-link="${selector}"]`);
});

Cypress.Commands.add(
  'login',
  (
    provider: string = 'kube:admin',
    username: string = 'kubeadmin',
    password: string = Cypress.env('LOGIN_PASSWORD'),
    oauthurl: string,
  ) => {
    cy.session(
      [provider, username],
      () => {
        cy.visit(Cypress.config('baseUrl'));
        cy.window().then(
          { oauthurl },
          (
            win: any, // eslint-disable-line @typescript-eslint/no-explicit-any
          ) => {
            // Check if auth is disabled (for a local development environment)
            if (win.SERVER_FLAGS?.authDisabled) {
              cy.task('log', '  skipping login, console is running with auth disabled');
              return;
            }
            cy.exec(
              `oc get node --selector=hypershift.openshift.io/managed --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
            ).then((result) => {
              cy.log(result.stdout);
              cy.task('log', result.stdout);
              if (result.stdout.includes('Ready')) {
                cy.log(oauthurl);
                cy.task('log', oauthurl);
                cy.origin(
                  oauthurl,
                  { args: { username, password } },
                  // eslint-disable-next-line @typescript-eslint/no-shadow
                  ({ username, password }) => {
                    cy.get('#inputUsername').type(username);
                    cy.get('#inputPassword').type(password);
                    cy.get('button[type=submit]').click();
                  },
                );
              } else {
                // Note required duplication in if above due to limitations of cy.origin
                cy.task('log', `  Logging in as ${username}`);
                cy.get('[data-test-id="login"]').should('be.visible');
                cy.get('body').then(($body) => {
                  if ($body.text().includes(provider)) {
                    cy.contains(provider).should('be.visible').click();
                  }
                });
                cy.get('#inputUsername').type(username);
                cy.get('#inputPassword').type(password);
                cy.get('button[type=submit]').click();
              }
            });
          },
        );
      },
      {
        cacheAcrossSpecs: true,
        validate() {
          cy.visit(Cypress.config('baseUrl'));
          cy.byTestID('user-dropdown').should('exist');
        },
      },
    );
  },
);

Cypress.Commands.add('cliLogin', (username?, password?, hostapi?) => {
  const loginUsername = username || Cypress.env('LOGIN_USERNAME');
  const loginPassword = password || Cypress.env('LOGIN_PASSWORD');
  const hostapiurl = hostapi || Cypress.env('HOST_API');
  cy.exec(
    `oc login -u ${loginUsername} -p ${loginPassword} ${hostapiurl} --insecure-skip-tls-verify=true`,
    { failOnNonZeroExit: false },
  ).then((result) => {
    cy.log(result.stderr);
    cy.log(result.stdout);
  });
});

Cypress.Commands.add('cliLogout', () => {
  cy.exec(`oc logout`, { failOnNonZeroExit: false }).then((result) => {
    cy.log(result.stderr);
    cy.log(result.stdout);
  });
});

Cypress.Commands.add('adminCLI', (command: string) => {
  cy.log(`Run admin command: ${command}`);
  cy.exec(`${command} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);
});

const MOCK_STREAMED_RESPONSE_BODY = `data: {"event": "start", "data": {"conversation_id": "5f424596-a4f9-4a3a-932b-46a768de3e7c"}}

data: {"event": "token", "data": {"id": 0, "token": "Mock"}}

data: {"event": "token", "data": {"id": 1, "token": " OLS"}}

data: {"event": "token", "data": {"id": 2, "token": " response"}}

data: {"event": "end", "data": {"referenced_documents": [], "truncated": false}}
`;

type Attachment = { attachment_type: string; content_type: string };

Cypress.Commands.add(
  'interceptQuery',
  (
    alias: string,
    query: string,
    conversationId: string | null = null,
    attachments: Array<Attachment> = [],
  ) => {
    cy.intercept(
      'POST',
      '/api/proxy/plugin/lightspeed-console-plugin/ols/v1/streaming_query',
      (request) => {
        expect(request.body.media_type).to.equal('application/json');
        expect(request.body.conversation_id).to.equal(conversationId);
        expect(request.body.query).to.equal(query);

        expect(request.body.attachments).to.have.lengthOf(attachments.length);
        attachments.forEach((a, i) => {
          expect(request.body.attachments[i].attachment_type).to.equal(a.attachment_type);
          expect(request.body.attachments[i].content_type).to.equal(a.content_type);
        });

        request.reply({ body: MOCK_STREAMED_RESPONSE_BODY, delay: 1000 });
      },
    ).as(alias);
  },
);

const USER_FEEDBACK_MOCK_RESPONSE = { body: { message: 'Feedback received' } };

Cypress.Commands.add(
  'interceptFeedback',
  (
    alias: string,
    conversationId: string,
    sentiment: number,
    userFeedback: string,
    userQuestionStartsWith: string,
  ) => {
    cy.intercept(
      'POST',
      '/api/proxy/plugin/lightspeed-console-plugin/ols/v1/feedback',
      (request) => {
        expect(_.omit(request.body, 'user_question')).to.deep.equal({
          /* eslint-disable camelcase */
          conversation_id: conversationId,
          sentiment,
          user_feedback: userFeedback,
          llm_response: 'Mock OLS response',
          /* eslint-enable camelcase */
        });
        expect(request.body.user_question.startsWith(userQuestionStartsWith)).to.equal(true);

        request.reply(USER_FEEDBACK_MOCK_RESPONSE);
      },
    ).as(alias);
  },
);
