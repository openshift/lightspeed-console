import * as React from 'react';
import { useDispatch } from 'react-redux';

import {
  attachmentSet,
  openOLS,
  setAutoSubmit,
  setHidePrompt,
  setIsTroubleshooting,
  setQuery,
} from '../redux-actions';
import { Attachment } from '../types';

export type OpenOLSMode = 'ask' | 'troubleshooting';

// Hook that provides a callback function to open the OpenShift Lightspeed UI with an optional
// initial prompt. Exposed as a console extension so other console pages and plugins can discover
// and invoke it.
export const useOpenOLS = (): ((
  // Optional initial prompt text to populate the input field
  prompt?: string,
  // Optional array of attachments to include with the prompt
  attachments?: Attachment[],
  // If true, automatically submits the prompt
  submitImmediately?: boolean,
  // If true, hides the user's message from chat history (useful for contextual help)
  hidePrompt?: boolean,
  // OLS request mode; drives Redux isTroubleshooting and the API `mode` field
  mode?: OpenOLSMode,
) => void) => {
  const dispatch = useDispatch();

  return React.useCallback(
    (
      prompt?: string,
      attachments?: Attachment[],
      submitImmediately?: boolean,
      hidePrompt?: boolean,
      mode?: OpenOLSMode,
    ) => {
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

      dispatch(setHidePrompt(Boolean(hidePrompt)));

      if (mode !== undefined) {
        dispatch(setIsTroubleshooting(mode === 'troubleshooting'));
      }

      dispatch(openOLS());
    },
    [dispatch],
  );
};

export default useOpenOLS;
