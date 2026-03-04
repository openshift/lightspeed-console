import { Map as ImmutableMap } from 'immutable';
import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';

import { getApiUrl } from './config';
import { getRequestInitWithAuthHeader } from './hooks/useAuth';
import { ChatEntry, ConversationSummary, Tool } from './types';

const CONVERSATIONS_ENDPOINT = getApiUrl('/v1/conversations');
const REQUEST_TIMEOUT = 5 * 60 * 1000;

const LOCAL_STORAGE_KEY = 'ols-lastConversationId';

type ConversationsListResponse = {
  conversations: ConversationSummary[];
};

type ConversationMessage = {
  content: string;
  type: 'assistant' | 'user';
};

type ConversationExchange = {
  messages: ConversationMessage[];
  tool_calls: Array<{ args: Record<string, unknown>; id: string; name: string }>;
  tool_results: Array<{
    content: string;
    id: string;
    round: number;
    status: string;
  }>;
};

type ConversationDetailResponse = {
  chat_history: ConversationExchange[];
  conversation_id: string;
};

type ConversationDeleteResponse = {
  conversation_id: string;
  response: string;
  success: boolean;
};

export const fetchConversationsList = (): Promise<ConversationsListResponse> =>
  consoleFetchJSON(CONVERSATIONS_ENDPOINT, 'get', getRequestInitWithAuthHeader(), REQUEST_TIMEOUT);

export const fetchConversation = (conversationID: string): Promise<ConversationDetailResponse> =>
  consoleFetchJSON(
    `${CONVERSATIONS_ENDPOINT}/${conversationID}`,
    'get',
    getRequestInitWithAuthHeader(),
    REQUEST_TIMEOUT,
  );

export const deleteConversation = (conversationID: string): Promise<ConversationDeleteResponse> =>
  consoleFetchJSON.delete(
    `${CONVERSATIONS_ENDPOINT}/${conversationID}`,
    {},
    getRequestInitWithAuthHeader(),
    REQUEST_TIMEOUT,
  );

let entryCounter = 0;

export const transformChatHistory = (detail: ConversationDetailResponse): ChatEntry[] => {
  const entries: ChatEntry[] = [];
  for (const exchange of detail.chat_history) {
    const userMsg = exchange.messages.find((m) => m.type === 'user');
    const assistantMsg = exchange.messages.find((m) => m.type === 'assistant');

    if (userMsg) {
      entries.push({
        attachments: {},
        text: userMsg.content,
        who: 'user',
      });
    }

    if (assistantMsg) {
      const toolsMap: Record<string, Partial<Tool>> = {};
      if (exchange.tool_calls) {
        for (const tc of exchange.tool_calls) {
          toolsMap[tc.id] = {
            args: tc.args as Tool['args'],
            name: tc.name,
          };
        }
      }
      if (exchange.tool_results) {
        for (const tr of exchange.tool_results) {
          toolsMap[tr.id] = {
            ...toolsMap[tr.id],
            content: tr.content,
            status: tr.status as Tool['status'],
          };
        }
      }

      entryCounter += 1;
      entries.push({
        id: `restored_${entryCounter}`,
        isCancelled: false,
        isStreaming: false,
        isTruncated: false,
        text: assistantMsg.content,
        tools:
          Object.keys(toolsMap).length > 0
            ? ImmutableMap(toolsMap as Record<string, Tool>)
            : ImmutableMap<string, Tool>(),
        who: 'ai',
      });
    }
  }
  return entries;
};

export const getLastConversationId = (): string | null => localStorage.getItem(LOCAL_STORAGE_KEY);

export const setLastConversationId = (id: string | null): void => {
  if (id) {
    localStorage.setItem(LOCAL_STORAGE_KEY, id);
  } else {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
};
