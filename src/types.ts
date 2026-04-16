import * as React from 'react';
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
  approvalID?: string;
  args: { [key: string]: unknown };
  content: string;
  description?: string;
  isApproved?: boolean;
  isDenied?: boolean;
  isUserApproval?: boolean;
  name: string;
  status: 'error' | 'success' | 'truncated';
  uiResourceUri?: string;
  serverName?: string;
  structuredContent?: Record<string, unknown>;
  olsToolUiID?: string;
};

export type OlsToolUIComponent = React.ComponentType<{ tool: Tool }>;

type HistoryCompression = {
  durationMs?: number;
  status: 'compressing' | 'done';
};

type ChatEntryUser = {
  attachments: { [key: string]: Attachment };
  hidden?: boolean;
  text: string;
  who: 'user';
};

type UserFeedback = {
  isOpen: boolean;
  sentiment?: number;
  text?: string;
};

type ChatEntryAI = {
  error?: ErrorType;
  historyCompression?: HistoryCompression;
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
