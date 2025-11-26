import * as React from 'react';
import { useDispatch } from 'react-redux';

import { openOLS, setQuery } from '../redux-actions';

// Hook that provides a callback function to open the OpenShift Lightspeed UI with an optional
// initial prompt. Exposed as a console extension so other console pages and plugins can discover
// and invoke it.
export const useOpenOLS = (): ((prompt?: string) => void) => {
  const dispatch = useDispatch();

  return React.useCallback(
    (prompt?: string) => {
      if (prompt) {
        dispatch(setQuery(prompt));
      }
      dispatch(openOLS());
    },
    [dispatch],
  );
};

export default useOpenOLS;
