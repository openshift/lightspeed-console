import * as React from 'react';
import { useDispatch } from 'react-redux';

import { attachmentSet, openOLS, setAutoSubmit, setQuery } from '../redux-actions';
import { Attachment } from '../types';

// Hook that provides a callback function to open the OpenShift Lightspeed UI with an optional
// initial prompt. Exposed as a console extension so other console pages and plugins can discover
// and invoke it.
export const useOpenOLS = (): ((
  prompt?: string,
  attachments?: Attachment[],
  submitImmediately?: boolean,
) => void) => {
  const dispatch = useDispatch();

  return React.useCallback(
    (prompt?: string, attachments?: Attachment[], submitImmediately?: boolean) => {
      if (prompt) {
        dispatch(setQuery(prompt));
      }

      if (attachments && attachments.length > 0) {
        for (const attachment of attachments) {
          dispatch(
            attachmentSet(
              attachment.attachmentType,
              attachment.kind,
              attachment.name,
              attachment.ownerName,
              attachment.namespace,
              attachment.value,
              attachment.originalValue,
            ),
          );
        }
      }

      if (submitImmediately) {
        dispatch(setAutoSubmit(true));
      }

      dispatch(openOLS());
    },
    [dispatch],
  );
};

export default useOpenOLS;
