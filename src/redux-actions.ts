import { action, ActionType as Action } from 'typesafe-actions';

export enum ActionType {
  CloseOLS = 'closeOLS',
  DismissPrivacyAlert = 'dismissPrivacyAlert',
  OpenOLS = 'openOLS',
  SetChatHistory = 'setChatHistory',
  SetContext = 'setContext',
}

export const closeOLS = () => action(ActionType.CloseOLS);
export const dismissPrivacyAlert = () => action(ActionType.DismissPrivacyAlert);
export const openOLS = () => action(ActionType.OpenOLS);
export const setChatHistory = (chatHistory: object) =>
  action(ActionType.SetChatHistory, { chatHistory });
export const setContext = (context: object) => action(ActionType.SetContext, { context });

const actions = { closeOLS, dismissPrivacyAlert, openOLS, setChatHistory, setContext };

export type OLSAction = Action<typeof actions>;
