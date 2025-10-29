/* eslint-disable @typescript-eslint/no-use-before-define */
import * as _ from 'lodash';

import { getApiUrl } from '../../src/config';

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
            });
          },
        );
      },
      {
        cacheAcrossSpecs: true,
        validate() {
          cy.visit(Cypress.config('baseUrl'));
          cy.byTestID('username').should('exist');
        },
      },
    );
  },
);

Cypress.Commands.add('adminCLI', (command: string, options?) => {
  cy.log(`Run admin command: ${command}`);
  cy.exec(`${command} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`, options);
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
    cy.intercept('POST', getApiUrl('/v1/streaming_query'), (request) => {
      expect(request.body.media_type).to.equal('application/json');
      expect(request.body.conversation_id).to.equal(conversationId);
      expect(request.body.query).to.equal(query);

      expect(request.body.attachments).to.have.lengthOf(attachments.length);
      attachments.forEach((a, i) => {
        expect(request.body.attachments[i].attachment_type).to.equal(a.attachment_type);
        expect(request.body.attachments[i].content_type).to.equal(a.content_type);
      });

      request.reply({ body: MOCK_STREAMED_RESPONSE_BODY, delay: 1000 });
    }).as(alias);
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
    cy.intercept('POST', getApiUrl('/v1/feedback'), (request) => {
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
    }).as(alias);
  },
);
