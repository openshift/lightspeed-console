import { List as ImmutableList, Map as ImmutableMap } from 'immutable';
import { describe, expect, it } from 'vitest';

import {
  addContextEvent,
  attachmentDelete,
  attachmentsClear,
  attachmentSet,
  chatHistoryClear,
  chatHistoryPush,
  chatHistoryUpdateByID,
  chatHistoryUpdateTool,
  clearContextEvents,
  closeOLS,
  importCodeBlock,
  openAttachmentClear,
  openAttachmentSet,
  openOLS,
  openToolClear,
  openToolSet,
  setAutoSubmit,
  setConversationID,
  setHidePrompt,
  setIsContextEventsLoading,
  setIsTroubleshooting,
  setQuery,
  userFeedbackClose,
  userFeedbackDisable,
  userFeedbackOpen,
  userFeedbackSetSentiment,
  userFeedbackSetText,
} from '../src/redux-actions';
import reducer, { OLSState } from '../src/redux-reducers';
import { Attachment, ChatEntry } from '../src/types';

const initState = (): OLSState =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reducer(undefined as any, { type: '' } as any);

const attachment: Attachment = {
  attachmentType: 'YAML',
  kind: 'Pod',
  name: 'my-pod',
  namespace: 'default',
  ownerName: 'my-deploy',
  value: 'apiVersion: v1',
};

const setAttachment = (state: OLSState, a: Attachment): OLSState =>
  reducer(
    state,
    attachmentSet(
      a.attachmentType,
      a.kind,
      a.name,
      a.ownerName,
      a.namespace,
      a.value,
      a.originalValue,
      a.id,
    ),
  );

describe('reducer initialization', () => {
  it('returns default state when state is undefined', () => {
    const state = initState();
    expect(ImmutableMap.isMap(state)).toBe(true);
    expect(state.get('isOpen')).toBe(false);
    expect(state.get('query')).toBe('');
    expect(state.get('conversationID')).toBe(null);
    expect(state.get('autoSubmit')).toBe(false);
    expect(state.get('hidePrompt')).toBe(false);
    expect(state.get('isTroubleshooting')).toBe(false);
    expect(state.get('isUserFeedbackEnabled')).toBe(true);
    expect(state.get('isContextEventsLoading')).toBe(false);
    expect(state.get('codeBlock')).toBe(null);
    expect(state.get('openAttachment')).toBe(null);
    expect(ImmutableList.isList(state.get('chatHistory'))).toBe(true);
    expect(state.get('chatHistory').size).toBe(0);
    expect(ImmutableMap.isMap(state.get('attachments'))).toBe(true);
    expect(state.get('attachments').size).toBe(0);
    expect(state.get('contextEvents')).toStrictEqual([]);
  });
});

describe('reducer returns state unchanged for unknown action', () => {
  it('returns the same state reference', () => {
    const state = initState();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const next = reducer(state, { type: 'nonexistent' } as any);
    expect(next).toBe(state);
  });
});

describe('context events', () => {
  it('AddContextEvent appends to empty list', () => {
    const state = initState();
    const event = { kind: 'Pod', message: 'Started' };
    const next = reducer(state, addContextEvent(event));
    expect(next.get('contextEvents')).toStrictEqual([event]);
  });

  it('AddContextEvent appends to existing events', () => {
    let state = initState();
    const event1 = { kind: 'Pod', message: 'Started' };
    const event2 = { kind: 'Pod', message: 'Pulled' };
    state = reducer(state, addContextEvent(event1));
    state = reducer(state, addContextEvent(event2));
    expect(state.get('contextEvents')).toStrictEqual([event1, event2]);
  });

  it('ClearContextEvents resets to empty array', () => {
    let state = initState();
    state = reducer(state, addContextEvent({ msg: 'test' }));
    state = reducer(state, clearContextEvents());
    expect(state.get('contextEvents')).toStrictEqual([]);
  });

  it('SetIsContextEventsLoading sets the loading flag', () => {
    const state = initState();
    const next = reducer(state, setIsContextEventsLoading(true));
    expect(next.get('isContextEventsLoading')).toBe(true);
  });
});

describe('attachments', () => {
  it('AttachmentSet with explicit id', () => {
    const state = initState();
    const next = setAttachment(state, { ...attachment, id: 'custom-id' });
    expect(next.getIn(['attachments', 'custom-id']).kind).toBe('Pod');
  });

  it('AttachmentSet generates id from type, kind, name, and ownerName', () => {
    const state = initState();
    const next = setAttachment(state, attachment);
    const expectedID = 'YAML_Pod_my-pod_my-deploy';
    expect(next.getIn(['attachments', expectedID]).kind).toBe('Pod');
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
    const next = setAttachment(state, noOwner);
    const expectedID = 'YAML_Pod_my-pod_NO-OWNER';
    expect(next.getIn(['attachments', expectedID]).kind).toBe('Pod');
  });

  it('AttachmentDelete removes an attachment by id', () => {
    let state = initState();
    state = setAttachment(state, { ...attachment, id: 'del-me' });
    expect(state.get('attachments').size).toBe(1);
    state = reducer(state, attachmentDelete('del-me'));
    expect(state.get('attachments').size).toBe(0);
  });

  it('AttachmentsClear removes all attachments', () => {
    let state = initState();
    state = setAttachment(state, { ...attachment, id: 'a' });
    state = setAttachment(state, { ...attachment, id: 'b' });
    expect(state.get('attachments').size).toBe(2);
    state = reducer(state, attachmentsClear());
    expect(state.get('attachments').size).toBe(0);
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
    state = setAttachment(state, alertAttachment);
    expect(state.get('attachments').size).toBe(1);
    expect(state.getIn(['attachments', alertId]).value).toBe('original yaml');

    state = setAttachment(state, {
      ...alertAttachment,
      value: 'edited yaml',
      originalValue: 'original yaml',
      id: alertId,
    });
    expect(state.get('attachments').size).toBe(1);
    expect(state.get('attachments').has(alertId)).toBe(true);
    expect(state.getIn(['attachments', alertId]).value).toBe('edited yaml');
    expect(state.getIn(['attachments', alertId]).originalValue).toBe('original yaml');
  });

  it('AttachmentSet with explicit id preserves edits on re-select (no duplicate)', () => {
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
    state = setAttachment(state, alertAttachment);

    state = setAttachment(state, {
      ...alertAttachment,
      value: 'edited yaml',
      originalValue: 'original yaml',
      id: alertId,
    });
    expect(state.get('attachments').size).toBe(1);

    state = setAttachment(state, {
      ...alertAttachment,
      value: 'original yaml',
      originalValue: undefined,
      id: alertId,
    });
    expect(state.get('attachments').size).toBe(1);
    expect(state.get('attachments').has(alertId)).toBe(true);
    expect(state.getIn(['attachments', alertId]).value).toBe('edited yaml');
    expect(state.getIn(['attachments', alertId]).originalValue).toBe('original yaml');
  });

  it('AttachmentSet overwrites unedited attachment with same id', () => {
    let state = initState();
    state = setAttachment(state, { ...attachment, id: 'a' });
    state = setAttachment(state, {
      ...attachment,
      id: 'a',
      value: 'updated yaml',
    });
    expect(state.getIn(['attachments', 'a']).value).toBe('updated yaml');
    expect(state.getIn(['attachments', 'a']).originalValue).toBeUndefined();
  });

  it('AttachmentSet preserves user edits when re-selecting same attachment', () => {
    let state = initState();
    state = setAttachment(state, {
      ...attachment,
      id: 'a',
      value: 'edited yaml',
      originalValue: 'apiVersion: v1',
    });
    state = setAttachment(state, {
      ...attachment,
      id: 'a',
      value: 'fresh yaml from server',
    });
    expect(state.getIn(['attachments', 'a']).value).toBe('edited yaml');
    expect(state.getIn(['attachments', 'a']).originalValue).toBe('fresh yaml from server');
  });

  it('AttachmentSet allows explicit save with originalValue on edited attachment', () => {
    let state = initState();
    state = setAttachment(state, {
      ...attachment,
      id: 'a',
      value: 'first edit',
      originalValue: 'apiVersion: v1',
    });
    state = setAttachment(state, {
      ...attachment,
      id: 'a',
      value: 'second edit',
      originalValue: 'apiVersion: v1',
    });
    expect(state.getIn(['attachments', 'a']).value).toBe('second edit');
    expect(state.getIn(['attachments', 'a']).originalValue).toBe('apiVersion: v1');
  });

  it('AttachmentSet revert clears changed state when originalValue equals value', () => {
    let state = initState();
    state = setAttachment(state, {
      ...attachment,
      id: 'a',
      value: 'edited yaml',
      originalValue: 'apiVersion: v1',
    });
    expect(state.getIn(['attachments', 'a']).value).toBe('edited yaml');
    expect(state.getIn(['attachments', 'a']).originalValue).toBe('apiVersion: v1');

    state = setAttachment(state, {
      ...attachment,
      id: 'a',
      value: 'apiVersion: v1',
      originalValue: 'apiVersion: v1',
    });
    expect(state.getIn(['attachments', 'a']).value).toBe('apiVersion: v1');
    expect(state.getIn(['attachments', 'a']).originalValue).toBe('apiVersion: v1');
  });

  it('AttachmentSet respects empty-string originalValue as explicit', () => {
    let state = initState();
    state = setAttachment(state, {
      ...attachment,
      id: 'a',
      value: 'first edit',
      originalValue: '',
    });
    state = setAttachment(state, {
      ...attachment,
      id: 'a',
      value: 'second edit',
      originalValue: '',
    });
    expect(state.getIn(['attachments', 'a']).value).toBe('second edit');
    expect(state.getIn(['attachments', 'a']).originalValue).toBe('');
  });
});

describe('chat history', () => {
  const aiEntry: ChatEntry = {
    id: 'msg-1',
    isCancelled: false,
    isStreaming: true,
    isTruncated: false,
    text: 'Hello',
    who: 'ai',
  };

  it('ChatHistoryPush adds an entry', () => {
    const state = initState();
    const next = reducer(state, chatHistoryPush(aiEntry));
    expect(next.get('chatHistory').size).toBe(1);
    expect(next.get('chatHistory').get(0).get('id')).toBe('msg-1');
  });

  it('ChatHistoryPush preserves existing entries', () => {
    let state = initState();
    state = reducer(state, chatHistoryPush(aiEntry));
    state = reducer(state, chatHistoryPush({ ...aiEntry, id: 'msg-2', text: 'World' }));
    expect(state.get('chatHistory').size).toBe(2);
    expect(state.get('chatHistory').get(0).get('id')).toBe('msg-1');
    expect(state.get('chatHistory').get(1).get('id')).toBe('msg-2');
  });

  it('ChatHistoryClear removes all entries', () => {
    let state = initState();
    state = reducer(state, chatHistoryPush(aiEntry));
    state = reducer(state, chatHistoryClear());
    expect(state.get('chatHistory').size).toBe(0);
  });

  it('ChatHistoryUpdateByID merges fields into the matching entry', () => {
    let state = initState();
    state = reducer(state, chatHistoryPush(aiEntry));
    state = reducer(
      state,
      chatHistoryUpdateByID('msg-1', { isStreaming: false, text: 'Hello, updated' }),
    );
    const updated = state.get('chatHistory').get(0);
    expect(updated.get('isStreaming')).toBe(false);
    expect(updated.get('text')).toBe('Hello, updated');
    expect(updated.get('id')).toBe('msg-1');
  });

  it('ChatHistoryUpdateTool merges tool data into the matching entry', () => {
    let state = initState();
    state = reducer(state, chatHistoryPush(aiEntry));
    state = reducer(
      state,
      chatHistoryUpdateTool('msg-1', 'tool-1', {
        content: 'result',
        name: 'search',
        status: 'success',
      }),
    );
    const tool = state.getIn(['chatHistory', 0, 'tools', 'tool-1']);
    expect(tool.get('name')).toBe('search');
    expect(tool.get('status')).toBe('success');
  });
});

describe('popover open/close', () => {
  it('OpenOLS sets isOpen to true', () => {
    const state = initState();
    expect(reducer(state, openOLS()).get('isOpen')).toBe(true);
  });

  it('CloseOLS sets isOpen to false and hidePrompt to false', () => {
    let state = initState();
    state = reducer(state, openOLS());
    state = reducer(state, setHidePrompt(true));
    state = reducer(state, closeOLS());
    expect(state.get('isOpen')).toBe(false);
    expect(state.get('hidePrompt')).toBe(false);
  });
});

describe('simple setters', () => {
  it('SetQuery', () => {
    const state = initState();
    expect(reducer(state, setQuery('hello')).get('query')).toBe('hello');
  });

  it('SetConversationID', () => {
    const state = initState();
    const next = reducer(state, setConversationID('conv-123'));
    expect(next.get('conversationID')).toBe('conv-123');
  });

  it('SetAutoSubmit', () => {
    const state = initState();
    expect(reducer(state, setAutoSubmit(true)).get('autoSubmit')).toBe(true);
  });

  it('SetHidePrompt', () => {
    const state = initState();
    expect(reducer(state, setHidePrompt(true)).get('hidePrompt')).toBe(true);
  });

  it('SetIsTroubleshooting', () => {
    const state = initState();
    const next = reducer(state, setIsTroubleshooting(true));
    expect(next.get('isTroubleshooting')).toBe(true);
  });

  it('ImportCodeBlock', () => {
    const state = initState();
    const code = { id: 'cb-1', value: 'console.log("hi")' };
    expect(reducer(state, importCodeBlock(code)).get('codeBlock')).toBe(code);
  });
});

describe('open attachment', () => {
  it('OpenAttachmentSet stores the attachment', () => {
    const state = initState();
    const next = reducer(state, openAttachmentSet(attachment));
    expect(next.get('openAttachment')).toStrictEqual(attachment);
  });

  it('OpenAttachmentClear resets to null', () => {
    let state = initState();
    state = reducer(state, openAttachmentSet(attachment));
    state = reducer(state, openAttachmentClear());
    expect(state.get('openAttachment')).toBe(null);
  });
});

describe('open tool', () => {
  it('OpenToolSet stores chatEntryIndex and id', () => {
    const state = initState();
    const next = reducer(state, openToolSet(2, 'tool-5'));
    expect(next.getIn(['openTool', 'chatEntryIndex'])).toBe(2);
    expect(next.getIn(['openTool', 'id'])).toBe('tool-5');
  });

  it('OpenToolClear resets both fields to null', () => {
    let state = initState();
    state = reducer(state, openToolSet(2, 'tool-5'));
    state = reducer(state, openToolClear());
    expect(state.getIn(['openTool', 'chatEntryIndex'])).toBe(null);
    expect(state.getIn(['openTool', 'id'])).toBe(null);
  });
});

describe('user feedback', () => {
  const pushAIEntry = (state: OLSState) =>
    reducer(
      state,
      chatHistoryPush({
        id: 'msg-1',
        isCancelled: false,
        isStreaming: false,
        isTruncated: false,
        text: 'Hi',
        who: 'ai',
      }),
    );

  it('UserFeedbackOpen sets isOpen on the entry', () => {
    let state = pushAIEntry(initState());
    state = reducer(state, userFeedbackOpen(0));
    expect(state.getIn(['chatHistory', 0, 'userFeedback', 'isOpen'])).toBe(true);
  });

  it('UserFeedbackClose sets isOpen to false', () => {
    let state = pushAIEntry(initState());
    state = reducer(state, userFeedbackOpen(0));
    state = reducer(state, userFeedbackClose(0));
    expect(state.getIn(['chatHistory', 0, 'userFeedback', 'isOpen'])).toBe(false);
  });

  it('UserFeedbackSetSentiment stores sentiment value', () => {
    let state = pushAIEntry(initState());
    state = reducer(state, userFeedbackSetSentiment(0, 1));
    expect(state.getIn(['chatHistory', 0, 'userFeedback', 'sentiment'])).toBe(1);
  });

  it('UserFeedbackSetText stores feedback text', () => {
    let state = pushAIEntry(initState());
    state = reducer(state, userFeedbackSetText(0, 'Great answer'));
    expect(state.getIn(['chatHistory', 0, 'userFeedback', 'text'])).toBe('Great answer');
  });

  it('UserFeedbackDisable disables feedback globally', () => {
    const state = initState();
    expect(reducer(state, userFeedbackDisable()).get('isUserFeedbackEnabled')).toBe(false);
  });
});
