# OLS Console Tests
The OLS console tests relies on upstream [openshift/console](https://github.com/openshift/console/tree/master) which provides fundamental configurations, views that we can reuse in openshift-tests-private web tests

## Prerequisite
1. [node.js](https://nodejs.org/) >= 18 & [yarn](https://yarnpkg.com/en/docs/install) >= 1.20
2. upstream [openshift/console](https://github.com/openshift/console/tree/master) should be cloned locally
3. upstream openshift/console dependencies need to be installed, for example we cloned openshift/console repo and save it to ~/OLS
   - cd ~/OLS/console/frontend
   - yarn install


## Install dependencies
all required dependencies are defined in `package.json` in order to run Cypress tests, run `npm install` so that dependencies will be installed in `node_modules` folder
```bash
$ npm install
$ ls -ltr
node_modules/     -> dependencies will be installed at runtime here
```

**[Note] ALL following steps will run in `tests` directory of lightspeed-console repo**
## Create symbolic link to console tools
ln -s ~/OLS/console/frontend/packages/integration-tests-cypress upstream


## Directory structure
after dependencies are installed successfully and before we run actual tests, please confirm if we have correct structure as below, two new folders will be created after above
```bash
$ ls tests
lrwxr-xr-x  upstream -> /xxx/console/frontend/packages/integration-tests-cypress
drwxr-xr-x  node_modules
````


### Export necessary variables
in order to run Cypress tests, we need to export some environment variables that Cypress can read then pass down to our tests, currently we have following environment variables defined and used.
```bash
export CYPRESS_BASE_URL=https://<console_route_spec_host>
export CYPRESS_LOGIN_IDP=flexy-htpasswd-provider
**[Note] Use `flexy-htpasswd-provider` above when running tests on flexy installed clusters and using any user other than kubeadmin. Use `kube:admin` when running tests as kubeadmin
export CYPRESS_LOGIN_USERS=USER1:Password1,USER2:Password2,USER3:Password3
export CYPRESS_KUBECONFIG_PATH=/path/to/kubeconfig
```
### Start Cypress
we can either open Cypress GUI(open) or run Cypress in headless mode(run)
```bash
npx cypress open
npx cypress run --spec tests/tests/lightspeed-install.cy.ts

```
