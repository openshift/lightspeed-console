import { action, ActionType as Action } from 'typesafe-actions';

export enum ActionType {
  SetPromptText = 'setPromptText',
}

export const setPromptText = (prompt: string) => action(ActionType.SetPromptText, { prompt });

const actions = { setPromptText };

export type OLSAction = Action<typeof actions>;
