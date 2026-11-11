import { useEffect, useState } from 'react';

import { useUserPreference } from '@openshift-console/dynamic-plugin-sdk';

const THEME_SYSTEM_DEFAULT = 'systemDefault';

const darkSchemeQuery = window.matchMedia?.('(prefers-color-scheme: dark)');

export const useIsDarkTheme = (): [boolean] => {
  const [theme] = useUserPreference<string>('console.theme', undefined, true);
  const [systemPrefersDark, setSystemPrefersDark] = useState(darkSchemeQuery?.matches ?? false);

  useEffect(() => {
    if (!darkSchemeQuery) {
      return;
    }
    // Re-render when the OS color scheme changes so our theme stays in sync
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    darkSchemeQuery.addEventListener('change', handler);
    return () => darkSchemeQuery.removeEventListener('change', handler);
  }, []);

  // Match the console, which defaults to system default and treats unrecognized values as light
  const isSystemDefault = theme === undefined || theme === THEME_SYSTEM_DEFAULT;
  return [theme === 'dark' || (isSystemDefault && systemPrefersDark)];
};
