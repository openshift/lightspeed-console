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

type ChatEntryUser = {
  attachments: { [key: string]: Attachment };
  text: string;
  who: 'user';
};

type ChatEntryAI = {
  error?: ErrorType;
  id: string;
  isStreaming: boolean;
  isTruncated: boolean;
  references?: Array<ReferencedDoc>;
  text?: string;
  userFeedback?: ImmutableMap<string, object>;
  who: 'ai';
};

export type ChatEntry = ChatEntryAI | ChatEntryUser;

export type CodeBlock = {
  id: string;
  value: string;
  triggeredFrom?: string;
};
