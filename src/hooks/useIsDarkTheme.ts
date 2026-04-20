import { useUserPreference } from '@openshift-console/dynamic-plugin-sdk';

export const useIsDarkTheme = (): [boolean] => {
  const [theme] = useUserPreference('console.theme', null, true);
  return [
    theme === 'systemDefault' || theme === null
      ? window.matchMedia?.('(prefers-color-scheme: dark)').matches
      : theme === 'dark',
  ];
};
