import { List as ImmutableList, Map as ImmutableMap } from 'immutable';

import { ActionType, OLSAction } from './redux-actions';
import { Attachment } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OLSState = ImmutableMap<string, any>;

export type State = {
  plugins: {
    ols: OLSState;
  };
  sdkCore: {
    user: {
      username: string;
    };
  };
};

const reducer = (state: OLSState, action: OLSAction): OLSState => {
  if (!state) {
    return ImmutableMap({
      attachments: ImmutableMap<string, Attachment>(),
      chatHistory: ImmutableList(),
      codeBlock: null,
      context: null,
      contextEvents: [],
      conversationID: null,
      isContextEventsLoading: false,
      isOpen: false,
      isUserFeedbackEnabled: true,
      openAttachment: null,
      query: '',
    });
  }

  switch (action.type) {
    case ActionType.AddContextEvent: {
      const oldEvents = state.get('contextEvents');
      return state.set(
        'contextEvents',
        oldEvents ? [...oldEvents, action.payload.event] : [action.payload.event],
      );
    }

    case ActionType.ImportCodeBlock:
      return state.set('codeBlock', action.payload.code);

    case ActionType.AttachmentDelete:
      return state.deleteIn(['attachments', action.payload.id]);

    case ActionType.AttachmentsClear:
      return state.set('attachments', ImmutableMap());

    case ActionType.AttachmentSet: {
      const id = `${action.payload.attachmentType}_${action.payload.kind}_${action.payload.name}_${action.payload.ownerName ?? 'NO-OWNER'}`;
      return state.setIn(['attachments', id], action.payload);
    }

    case ActionType.ChatHistoryClear:
      return state.set('chatHistory', ImmutableList());

    case ActionType.chatHistoryUpdateByID: {
      const index = state
        .get('chatHistory')
        .findIndex((entry) => entry.get('id') === action.payload.id);
      return state.mergeIn(['chatHistory', index], action.payload.entry);
    }

    case ActionType.ChatHistoryPush:
      return state.set(
        'chatHistory',
        state.get('chatHistory').push(ImmutableMap(action.payload.entry)),
      );

    case ActionType.ClearContextEvents:
      return state.set('contextEvents', []);

    case ActionType.CloseOLS:
      return state.set('isOpen', false);

    case ActionType.OpenAttachmentClear:
      return state.set('openAttachment', null);

    case ActionType.OpenAttachmentSet:
      return state.set('openAttachment', action.payload.attachment);

    case ActionType.OpenOLS:
      return state.set('isOpen', true);

    case ActionType.SetIsContextEventsLoading:
      return state.set('isContextEventsLoading', action.payload.isLoading);

    case ActionType.SetConversationID:
      return state.set('conversationID', action.payload.id);

    case ActionType.SetQuery:
      return state.set('query', action.payload.query);

    case ActionType.UserFeedbackClose:
      return state.setIn(
        ['chatHistory', action.payload.entryIndex, 'userFeedback', 'isOpen'],
        false,
      );

    case ActionType.UserFeedbackDisable:
      return state.set('isUserFeedbackEnabled', false);

    case ActionType.UserFeedbackOpen:
      return state.setIn(
        ['chatHistory', action.payload.entryIndex, 'userFeedback', 'isOpen'],
        true,
      );

    case ActionType.UserFeedbackSetSentiment:
      return state.setIn(
        ['chatHistory', action.payload.entryIndex, 'userFeedback', 'sentiment'],
        action.payload.sentiment,
      );

    case ActionType.UserFeedbackSetText:
      return state.setIn(
        ['chatHistory', action.payload.entryIndex, 'userFeedback', 'text'],
        action.payload.text,
      );

    default:
      break;
  }
  return state;
};

export default reducer;
