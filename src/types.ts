import { Map as ImmutableMap } from 'immutable';

import { ErrorType } from './error';

export type Attachment = {
  attachmentType: string;
  kind: string;
  name: string;
  namespace: string;
  originalValue?: string;
  value: string;
};

export type ReferencedDoc = {
  docs_url: string;
  title: string;
};

type ChatEntryUser = {
  attachments: { [key: string]: Attachment };
  text: string;
  who: 'user';
};

type ChatEntryAI = {
  error?: ErrorType;
  isTruncated: boolean;
  references?: Array<ReferencedDoc>;
  text?: string;
  userFeedback?: ImmutableMap<string, object>;
  who: 'ai';
};

export type ChatEntry = ChatEntryAI | ChatEntryUser;
