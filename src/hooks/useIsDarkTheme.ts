import { useUserSettings } from '@openshift-console/dynamic-plugin-sdk';

const THEME_SYSTEM_DEFAULT = 'systemDefault';

export const useIsDarkTheme = (): [boolean] => {
  const [theme] = useUserSettings<string>('console.theme', undefined, true);
  const systemPrefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;

  // Match the console, which defaults to system default and treats unrecognized values as light
  const isSystemDefault = theme === undefined || theme === THEME_SYSTEM_DEFAULT;
  return [theme === 'dark' || (isSystemDefault && systemPrefersDark)];
};
