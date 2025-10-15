# OpenShift Lightspeed Console Tests
These console tests install the OpenShift Lightspeed Operator in the specified cluster and then run a series of tests against the UI.

## Prerequisites
1. [Node.js](https://nodejs.org/) >= 18

## Install dependencies
All required dependencies are defined in `package.json` in order to run Cypress tests, run `npm install` so that dependencies will be installed in the `node_modules` folder
```bash
$ npm install
$ ls -ltr
node_modules/     -> dependencies will be installed at runtime here
```

## Directory structure
After dependencies are installed successfully and before we run actual tests, please confirm if we have correct structure as below, two new folders will be created after above
```bash
$ ls tests
drwxr-xr-x  node_modules
```

### Export necessary variables
In order to run Cypress tests, we need to export some environment variables that Cypress can read then pass down to our tests, currently we have following environment variables defined and used.
```bash
export CYPRESS_BASE_URL=https://<console_route_spec_host>
export CYPRESS_LOGIN_IDP=kube:admin
**[Note]** Use `flexy-htpasswd-provider` above when running tests on flexy installed clusters and using any user other than kubeadmin. Use `kube:admin` when running tests as kubeadmin
export CYPRESS_LOGIN_PASSWORD=<kubeadmin password>
export CYPRESS_KUBECONFIG_PATH=/path/to/kubeconfig
```
If you're running a **HyperShift cluster**, please also run
```bash
export CYPRESS_BUNDLE_IMAGE=<Konflux bundle image>
```
The bundle image can be taken from [Konflux's bundle image](https://console.redhat.com/application-pipeline/workspaces/crt-nshift-lightspeed/applications/ols-bundle/components/test-bundle)

### Start Cypress
We can either open the Cypress GUI (`open`) or run Cypress in headless mode (`run`)
```bash
npx cypress open
npx cypress run 

```
