import { action, ActionType as Action } from 'typesafe-actions';

import { Attachment, ChatEntry } from './types';

export enum ActionType {
  AttachmentDelete = 'attachmentDelete',
  AttachmentsClear = 'attachmentsClear',
  AttachmentSet = 'attachmentSet',
  ChatHistoryClear = 'chatHistoryClear',
  ChatHistoryPush = 'chatHistoryPush',
  CloseOLS = 'closeOLS',
  OpenAttachmentClear = 'openAttachmentClear',
  OpenAttachmentSet = 'openAttachmentSet',
  OpenOLS = 'openOLS',
  SetContext = 'setContext',
  SetConversationID = 'setConversationID',
  SetQuery = 'setQuery',
  UserFeedbackClose = 'userFeedbackClose',
  UserFeedbackDisable = 'userFeedbackDisable',
  UserFeedbackOpen = 'userFeedbackOpen',
  UserFeedbackSetSentiment = 'userFeedbackSetSentiment',
  UserFeedbackSetText = 'userFeedbackSetText',
}

export const attachmentDelete = (id: string) => action(ActionType.AttachmentDelete, { id });

export const attachmentsClear = () => action(ActionType.AttachmentsClear);

export const attachmentSet = (
  attachmentType: string,
  kind: string,
  name: string,
  namespace: string,
  value: string,
) =>
  action(ActionType.AttachmentSet, {
    attachmentType,
    kind,
    name,
    namespace,
    value,
  });

export const chatHistoryClear = () => action(ActionType.ChatHistoryClear);

export const chatHistoryPush = (entry: ChatEntry) => action(ActionType.ChatHistoryPush, { entry });

export const closeOLS = () => action(ActionType.CloseOLS);

export const openAttachmentClear = () => action(ActionType.OpenAttachmentClear);

export const openAttachmentSet = (attachment: Attachment) =>
  action(ActionType.OpenAttachmentSet, { attachment });

export const openOLS = () => action(ActionType.OpenOLS);

export const setContext = (context: object) => action(ActionType.SetContext, { context });

export const setConversationID = (id: string) => action(ActionType.SetConversationID, { id });

export const setQuery = (query: string) => action(ActionType.SetQuery, { query });

export const userFeedbackClose = (entryIndex: number) =>
  action(ActionType.UserFeedbackClose, { entryIndex });

export const userFeedbackDisable = () => action(ActionType.UserFeedbackDisable);

export const userFeedbackOpen = (entryIndex: number) =>
  action(ActionType.UserFeedbackOpen, { entryIndex });

export const userFeedbackSetSentiment = (entryIndex: number, sentiment: number) =>
  action(ActionType.UserFeedbackSetSentiment, { entryIndex, sentiment });

export const userFeedbackSetText = (entryIndex: number, text: string) =>
  action(ActionType.UserFeedbackSetText, { entryIndex, text });

const actions = {
  attachmentDelete,
  attachmentsClear,
  attachmentSet,
  chatHistoryClear,
  chatHistoryPush,
  closeOLS,
  openAttachmentClear,
  openAttachmentSet,
  openOLS,
  setContext,
  setConversationID,
  setQuery,
  userFeedbackClose,
  userFeedbackDisable,
  userFeedbackOpen,
  userFeedbackSetSentiment,
  userFeedbackSetText,
};

export type OLSAction = Action<typeof actions>;
