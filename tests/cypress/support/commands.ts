import { nav } from '../../upstream/views/nav';
import { guidedTour } from '../../upstream/views/guided-tour';

declare global {
    namespace Cypress {
        interface Chainable<Subject> {
            switchPerspective(perspective: string);
            uiLogin(provider: string, username: string, password: string);
            uiLogout();
            cliLogin(username?, password?, hostapi?);
            cliLogout();
            adminCLI(command: string, options?);
            retryTask(condition, expectedoutput, options?);
            checkCommandResult(condition, expectedoutput, options?);
            hasWindowsNode();
            isEdgeCluster();
            isAWSSTSCluster();
            isAzureWIFICluster();
            checkClusterType(commandName);
            isEFSDeployed();
            isPlatformSuitableForNMState();
            isTechPreviewNoUpgradeEnabled();
            isManagedCluster();
            isIPICluster();
            cliLoginAzureExternalOIDC();
            uiLoginAzureExternalOIDC();
            uiLogoutAzureExternalOIDC();
        }
    }
}

const kubeconfig = Cypress.env('KUBECONFIG_PATH');
const DEFAULT_RETRY_OPTIONS = { retries: 3, interval: 10000 };

Cypress.Commands.add("switchPerspective", (perspective: string) => {

    /* if side bar is collapsed then expand it
    before switching perspecting */
    cy.get('body').then((body) => {
        if (body.find('.pf-m-collapsed').length > 0) {
            cy.get('#nav-toggle').click()
        }
    });
    nav.sidenav.switcher.changePerspectiveTo(perspective);
    nav.sidenav.switcher.shouldHaveText(perspective);
});

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
const AzureLoginFlowOnPage = ()=>{
  const sentArgs = {username: Cypress.env('LOGIN_USER'), password: Cypress.env('LOGIN_PASSWD'), email: Cypress.env('LOGIN_USER_EMAIL')};
  cy.origin('https://login.microsoftonline.com', { args: sentArgs },
  ({ username, password, email }) => {
    cy.wait(5000);
    cy.get('body').then(($body) => {
      if ($body.text().includes('Pick an account')) {
        if($body.text().includes(username)){
          cy.log('Choose an existing account!');
          cy.contains(username).click();
        }else {
          cy.log('Use another account!');
          cy.contains('Use another account').click();
          cy.log('Now input account email.');
          cy.get('input[type="email"]').type(email);
          cy.get('input[type=submit]').click();
        }
      }else if ($body.text().includes('Sign in')) {
        cy.log('Now input account email.');
        cy.get('input[type="email"]').type(email);
        cy.get('input[type=submit]').click();
      }
    });
  });
  cy.wait(5000);
  cy.origin('https://auth.redhat.com',{ args: sentArgs }, ({ username, password, email }) => {
    cy.get('body', {timeout: 10000}).should('include.text','Internal SSO');
    cy.get('body').then(($body) => {
      cy.log('Now input user and password.');
      cy.get('#username').type(username);
      cy.get('#password').type(password);
      cy.get('input[type=submit]').click();
  });
  });
  cy.wait(5000);

};
Cypress.Commands.add("uiLoginAzureExternalOIDC", () => {
  cy.visit('/');
  cy.wait(10000);
  cy.url().then(($url)=>{
    cy.log('current url is: '+ $url);
    if($url.includes('console-openshift-console')){
      cy.log('Already login!');
    }else{
      AzureLoginFlowOnPage();
      cy.url().then(($url1)=>{
        cy.log('current url is: '+ $url1);
        if(!$url1.includes('console-openshift-console')){
          cy.log('Still on microsoft login page.')
          cy.origin('https://login.microsoftonline.com', () => {
            cy.get('body').then(($body) => {
              if ($body.text().includes('signed in')) {
                cy.get('input[value=No]').click();
              }
            });
          });
        }
      });
    }
  });
  cy.byTestID('user-dropdown').should('exist');
  guidedTour.close();
  cy.switchPerspective('Administrator');
  cy.log('Login Successfully!');
});

Cypress.Commands.add("uiLogoutAzureExternalOIDC", () => {
  cy.uiLogout();
  cy.wait(3000);
  cy.origin('https://login.microsoftonline.com', () => {
    cy.get('body').then(($body) => {
      if ($body.text().includes('Pick an account')) {
        cy.contains('Signed in').click();
      }
    cy.contains('div#login_workload_logo_text', 'You signed out of your account').should('exist');
    cy.contains('div#SignOutStatusMessage', 'a good idea to close all browser windows').should('exist');
    });
  });
  cy.log('Log out successfully!');
});

Cypress.Commands.add("cliLoginAzureExternalOIDC", () => {
  cy.origin('http://localhost:8080', () =>{
    cy.visit('/');
  });
  AzureLoginFlowOnPage();
  cy.log('Login finished!');
});

Cypress.Commands.add("adminCLI", (command: string, options?: {}) => {
  cy.log(`Run admin command: ${command}`)
  cy.exec(`${command} --kubeconfig ${kubeconfig}`, options)
});

Cypress.Commands.add('retryTask', (command, expectedOutput, options?) => {
  const { retries, interval } = options || DEFAULT_RETRY_OPTIONS;
  const retryTaskFn = (currentRetries) => {
    return cy.adminCLI(command)
      .then(result => {
        if (result.stdout.includes(expectedOutput)) {
          return cy.wrap(true);
        } else if (currentRetries < retries) {
          return cy.wait(interval).then(() => retryTaskFn(currentRetries + 1));
        } else {
          return cy.wrap(false);
        }
      });
  };
  return retryTaskFn(0);
});

Cypress.Commands.add("checkCommandResult", (command, expectedoutput, options?) => {
  return cy.retryTask(command, expectedoutput, options)
    .then(conditionMet =>{
      if (conditionMet) {
        return;
      } else {
        throw new Error(`"${command}" failed to meet expectedoutput ${expectedoutput} within ${options.retries} retries`);
      }
    })
});

const hasWindowsNode = () :boolean => {
  cy.exec(`oc get node -l kubernetes.io/os=windows --kubeconfig ${kubeconfig}`).then((result) => {
      if(!result.stdout){
        cy.log("Testing on cluster without windows node. Skip this windows scenario!");
        return false;
      } else {
        cy.log("Testing on cluster with windows node.");
        return cy.wrap(true);
      }
  });
};
Cypress.Commands.add("hasWindowsNode", () => {
  return hasWindowsNode();
});
Cypress.Commands.add("isEdgeCluster", () => {
  cy.exec(`oc get infrastructure cluster -o jsonpath={.spec.platformSpec.type} --kubeconfig ${kubeconfig}`, { failOnNonZeroExit: false }).then((result) => {
      cy.log(result.stdout);
      if ( result.stdout == 'BareMetal' ){
         cy.log("Testing on Edge cluster.");
         return cy.wrap(true);
      }else {
         cy.log("It's not Edge cluster. Skip!");
         return cy.wrap(false);
      }
    });
});
Cypress.Commands.add("isAWSSTSCluster", (credentialMode: string, infraPlatform: string, authIssuer: string) => {
  if(credentialMode == 'Manual' && infraPlatform == 'AWS' && authIssuer != ''){
    cy.log('Testing on AWS STS cluster!');
    return cy.wrap(true);
  }else{
    cy.log('Not AWS STS cluster, skip!');
    return cy.wrap(false);
  }
});
Cypress.Commands.add("isAzureWIFICluster", (credentialMode: string, infraPlatform: string, authIssuer: string) => {
  if(credentialMode == 'Manual' && infraPlatform == 'Azure' && authIssuer != ''){
    cy.log('Testing on Azure WIFI cluster!');
    return cy.wrap(true);
  }else{
    cy.log('Not Azure WIFI cluster, skip!');
    return cy.wrap(false);
  }
});
Cypress.Commands.add("checkClusterType", (commandName) => {
  const clusterTypes = {
    isGCPCluster: {
      condition: (credentialMode, infraPlatform, authIssuer) =>
        infraPlatform === 'GCP',
      message: 'Continuing testing on a GCP cluster!',
      skipMessage: 'This is not a GCP cluster!!!'
    },
    isGCPWIFICluster: {
      condition: (credentialMode, infraPlatform, authIssuer) =>
        credentialMode === 'Manual' && infraPlatform === 'GCP' && authIssuer !== '',
      message: 'Continuing testing a GCP WIFI enabled cluster!',
      skipMessage: 'This is not a GCP WIFI enabled cluster!!!'
    }
  };
  const clusterType = clusterTypes[commandName];

  if (!clusterType) {
    cy.log(`Unknown command: ${commandName}`);
    return;
  }

  return cy.exec(`oc get cloudcredential cluster --template={{.spec.credentialsMode}} --kubeconfig=${kubeconfig}`)
    .then(result => {
      const credentialMode = result.stdout.trim();
      return cy.exec(`oc get infrastructure cluster --template={{.status.platform}} --kubeconfig=${kubeconfig}`)
        .then(result => ({ credentialMode, infraPlatform: result.stdout.trim() }));
    })
    .then(({ credentialMode, infraPlatform }) => {
      return cy.exec(`oc get authentication cluster --template={{.spec.serviceAccountIssuer}} --kubeconfig=${kubeconfig}`)
        .then(result => ({ credentialMode, infraPlatform, authIssuer: result.stdout.trim() }));
    })
    .then(({ credentialMode, infraPlatform, authIssuer }) => {
      cy.log(`platform: ${infraPlatform} #########`);
      cy.log(`credentialMode: ${credentialMode} #########`);
      cy.log(`authIssuer: ${authIssuer} #########`);

      const result = clusterType.condition(credentialMode, infraPlatform, authIssuer);
      const message = result ? clusterType.message : clusterType.skipMessage;
      cy.log(message);
      return cy.wrap(result);
    });
});

Cypress.Commands.add("isEFSDeployed", () => {
  cy.adminCLI('oc get sc').then(result => {
    if (result.stdout.includes('efs.csi.aws.com')) {
      cy.log('EFS deployed, it do not support volumesnapshot, skipping')
      return cy.wrap(true);
    } else {
      return cy.wrap(false);
    }
  })
});

Cypress.Commands.add("isPlatformSuitableForNMState", () => {
  cy.exec(`oc get infrastructure cluster -o jsonpath={.spec.platformSpec.type} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`, { failOnNonZeroExit: false }).then((result) => {
    if( result.stdout == 'BareMetal' || result.stdout == 'None' || result.stdout == 'VSphere' || result.stdout == 'OpenStack'){
      cy.log("Testing on baremetal/vsphere/openstack.");
      return cy.wrap(true);
    } else {
      cy.log("Skipping for unsupported platform, not baremetal/vsphere/openstack!");
      return cy.wrap(false);
    }
  });
});

Cypress.Commands.add("isTechPreviewNoUpgradeEnabled", () => {
  cy.adminCLI(`oc get featuregate cluster -o jsonpath='{.spec.featureSet}'`)
    .then((result) => {
      const command_stdout = result.stdout;
      if(command_stdout.includes('TechPreviewNoUpgrade')) {
        cy.log('TechPreviewNoUpgrade is Enabled');
        return cy.wrap(true);
      } else {
        cy.log('TechPreviewNoUpgrade is NOT enabled');
        return cy.wrap(false);
      }
    })
});

Cypress.Commands.add("isManagedCluster", () => {
  let brand;
  cy.window().then((win: any) => {
    brand = win.SERVER_FLAGS.branding;
    cy.log(`${brand}`);
    if(brand == 'rosa' || brand == 'dedicated'){
      cy.log('Testing on Rosa/OSD cluster!');
      return cy.wrap(true);
    } else {
      cy.log('Not Rosa/OSD cluster. Skip!');
      return cy.wrap(false);
    }
  });
});

Cypress.Commands.add("isIPICluster", () => {
  cy.exec(`oc get machines.machine.openshift.io -n openshift-machine-api --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`, { failOnNonZeroExit: false }).then((result) => {
    if( result.stdout.includes('Running') ){
      cy.log("Testing on IPI cluster!");
      return cy.wrap(true);
    } else {
      cy.log("Not IPI cluster. Skip!");
      return cy.wrap(false);
    }
  });
});
