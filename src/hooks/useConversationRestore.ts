import * as React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { fetchConversation, getLastConversationId, transformChatHistory } from '../conversations';
import { chatHistoryPush, setConversationID } from '../redux-actions';
import { State } from '../redux-reducers';
import { ChatEntry } from '../types';

export const useConversationRestore = (): boolean => {
  const dispatch = useDispatch();
  const [isRestored, setIsRestored] = React.useState(false);

  const chatHistory = useSelector((s: State) => s.plugins?.ols?.get('chatHistory'));
  const conversationID = useSelector((s: State) => s.plugins?.ols?.get('conversationID'));

  React.useEffect(() => {
    if (conversationID || chatHistory?.size > 0) {
      setIsRestored(true);
      return;
    }

    const lastId = getLastConversationId();
    if (!lastId) {
      setIsRestored(true);
      return;
    }

    fetchConversation(lastId)
      .then((detail) => {
        const entries = transformChatHistory(detail);
        dispatch(setConversationID(lastId));
        entries.forEach((entry: ChatEntry) => {
          dispatch(chatHistoryPush(entry));
        });
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Failed to restore conversation:', err);
      })
      .finally(() => {
        setIsRestored(true);
      });
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return isRestored;
};
