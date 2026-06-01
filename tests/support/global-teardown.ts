/* eslint-disable no-console */
import { oc } from './fixtures';

const globalTeardown = async () => {
  if (process.env.SKIP_OLS_SETUP) {
    console.log('Skip OLS uninstall because SKIP_OLS_SETUP is true');
    return;
  }

  const OLS_NAMESPACE = 'openshift-lightspeed';
  const username = process.env.LOGIN_USERNAME || 'kubeadmin';

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
