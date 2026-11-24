/* eslint-disable no-console */
import * as fs from 'fs';
import * as path from 'path';

import { gatherClusterArtifacts, oc } from './fixtures';

// Written by the global setup when the run reused a pre-existing OLS
// installation (see global-setup.ts).
const PREINSTALLED_MARKER = path.join(__dirname, '..', '.ols-preinstalled');

const globalTeardown = async () => {
  if (process.env.SKIP_OLS_SETUP) {
    console.log('Skip OLS uninstall because SKIP_OLS_SETUP is true');
    return;
  }

  const preinstalled = fs.existsSync(PREINSTALLED_MARKER);
  if (preinstalled) {
    fs.rmSync(PREINSTALLED_MARKER, { force: true });
  }

  const OLS_NAMESPACE = 'openshift-lightspeed';
  const username = process.env.LOGIN_USERNAME || 'kubeadmin';

  console.log('Gathering cluster artifacts...');
  gatherClusterArtifacts();

  // Preserving a pre-existing installation: only the role bindings granted
  // by the setup are removed; the OLSConfig and namespace are left intact.
  if (preinstalled) {
    console.log('OLS installation pre-existed this run, preserving OLSConfig and namespace');
  } else {
    try {
      oc(['delete', '--timeout=2m', 'OLSConfig', 'cluster']);
    } catch {
      // Ignore errors during cleanup
    }

    try {
      oc(['delete', 'namespace', OLS_NAMESPACE]);
    } catch {
      // Ignore errors during cleanup
    }
  }

  try {
    oc(['adm', 'policy', 'remove-cluster-role-from-user', 'cluster-admin', username]);
  } catch {
    // Ignore errors during cleanup
  }

  try {
    oc([
      'adm',
      'policy',
      'remove-cluster-role-from-user',
      'lightspeed-operator-query-access',
      username,
    ]);
  } catch {
    // Ignore errors during cleanup
  }

  console.log('OLS cleanup complete');
};

export default globalTeardown;
