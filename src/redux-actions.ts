import { action, ActionType as Action } from 'typesafe-actions';

import { Attachment, AttachmentOptions, ChatEntry } from './types';

export enum ActionType {
  AttachmentAdd = 'attachmentAdd',
  AttachmentDelete = 'attachmentDelete',
  AttachmentsClear = 'attachmentsClear',
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
  UserFeedbackOpen = 'userFeedbackOpen',
  UserFeedbackSetSentiment = 'userFeedbackSetSentiment',
  UserFeedbackSetText = 'userFeedbackSetText',
}

export const attachmentAdd = (
  attachmentType: string,
  kind: string,
  name: string,
  namespace: string,
  value: string,
  options: AttachmentOptions = null,
) =>
  action(ActionType.AttachmentAdd, {
    attachmentType,
    kind,
    name,
    namespace,
    value,
    options,
  });
export const attachmentDelete = (id: string) => action(ActionType.AttachmentDelete, { id });
export const attachmentsClear = () => action(ActionType.AttachmentsClear);
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
export const userFeedbackOpen = (entryIndex: number) =>
  action(ActionType.UserFeedbackOpen, { entryIndex });
export const userFeedbackSetSentiment = (entryIndex: number, sentiment: number) =>
  action(ActionType.UserFeedbackSetSentiment, { entryIndex, sentiment });
export const userFeedbackSetText = (entryIndex: number, text: string) =>
  action(ActionType.UserFeedbackSetText, { entryIndex, text });

const actions = {
  attachmentAdd,
  attachmentDelete,
  attachmentsClear,
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
  userFeedbackOpen,
  userFeedbackSetSentiment,
  userFeedbackSetText,
};

export type OLSAction = Action<typeof actions>;
