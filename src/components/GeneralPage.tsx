import { List as ImmutableList, Map as ImmutableMap } from 'immutable';
import { defer, omit, uniqueId } from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import { useDispatch, useSelector } from 'react-redux';
import { consoleFetch } from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  Badge,
  Button,
  CodeBlock,
  CodeBlockAction,
  CodeBlockCode,
  ExpandableSection,
  Form,
  HelperText,
  HelperTextItem,
  Label,
  LabelGroup,
  Level,
  LevelItem,
  Spinner,
  Split,
  SplitItem,
  Stack,
  StackItem,
  TextArea,
  Title,
} from '@patternfly/react-core';
import {
  CompressIcon,
  ExpandIcon,
  ExternalLinkAltIcon,
  PaperPlaneIcon,
  StopIcon,
  WindowMinimizeIcon,
} from '@patternfly/react-icons';

import { toOLSAttachment } from '../attachments';
import { getApiUrl } from '../config';
import { getFetchErrorMessage } from '../error';
import { AuthStatus, getRequestInitWithAuthHeader, useAuth } from '../hooks/useAuth';
import { useBoolean } from '../hooks/useBoolean';
import {
  attachmentDelete,
  attachmentsClear,
  chatHistoryClear,
  chatHistoryPush,
  chatHistoryUpdateByID,
  chatHistoryUpdateTool,
  setConversationID,
  setQuery,
} from '../redux-actions';
import { State } from '../redux-reducers';
import { Attachment, ChatEntry, ReferencedDoc } from '../types';
import AttachmentModal from './AttachmentModal';
import AttachMenu from './AttachMenu';
import AttachmentLabel from './AttachmentLabel';
import AttachmentsSizeAlert from './AttachmentsSizeAlert';
import CopyAction from './CopyAction';
import ImportAction from './ImportAction';
import Feedback from './Feedback';
import NewChatModal from './NewChatModal';
import ReadinessAlert from './ReadinessAlert';
import ResponseTools from './ResponseTools';
import ToolModal from './ResponseToolModal';

import './general-page.css';

const QUERY_ENDPOINT = getApiUrl('/v1/streaming_query');

type QueryResponseStart = {
  event: 'start';
  data: {
    conversation_id: string;
  };
};

type QueryResponseToken = {
  event: 'token';
  data: {
    id: number;
    token: string;
  };
};

type QueryResponseError = {
  event: 'error';
  data: {
    response: string;
    cause: string;
  };
};

type QueryResponseEnd = {
  event: 'end';
  data: {
    referenced_documents: Array<ReferencedDoc>;
    truncated: boolean;
  };
};

type QueryResponseToolRequest = {
  event: 'tool_call';
  data: {
    args: { [key: string]: Array<string> };
    id: string;
    name: string;
  };
};

type QueryResponseToolExecution = {
  event: 'tool_result';
  data: {
    content: string;
    id: string;
    status: 'error' | 'success';
  };
};

type QueryResponse =
  | QueryResponseStart
  | QueryResponseToken
  | QueryResponseError
  | QueryResponseEnd
  | QueryResponseToolRequest
  | QueryResponseToolExecution;

type ExternalLinkProps = {
  children: React.ReactNode;
  href: string;
};

const ExternalLink: React.FC<ExternalLinkProps> = ({ children, href }) => (
  <a href={href} rel="noopener noreferrer" target="_blank">
    {children} <ExternalLinkAltIcon />
  </a>
);

const isURL = (s: string): boolean => {
  try {
    const url = new URL(s);
    return !!(url.protocol && url.host);
  } catch {
    return false;
  }
};

type ReferenceDocsProps = {
  references: Array<ReferencedDoc>;
};

const ReferenceDocs: React.FC<ReferenceDocsProps> = ({ references }) => {
  let validReferences: Array<ReferencedDoc> = [];
  if (Array.isArray(references)) {
    validReferences = references.filter(
      (r) =>
        r && typeof r.doc_title === 'string' && typeof r.doc_url === 'string' && isURL(r.doc_url),
    );
  }

  if (validReferences.length === 0) {
    return null;
  }

  return (
    <div className="ols-plugin__references">
      <LabelGroup categoryName="Related documentation">
        {validReferences.map((r, i) => (
          <Label key={i} textMaxWidth="16rem">
            <ExternalLink href={r.doc_url}>{r.doc_title}</ExternalLink>
          </Label>
        ))}
      </LabelGroup>
    </div>
  );
};

const Code = ({ children }: { children: React.ReactNode }) => {
  if (!String(children).includes('\n')) {
    return <code>{children}</code>;
  }

  return (
    <CodeBlock
      actions={
        <CodeBlockAction>
          <CopyAction value={children.toString()} />
          <ImportAction value={children.toString()} />
        </CodeBlockAction>
      }
      className="ols-plugin__code-block"
    >
      <CodeBlockCode className="ols-plugin__code-block-code">{children}</CodeBlockCode>
    </CodeBlock>
  );
};

type ChatHistoryEntryProps = {
  conversationID: string;
  entry: ChatEntry;
  entryIndex: number;
};

const ChatHistoryEntry: React.FC<ChatHistoryEntryProps> = ({
  conversationID,
  entry,
  entryIndex,
}) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const [isContextExpanded, toggleContextExpanded] = useBoolean(false);
  const isUserFeedbackEnabled = useSelector((s: State) =>
    s.plugins?.ols?.get('isUserFeedbackEnabled'),
  );

  if (entry.who === 'ai') {
    return (
      <div className="ols-plugin__chat-entry ols-plugin__chat-entry--ai">
        <div className="ols-plugin__chat-entry-name">OpenShift Lightspeed</div>
        {entry.error ? (
          <Alert
            isExpandable={!!entry.error.moreInfo}
            isInline
            title={
              entry.error.moreInfo
                ? entry.error.message
                : t('Error querying OpenShift Lightspeed service')
            }
            variant="danger"
          >
            {entry.error.moreInfo ? entry.error.moreInfo : entry.error.message}
          </Alert>
        ) : (
          <>
            <Markdown components={{ code: Code }}>{entry.text}</Markdown>
            {!entry.text && !entry.isCancelled && (
              <HelperText>
                <HelperTextItem>
                  {t('Waiting for LLM provider...')} <Spinner size="lg" />
                </HelperTextItem>
              </HelperText>
            )}
            {entry.isTruncated && (
              <Alert isInline title={t('History truncated')} variant="warning">
                {t('Conversation history has been truncated to fit within context window.')}
              </Alert>
            )}
            {entry.isCancelled && (
              <Alert
                className="ols-plugin__chat-entry-cancelled"
                isInline
                isPlain
                title={t('Cancelled')}
                variant="info"
              />
            )}
            {entry.tools && <ResponseTools entryIndex={entryIndex} />}
            <ReferenceDocs references={entry.references} />
            {isUserFeedbackEnabled && !entry.isStreaming && entry.text && (
              <Feedback conversationID={conversationID} entryIndex={entryIndex} />
            )}
          </>
        )}
      </div>
    );
  }
  if (entry.who === 'user') {
    return (
      <div className="ols-plugin__chat-entry ols-plugin__chat-entry--user">
        <div className="ols-plugin__chat-entry-name">You</div>
        <div className="ols-plugin__chat-entry-text">{entry.text}</div>
        {entry.attachments && Object.keys(entry.attachments).length > 0 && (
          <ExpandableSection
            className="ols-plugin__chat-history-context"
            displaySize="lg"
            isExpanded={isContextExpanded}
            onToggle={toggleContextExpanded}
            toggleContent={
              <>
                Context <Badge>{Object.keys(entry.attachments).length}</Badge>
              </>
            }
          >
            {Object.keys(entry.attachments).map((key: string) => {
              const attachment: Attachment = entry.attachments[key];
              return <AttachmentLabel attachment={attachment} key={key} />;
            })}
          </ExpandableSection>
        )}
      </div>
    );
  }
  return null;
};

type AuthAlertProps = {
  authStatus: AuthStatus;
};

const AuthAlert: React.FC<AuthAlertProps> = ({ authStatus }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  if (authStatus === AuthStatus.NotAuthenticated) {
    return (
      <Alert className="ols-plugin__alert" isInline title={t('Not authenticated')} variant="danger">
        {t(
          'OpenShift Lightspeed authentication failed. Contact your system administrator for more information.',
        )}
      </Alert>
    );
  }

  if (authStatus === AuthStatus.NotAuthorized) {
    return (
      <Alert className="ols-plugin__alert" isInline title={t('Not authorized')} variant="danger">
        {t(
          'You do not have sufficient permissions to access OpenShift Lightspeed. Contact your system administrator for more information.',
        )}
      </Alert>
    );
  }

  return null;
};

const PrivacyAlert: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  return (
    <Alert className="ols-plugin__alert" isInline title={t('Important')} variant="info">
      {t(
        "OpenShift Lightspeed uses AI technology to help answer your questions. Do not include personal information or other sensitive information in your input. Interactions may be used to improve Red Hat's products or services.",
      )}
    </Alert>
  );
};

const Welcome: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  return (
    <>
      <div className="ols-plugin__welcome-logo"></div>
      <Title className="pf-v6-u-text-align-center" headingLevel="h1">
        {t('Red Hat OpenShift Lightspeed')}
      </Title>
      <Title className="ols-plugin__welcome-subheading pf-v6-u-text-align-center" headingLevel="h5">
        {t(
          'Explore deeper insights, engage in meaningful discussions, and unlock new possibilities with Red Hat OpenShift Lightspeed. Answers are provided by generative AI technology, please use appropriate caution when following recommendations.',
        )}
      </Title>
    </>
  );
};

type GeneralPageProps = {
  onClose: () => void;
  onCollapse?: () => void;
  onExpand?: () => void;
};

const GeneralPage: React.FC<GeneralPageProps> = ({ onClose, onCollapse, onExpand }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const dispatch = useDispatch();

  const attachments = useSelector((s: State) => s.plugins?.ols?.get('attachments'));
  const chatHistory: ImmutableList<ImmutableMap<string, unknown>> = useSelector((s: State) =>
    s.plugins?.ols?.get('chatHistory'),
  );

  const conversationID: string = useSelector((s: State) => s.plugins?.ols?.get('conversationID'));
  const query: string = useSelector((s: State) => s.plugins?.ols?.get('query'));

  const [validated, setValidated] = React.useState<'default' | 'error'>('default');

  const [streamController, setStreamController] = React.useState(new AbortController());

  const [authStatus] = useAuth();

  const [isNewChatModalOpen, , openNewChatModal, closeNewChatModal] = useBoolean(false);

  const chatHistoryEndRef = React.useRef(null);
  const promptRef = React.useRef(null);

  const scrollIntoView = React.useCallback((behavior = 'smooth') => {
    defer(() => {
      chatHistoryEndRef?.current?.scrollIntoView({ behavior });
    });
  }, []);

  // Scroll to bottom of chat after first render (when opening UI that already has chat history)
  React.useEffect(() => {
    scrollIntoView('instant');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearChat = React.useCallback(() => {
    dispatch(setConversationID(null));
    dispatch(chatHistoryClear());
    dispatch(attachmentsClear());
  }, [dispatch]);

  const onChange = React.useCallback(
    (_e, value) => {
      if (value.trim().length > 0) {
        setValidated('default');
      }
      dispatch(setQuery(value));
    },
    [dispatch],
  );

  const isStreaming = !!chatHistory.last()?.get('isStreaming');

  const onSubmit = React.useCallback(
    (e) => {
      e.preventDefault();

      if (isStreaming) {
        return;
      }

      if (!query || query.trim().length === 0) {
        setValidated('error');
        return;
      }

      dispatch(
        chatHistoryPush({
          attachments: attachments.map((a) => omit(a, 'originalValue')),
          text: query,
          who: 'user',
        }),
      );
      const chatEntryID = uniqueId('ChatEntry_');
      dispatch(
        chatHistoryPush({
          id: chatEntryID,
          isCancelled: false,
          isStreaming: true,
          isTruncated: false,
          references: [],
          text: '',
          tools: ImmutableMap(),
          who: 'ai',
        }),
      );
      scrollIntoView();

      const requestJSON = {
        attachments: attachments.valueSeq().map(toOLSAttachment),
        // eslint-disable-next-line camelcase
        conversation_id: conversationID,
        // eslint-disable-next-line camelcase
        media_type: 'application/json',
        query,
      };

      const streamResponse = async () => {
        const controller = new AbortController();
        setStreamController(controller);
        const response = await consoleFetch(QUERY_ENDPOINT, {
          method: 'POST',
          headers: Object.assign({}, getRequestInitWithAuthHeader().headers, {
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(requestJSON),
          signal: controller.signal,
        });
        if (response.ok === false) {
          dispatch(
            chatHistoryUpdateByID(chatEntryID, {
              error: getFetchErrorMessage({ response }, t),
              isStreaming: false,
              isTruncated: false,
              who: 'ai',
            }),
          );
          return;
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let responseText = '';
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          const text = decoder.decode(value);
          text
            .split('\n')
            .filter((s) => s.startsWith('data: '))
            .forEach((s) => {
              const line = s.slice(5).trim();
              let json: QueryResponse;
              try {
                json = JSON.parse(line);
              } catch (error) {
                // eslint-disable-next-line no-console
                console.error(`Failed to parse JSON string "${line}"`, error);
              }
              if (json && json.event && json.data) {
                if (json.event === 'start') {
                  dispatch(setConversationID(json.data.conversation_id));
                } else if (json.event === 'token') {
                  responseText += json.data.token;
                  dispatch(chatHistoryUpdateByID(chatEntryID, { text: responseText }));
                } else if (json.event === 'end') {
                  dispatch(
                    chatHistoryUpdateByID(chatEntryID, {
                      isStreaming: false,
                      isTruncated: json.data.truncated === true,
                      references: json.data.referenced_documents,
                    }),
                  );
                } else if (json.event === 'tool_call') {
                  const { args, id, name } = json.data;
                  dispatch(chatHistoryUpdateTool(chatEntryID, id, { name, args }));
                } else if (json.event === 'tool_result') {
                  const { content, id, status } = json.data;
                  dispatch(chatHistoryUpdateTool(chatEntryID, id, { content, status }));
                } else if (json.event === 'error') {
                  dispatch(
                    chatHistoryUpdateByID(chatEntryID, {
                      error: getFetchErrorMessage({ json: { detail: json.data } }, t),
                      isStreaming: false,
                    }),
                  );
                } else {
                  // eslint-disable-next-line no-console
                  console.warn(`Unrecognized event in response stream:`, JSON.stringify(json));
                }
              }
            });
        }
      };
      streamResponse().catch((error) => {
        if (error.name !== 'AbortError') {
          dispatch(
            chatHistoryUpdateByID(chatEntryID, {
              error: getFetchErrorMessage(error, t),
              isStreaming: false,
              isTruncated: false,
              who: 'ai',
            }),
          );
        }
        scrollIntoView();
      });

      // Clear prompt input and return focus to it
      dispatch(setQuery(''));
      dispatch(attachmentsClear());
      promptRef.current?.focus();
    },
    [attachments, conversationID, dispatch, isStreaming, query, scrollIntoView, t],
  );

  const streamingResponseID: string = isStreaming
    ? (chatHistory.last()?.get('id') as string)
    : undefined;
  const onStreamCancel = React.useCallback(
    (e) => {
      e.preventDefault();
      if (streamingResponseID) {
        streamController.abort();
        dispatch(
          chatHistoryUpdateByID(streamingResponseID, {
            isCancelled: true,
            isStreaming: false,
          }),
        );
      }
    },
    [dispatch, streamController, streamingResponseID],
  );

  // We use keypress instead of keydown even though keypress is deprecated to work around a problem
  // with IME (input method editor) input. A cleaner solution would be to use the isComposing
  // property, but unfortunately the Safari implementation differs making it unusable for our case.
  const onKeyPress = React.useCallback(
    (e) => {
      // Enter key alone submits the prompt, Shift+Enter inserts a newline
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSubmit(e);
      }
    },
    [onSubmit],
  );

  const onConfirmNewChat = React.useCallback(() => {
    clearChat();
    closeNewChatModal();
  }, [clearChat, closeNewChatModal]);

  const isWelcomePage = chatHistory.size === 0;

  return (
    <Stack hasGutter>
      <StackItem
        className={`ols-plugin__header${isWelcomePage ? ' ' : ' ols-plugin__header--with-title'}`}
      >
        {onExpand && (
          <Button
            className="ols-plugin__popover-control"
            icon={<ExpandIcon />}
            onClick={onExpand}
            title={t('Expand')}
            variant="plain"
          />
        )}
        {onCollapse && (
          <Button
            className="ols-plugin__popover-control"
            icon={<CompressIcon />}
            onClick={onCollapse}
            title={t('Collapse')}
            variant="plain"
          />
        )}
        <Button
          className="ols-plugin__popover-control"
          icon={<WindowMinimizeIcon />}
          onClick={onClose}
          title={t('Minimize')}
          variant="plain"
        />
        {!isWelcomePage && (
          <Level>
            <LevelItem>
              <Title className="ols-plugin__heading" headingLevel="h1">
                {t('Red Hat OpenShift Lightspeed')}
              </Title>
            </LevelItem>
            <LevelItem>
              <Button
                className="ols-plugin__popover-clear-chat"
                onClick={openNewChatModal}
                variant="primary"
              >
                {t('Clear chat')}
              </Button>
            </LevelItem>
          </Level>
        )}
      </StackItem>

      <StackItem
        aria-label={t('OpenShift Lightspeed chat history')}
        className="ols-plugin__chat-history"
        isFilled
      >
        {isWelcomePage && <Welcome />}
        <AuthAlert authStatus={authStatus} />
        <PrivacyAlert />
        {chatHistory.toJS().map((entry: ChatEntry, i: number) => (
          <ChatHistoryEntry conversationID={conversationID} entry={entry} entryIndex={i} key={i} />
        ))}
        <AttachmentsSizeAlert />
        <ReadinessAlert />
        <div ref={chatHistoryEndRef} />
      </StackItem>

      {authStatus !== AuthStatus.NotAuthenticated && authStatus !== AuthStatus.NotAuthorized && (
        <StackItem className="ols-plugin__chat-prompt">
          <Form onSubmit={isStreaming ? onStreamCancel : onSubmit}>
            <Split hasGutter>
              <SplitItem>
                <AttachMenu />
              </SplitItem>
              <SplitItem isFilled>
                <TextArea
                  aria-label={t('OpenShift Lightspeed prompt')}
                  autoFocus
                  className="ols-plugin__chat-prompt-input"
                  onChange={onChange}
                  onFocus={(e) => {
                    // Move cursor to the end of the text when popover is closed then reopened
                    const len = e.currentTarget?.value?.length;
                    if (len) {
                      e.currentTarget.setSelectionRange(len, len);
                    }
                  }}
                  onKeyPress={onKeyPress}
                  placeholder={t('Send a message...')}
                  ref={promptRef}
                  resizeOrientation="vertical"
                  rows={Math.min(query.split('\n').length, 12)}
                  validated={validated}
                  value={query}
                />
              </SplitItem>
              <SplitItem className="ols-plugin__chat-prompt-submit">
                <Button className="ols-plugin__chat-prompt-button" type="submit" variant="primary">
                  {isStreaming ? <StopIcon /> : <PaperPlaneIcon />}
                </Button>
              </SplitItem>
            </Split>
          </Form>
          <div className="ols-plugin__chat-prompt-attachments">
            {attachments.keySeq().map((id: string) => {
              const attachment: Attachment = attachments.get(id);
              return (
                <AttachmentLabel
                  attachment={attachment}
                  isEditable
                  key={id}
                  onClose={() => dispatch(attachmentDelete(id))}
                />
              );
            })}
          </div>

          <HelperText>
            <HelperTextItem className="ols-plugin__footer">
              {t('Always review AI generated content prior to use.')}
            </HelperTextItem>
            <HelperTextItem className="ols-plugin__footer">
              {t('For questions or feedback about OpenShift Lightspeed,')}{' '}
              <ExternalLink href="mailto:openshift-lightspeed-contact-requests@redhat.com?subject=Contact the OpenShift Lightspeed team">
                email the Red Hat team
              </ExternalLink>
            </HelperTextItem>
          </HelperText>

          <AttachmentModal />
          <ToolModal />
          <NewChatModal
            isOpen={isNewChatModalOpen}
            onClose={closeNewChatModal}
            onConfirm={onConfirmNewChat}
          />
        </StackItem>
      )}
    </Stack>
  );
};

export default GeneralPage;
