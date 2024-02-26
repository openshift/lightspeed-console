import { action, ActionType as Action } from 'typesafe-actions';

export enum ActionType {
  DismissPrivacyAlert = 'dismissPrivacyAlert',
  SetContext = 'setContext',
}

export const dismissPrivacyAlert = () => action(ActionType.DismissPrivacyAlert);
export const setContext = (context: object) => action(ActionType.SetContext, { context });

const actions = { dismissPrivacyAlert, setContext };

export type OLSAction = Action<typeof actions>;
