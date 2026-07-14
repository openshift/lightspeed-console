import { useEffect, useState } from 'react';

import { useUserPreference } from '@openshift-console/dynamic-plugin-sdk';

const darkSchemeQuery = window.matchMedia?.('(prefers-color-scheme: dark)');

export const useIsDarkTheme = (): [boolean] => {
  const [theme] = useUserPreference('console.theme', null, true);
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

  return [theme === 'systemDefault' || theme === null ? systemPrefersDark : theme === 'dark'];
};
