import { Map as ImmutableMap } from 'immutable';

import { ErrorType } from './error';

declare global {
  interface Window {
    SERVER_FLAGS: {
      releaseVersion: string;
    };
  }
}

export type Attachment = {
  attachmentType: string;
  isEditable?: boolean;
  kind: string;
  name: string;
  namespace: string;
  originalValue?: string;
  ownerName?: string;
  value: string;
};

export type ReferencedDoc = {
  doc_title: string;
  doc_url: string;
};

export type Tool = {
  args: { [key: string]: Array<string> };
  content: string;
  name: string;
  status: 'error' | 'success' | 'truncated';
  uiResourceUri?: string;
  serverName?: string;
  structuredContent?: Record<string, unknown>;
};

type ChatEntryUser = {
  attachments: { [key: string]: Attachment };
  hidden?: boolean;
  text: string;
  who: 'user';
};

export type UserFeedback = {
  isOpen: boolean;
  sentiment?: number;
  text?: string;
};

type ChatEntryAI = {
  error?: ErrorType;
  id: string;
  isCancelled: boolean;
  isStreaming: boolean;
  isTruncated: boolean;
  references?: Array<ReferencedDoc>;
  text?: string;
  tools?: ImmutableMap<string, Tool>;
  userFeedback?: ImmutableMap<keyof UserFeedback, UserFeedback[keyof UserFeedback]>;
  who: 'ai';
};

export type ChatEntry = ChatEntryAI | ChatEntryUser;

export type CodeBlock = {
  id: string;
  value: string;
  triggeredFrom?: string;
};
