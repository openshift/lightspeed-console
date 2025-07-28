import { useUserSettings } from '@openshift-console/dynamic-plugin-sdk';

export const useIsDarkTheme = (): [boolean] => {
  const [theme] = useUserSettings('console.theme', null, true);
  return [
    theme === 'systemDefault'
      ? window.matchMedia?.('(prefers-color-scheme: dark)').matches
      : theme === 'dark',
  ];
};
