import { action, ActionType as Action } from 'typesafe-actions';

export enum ActionType {
  SetContext = 'setContext',
}

export const setContext = (context: Object) => action(ActionType.SetContext, { context });

const actions = { setContext };

export type OLSAction = Action<typeof actions>;
