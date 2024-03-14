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
    return ImmutableMap({
      chatHistory: [],
      context: null,
      isOpen: false,
      isPrivacyAlertDismissed: false,
    });
  }

  switch (action.type) {
    case ActionType.CloseOLS:
      return state.set('isOpen', false);

    case ActionType.DismissPrivacyAlert:
      return state.set('isPrivacyAlertDismissed', true);

    case ActionType.OpenOLS:
      return state.set('isOpen', true);

    case ActionType.SetContext:
      return state.set('context', action.payload.context);

    case ActionType.SetChatHistory:
      return state.set('chatHistory', action.payload.chatHistory);

    default:
      break;
  }
  return state;
};

export default reducer;
