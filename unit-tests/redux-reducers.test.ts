import { describe, it } from 'node:test';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { List as ImmutableList, Map as ImmutableMap } from 'immutable';

import reducer, { OLSState } from '../src/redux-reducers';
import { ActionType } from '../src/redux-actions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dispatch = (state: OLSState, type: ActionType, payload?: any) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reducer(state, { type, payload } as any);

const initState = (): OLSState =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reducer(undefined as any, { type: '' } as any);

describe('reducer initialization', () => {
  it('returns default state when state is undefined', () => {
    const state = initState();
    strictEqual(ImmutableMap.isMap(state), true);
    strictEqual(state.get('isOpen'), false);
    strictEqual(state.get('query'), '');
    strictEqual(state.get('conversationID'), null);
    strictEqual(state.get('autoSubmit'), false);
    strictEqual(state.get('hidePrompt'), false);
    strictEqual(state.get('isTroubleshooting'), false);
    strictEqual(state.get('isUserFeedbackEnabled'), true);
    strictEqual(state.get('isContextEventsLoading'), false);
    strictEqual(state.get('codeBlock'), null);
    strictEqual(state.get('openAttachment'), null);
    strictEqual(ImmutableList.isList(state.get('chatHistory')), true);
    strictEqual(state.get('chatHistory').size, 0);
    strictEqual(ImmutableMap.isMap(state.get('attachments')), true);
    strictEqual(state.get('attachments').size, 0);
    deepStrictEqual(state.get('contextEvents'), []);
  });
});

describe('reducer returns state unchanged for unknown action', () => {
  it('returns the same state reference', () => {
    const state = initState();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const next = reducer(state, { type: 'nonexistent' } as any);
    strictEqual(next, state);
  });
});

describe('context events', () => {
  it('AddContextEvent appends to empty list', () => {
    const state = initState();
    const event = { kind: 'Pod', message: 'Started' };
    const next = dispatch(state, ActionType.AddContextEvent, { event });
    deepStrictEqual(next.get('contextEvents'), [event]);
  });

  it('AddContextEvent appends to existing events', () => {
    let state = initState();
    const event1 = { kind: 'Pod', message: 'Started' };
    const event2 = { kind: 'Pod', message: 'Pulled' };
    state = dispatch(state, ActionType.AddContextEvent, { event: event1 });
    state = dispatch(state, ActionType.AddContextEvent, { event: event2 });
    deepStrictEqual(state.get('contextEvents'), [event1, event2]);
  });

  it('ClearContextEvents resets to empty array', () => {
    let state = initState();
    state = dispatch(state, ActionType.AddContextEvent, { event: { msg: 'test' } });
    state = dispatch(state, ActionType.ClearContextEvents);
    deepStrictEqual(state.get('contextEvents'), []);
  });

  it('SetIsContextEventsLoading sets the loading flag', () => {
    const state = initState();
    const next = dispatch(state, ActionType.SetIsContextEventsLoading, { isLoading: true });
    strictEqual(next.get('isContextEventsLoading'), true);
  });
});

describe('attachments', () => {
  const attachment = {
    attachmentType: 'YAML',
    kind: 'Pod',
    name: 'my-pod',
    namespace: 'default',
    ownerName: 'my-deploy',
    value: 'apiVersion: v1',
  };

  it('AttachmentSet with explicit id', () => {
    const state = initState();
    const next = dispatch(state, ActionType.AttachmentSet, { ...attachment, id: 'custom-id' });
    strictEqual(next.getIn(['attachments', 'custom-id']).kind, 'Pod');
  });

  it('AttachmentSet generates id from type, kind, name, and ownerName', () => {
    const state = initState();
    const next = dispatch(state, ActionType.AttachmentSet, attachment);
    const expectedID = 'YAML_Pod_my-pod_my-deploy';
    strictEqual(next.getIn(['attachments', expectedID]).kind, 'Pod');
  });

  it('AttachmentSet uses NO-OWNER when ownerName is undefined', () => {
    const state = initState();
    const noOwner = {
      attachmentType: 'YAML',
      kind: 'Pod',
      name: 'my-pod',
      namespace: 'default',
      value: 'apiVersion: v1',
    };
    const next = dispatch(state, ActionType.AttachmentSet, noOwner);
    const expectedID = 'YAML_Pod_my-pod_NO-OWNER';
    strictEqual(next.getIn(['attachments', expectedID]).kind, 'Pod');
  });

  it('AttachmentDelete removes an attachment by id', () => {
    let state = initState();
    state = dispatch(state, ActionType.AttachmentSet, { ...attachment, id: 'del-me' });
    strictEqual(state.get('attachments').size, 1);
    state = dispatch(state, ActionType.AttachmentDelete, { id: 'del-me' });
    strictEqual(state.get('attachments').size, 0);
  });

  it('AttachmentsClear removes all attachments', () => {
    let state = initState();
    state = dispatch(state, ActionType.AttachmentSet, { ...attachment, id: 'a' });
    state = dispatch(state, ActionType.AttachmentSet, { ...attachment, id: 'b' });
    strictEqual(state.get('attachments').size, 2);
    state = dispatch(state, ActionType.AttachmentsClear);
    strictEqual(state.get('attachments').size, 0);
  });

  it('AttachmentSet with explicit id updates in place on save (no duplicate)', () => {
    const alertId = 'YAML_Alert_alertname=HighMemory,severity=warning';
    const alertAttachment = {
      attachmentType: 'YAML',
      kind: 'Alert',
      name: 'HighMemory',
      namespace: '',
      value: 'original yaml',
      id: alertId,
    };

    let state = initState();
    state = dispatch(state, ActionType.AttachmentSet, alertAttachment);
    strictEqual(state.get('attachments').size, 1);
    strictEqual(state.getIn(['attachments', alertId]).value, 'original yaml');

    state = dispatch(state, ActionType.AttachmentSet, {
      ...alertAttachment,
      value: 'edited yaml',
      originalValue: 'original yaml',
      id: alertId,
    });
    strictEqual(state.get('attachments').size, 1);
    strictEqual(state.get('attachments').has(alertId), true);
    strictEqual(state.getIn(['attachments', alertId]).value, 'edited yaml');
    strictEqual(state.getIn(['attachments', alertId]).originalValue, 'original yaml');
  });

  it('AttachmentSet with explicit id updates in place on revert (no duplicate)', () => {
    const alertId = 'YAML_Alert_alertname=HighMemory,severity=warning';
    const alertAttachment = {
      attachmentType: 'YAML',
      kind: 'Alert',
      name: 'HighMemory',
      namespace: '',
      value: 'original yaml',
      id: alertId,
    };

    let state = initState();
    state = dispatch(state, ActionType.AttachmentSet, alertAttachment);

    state = dispatch(state, ActionType.AttachmentSet, {
      ...alertAttachment,
      value: 'edited yaml',
      originalValue: 'original yaml',
      id: alertId,
    });
    strictEqual(state.get('attachments').size, 1);

    state = dispatch(state, ActionType.AttachmentSet, {
      ...alertAttachment,
      value: 'original yaml',
      originalValue: undefined,
      id: alertId,
    });
    strictEqual(state.get('attachments').size, 1);
    strictEqual(state.get('attachments').has(alertId), true);
    strictEqual(state.getIn(['attachments', alertId]).value, 'original yaml');
    strictEqual(state.getIn(['attachments', alertId]).originalValue, undefined);
  });
});

describe('chat history', () => {
  const aiEntry = {
    id: 'msg-1',
    who: 'ai',
    text: 'Hello',
    isStreaming: true,
    isCancelled: false,
    isTruncated: false,
  };

  it('ChatHistoryPush adds an entry', () => {
    const state = initState();
    const next = dispatch(state, ActionType.ChatHistoryPush, { entry: aiEntry });
    strictEqual(next.get('chatHistory').size, 1);
    strictEqual(next.get('chatHistory').get(0).get('id'), 'msg-1');
  });

  it('ChatHistoryPush preserves existing entries', () => {
    let state = initState();
    state = dispatch(state, ActionType.ChatHistoryPush, { entry: aiEntry });
    state = dispatch(state, ActionType.ChatHistoryPush, {
      entry: { ...aiEntry, id: 'msg-2', text: 'World' },
    });
    strictEqual(state.get('chatHistory').size, 2);
    strictEqual(state.get('chatHistory').get(0).get('id'), 'msg-1');
    strictEqual(state.get('chatHistory').get(1).get('id'), 'msg-2');
  });

  it('ChatHistoryClear removes all entries', () => {
    let state = initState();
    state = dispatch(state, ActionType.ChatHistoryPush, { entry: aiEntry });
    state = dispatch(state, ActionType.ChatHistoryClear);
    strictEqual(state.get('chatHistory').size, 0);
  });

  it('ChatHistoryUpdateByID merges fields into the matching entry', () => {
    let state = initState();
    state = dispatch(state, ActionType.ChatHistoryPush, { entry: aiEntry });
    state = dispatch(state, ActionType.ChatHistoryUpdateByID, {
      id: 'msg-1',
      entry: { isStreaming: false, text: 'Hello, updated' },
    });
    const updated = state.get('chatHistory').get(0);
    strictEqual(updated.get('isStreaming'), false);
    strictEqual(updated.get('text'), 'Hello, updated');
    strictEqual(updated.get('id'), 'msg-1');
  });

  it('ChatHistoryUpdateTool merges tool data into the matching entry', () => {
    let state = initState();
    state = dispatch(state, ActionType.ChatHistoryPush, { entry: aiEntry });
    state = dispatch(state, ActionType.ChatHistoryUpdateTool, {
      id: 'msg-1',
      toolID: 'tool-1',
      tool: { name: 'search', status: 'success', content: 'result' },
    });
    const tool = state.getIn(['chatHistory', 0, 'tools', 'tool-1']);
    strictEqual(tool.get('name'), 'search');
    strictEqual(tool.get('status'), 'success');
  });
});

describe('popover open/close', () => {
  it('OpenOLS sets isOpen to true', () => {
    const state = initState();
    strictEqual(dispatch(state, ActionType.OpenOLS).get('isOpen'), true);
  });

  it('CloseOLS sets isOpen to false and hidePrompt to false', () => {
    let state = initState();
    state = dispatch(state, ActionType.OpenOLS);
    state = dispatch(state, ActionType.SetHidePrompt, { hidePrompt: true });
    state = dispatch(state, ActionType.CloseOLS);
    strictEqual(state.get('isOpen'), false);
    strictEqual(state.get('hidePrompt'), false);
  });
});

describe('simple setters', () => {
  it('SetQuery', () => {
    const state = initState();
    strictEqual(dispatch(state, ActionType.SetQuery, { query: 'hello' }).get('query'), 'hello');
  });

  it('SetConversationID', () => {
    const state = initState();
    const next = dispatch(state, ActionType.SetConversationID, { id: 'conv-123' });
    strictEqual(next.get('conversationID'), 'conv-123');
  });

  it('SetAutoSubmit', () => {
    const state = initState();
    strictEqual(
      dispatch(state, ActionType.SetAutoSubmit, { autoSubmit: true }).get('autoSubmit'),
      true,
    );
  });

  it('SetHidePrompt', () => {
    const state = initState();
    strictEqual(
      dispatch(state, ActionType.SetHidePrompt, { hidePrompt: true }).get('hidePrompt'),
      true,
    );
  });

  it('SetIsTroubleshooting', () => {
    const state = initState();
    const next = dispatch(state, ActionType.SetIsTroubleshooting, { isTroubleshooting: true });
    strictEqual(next.get('isTroubleshooting'), true);
  });

  it('ImportCodeBlock', () => {
    const state = initState();
    const code = { id: 'cb-1', value: 'console.log("hi")' };
    strictEqual(dispatch(state, ActionType.ImportCodeBlock, { code }).get('codeBlock'), code);
  });
});

describe('open attachment', () => {
  it('OpenAttachmentSet stores the attachment', () => {
    const state = initState();
    const attachment = { kind: 'Pod', name: 'test' };
    const next = dispatch(state, ActionType.OpenAttachmentSet, { attachment });
    deepStrictEqual(next.get('openAttachment'), attachment);
  });

  it('OpenAttachmentClear resets to null', () => {
    let state = initState();
    state = dispatch(state, ActionType.OpenAttachmentSet, { attachment: { kind: 'Pod' } });
    state = dispatch(state, ActionType.OpenAttachmentClear);
    strictEqual(state.get('openAttachment'), null);
  });
});

describe('open tool', () => {
  it('OpenToolSet stores chatEntryIndex and id', () => {
    const state = initState();
    const next = dispatch(state, ActionType.OpenToolSet, { chatEntryIndex: 2, id: 'tool-5' });
    strictEqual(next.getIn(['openTool', 'chatEntryIndex']), 2);
    strictEqual(next.getIn(['openTool', 'id']), 'tool-5');
  });

  it('OpenToolClear resets both fields to null', () => {
    let state = initState();
    state = dispatch(state, ActionType.OpenToolSet, { chatEntryIndex: 2, id: 'tool-5' });
    state = dispatch(state, ActionType.OpenToolClear);
    strictEqual(state.getIn(['openTool', 'chatEntryIndex']), null);
    strictEqual(state.getIn(['openTool', 'id']), null);
  });
});

describe('user feedback', () => {
  const pushAIEntry = (state: OLSState) =>
    dispatch(state, ActionType.ChatHistoryPush, {
      entry: {
        id: 'msg-1',
        who: 'ai',
        text: 'Hi',
        isStreaming: false,
        isCancelled: false,
        isTruncated: false,
      },
    });

  it('UserFeedbackOpen sets isOpen on the entry', () => {
    let state = pushAIEntry(initState());
    state = dispatch(state, ActionType.UserFeedbackOpen, { entryIndex: 0 });
    strictEqual(state.getIn(['chatHistory', 0, 'userFeedback', 'isOpen']), true);
  });

  it('UserFeedbackClose sets isOpen to false', () => {
    let state = pushAIEntry(initState());
    state = dispatch(state, ActionType.UserFeedbackOpen, { entryIndex: 0 });
    state = dispatch(state, ActionType.UserFeedbackClose, { entryIndex: 0 });
    strictEqual(state.getIn(['chatHistory', 0, 'userFeedback', 'isOpen']), false);
  });

  it('UserFeedbackSetSentiment stores sentiment value', () => {
    let state = pushAIEntry(initState());
    state = dispatch(state, ActionType.UserFeedbackSetSentiment, { entryIndex: 0, sentiment: 1 });
    strictEqual(state.getIn(['chatHistory', 0, 'userFeedback', 'sentiment']), 1);
  });

  it('UserFeedbackSetText stores feedback text', () => {
    let state = pushAIEntry(initState());
    state = dispatch(state, ActionType.UserFeedbackSetText, {
      entryIndex: 0,
      text: 'Great answer',
    });
    strictEqual(state.getIn(['chatHistory', 0, 'userFeedback', 'text']), 'Great answer');
  });

  it('UserFeedbackDisable disables feedback globally', () => {
    const state = initState();
    strictEqual(
      dispatch(state, ActionType.UserFeedbackDisable).get('isUserFeedbackEnabled'),
      false,
    );
  });
});
