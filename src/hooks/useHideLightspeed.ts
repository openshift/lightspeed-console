import { useUserSettings } from '@openshift-console/dynamic-plugin-sdk';

export const useHideLightspeed = (): [boolean] => {
  // Keep the hook call to avoid React hook order issues
  useUserSettings<boolean>('console.hideLightspeedButton');
  // Always show during development
  return [false];
};
