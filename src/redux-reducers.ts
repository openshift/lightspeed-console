import { Map as ImmutableMap } from 'immutable';

import { ActionType, OLSAction } from './redux-actions';

export type OLSState = ImmutableMap<string, unknown>;
export type State = {
  plugins: {
    ols: OLSState;
  };
};

const reducer = (state: OLSState, action: OLSAction): OLSState => {
  if (!state) {
    return ImmutableMap({ context: null });
  }

  switch (action.type) {
    case ActionType.SetContext:
      return state.set('context', action.payload.context);

    default:
      break;
  }
  return state;
};

export default reducer;
