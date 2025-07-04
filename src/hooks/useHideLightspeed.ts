import { useUserSettings } from '@openshift-console/dynamic-plugin-sdk';

export const useHideLightspeed = (): [boolean] => {
  const [isHidden, , isLoaded] = useUserSettings('console.hideLightspeedButton');
  return [isLoaded === true && isHidden === true];
};
