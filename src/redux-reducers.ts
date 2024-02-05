import { Map as ImmutableMap } from 'immutable';

import { ActionType, OLSAction } from './redux-actions';

export type OLSState = ImmutableMap<string, any>;
export type State = {
  plugins: {
    ols: OLSState;
  }
}

const reducer = (state: OLSState, action: OLSAction): OLSState => {
  if (!state) {
    return ImmutableMap({ prompt: null });
  }

  switch (action.type) {
    case ActionType.SetPromptText:
      return state.set('prompt', action.payload.prompt);

    default:
      break;
  }
  return state;
};

export default reducer;
