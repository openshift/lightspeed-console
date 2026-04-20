import { List as ImmutableList, Map as ImmutableMap } from 'immutable';
import { defer } from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  Badge,
  Button,
  ExpandableSection,
  Spinner,
  Title,
  Tooltip,
} from '@patternfly/react-core';
import {
  CheckIcon,
  CompressIcon,
  ExpandIcon,
  ExternalLinkAltIcon,
  OutlinedCopyIcon,
  TrashIcon,
  WindowMinimizeIcon,
} from '@patternfly/react-icons';
import {
  Chatbot,
  ChatbotContent,
  ChatbotDisplayMode,
  ChatbotFooter,
  ChatbotFootnote,
  ChatbotHeader,
  ChatbotHeaderActions,
  ChatbotHeaderMain,
  ChatbotHeaderTitle,
  Message,
  MessageBox,
  type SourcesCardProps,
} from '@patternfly/chatbot';

import { toOLSAttachment } from '../attachments';
import { getApiUrl } from '../config';
import { copyToClipboard } from '../clipboard';
import { ErrorType, getFetchErrorMessage } from '../error';
import { AuthStatus, getRequestInitWithAuthHeader, useAuth } from '../hooks/useAuth';
import { useBoolean } from '../hooks/useBoolean';
import { useFirstTimeUser } from '../hooks/useFirstTimeUser';
import { useIsDarkTheme } from '../hooks/useIsDarkTheme';
import {
  attachmentsClear,
  chatHistoryClear,
  setConversationID,
  userFeedbackClose,
  userFeedbackOpen,
  userFeedbackSetSentiment,
  userFeedbackSetText,
} from '../redux-actions';
import { State } from '../redux-reducers';
import { Attachment, ChatEntry, ReferencedDoc, Tool } from '../types';
import AttachmentLabel from './AttachmentLabel';
import AttachmentsSizeAlert from './AttachmentsSizeAlert';
import ImportAction from './ImportAction';
import NewChatModal from './NewChatModal';
import Prompt from './Prompt';
import ReadinessAlert from './ReadinessAlert';
import ResponseTools from './ResponseTools';
import ToolApproval from './ToolApproval';
import WelcomeNotice from './WelcomeNotice';

import './general-page.css';
import '@patternfly/chatbot/dist/css/main.css';

import aiAvatar from '../assets/logo.svg';
import aiAvatarDark from '../assets/logo-dark.svg';
import userAvatar from '../assets/user.png';

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

const ImportCodeBlockAction: React.FC = () => {
  const containerRef = React.useRef<HTMLSpanElement | null>(null);
  const [value, setValue] = React.useState<string>('');

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }

    const codeBlockEl = el.closest('.pf-v6-c-code-block');
    const code = codeBlockEl?.querySelector('code')?.textContent;
    const isYAML =
      (codeBlockEl?.querySelector('.pf-chatbot__message-code-block-language') as HTMLElement | null)
        ?.textContent === 'yaml';
    if (isYAML && typeof code === 'string' && code.length > 0) {
      setValue(code);
    }
  }, []);

  return <span ref={containerRef}>{value ? <ImportAction value={value} /> : null}</span>;
};

const USER_FEEDBACK_ENDPOINT = getApiUrl('/v1/feedback');
const REQUEST_TIMEOUT = 5 * 60 * 1000;
const THUMBS_DOWN = -1;
const THUMBS_UP = 1;

type ChatHistoryEntryProps = {
  conversationID: string;
  entryIndex: number;
};

const ChatHistoryEntry = React.memo(({ conversationID, entryIndex }: ChatHistoryEntryProps) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const dispatch = useDispatch();

  const [feedbackError, setFeedbackError] = React.useState<ErrorType>();
  const [feedbackSubmitted, setFeedbackSubmitted] = React.useState(false);
  const [isContextExpanded, toggleContextExpanded] = useBoolean(false);

  const entryMap = useSelector((s: State) => s.plugins?.ols?.getIn(['chatHistory', entryIndex]));
  const entry = entryMap.toJS() as ChatEntry;

  const attachments: ImmutableMap<string, Attachment> = useSelector((s: State) =>
    s.plugins?.ols?.getIn(['chatHistory', entryIndex - 1, 'attachments']),
  );
  const isFeedbackOpen: boolean = useSelector((s: State) =>
    s.plugins?.ols?.getIn(['chatHistory', entryIndex, 'userFeedback', 'isOpen']),
  );
  const query: string = useSelector((s: State) =>
    s.plugins?.ols?.getIn(['chatHistory', entryIndex - 1, 'text']),
  );
  const response: string = useSelector((s: State) =>
    s.plugins?.ols?.getIn(['chatHistory', entryIndex, 'text']),
  );

  const isUserFeedbackEnabled = useSelector((s: State) =>
    s.plugins?.ols?.get('isUserFeedbackEnabled'),
  );
  const sentiment: number = useSelector((s: State) =>
    s.plugins?.ols?.getIn(['chatHistory', entryIndex, 'userFeedback', 'sentiment']),
  );
  const feedbackText: string = useSelector((s: State) =>
    s.plugins?.ols?.getIn(['chatHistory', entryIndex, 'userFeedback', 'text']),
  );

  const [isDarkTheme] = useIsDarkTheme();

  const onThumbsDown = React.useCallback(() => {
    dispatch(userFeedbackOpen(entryIndex));
    dispatch(userFeedbackSetSentiment(entryIndex, THUMBS_DOWN));
    setFeedbackSubmitted(false);
  }, [dispatch, entryIndex]);

  const onThumbsUp = React.useCallback(() => {
    dispatch(userFeedbackOpen(entryIndex));
    dispatch(userFeedbackSetSentiment(entryIndex, THUMBS_UP));
    setFeedbackSubmitted(false);
  }, [dispatch, entryIndex]);

  const onFeedbackClose = React.useCallback(() => {
    dispatch(userFeedbackClose(entryIndex));
  }, [dispatch, entryIndex]);

  const onFeedbackTextChange = React.useCallback(
    (_event: React.ChangeEvent<HTMLTextAreaElement>, value: string) => {
      dispatch(userFeedbackSetText(entryIndex, value));
    },
    [dispatch, entryIndex],
  );

  const onFeedbackSubmit = React.useCallback(() => {
    const userQuestion = attachments
      ? `${query}\n---\nThe attachments that were sent with the prompt are shown below.\n${JSON.stringify(attachments.valueSeq().map(toOLSAttachment), null, 2)}`
      : query;

    /* eslint-disable camelcase */
    const requestJSON = {
      conversation_id: conversationID,
      llm_response: response,
      sentiment,
      user_feedback: feedbackText ?? '',
      user_question: userQuestion,
    };
    /* eslint-enable camelcase */

    consoleFetchJSON
      .post(USER_FEEDBACK_ENDPOINT, requestJSON, getRequestInitWithAuthHeader(), REQUEST_TIMEOUT)
      .then(() => {
        setFeedbackSubmitted(true);
      })
      .catch((err) => {
        setFeedbackError(getFetchErrorMessage(err, t));
        setFeedbackSubmitted(false);
      });
  }, [conversationID, query, attachments, response, sentiment, feedbackText, t]);

  if (entry.who === 'user' && entry.hidden) {
    return null;
  }

  if (entry.who === 'ai') {
    const thumbsUpTooltip = t('Good response');
    const thumbsDownTooltip = t('Bad response');
    const actions = entry.error
      ? undefined
      : {
          copy: { onClick: () => copyToClipboard(entry.text) },
          ...(isUserFeedbackEnabled && {
            positive: {
              clickedTooltipContent: thumbsUpTooltip,
              onClick: onThumbsUp,
              tooltipContent: thumbsUpTooltip,
            },
            negative: {
              clickedTooltipContent: thumbsDownTooltip,
              onClick: onThumbsDown,
              tooltipContent: thumbsDownTooltip,
            },
          }),
        };

    let sources: SourcesCardProps | undefined;
    if (Array.isArray(entry.references)) {
      const references: ReferencedDoc[] = entry.references.filter(
        (r) =>
          r && typeof r.doc_title === 'string' && typeof r.doc_url === 'string' && isURL(r.doc_url),
      );
      if (references.length > 0) {
        sources = {
          sources: references.map((r) => ({
            isExternal: true,
            title: r.doc_title,
            link: r.doc_url,
          })),
        };
      }
    }

    const pendingApprovalTools = entry.tools
      ? Object.entries(entry.tools as unknown as { [key: string]: Tool }).filter(
          ([, tool]) => tool.isUserApproval && !tool.isApproved && !tool.isDenied,
        )
      : [];

    const historyCompressedAlert = (
      <Alert
        className="ols-plugin__history-compressed"
        customIcon={<CheckIcon />}
        isInline
        isPlain
        title={t('History compressed')}
        variant="success"
      />
    );

    return (
      <Message
        actions={actions}
        avatar={isDarkTheme ? aiAvatarDark : aiAvatar}
        codeBlockProps={{
          customActions: entry.isStreaming ? undefined : <ImportCodeBlockAction />,
          isExpandable: true,
        }}
        content={entry.text}
        data-test="ols-plugin__chat-entry-ai"
        extraContent={{
          afterMainContent: (
            <>
              {entry.error && (
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
              )}
              {entry.historyCompression?.status === 'compressing' && !entry.isCancelled && (
                <Alert
                  customIcon={<Spinner isInline size="md" />}
                  isInline
                  isPlain
                  title={t('Compressing history...')}
                  variant="info"
                />
              )}
              {entry.historyCompression?.status === 'done' &&
                (entry.historyCompression.durationMs === undefined ? (
                  historyCompressedAlert
                ) : (
                  <Tooltip
                    content={t('Compressed in {{seconds}} seconds', {
                      seconds: (entry.historyCompression.durationMs / 1000).toFixed(2),
                    })}
                  >
                    {historyCompressedAlert}
                  </Tooltip>
                ))}
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
              {pendingApprovalTools.map(([toolID, tool]) => (
                <ToolApproval chatEntryID={entry.id} key={toolID} tool={tool} toolID={toolID} />
              ))}
              {entry.tools && <ResponseTools entryIndex={entryIndex} />}
            </>
          ),
          endContent: feedbackError ? (
            <Alert
              className="ols-plugin__alert"
              isExpandable={!!feedbackError.moreInfo}
              isInline
              title={
                feedbackError.moreInfo ? feedbackError.message : t('Error submitting feedback')
              }
              variant="danger"
            >
              {feedbackError.moreInfo ? feedbackError.moreInfo : feedbackError.message}
            </Alert>
          ) : undefined,
        }}
        hasRoundAvatar={false}
        isCompact
        isLoading={!entry.text && !entry.isCancelled && !entry.error}
        name="OpenShift Lightspeed"
        role="bot"
        sources={sources}
        timestamp=" "
        userFeedbackComplete={
          isFeedbackOpen && feedbackSubmitted ? { onClose: onFeedbackClose } : undefined
        }
        userFeedbackForm={
          isFeedbackOpen && !feedbackSubmitted && sentiment !== undefined
            ? {
                className: 'ols-plugin__feedback',
                hasTextArea: true,
                headingLevel: 'h6',
                onClose: onFeedbackClose,
                onSubmit: onFeedbackSubmit,
                onTextAreaChange: onFeedbackTextChange,
                submitWord: t('Submit'),
                textAreaProps: { value: feedbackText ?? '' },
                title: t(
                  "Do not include personal information or other sensitive information in your feedback. Feedback may be used to improve Red Hat's products or services.",
                ),
              }
            : undefined
        }
      />
    );
  }

  if (entry.who === 'user') {
    return (
      <Message
        avatar={userAvatar}
        avatarProps={{ className: 'ols-plugin__avatar', isBordered: true }}
        data-test="ols-plugin__chat-entry-user"
        extraContent={{
          afterMainContent: (
            <>
              <div>{entry.text}</div>
              {entry.attachments && Object.keys(entry.attachments).length > 0 && (
                <ExpandableSection
                  displaySize="lg"
                  isExpanded={isContextExpanded}
                  onToggle={toggleContextExpanded}
                  toggleContent={
                    <>
                      {t('Context')} <Badge>{Object.keys(entry.attachments).length}</Badge>
                    </>
                  }
                >
                  {Object.keys(entry.attachments).map((key: string) => {
                    const attachment: Attachment = entry.attachments[key];
                    return <AttachmentLabel attachment={attachment} key={key} />;
                  })}
                </ExpandableSection>
              )}
            </>
          ),
        }}
        hasRoundAvatar={false}
        isCompact
        name="You"
        role="user"
        timestamp=" "
      />
    );
  }

  return null;
});
ChatHistoryEntry.displayName = 'ChatHistoryEntry';

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

type GeneralPageProps = {
  ariaLabel: string;
  className: string;
  onClose: () => void;
  onCollapse?: () => void;
  onExpand?: () => void;
};

const GeneralPage: React.FC<GeneralPageProps> = ({
  ariaLabel,
  className,
  onClose,
  onCollapse,
  onExpand,
}) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const dispatch = useDispatch();

  const chatHistory: ImmutableList<ImmutableMap<string, unknown>> = useSelector((s: State) =>
    s.plugins?.ols?.get('chatHistory'),
  );

  const conversationID: string = useSelector((s: State) => s.plugins?.ols?.get('conversationID'));

  const [authStatus] = useAuth();
  const [isFirstTimeUser] = useFirstTimeUser();

  const [isNewChatModalOpen, , openNewChatModal, closeNewChatModal] = useBoolean(false);
  const [isCopied, , setCopied, setNotCopied] = useBoolean(false);

  const chatHistoryEndRef = React.useRef<HTMLDivElement | null>(null);

  const scrollIntoView = React.useCallback((behavior: ScrollBehavior = 'smooth') => {
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

  const onConfirmNewChat = React.useCallback(() => {
    clearChat();
    closeNewChatModal();
  }, [clearChat, closeNewChatModal]);

  const copyConversation = React.useCallback(async () => {
    try {
      const chatEntries = chatHistory.toJS();
      let conversationText = '';

      chatEntries.forEach((entry: ChatEntry) => {
        if (entry.who === 'user' && !entry.hidden) {
          conversationText += `You: ${entry.text}\n\n`;
        } else if (entry.who === 'ai' && entry.text && !entry.isStreaming) {
          conversationText += `OpenShift Lightspeed: ${entry.text}\n\n`;
        }
      });

      const trimmed = conversationText.trim();
      if (!trimmed) {
        return;
      }

      await navigator.clipboard.writeText(trimmed);
      setCopied();
      setTimeout(setNotCopied, 2000);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to copy conversation to clipboard: ', err);
    }
  }, [chatHistory, setCopied, setNotCopied]);

  return (
    <Chatbot
      ariaLabel={ariaLabel}
      className={className}
      data-test="ols-plugin__popover"
      displayMode={onCollapse ? ChatbotDisplayMode.fullscreen : ChatbotDisplayMode.default}
    >
      <ChatbotHeader>
        <ChatbotHeaderMain>
          <ChatbotHeaderTitle className="ols-plugin__header-title">
            <Title headingLevel="h1">{t('Red Hat OpenShift Lightspeed')}</Title>
          </ChatbotHeaderTitle>
        </ChatbotHeaderMain>
        <ChatbotHeaderActions className="ols-plugin__header-actions">
          {chatHistory.size > 0 && (
            <>
              <Tooltip content={t('Clear chat')}>
                <Button
                  className="ols-plugin__popover-control"
                  data-test="ols-plugin__clear-chat-button"
                  icon={<TrashIcon />}
                  onClick={openNewChatModal}
                  variant="plain"
                />
              </Tooltip>
              <Tooltip
                content={isCopied ? t('Copied') : t('Copy conversation')}
                data-test="ols-plugin__copy-conversation-tooltip"
              >
                <Button
                  className="ols-plugin__popover-control"
                  data-test="ols-plugin__copy-conversation-button"
                  icon={isCopied ? <CheckIcon /> : <OutlinedCopyIcon />}
                  onClick={copyConversation}
                  variant="plain"
                />
              </Tooltip>
            </>
          )}
          {onExpand && (
            <Button
              className="ols-plugin__popover-control"
              data-test="ols-plugin__popover-expand-button"
              icon={<ExpandIcon />}
              onClick={onExpand}
              title={t('Expand')}
              variant="plain"
            />
          )}
          {onCollapse && (
            <Button
              className="ols-plugin__popover-control"
              data-test="ols-plugin__popover-collapse-button"
              icon={<CompressIcon />}
              onClick={onCollapse}
              title={t('Collapse')}
              variant="plain"
            />
          )}
          <Button
            className="ols-plugin__popover-control"
            data-test="ols-plugin__popover-minimize-button"
            icon={<WindowMinimizeIcon />}
            onClick={onClose}
            title={t('Minimize')}
            variant="plain"
          />
        </ChatbotHeaderActions>
      </ChatbotHeader>

      <ChatbotContent aria-label={t('OpenShift Lightspeed chat history')}>
        <MessageBox>
          <div className="ols-plugin__welcome-logo"></div>
          <Title className="ols-plugin__welcome-subheading" headingLevel="h5">
            {t(
              'Explore deeper insights, engage in meaningful discussions, and unlock new possibilities with Red Hat OpenShift Lightspeed. Answers are provided by generative AI technology, please use appropriate caution when following recommendations.',
            )}
          </Title>
          <AuthAlert authStatus={authStatus} />
          <PrivacyAlert />
          {isFirstTimeUser && <WelcomeNotice />}
          {chatHistory
            .map((entry, i) => (
              <ChatHistoryEntry
                conversationID={conversationID}
                entryIndex={i}
                key={(entry.get('id') as string) ?? i}
              />
            ))
            .toArray()}
          <AttachmentsSizeAlert />
          <ReadinessAlert />
          <div ref={chatHistoryEndRef} />
        </MessageBox>
      </ChatbotContent>

      {authStatus !== AuthStatus.NotAuthenticated && authStatus !== AuthStatus.NotAuthorized && (
        <ChatbotFooter>
          <Prompt scrollIntoView={scrollIntoView} />
          <ChatbotFootnote label={t('Always review AI generated content prior to use.')} />
          <div className="ols-plugin__footnote">
            {t('For questions or feedback about OpenShift Lightspeed,')}{' '}
            <ExternalLink href="mailto:openshift-lightspeed-contact-requests@redhat.com?subject=Contact the OpenShift Lightspeed team">
              {t('email the Red Hat team')}
            </ExternalLink>
          </div>
          <NewChatModal
            isOpen={isNewChatModalOpen}
            onClose={closeNewChatModal}
            onConfirm={onConfirmNewChat}
          />
        </ChatbotFooter>
      )}
    </Chatbot>
  );
};

export default GeneralPage;
