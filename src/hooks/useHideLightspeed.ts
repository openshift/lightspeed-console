import { useUserSettings } from '@openshift-console/dynamic-plugin-sdk';

export const useHideLightspeed = (): [boolean] => {
  const [isHidden, , isLoaded] = useUserSettings<boolean>('console.hideLightspeedButton');
  return [isLoaded && isHidden];
};
