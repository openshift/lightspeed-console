import { action, ActionType as Action } from 'typesafe-actions';

export enum ActionType {
  DismissPrivacyAlert = 'dismissPrivacyAlert',
  SetContext = 'setContext',
  SetHistory = 'setHistory',
}

export const dismissPrivacyAlert = () => action(ActionType.DismissPrivacyAlert);
export const setContext = (context: object) => action(ActionType.SetContext, { context });
export const setHistory = (history: object) => action(ActionType.SetHistory, { history });

const actions = { dismissPrivacyAlert, setContext, setHistory };

export type OLSAction = Action<typeof actions>;
