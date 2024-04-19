import { Map as ImmutableMap } from 'immutable';

export type Attachment = {
  attachmentType: string;
  kind: string;
  name: string;
  namespace: string;
  value: object;
};

type ChatEntryUser = {
  attachments: ImmutableMap<string, string>;
  text: string;
  who: 'user';
};

type ChatEntryAI = {
  error?: string;
  isTruncated: boolean;
  references?: Array<string>;
  text?: string;
  userFeedback?: ImmutableMap<string, object>;
  who: 'ai';
};

export type ChatEntry = ChatEntryAI | ChatEntryUser;
