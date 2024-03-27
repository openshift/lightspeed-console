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
  TextContent,
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
import { dismissPrivacyAlert, setChatHistory, setContext, setQuery } from '../redux-actions';
import { State } from '../redux-reducers';

import './general-page.css';
import { getRequestInitwithAuthHeader } from '../hooks/useAuthorization';

const QUERY_ENDPOINT = '/api/proxy/plugin/lightspeed-console-plugin/ols/v1/query';
const QUERY_TIMEOUT = 10 * 60 * 1000; // 10 minutes

type QueryResponse = {
  conversation_id: string;
  query: string;
  referenced_documents: Array<string>;
  response: string;
};

type ChatEntryUser = {
  text?: string;
  who: 'user';
};

type ChatEntryAI = {
  error?: string;
  references?: Array<string>;
  text?: string;
  who: 'ai';
};

type ChatEntry = ChatEntryAI | ChatEntryUser;

const Feedback: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const [isClosed, , setClosed, setOpen] = useBoolean(false);
  const [isThumbsDown, toggleThumbsDown, , unsetThumbsDown] = useBoolean(false);
  const [isThumbsUp, toggleThumbsUp, , unsetThumbsUp] = useBoolean(false);

  const onThumbsUp = React.useCallback(() => {
    toggleThumbsUp();
    unsetThumbsDown();
    setOpen();
  }, [setOpen, toggleThumbsUp, unsetThumbsDown]);

  const onThumbsDown = React.useCallback(() => {
    toggleThumbsDown();
    unsetThumbsUp();
    setOpen();
  }, [setOpen, toggleThumbsDown, unsetThumbsUp]);

  return (
    <div className="ols-plugin__feedback">
      <Tooltip content={t('Good response')}>
        <div
          className={`ols-plugin__feedback-icon${
            isThumbsUp ? ' ols-plugin__feedback-icon--selected' : ''
          }`}
          onClick={onThumbsUp}
        >
          {isThumbsUp ? <ThumbsUpIcon /> : <OutlinedThumbsUpIcon />}
        </div>
      </Tooltip>
      <Tooltip content={t('Bad response')}>
        <div
          className={`ols-plugin__feedback-icon${
            isThumbsDown ? ' ols-plugin__feedback-icon--selected' : ''
          }`}
          onClick={onThumbsDown}
        >
          {isThumbsDown ? <ThumbsDownIcon /> : <OutlinedThumbsDownIcon />}
        </div>
      </Tooltip>
      {!isClosed && (isThumbsDown || isThumbsUp) && (
        <div className="ols-plugin__feedback-comment">
          <Title headingLevel="h3">
            {t('Why did you choose this rating?')}
            <Chip className="ols-plugin__feedback-optional" isReadOnly>
              {t('Optional')}
            </Chip>
            <TimesIcon className="ols-plugin__popover-close" onClick={setClosed} />
          </Title>
          {isThumbsDown && (
            <>
              <Label className="ols-plugin__feedback-label">{t('Harmful / Unsafe')}</Label>
              <Label className="ols-plugin__feedback-label">{t('Not factually correct')}</Label>
            </>
          )}
          {isThumbsUp && (
            <>
              <Label className="ols-plugin__feedback-label">{t('Correct')}</Label>
              <Label className="ols-plugin__feedback-label">{t('Easy to understand')}</Label>
              <Label className="ols-plugin__feedback-label">{t('Complete')}</Label>
            </>
          )}
          <TextArea
            aria-label={t('Provide additional feedback')}
            className="ols-plugin__feedback-input"
            placeholder={t('Provide additional feedback')}
            resizeOrientation="vertical"
            rows={1}
          />
          <HelperText>
            <HelperTextItem className="ols-plugin__feedback-footer" variant="indeterminate">
              {t('TODO: Feedback privacy warning')}
            </HelperTextItem>
          </HelperText>
          <Button variant="primary">{t('Submit')}</Button>
        </div>
      )}
    </div>
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
  entry: ChatEntry;
  noFeedback?: boolean;
};

const ChatHistoryEntry: React.FC<ChatHistoryEntryProps> = ({ entry, noFeedback = false }) => {
  if (entry.who === 'ai') {
    return (
      <div className="ols-plugin__chat-entry ols-plugin__chat-entry--ai">
        <div className="ols-plugin__chat-entry-name">OpenShift Lightspeed</div>
        {entry.error ? (
          <div className="ols-plugin__chat-entry--error">{entry.error}</div>
        ) : (
          <>
            <div className="ols-plugin__chat-entry-text">{entry.text}</div>
            {entry.references && (
              <ChipGroup categoryName="Referenced docs">
                {entry.references.map((r) => (
                  <Chip isReadOnly key={r}>
                    <ExternalLink href={r}>{r}</ExternalLink>
                  </Chip>
                ))}
              </ChipGroup>
            )}
            {!noFeedback && <Feedback />}
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
      title="Data privacy"
      variant="info"
    >
      <p>{t('TODO: Data privacy info wording line 1')}</p>
      <p>{t('TODO: Data privacy info wording line 2')}</p>
    </Alert>
  );
};

const Welcome: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  return (
    <PageSection variant="light">
      <div className="ols-plugin__welcome-logo"></div>
      <Title className="pf-v5-u-text-align-center" headingLevel="h1">
        {t('Red Hat OpenShift Lightspeed')}
      </Title>
      <Title className="ols-plugin__welcome-subheading pf-v5-u-text-align-center" headingLevel="h4">
        {t(
          'Explore deeper insights, engage in meaningful discussions, and unlock new possibilities with Red Hat OpenShift Lightspeed',
        )}
      </Title>
      <PrivacyAlert />
    </PageSection>
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

  const chatHistory: ChatEntry[] = useSelector((s: State) => s.plugins?.ols?.get('chatHistory'));
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

  const onInsertYAML = (e) => {
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
  };

  const clearChat = React.useCallback(() => {
    dispatch(setContext(null));
    dispatch(setChatHistory([]));
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

      const newChatHistory = [...chatHistory, { text: query, who: 'user' }];
      dispatch(setChatHistory(newChatHistory));
      scrollChatHistoryToBottom();
      setWaiting();

      // Clear prompt input and return focus to it
      dispatch(setQuery(''));
      promptRef.current.focus();

      const requestJSON = { conversation_id: conversationID, query };

      consoleFetchJSON
        .post(QUERY_ENDPOINT, requestJSON, getRequestInitwithAuthHeader(), QUERY_TIMEOUT)
        .then((response: QueryResponse) => {
          setConversationID(response.conversation_id);
          dispatch(
            setChatHistory([
              ...newChatHistory,
              {
                references: response.referenced_documents,
                text: response.response,
                who: 'ai',
              },
            ]),
          );
          scrollChatHistoryToBottom();
          unsetWaiting();
        })
        .catch((error) => {
          dispatch(
            setChatHistory([
              ...newChatHistory,
              { error: error.toString(), text: undefined, who: 'ai' },
            ]),
          );
          scrollChatHistoryToBottom();
          unsetWaiting();
        });
    },
    [
      chatHistory,
      conversationID,
      dispatch,
      query,
      scrollChatHistoryToBottom,
      setWaiting,
      unsetWaiting,
    ],
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

  const isWelcomePage = chatHistory.length === 0;

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
          {isWelcomePage ? <Welcome /> : <PrivacyAlert />}
          <TextContent>
            {chatHistory.map((entry, i) => (
              <ChatHistoryEntry key={i} entry={entry} />
            ))}
            {isWaiting && <ChatHistoryEntryWaiting />}
            <div ref={chatHistoryEndRef} />
          </TextContent>
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
              {t('TODO: Footer info wording')}
            </HelperTextItem>
          </HelperText>
        </PageSection>
      </Page>
    </>
  );
};

export default GeneralPage;
