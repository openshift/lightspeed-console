import { useUserPreference } from '@openshift-console/dynamic-plugin-sdk';

export const useHideLightspeed = (): [boolean] => {
  const [isHidden, , isLoaded] = useUserPreference<boolean>('console.hideLightspeedButton');
  return [isLoaded && isHidden];
};
