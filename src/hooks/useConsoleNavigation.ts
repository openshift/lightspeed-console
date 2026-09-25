import * as React from 'react';
import { useNavigate } from 'react-router';

import { navigateToConsolePath } from '../consoleNavigation';

export const useConsoleNavigation = (): ((path: string) => void) => {
  const navigate = useNavigate();

  return React.useCallback(
    (path: string) => {
      if (!path || path === '#') {
        return;
      }

      try {
        navigate(path);
      } catch {
        try {
          navigateToConsolePath(path);
        } catch {
          // Fail closed: navigation is best-effort from the Lightspeed modal.
        }
      }
    },
    [navigate],
  );
};
