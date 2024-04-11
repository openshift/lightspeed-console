import { Map as ImmutableMap } from 'immutable';

type ChatEntryUser = {
  text: string;
  who: 'user';
};

type ChatEntryAI = {
  error?: string;
  isTruncated: boolean;
  references?: Array<string>;
  text?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userFeedback?: ImmutableMap<string, any>;
  who: 'ai';
};

export type ChatEntry = ChatEntryAI | ChatEntryUser;
