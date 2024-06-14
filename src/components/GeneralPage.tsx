import { List as ImmutableList } from 'immutable';
import { dump } from 'js-yaml';
import { cloneDeep, defer, each, isMatch, map as lodashMap } from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import { useDispatch, useSelector } from 'react-redux';
import {
  consoleFetchJSON,
  K8sResourceKind,
  useK8sWatchResource,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  Badge,
  Button,
  Chip,
  ChipGroup,
  CodeBlock,
  CodeBlockCode,
  ExpandableSection,
  Form,
  HelperText,
  HelperTextItem,
  Icon,
  Label,
  Level,
  LevelItem,
  MenuToggle,
  Page,
  PageSection,
  Select,
  SelectList,
  SelectOption,
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
  FileCodeIcon,
  PaperPlaneIcon,
  PlusCircleIcon,
  TaskIcon,
  WindowMinimizeIcon,
} from '@patternfly/react-icons';

import { AttachmentTypes, buildQuery } from '../attachments';
import { AuthStatus, getRequestInitwithAuthHeader, useAuth } from '../hooks/useAuth';
import { useBoolean } from '../hooks/useBoolean';
import { useLocationContext } from '../hooks/useLocationContext';
import {
  attachmentAdd,
  attachmentDelete,
  attachmentsClear,
  chatHistoryClear,
  chatHistoryPush,
  openAttachmentSet,
  setContext,
  setConversationID,
  setQuery,
} from '../redux-actions';
import { State } from '../redux-reducers';
import { Attachment, ChatEntry, ReferencedDoc } from '../types';
import AttachEventsModal from './AttachEventsModal';
import AttachLogModal from './AttachLogModal';
import AttachmentModal from './AttachmentModal';
import CopyAction from './CopyAction';
import Feedback from './Feedback';
import ResourceIcon from './ResourceIcon';

import './general-page.css';

const QUERY_ENDPOINT = '/api/proxy/plugin/lightspeed-console-plugin/ols/v1/query';
const ALERTS_ENDPOINT = '/api/prometheus/api/v1/rules?type=alert';

const REQUEST_TIMEOUT = 10 * 60 * 1000; // 10 minutes

type QueryResponse = {
  conversation_id: string;
  query: string;
  referenced_documents: Array<ReferencedDoc>;
  response: string;
  truncated: boolean;
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

type DocLinkProps = {
  reference: ReferencedDoc;
};

const DocLink: React.FC<DocLinkProps> = ({ reference }) => {
  if (!reference || typeof reference.docs_url !== 'string' || typeof reference.title !== 'string') {
    return null;
  }

  return (
    <Chip isReadOnly textMaxWidth="16rem">
      <ExternalLink href={reference.docs_url}>{reference.title}</ExternalLink>
    </Chip>
  );
};

const Code = ({ children }: { children: React.ReactNode }) => {
  if (!String(children).includes('\n')) {
    return <code>{children}</code>;
  }

  const actions = <CopyAction value={children.toString()} />;

  return (
    <CodeBlock actions={actions}>
      <CodeBlockCode className="ols-plugin__code-block">{children}</CodeBlockCode>
    </CodeBlock>
  );
};

type AttachmentLabelProps = {
  attachment: Attachment;
  onClose?: () => void;
};

const AttachmentLabel: React.FC<AttachmentLabelProps> = ({ attachment, onClose }) => {
  const dispatch = useDispatch();

  const onClick = React.useCallback(() => {
    dispatch(openAttachmentSet(attachment));
  }, [attachment, dispatch]);

  if (!attachment) {
    return null;
  }

  const { attachmentType, kind, name } = attachment;

  return (
    <Label className="ols-plugin__context-label" onClick={onClick} onClose={onClose}>
      <ResourceIcon kind={kind} />
      <span className="ols-plugin__context-label-text">{name}</span>{' '}
      {kind !== 'Alert' && (
        <Label className="ols-plugin__context-label-type">{attachmentType}</Label>
      )}
    </Label>
  );
};

type ChatHistoryEntryProps = {
  conversationID: string;
  entry: ChatEntry;
  entryIndex: number;
  scrollIntoView: () => void;
};

const ChatHistoryEntry: React.FC<ChatHistoryEntryProps> = ({
  conversationID,
  entry,
  entryIndex,
  scrollIntoView,
}) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const [isContextExpanded, toggleContextExpanded] = useBoolean(false);

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
            <div className="ols-plugin__chat-entry-text">
              <Markdown components={{ code: Code }}>{entry.text}</Markdown>
            </div>
            {entry.isTruncated && (
              <Alert isInline title={t('History truncated')} variant="warning">
                {t('Conversation history has been truncated to fit within context window.')}
              </Alert>
            )}
            {entry.references && (
              <ChipGroup categoryName="Related documentation" className="ols-plugin__references">
                {entry.references.map((r, i) => (
                  <DocLink reference={r} key={i} />
                ))}
              </ChipGroup>
            )}
            <Feedback
              conversationID={conversationID}
              entryIndex={entryIndex}
              scrollIntoView={scrollIntoView}
            />
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
            isExpanded={isContextExpanded}
            onToggle={toggleContextExpanded}
            toggleContent={
              <>
                Context
                <Badge className="ols-plugin__chat-history-context-count">
                  {Object.keys(entry.attachments).length}
                </Badge>
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

const ChatHistoryEntryWaiting = () => (
  <div className="ols-plugin__chat-entry ols-plugin__chat-entry--ai">
    <div className="ols-plugin__chat-entry-name">OpenShift Lightspeed</div>
    <Spinner size="lg" />
  </div>
);

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
        'OpenShift Lightspeed can answer questions related to OpenShift. Do not include personal or business sensitive information in your input. Interactions with OpenShift Lightspeed may be reviewed and used to improve our products and services.',
      )}
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

type AttachMenuProps = {
  context: K8sResourceKind;
};

const AttachMenu: React.FC<AttachMenuProps> = ({ context }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const dispatch = useDispatch();

  const [error, setError] = React.useState<string>();
  const [isEventsModalOpen, , openEventsModal, closeEventsModal] = useBoolean(false);
  const [isLogModalOpen, , openLogModal, closeLogModal] = useBoolean(false);
  const [isLoading, , setLoading, setLoaded] = useBoolean(false);
  const [isOpen, toggleIsOpen, , close, setIsOpen] = useBoolean(false);

  const kind = context?.kind;
  const name = context?.metadata?.name;
  const namespace = context?.metadata?.namespace;

  const onSelect = React.useCallback(
    (_e: React.MouseEvent | undefined, attachmentType: string) => {
      if (!kind || !name) {
        setError(t('Could not get context'));
        return;
      }

      if (attachmentType === AttachmentTypes.Events) {
        openEventsModal();
        close();
      } else if (attachmentType === AttachmentTypes.Log) {
        openLogModal();
        close();
      } else if (kind === 'Alert') {
        setLoading();
        const labels = Object.fromEntries(new URLSearchParams(location.search));
        consoleFetchJSON(ALERTS_ENDPOINT, 'get', getRequestInitwithAuthHeader(), REQUEST_TIMEOUT)
          .then((response) => {
            let alert;
            each(response?.data?.groups, (group) => {
              each(group.rules, (rule) => {
                alert = rule.alerts?.find((a) => isMatch(labels, a.labels));
                if (alert) {
                  return false;
                }
              });
              if (alert) {
                return false;
              }
            });
            if (alert) {
              try {
                const yaml = dump(alert, { lineWidth: -1 }).trim();
                dispatch(attachmentAdd(AttachmentTypes.YAML, kind, name, namespace, yaml));
                close();
              } catch (e) {
                setError(t('Error getting YAML: {{e}}', { e }));
              }
            } else {
              setError(t('Failed to find definition YAML for alert'));
            }
            setLoaded();
          })
          .catch((error) => {
            setError(t('Error fetching alerting rules: {{error}}', { error }));
            setLoaded();
          });
      } else {
        let data;
        if (attachmentType === AttachmentTypes.YAML) {
          data = cloneDeep(context);
          // We ignore the managedFields section because it doesn't have much value
          delete data.metadata.managedFields;
        } else if (attachmentType === AttachmentTypes.YAMLStatus) {
          data = { status: context.status };
        }
        try {
          const yaml = dump(data, { lineWidth: -1 }).trim();
          dispatch(attachmentAdd(attachmentType, kind, name, namespace, yaml));
          close();
        } catch (e) {
          setError(t('Error getting YAML: {{e}}', { e }));
        }
      }
    },
    [
      close,
      context,
      dispatch,
      kind,
      name,
      namespace,
      openEventsModal,
      openLogModal,
      setLoaded,
      setLoading,
      t,
    ],
  );

  const showEvents = kind === 'Pod';
  const showLogs = kind === 'Pod';

  return (
    <>
      {showEvents && (
        <AttachEventsModal
          isOpen={isEventsModalOpen}
          kind={kind}
          name={name}
          namespace={namespace}
          onClose={closeEventsModal}
          uid={context?.metadata?.uid}
        />
      )}
      {showLogs && (
        <AttachLogModal
          containers={lodashMap(context?.spec?.containers, 'name')?.sort()}
          isOpen={isLogModalOpen}
          kind={kind}
          namespace={namespace}
          onClose={closeLogModal}
          pod={name}
        />
      )}

      <Select
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onSelect={onSelect}
        toggle={(toggleRef) => (
          <MenuToggle
            className="ols-plugin__attach-menu"
            isExpanded={isOpen}
            onClick={toggleIsOpen}
            ref={toggleRef}
            variant="plain"
          >
            <Icon size="md">
              {isOpen ? (
                <PlusCircleIcon className="ols-plugin__context-menu-icon--active" />
              ) : (
                <Tooltip content={t('Attach context')}>
                  <PlusCircleIcon />
                </Tooltip>
              )}
            </Icon>
          </MenuToggle>
        )}
      >
        <SelectList className="ols-plugin__context-menu">
          {!kind || !name ? (
            <Alert isInline isPlain variant="info" title="No context found">
              <p>The current page your are viewing does not contain any supported context.</p>
            </Alert>
          ) : (
            <>
              <Title className="ols-plugin__context-menu-heading" headingLevel="h5">
                {t('Currently viewing')}
              </Title>
              <Label
                className="ols-plugin__context-label"
                textMaxWidth="10rem"
                title={t('{{kind}} {{name}} in namespace {{namespace}}', { kind, name, namespace })}
              >
                <ResourceIcon kind={kind} /> {name}
              </Label>

              <Title className="ols-plugin__context-menu-heading" headingLevel="h5">
                {t('Attach')}
              </Title>

              {kind === 'Alert' ? (
                <SelectOption value={AttachmentTypes.YAML}>
                  <FileCodeIcon /> {t('Alert')} {isLoading && <Spinner size="md" />}
                </SelectOption>
              ) : (
                <>
                  <SelectOption value={AttachmentTypes.YAML}>
                    <FileCodeIcon /> YAML
                  </SelectOption>
                  <SelectOption value={AttachmentTypes.YAMLStatus}>
                    <FileCodeIcon /> YAML <Chip isReadOnly>status</Chip> {t('only')}
                  </SelectOption>
                  {showEvents && (
                    <SelectOption value={AttachmentTypes.Events}>
                      <TaskIcon /> {t('Events')}
                    </SelectOption>
                  )}
                  {showLogs && (
                    <SelectOption value={AttachmentTypes.Log}>
                      <TaskIcon /> {t('Logs')}
                    </SelectOption>
                  )}
                </>
              )}
            </>
          )}

          {error && (
            <Alert
              className="ols-plugin__alert"
              isInline
              title={t('Failed to attach context')}
              variant="danger"
            >
              {error}
            </Alert>
          )}
        </SelectList>
      </Select>
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
  const chatHistory: ImmutableList<ChatEntry> = useSelector((s: State) =>
    s.plugins?.ols?.get('chatHistory'),
  );

  let k8sWatchOptions;

  // Do we have a context in Redux that looks like a k8s resource with sufficient information
  const context: K8sResourceKind = useSelector((s: State) => s.plugins?.ols?.get('context'));
  if (
    context &&
    typeof context.kind === 'string' &&
    typeof context.metadata?.name === 'string' &&
    typeof context.metadata?.namespace === 'string'
  ) {
    k8sWatchOptions = {
      isList: false,
      kind: context.kind,
      name: context.metadata?.name,
      namespace: context.metadata?.namespace,
    };
  }

  const [kind, name, namespace] = useLocationContext();

  // If we didn't get a k8s resource context from Redux, can we get one from the current page?
  if (!k8sWatchOptions && kind && kind !== 'Alert' && name) {
    k8sWatchOptions = { isList: false, kind, name, namespace };
  }

  const k8sContext = useK8sWatchResource<K8sResourceKind>(k8sWatchOptions ?? null);

  const [attachContext] =
    kind === 'Alert' && name ? [{ kind, metadata: { name, namespace } }] : k8sContext;

  const conversationID: string = useSelector((s: State) => s.plugins?.ols?.get('conversationID'));
  const query: string = useSelector((s: State) => s.plugins?.ols?.get('query'));

  const [validated, setValidated] = React.useState<'default' | 'error'>('default');

  const [authStatus] = useAuth();

  const [isWaiting, , setWaiting, unsetWaiting] = useBoolean(false);

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
    dispatch(setContext(null));
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

  const onSubmit = React.useCallback(
    (e) => {
      e.preventDefault();

      if (!query || query.trim().length === 0) {
        setValidated('error');
        return;
      }

      dispatch(chatHistoryPush({ attachments, text: query, who: 'user' }));
      scrollIntoView();
      setWaiting();

      const requestJSON = {
        conversation_id: conversationID,
        query: buildQuery(query, attachments),
      };

      consoleFetchJSON
        .post(QUERY_ENDPOINT, requestJSON, getRequestInitwithAuthHeader(), REQUEST_TIMEOUT)
        .then((response: QueryResponse) => {
          dispatch(setConversationID(response.conversation_id));
          dispatch(
            chatHistoryPush({
              isTruncated: response.truncated === true,
              references: response.referenced_documents,
              text: response.response,
              who: 'ai',
            }),
          );
          scrollIntoView();
          unsetWaiting();
        })
        .catch((error) => {
          const errorDetail = error.json?.detail;
          const errorMessage =
            typeof errorDetail?.response === 'string' && typeof errorDetail?.cause === 'string'
              ? `${errorDetail.response}: ${errorDetail.cause}`
              : error.json?.message || 'Query POST failed';
          dispatch(chatHistoryPush({ error: errorMessage, isTruncated: false, who: 'ai' }));
          scrollIntoView();
          unsetWaiting();
        });

      // Clear prompt input and return focus to it
      dispatch(setQuery(''));
      dispatch(attachmentsClear());
      promptRef.current?.focus();
    },
    [attachments, conversationID, dispatch, query, scrollIntoView, setWaiting, unsetWaiting],
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

  const isWelcomePage = chatHistory.size === 0;

  return (
    <>
      <Page>
        <PageSection className={isWelcomePage ? undefined : 'ols-plugin__header'} variant="light">
          {onExpand && <ExpandIcon className="ols-plugin__popover-close" onClick={onExpand} />}
          {onCollapse && (
            <CompressIcon className="ols-plugin__popover-close" onClick={onCollapse} />
          )}
          <WindowMinimizeIcon className="ols-plugin__popover-close" onClick={onClose} />
          {!isWelcomePage && (
            <Level>
              <LevelItem>
                <Title className="ols-plugin__heading" headingLevel="h1">
                  {t('Red Hat OpenShift Lightspeed')}
                </Title>
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
          <AuthAlert authStatus={authStatus} />
          <PrivacyAlert />
          {chatHistory.toJS().map((entry, i) => (
            <ChatHistoryEntry
              conversationID={conversationID}
              entry={entry}
              entryIndex={i}
              key={i}
              scrollIntoView={scrollIntoView}
            />
          ))}
          {isWaiting && <ChatHistoryEntryWaiting />}
          <div ref={chatHistoryEndRef} />
        </PageSection>

        {authStatus !== AuthStatus.NotAuthenticated && authStatus !== AuthStatus.NotAuthorized && (
          <PageSection className="ols-plugin__chat-prompt" isFilled={false} variant="light">
            <Form onSubmit={onSubmit}>
              <Split hasGutter>
                <SplitItem>
                  <AttachMenu context={attachContext} />
                </SplitItem>
                <SplitItem isFilled>
                  <TextArea
                    aria-label={t('OpenShift Lightspeed prompt')}
                    autoFocus
                    className="ols-plugin__chat-prompt-input"
                    onChange={onChange}
                    onKeyPress={onKeyPress}
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
                    rows={Math.min(query.split('\n').length, 12)}
                    validated={validated}
                    value={query}
                  />
                  <>
                    {attachments.keySeq().map((id: string) => {
                      const attachment: Attachment = attachments.get(id);
                      return (
                        <AttachmentLabel
                          attachment={attachment}
                          key={id}
                          onClose={() => dispatch(attachmentDelete(id))}
                        />
                      );
                    })}
                  </>
                </SplitItem>
                <SplitItem className="ols-plugin__chat-prompt-submit">
                  <Button
                    className="ols-plugin__chat-prompt-button"
                    type="submit"
                    variant="primary"
                  >
                    <PaperPlaneIcon />
                  </Button>
                </SplitItem>
              </Split>
            </Form>

            <HelperText>
              <HelperTextItem className="ols-plugin__footer" variant="indeterminate">
                {t('Always check AI/LLM generated responses for accuracy prior to use.')}
              </HelperTextItem>
            </HelperText>

            <AttachmentModal />
          </PageSection>
        )}
      </Page>
    </>
  );
};

export default GeneralPage;
