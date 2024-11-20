import { List as ImmutableList } from 'immutable';
import { defer, omit } from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import { useDispatch, useSelector } from 'react-redux';
import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  Badge,
  Button,
  Chip,
  ChipGroup,
  CodeBlock,
  CodeBlockAction,
  CodeBlockCode,
  ExpandableSection,
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
  PaperPlaneIcon,
  PencilAltIcon,
  WindowMinimizeIcon,
} from '@patternfly/react-icons';

import { isAttachmentChanged, toOLSAttachment } from '../attachments';
import { getFetchErrorMessage } from '../error';
import { AuthStatus, getRequestInitWithAuthHeader, useAuth } from '../hooks/useAuth';
import { useBoolean } from '../hooks/useBoolean';
import {
  attachmentDelete,
  attachmentsClear,
  chatHistoryClear,
  chatHistoryPush,
  openAttachmentSet,
  setConversationID,
  setQuery,
} from '../redux-actions';
import { State } from '../redux-reducers';
import { Attachment, ChatEntry, ReferencedDoc } from '../types';
import AttachmentModal from './AttachmentModal';
import AttachMenu from './AttachMenu';
import CopyAction from './CopyAction';
import ImportAction from './ImportAction';
import Feedback from './Feedback';
import NewChatModal from './NewChatModal';
import ReadinessAlert from './ReadinessAlert';
import ResourceIcon from './ResourceIcon';

import './general-page.css';

const QUERY_ENDPOINT = '/api/proxy/plugin/lightspeed-console-plugin/ols/v1/query';

const QUERY_REQUEST_TIMEOUT = 10 * 60 * 1000; // 10 minutes

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
  <a href={href} rel="noopener noreferrer" target="_blank">
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

type AttachmentLabelProps = {
  attachment: Attachment;
  isEditable?: boolean;
  onClose?: () => void;
};

const AttachmentLabel: React.FC<AttachmentLabelProps> = ({ attachment, isEditable, onClose }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const dispatch = useDispatch();

  const onClick = React.useCallback(() => {
    dispatch(openAttachmentSet(Object.assign({}, attachment, { isEditable })));
  }, [attachment, isEditable, dispatch]);

  if (!attachment) {
    return null;
  }

  const { attachmentType, kind, name } = attachment;
  const isChanged = isAttachmentChanged(attachment);

  return (
    <Tooltip content={isChanged ? t('Preview attachment - modified') : t('Preview attachment')}>
      <Label className="ols-plugin__context-label" onClick={onClick} onClose={onClose}>
        <ResourceIcon kind={kind} />
        <span className="ols-plugin__context-label-text">{name}</span>
        {isChanged && (
          <span className="ols-plugin__inline-icon">
            <PencilAltIcon />
          </span>
        )}
        {kind !== 'Alert' && <Label className="ols-plugin__inline-icon">{attachmentType}</Label>}
      </Label>
    </Tooltip>
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
            {entry.isTruncated && (
              <Alert isInline title={t('History truncated')} variant="warning">
                {t('Conversation history has been truncated to fit within context window.')}
              </Alert>
            )}
            {entry.references && (
              <ChipGroup categoryName="Related documentation" className="ols-plugin__references">
                {entry.references.map((r, i) => (
                  <DocLink key={i} reference={r} />
                ))}
              </ChipGroup>
            )}
            {isUserFeedbackEnabled && (
              <Feedback
                conversationID={conversationID}
                entryIndex={entryIndex}
                scrollIntoView={scrollIntoView}
              />
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

const ChatHistoryEntryWaiting = () => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  return (
    <div className="ols-plugin__chat-entry ols-plugin__chat-entry--ai">
      <div className="ols-plugin__chat-entry-name">OpenShift Lightspeed</div>
      <HelperText>
        <HelperTextItem variant="indeterminate">
          {t('Waiting for LLM provider...')} <Spinner size="lg" />
        </HelperTextItem>
      </HelperText>
    </div>
  );
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
        "OpenShift Lightspeed can answer questions related to OpenShift. This feature uses AI technology. Do not include personal information or other sensitive information in your input. Interactions may be used to improve Red Hat's products or services.",
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

  const conversationID: string = useSelector((s: State) => s.plugins?.ols?.get('conversationID'));
  const query: string = useSelector((s: State) => s.plugins?.ols?.get('query'));

  const [validated, setValidated] = React.useState<'default' | 'error'>('default');

  const [authStatus] = useAuth();

  const [isNewChatModalOpen, , openNewChatModal, closeNewChatModal] = useBoolean(false);
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

      dispatch(
        chatHistoryPush({
          attachments: attachments.map((a) => omit(a, 'originalValue')),
          text: query,
          who: 'user',
        }),
      );
      scrollIntoView();
      setWaiting();

      const requestJSON = {
        attachments: attachments.valueSeq().map(toOLSAttachment),
        // eslint-disable-next-line camelcase
        conversation_id: conversationID,
        query,
      };

      consoleFetchJSON
        .post(QUERY_ENDPOINT, requestJSON, getRequestInitWithAuthHeader(), QUERY_REQUEST_TIMEOUT)
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
          dispatch(
            chatHistoryPush({
              error: getFetchErrorMessage(error, t),
              isTruncated: false,
              who: 'ai',
            }),
          );
          scrollIntoView();
          unsetWaiting();
        });

      // Clear prompt input and return focus to it
      dispatch(setQuery(''));
      dispatch(attachmentsClear());
      promptRef.current?.focus();
    },
    [attachments, conversationID, dispatch, query, scrollIntoView, setWaiting, t, unsetWaiting],
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
    <Page>
      <PageSection className={isWelcomePage ? undefined : 'ols-plugin__header'} variant="light">
        {onExpand && (
          <Button
            className="ols-plugin__popover-control"
            onClick={onExpand}
            title={t('Expand')}
            variant="plain"
          >
            <ExpandIcon className="ols-plugin__popover-control-icon" />
          </Button>
        )}
        {onCollapse && (
          <Button
            className="ols-plugin__popover-control"
            onClick={onCollapse}
            title={t('Collapse')}
            variant="plain"
          >
            <CompressIcon className="ols-plugin__popover-control-icon" />
          </Button>
        )}
        <Button
          className="ols-plugin__popover-control"
          onClick={onClose}
          title={t('Minimize')}
          variant="plain"
        >
          <WindowMinimizeIcon className="ols-plugin__popover-control-icon" />
        </Button>
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
        <ReadinessAlert />
        <div ref={chatHistoryEndRef} />
      </PageSection>

      {authStatus !== AuthStatus.NotAuthenticated && authStatus !== AuthStatus.NotAuthorized && (
        <PageSection className="ols-plugin__chat-prompt" isFilled={false} variant="light">
          <Form onSubmit={onSubmit}>
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
                  <PaperPlaneIcon />
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
            <HelperTextItem className="ols-plugin__footer" variant="indeterminate">
              {t('Always review AI generated content prior to use.')}
            </HelperTextItem>
            <HelperTextItem className="ols-plugin__footer" variant="indeterminate">
              {t('Want to contact the OpenShift Lightspeed team?')}{' '}
              <ExternalLink href="mailto:openshift-lightspeed-contact-requests@redhat.com?subject=Contact the OpenShift Lightspeed team">
                Click here
              </ExternalLink>{' '}
              to email us.
            </HelperTextItem>
          </HelperText>

          <AttachmentModal />
          <NewChatModal
            isOpen={isNewChatModalOpen}
            onClose={closeNewChatModal}
            onConfirm={onConfirmNewChat}
          />
        </PageSection>
      )}
    </Page>
  );
};

export default GeneralPage;
