import { List } from 'immutable';
import { dump } from 'js-yaml';
import { defer } from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import {
  consoleFetchJSON,
  GreenCheckCircleIcon,
  K8sResourceKind,
  RedExclamationCircleIcon,
  ResourceLink,
  ResourceStatus,
  useK8sWatchResource,
  WatchK8sResource,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  AlertActionLink,
  Button,
  Chip,
  ChipGroup,
  Form,
  HelperText,
  HelperTextItem,
  Label,
  Level,
  LevelItem,
  Page,
  PageSection,
  Spinner,
  Split,
  SplitItem,
  TextArea,
  Title,
  Tooltip,
} from '@patternfly/react-core';
import {
  CompressIcon,
  ExpandIcon,
  ExternalLinkAltIcon,
  FileImportIcon,
  OutlinedThumbsDownIcon,
  OutlinedThumbsUpIcon,
  PaperPlaneIcon,
  SyncAltIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  TimesIcon,
} from '@patternfly/react-icons';

import { useBoolean } from '../hooks/useBoolean';
import { jobStatus, podStatus } from '../k8s';
import {
  chatHistoryClear,
  chatHistoryPush,
  dismissPrivacyAlert,
  setContext,
  setQuery,
  userFeedbackClose,
  userFeedbackOpen,
  userFeedbackSetSentiment,
  userFeedbackSetText,
} from '../redux-actions';
import { State } from '../redux-reducers';
import { ChatEntry } from '../types';

import './general-page.css';
import { getRequestInitwithAuthHeader } from '../hooks/useAuthorization';

const QUERY_ENDPOINT = '/api/proxy/plugin/lightspeed-console-plugin/ols/v1/query';
const USER_FEEDBACK_ENDPOINT = '/api/proxy/plugin/lightspeed-console-plugin/ols/v1/feedback';

const REQUEST_TIMEOUT = 10 * 60 * 1000; // 10 minutes

type QueryResponse = {
  conversation_id: string;
  query: string;
  referenced_documents: Array<string>;
  response: string;
  truncated: boolean;
};

const THUMBS_DOWN = -1;
const THUMBS_UP = 1;

type FeedbackProps = {
  conversationID: string;
  entryIndex: number;
};

const Feedback: React.FC<FeedbackProps> = ({ conversationID, entryIndex }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const dispatch = useDispatch();

  const isOpen: string = useSelector((s: State) =>
    s.plugins?.ols?.getIn(['chatHistory', entryIndex, 'userFeedback', 'isOpen']),
  );
  const query: string = useSelector((s: State) =>
    s.plugins?.ols?.getIn(['chatHistory', entryIndex - 1, 'text']),
  );
  const response: string = useSelector((s: State) =>
    s.plugins?.ols?.getIn(['chatHistory', entryIndex, 'text']),
  );
  const sentiment: number = useSelector((s: State) =>
    s.plugins?.ols?.getIn(['chatHistory', entryIndex, 'userFeedback', 'sentiment']),
  );
  const text: string = useSelector((s: State) =>
    s.plugins?.ols?.getIn(['chatHistory', entryIndex, 'userFeedback', 'text']),
  );

  const [error, setError] = React.useState<string>();
  const [submitted, setSubmitted] = React.useState(false);

  const onClose = React.useCallback(() => {
    dispatch(userFeedbackClose(entryIndex));
  }, [dispatch, entryIndex]);

  const onThumbsDown = React.useCallback(() => {
    dispatch(userFeedbackOpen(entryIndex));
    dispatch(
      userFeedbackSetSentiment(entryIndex, sentiment === THUMBS_DOWN ? undefined : THUMBS_DOWN),
    );
  }, [dispatch, entryIndex, sentiment]);

  const onThumbsUp = React.useCallback(() => {
    dispatch(userFeedbackOpen(entryIndex));
    dispatch(userFeedbackSetSentiment(entryIndex, sentiment === THUMBS_UP ? undefined : THUMBS_UP));
  }, [dispatch, entryIndex, sentiment]);

  const onTextChange = React.useCallback(
    (_e, text) => {
      dispatch(userFeedbackSetText(entryIndex, text));
    },
    [dispatch, entryIndex],
  );

  const onSubmit = React.useCallback(() => {
    const requestJSON = {
      conversation_id: conversationID,
      llm_response: response,
      sentiment: sentiment,
      user_feedback: text,
      user_question: query,
    };

    consoleFetchJSON
      .post(USER_FEEDBACK_ENDPOINT, requestJSON, getRequestInitwithAuthHeader(), REQUEST_TIMEOUT)
      .then(() => {
        dispatch(userFeedbackClose(entryIndex));
        setSubmitted(true);
      })
      .catch((error) => {
        setError(error.response?.detail || error.message || 'Feedback POST failed');
        setSubmitted(false);
      });
  }, [conversationID, dispatch, entryIndex, query, response, sentiment, text]);

  return (
    <>
      <div className="ols-plugin__feedback">
        <Tooltip content={t('Good response')}>
          <div
            className={`ols-plugin__feedback-icon${
              sentiment === THUMBS_UP ? ' ols-plugin__feedback-icon--selected' : ''
            }`}
            onClick={onThumbsUp}
          >
            {sentiment === THUMBS_UP ? <ThumbsUpIcon /> : <OutlinedThumbsUpIcon />}
          </div>
        </Tooltip>
        <Tooltip content={t('Bad response')}>
          <div
            className={`ols-plugin__feedback-icon${
              sentiment === THUMBS_DOWN ? ' ols-plugin__feedback-icon--selected' : ''
            }`}
            onClick={onThumbsDown}
          >
            {sentiment === THUMBS_DOWN ? <ThumbsDownIcon /> : <OutlinedThumbsDownIcon />}
          </div>
        </Tooltip>
        {isOpen && sentiment !== undefined && (
          <div className="ols-plugin__feedback-comment">
            <Title headingLevel="h3">
              <TimesIcon className="ols-plugin__popover-close" onClick={onClose} />
              {t('Why did you choose this rating?')} <Chip isReadOnly>{t('Optional')}</Chip>
            </Title>
            <TextArea
              aria-label={t('Provide additional feedback')}
              className="ols-plugin__feedback-input"
              onChange={onTextChange}
              placeholder={t('Provide additional feedback')}
              resizeOrientation="vertical"
              rows={1}
              value={text}
            />
            <HelperText>
              <HelperTextItem className="ols-plugin__feedback-footer" variant="indeterminate">
                {t(
                  'Please refrain from sharing any sensitive information. All feedback may be reviewed and used to enhance the service.',
                )}
              </HelperTextItem>
            </HelperText>
            {error && (
              <Alert
                className="ols-plugin__alert"
                isInline
                title={t('Error submitting feedback')}
                variant="danger"
              >
                {error}
              </Alert>
            )}
            <Button onClick={onSubmit} variant="primary">
              {t('Submit')}
            </Button>
          </div>
        )}
      </div>
      {submitted && (
        <Label className="ols-plugin__feedback-submitted" color="blue">
          {t('Thank you for your feedback!')}
        </Label>
      )}
    </>
  );
};

type ExternalLinkProps = {
  children: React.ReactNode;
  href: string;
};

const ExternalLink: React.FC<ExternalLinkProps> = ({ children, href }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {children} <ExternalLinkAltIcon />
  </a>
);

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

  if (entry.who === 'ai') {
    return (
      <div className="ols-plugin__chat-entry ols-plugin__chat-entry--ai">
        <div className="ols-plugin__chat-entry-name">OpenShift Lightspeed</div>
        {entry.error ? (
          <Alert isInline title={t('Error submitting query')} variant="danger">
            {entry.error}
          </Alert>
        ) : (
          <>
            <div className="ols-plugin__chat-entry-text">{entry.text}</div>
            {entry.isTruncated && (
              <Alert isInline title={t('History truncated')} variant="warning">
                {t('Conversation history has been truncated to fit within context window.')}
              </Alert>
            )}
            {entry.references && (
              <ChipGroup categoryName="Referenced docs" className="ols-plugin__references">
                {entry.references.map((r) => (
                  <Chip isReadOnly key={r}>
                    <ExternalLink href={r}>{r}</ExternalLink>
                  </Chip>
                ))}
              </ChipGroup>
            )}
            <Feedback conversationID={conversationID} entryIndex={entryIndex} />
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
      </div>
    );
  }
  return null;
};

const ChatHistoryEntryWaiting = () => (
  <div className="ols-plugin__chat-entry ols-plugin__chat-entry--ai">
    <div className="ols-plugin__chat-entry-name">OpenShift Lightspeed</div>
    <Spinner size="lg" />
  </div>
);

const Status: React.FC<{ k8sResource: K8sResourceKind }> = ({ k8sResource }) => {
  if (!k8sResource?.kind || !k8sResource?.status) {
    return null;
  }
  if (k8sResource.kind === 'Pod') {
    const status = podStatus(k8sResource);
    return (
      <>
        {status === 'Completed' && <GreenCheckCircleIcon />}
        {status === 'CrashLoopBackOff' && <RedExclamationCircleIcon />}
        {status === 'Error' && <RedExclamationCircleIcon />}
        {status === 'Failed' && <RedExclamationCircleIcon />}
        {status === 'Running' && <SyncAltIcon />}
        &nbsp;{status}
      </>
    );
  }
  if (k8sResource.kind === 'Job') {
    const status = jobStatus(k8sResource);
    return (
      <>
        {status === 'Complete' && <GreenCheckCircleIcon />}
        {status === 'Failed' && <RedExclamationCircleIcon />}
        &nbsp;{status}
      </>
    );
  }
  return null;
};

const PrivacyAlert: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const dispatch = useDispatch();

  const isPrivacyAlertDismissed: boolean = useSelector((s: State) =>
    s.plugins?.ols?.get('isPrivacyAlertDismissed'),
  );

  const [isPrivacyAlertShown, , , hidePrivacyAlert] = useBoolean(!isPrivacyAlertDismissed);

  const hidePrivacyAlertPersistent = React.useCallback(() => {
    hidePrivacyAlert();
    dispatch(dismissPrivacyAlert());
  }, [dispatch, hidePrivacyAlert]);

  if (!isPrivacyAlertShown) {
    return null;
  }

  return (
    <Alert
      actionLinks={
        <>
          <AlertActionLink onClick={hidePrivacyAlert}>Got it</AlertActionLink>
          <AlertActionLink onClick={hidePrivacyAlertPersistent}>
            Don&apos;t show again
          </AlertActionLink>
        </>
      }
      className="ols-plugin__alert"
      isInline
      title={t('Data privacy')}
      variant="info"
    >
      <p>
        <strong>{t('Ask away.')}</strong>{' '}
        {t('OpenShift Lightspeed can answer questions related to OpenShift.')}
      </p>
      <p>
        <strong>{t("Don't share sensitive information.")}</strong>{' '}
        {t('Chat history may be reviewed or used to improve our services.')}
      </p>
    </Alert>
  );
};

const Welcome: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  return (
    <>
      <div className="ols-plugin__welcome-logo"></div>
      <Title className="pf-v5-u-text-align-center" headingLevel="h1">
        {t('Red Hat OpenShift Lightspeed')}
      </Title>
      <Title className="ols-plugin__welcome-subheading pf-v5-u-text-align-center" headingLevel="h4">
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

  const chatHistory: List<ChatEntry> = useSelector((s: State) =>
    s.plugins?.ols?.get('chatHistory'),
  );
  const context: K8sResourceKind = useSelector((s: State) => s.plugins?.ols?.get('context'));

  // Do we have a context that looks like a k8s resource with sufficient information
  const isK8sResourceContext =
    context &&
    typeof context.kind === 'string' &&
    typeof context.metadata?.name === 'string' &&
    typeof context.metadata?.namespace === 'string';

  const query: string = useSelector((s: State) => s.plugins?.ols?.get('query'));

  let watchResource: WatchK8sResource = null;
  if (isK8sResourceContext) {
    watchResource = {
      isList: false,
      kind: context.kind,
      name: context.metadata.name,
      namespace: context.metadata.namespace,
    };
  }
  const [resourceData, resourceLoaded, resourceLoadError] =
    useK8sWatchResource<K8sResourceKind>(watchResource);

  const [conversationID, setConversationID] = React.useState<string>();
  const [isWaiting, , setWaiting, unsetWaiting] = useBoolean(false);

  const chatHistoryEndRef = React.useRef(null);
  const promptRef = React.useRef(null);

  const scrollChatHistoryToBottom = React.useCallback(() => {
    chatHistoryEndRef?.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const onInsertYAML = React.useCallback(
    (e) => {
      e.preventDefault();

      if (isK8sResourceContext && promptRef?.current) {
        const { selectionStart, selectionEnd } = promptRef.current;

        let yaml = '';
        try {
          yaml = dump(context, { lineWidth: -1 }).trim();
        } catch (e) {
          yaml = t('Error getting YAML: {{e}}', { e });
        }

        const textBeforeCursor = query.substring(0, selectionStart);
        const textAfterCursor = query.substring(selectionEnd, query.length);
        dispatch(setQuery(textBeforeCursor + yaml + textAfterCursor));

        // Restore focus back to prompt input with the same cursor position
        // Defer so that this is called after the prompt text is updated
        defer(() => {
          const el = document.querySelector<HTMLElement>('.ols-plugin__chat-prompt-input');
          if (el && el.style) {
            el.style.height = '20rem';
          }
          promptRef.current.setSelectionRange(selectionStart, selectionStart);
          promptRef.current.focus();
        });
      }
    },
    [context, dispatch, isK8sResourceContext, query, t],
  );

  const clearChat = React.useCallback(() => {
    dispatch(setContext(null));
    dispatch(chatHistoryClear());
    setConversationID(undefined);
  }, [dispatch]);

  const onChange = React.useCallback(
    (_e, value) => {
      dispatch(setQuery(value));
    },
    [dispatch],
  );

  const onSubmit = React.useCallback(
    (e) => {
      e.preventDefault();

      if (!query) {
        return;
      }

      dispatch(chatHistoryPush({ text: query, who: 'user' }));
      scrollChatHistoryToBottom();
      setWaiting();

      // Clear prompt input and return focus to it
      dispatch(setQuery(''));
      promptRef.current.focus();

      const requestJSON = { conversation_id: conversationID, query };

      consoleFetchJSON
        .post(QUERY_ENDPOINT, requestJSON, getRequestInitwithAuthHeader(), REQUEST_TIMEOUT)
        .then((response: QueryResponse) => {
          setConversationID(response.conversation_id);
          dispatch(
            chatHistoryPush({
              isTruncated: response.truncated === true,
              references: response.referenced_documents,
              text: response.response,
              who: 'ai',
            }),
          );
          scrollChatHistoryToBottom();
          unsetWaiting();
        })
        .catch((error) => {
          const errorMessage = error.response?.detail || error.message || 'Query POST failed';
          dispatch(chatHistoryPush({ error: errorMessage, isTruncated: false, who: 'ai' }));
          scrollChatHistoryToBottom();
          unsetWaiting();
        });
    },
    [conversationID, dispatch, query, scrollChatHistoryToBottom, setWaiting, unsetWaiting],
  );

  const onKeyDown = React.useCallback(
    (e) => {
      // Both Enter+Ctrl and Enter+Meta submit the prompt
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onSubmit(e);
      }
    },
    [onSubmit],
  );

  const isWelcomePage = chatHistory.size === 0;

  return (
    <>
      <Page>
        <PageSection className={isWelcomePage ? undefined : 'ols-plugin__header'} variant="light">
          <TimesIcon className="ols-plugin__popover-close" onClick={onClose} />
          {onExpand && <ExpandIcon className="ols-plugin__popover-close" onClick={onExpand} />}
          {onCollapse && (
            <CompressIcon className="ols-plugin__popover-close" onClick={onCollapse} />
          )}
          {!isWelcomePage && (
            <Level>
              <LevelItem>
                <Title headingLevel="h1">{t('Red Hat OpenShift Lightspeed')}</Title>
              </LevelItem>
              <LevelItem>
                <Button onClick={clearChat} variant="primary">
                  {t('New chat')}
                </Button>
              </LevelItem>
            </Level>
          )}
        </PageSection>

        <PageSection
          aria-label={t('OpenShift Lightspeed chat history')}
          className="ols-plugin__chat-history"
          hasOverflowScroll
          isFilled
          variant="light"
        >
          {isWelcomePage && <Welcome />}
          <PrivacyAlert />
          {chatHistory.toJS().map((entry, i) => (
            <ChatHistoryEntry
              key={i}
              conversationID={conversationID}
              entry={entry}
              entryIndex={i}
            />
          ))}
          {isWaiting && <ChatHistoryEntryWaiting />}
          <div ref={chatHistoryEndRef} />
        </PageSection>

        <PageSection className="ols-plugin__chat-prompt" isFilled={false} variant="light">
          {isK8sResourceContext && (
            <>
              <Alert
                className="ols-plugin__alert"
                isInline
                title={
                  <>
                    Asking about&nbsp;&nbsp;
                    <ResourceLink
                      inline
                      kind={context.kind}
                      name={context.metadata.name}
                      title={context.metadata.uid}
                    />
                    {resourceLoaded && !resourceLoadError && (
                      <ResourceStatus>
                        <Status k8sResource={resourceData} />
                      </ResourceStatus>
                    )}
                  </>
                }
                variant="info"
              >
                <Button
                  className="ols-plugin__chat-context-action"
                  icon={<FileImportIcon />}
                  onClick={onInsertYAML}
                  variant="secondary"
                >
                  Insert {context.kind} YAML at cursor
                </Button>
              </Alert>
            </>
          )}

          <Form onSubmit={onSubmit}>
            <Split hasGutter>
              <SplitItem isFilled>
                <TextArea
                  aria-label={t('OpenShift Lightspeed prompt')}
                  autoFocus
                  autoResize
                  className="ols-plugin__chat-prompt-input"
                  onChange={onChange}
                  onKeyDown={onKeyDown}
                  onFocus={(e) => {
                    // Move cursor to the end of the text when popover is closed then reopened
                    const len = e.currentTarget?.value?.length;
                    if (len) {
                      e.currentTarget.setSelectionRange(len, len);
                    }
                  }}
                  placeholder={t('Send a message...')}
                  ref={promptRef}
                  resizeOrientation="vertical"
                  rows={1}
                  value={query}
                />
              </SplitItem>
              <SplitItem className="ols-plugin__chat-prompt-submit">
                <Button type="submit" variant="primary">
                  <PaperPlaneIcon />
                </Button>
              </SplitItem>
            </Split>
          </Form>

          <HelperText>
            <HelperTextItem className="ols-plugin__footer" variant="indeterminate">
              {t('The LLMs may provide inaccurate information. Double-check responses.')}
            </HelperTextItem>
          </HelperText>
        </PageSection>
      </Page>
    </>
  );
};

export default GeneralPage;
