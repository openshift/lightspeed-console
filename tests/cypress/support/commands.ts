import { nav } from '../../upstream/views/nav';
import { guidedTour } from '../../upstream/views/guided-tour';

declare global {
    namespace Cypress {
        interface Chainable<Subject> {
            uiLogin(provider: string, username: string, password: string);
            uiLogout();
            cliLogin(username?, password?, hostapi?);
            cliLogout();
            adminCLI(command: string, options?);
        }
    }
}

const kubeconfig = Cypress.env('KUBECONFIG_PATH');
const DEFAULT_RETRY_OPTIONS = { retries: 3, interval: 10000 };

// to avoid influence from upstream login change
Cypress.Commands.add('uiLogin', (provider: string, username: string, password: string)=> {
  cy.clearCookie('openshift-session-token');
  cy.visit('/');
  cy.window().then((win: any) => {
    if(win.SERVER_FLAGS?.authDisabled) {
      cy.task('log', 'Skipping login, console is running with auth disabled');
      return;
    }
  cy.get('[data-test-id="login"]').should('be.visible');
  cy.get('body').then(($body) => {
    if ($body.text().includes(provider)) {
      cy.contains(provider).should('be.visible').click();
    }else if ($body.find('li.idp').length > 0) {
      //using the last idp if doesn't provider idp name
      cy.get('li.idp').last().click();
    }
  });
  cy.get('#inputUsername').type(username);
  cy.get('#inputPassword').type(password);
  cy.get('button[type=submit]').click();
  cy.byTestID("username", {timeout: 120000})
    .should('be.visible');
  });
  guidedTour.close();
  cy.switchPerspective('Administrator');
});

Cypress.Commands.add('uiLogout', () => {
  cy.window().then((win: any) => {
    if (win.SERVER_FLAGS?.authDisabled){
      cy.log('Skipping logout, console is running with auth disabled');
      return;
    }
    cy.log('Log out UI');
    cy.byTestID('user-dropdown').click();
    cy.byTestID('log-out').should('be.visible');
    cy.byTestID('log-out').click({ force: true });
  })
});

Cypress.Commands.add("cliLogin", (username?, password?, hostapi?) => {
  const loginUsername = username || Cypress.env('LOGIN_USERNAME');
  const loginPassword = password || Cypress.env('LOGIN_PASSWORD');
  const hostapiurl = hostapi || Cypress.env('HOST_API');
  cy.exec(`oc login -u ${loginUsername} -p ${loginPassword} ${hostapiurl} --insecure-skip-tls-verify=true`, { failOnNonZeroExit: false })
    .then(result => {
      cy.log(result.stderr);
      cy.log(result.stdout);
  });
});

Cypress.Commands.add("cliLogout", () => {
  cy.exec(`oc logout`, { failOnNonZeroExit: false }).then(result => {
    cy.log(result.stderr);
    cy.log(result.stdout);
  });
});

Cypress.Commands.add("adminCLI", (command: string, options?: {}) => {
  cy.log(`Run admin command: ${command}`)
  cy.exec(`${command} --kubeconfig ${kubeconfig}`, options)
});

