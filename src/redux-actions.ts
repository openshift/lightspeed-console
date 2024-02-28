import { action, ActionType as Action } from 'typesafe-actions';

export enum ActionType {
  CloseOLS = 'closeOLS',
  DismissPrivacyAlert = 'dismissPrivacyAlert',
  OpenOLS = 'openOLS',
  SetContext = 'setContext',
  SetHistory = 'setHistory',
}

export const closeOLS = () => action(ActionType.CloseOLS);
export const dismissPrivacyAlert = () => action(ActionType.DismissPrivacyAlert);
export const openOLS = () => action(ActionType.OpenOLS);
export const setContext = (context: object) => action(ActionType.SetContext, { context });
export const setHistory = (history: object) => action(ActionType.SetHistory, { history });

const actions = { closeOLS, dismissPrivacyAlert, openOLS, setContext, setHistory };

export type OLSAction = Action<typeof actions>;
