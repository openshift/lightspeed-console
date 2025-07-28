import { List as ImmutableList, Map as ImmutableMap } from 'immutable';
import { defer } from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import { useDispatch, useSelector } from 'react-redux';
import { consoleFetchJSON, useUserSettings } from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  Badge,
  Button,
  CodeBlock,
  CodeBlockAction,
  CodeBlockCode,
  ExpandableSection,
  Label,
  LabelGroup,
  Stack,
  StackItem,
  Title,
} from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import {
  ChatbotContent,
  ChatbotFooter,
  ChatbotFootnote,
  ChatbotHeader,
  ChatbotHeaderActions,
  ChatbotHeaderMain,
  ChatbotHeaderTitle,
  Message,
} from '@patternfly/chatbot';

import { toOLSAttachment } from '../attachments';
import { copyToClipboard } from '../clipboard';
import { ErrorType, getFetchErrorMessage } from '../error';
import { AuthStatus, getRequestInitWithAuthHeader, useAuth } from '../hooks/useAuth';
import { useBoolean } from '../hooks/useBoolean';
import {
  attachmentsClear,
  chatHistoryClear,
  setConversationID,
  userFeedbackClose,
  userFeedbackOpen,
  userFeedbackSetSentiment,
} from '../redux-actions';
import { State } from '../redux-reducers';
import { Attachment, ChatEntry, ReferencedDoc } from '../types';
import AttachmentLabel from './AttachmentLabel';
import CopyAction from './CopyAction';
import ImportAction from './ImportAction';
import NewChatModal from './NewChatModal';
import Prompt from './Prompt';
import ReadinessAlert from './ReadinessAlert';
import ResponseTools from './ResponseTools';
import WindowControlButtons from './WindowControlButtons';

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
    <LabelGroup categoryName="Related documentation">
      {validReferences.map((r, i) => (
        <Label key={i} textMaxWidth="16rem">
          <ExternalLink href={r.doc_url}>{r.doc_title}</ExternalLink>
        </Label>
      ))}
    </LabelGroup>
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

const USER_FEEDBACK_ENDPOINT = '/api/proxy/plugin/lightspeed-console-plugin/ols/v1/feedback';
const REQUEST_TIMEOUT = 5 * 60 * 1000;
const THUMBS_DOWN = -1;
const THUMBS_UP = 1;

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

  const dispatch = useDispatch();

  const [feedbackError, setFeedbackError] = React.useState<ErrorType>();
  const [feedbackSubmitted, setFeedbackSubmitted] = React.useState(false);
  const [isContextExpanded, toggleContextExpanded] = useBoolean(false);

  const attachments: ImmutableMap<string, Attachment> = useSelector((s: State) =>
    s.plugins?.ols?.getIn(['chatHistory', entryIndex - 1, 'attachments']),
  );
  const isFeedbackOpen: string = useSelector((s: State) =>
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

  const [theme] = useUserSettings('console.theme', null, true);

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

  const onFeedbackSubmit = React.useCallback(
    (_quickResponse, additionalFeedback) => {
      const userQuestion = attachments
        ? `${query}\n---\nThe attachments that were sent with the prompt are shown below.\n${JSON.stringify(attachments.valueSeq().map(toOLSAttachment), null, 2)}`
        : query;

      /* eslint-disable camelcase */
      const requestJSON = {
        conversation_id: conversationID,
        llm_response: response,
        sentiment,
        user_feedback: additionalFeedback,
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
    },
    [conversationID, query, attachments, response, sentiment, t],
  );

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

    return (
      <>
        {/* @ts-expect-error: TS2786 */}
        <Message
          actions={actions}
          avatar={theme === 'dark' ? aiAvatarDark : aiAvatar}
          extraContent={{
            afterMainContent: entry.error ? (
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
          isLoading={!entry.text && !entry.isCancelled && !entry.error}
          name="OpenShift Lightspeed"
          role="bot"
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
                  submitWord: t('Submit'),
                  title: t(
                    "Do not include personal information or other sensitive information in your feedback. Feedback may be used to improve Red Hat's products or services.",
                  ),
                }
              : undefined
          }
        />
      </>
    );
  }

  if (entry.who === 'user') {
    return (
      <>
        {/* @ts-expect-error: TS2786 */}
        <Message
          avatar={userAvatar}
          extraContent={{
            afterMainContent: (
              <>
                <div>{entry.text}</div>
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
              </>
            ),
          }}
          hasRoundAvatar={false}
          name="You"
          role="user"
          timestamp=" "
        />
      </>
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

type GeneralPageProps = {
  onClose: () => void;
  onCollapse?: () => void;
  onExpand?: () => void;
};

const GeneralPage: React.FC<GeneralPageProps> = ({ onClose, onCollapse, onExpand }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const dispatch = useDispatch();

  const chatHistory: ImmutableList<ImmutableMap<string, unknown>> = useSelector((s: State) =>
    s.plugins?.ols?.get('chatHistory'),
  );

  const conversationID: string = useSelector((s: State) => s.plugins?.ols?.get('conversationID'));

  const [authStatus] = useAuth();

  const [isNewChatModalOpen, , openNewChatModal, closeNewChatModal] = useBoolean(false);

  const chatHistoryEndRef = React.useRef(null);

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

  const onConfirmNewChat = React.useCallback(() => {
    clearChat();
    closeNewChatModal();
  }, [clearChat, closeNewChatModal]);

  return (
    <Stack>
      <StackItem>
        {/* @ts-expect-error: TS2786 */}
        <ChatbotHeader className="ols-plugin__header">
          {/* @ts-expect-error: TS2786 */}
          <ChatbotHeaderMain>
            {/* @ts-expect-error: TS2786 */}
            <ChatbotHeaderTitle className="ols-plugin__header-title">
              <Title headingLevel="h1">{t('Red Hat OpenShift Lightspeed')}</Title>
              {chatHistory.size > 0 && (
                <Button
                  className="ols-plugin__popover-clear-chat"
                  onClick={openNewChatModal}
                  variant="primary"
                >
                  {t('Clear chat')}
                </Button>
              )}
            </ChatbotHeaderTitle>
          </ChatbotHeaderMain>
          {/* @ts-expect-error: TS2786 */}
          <ChatbotHeaderActions>
            <WindowControlButtons onClose={onClose} onCollapse={onCollapse} onExpand={onExpand} />
          </ChatbotHeaderActions>
        </ChatbotHeader>
      </StackItem>

      <StackItem className="ols-plugin__chat-history" isFilled>
        {/* @ts-expect-error: TS2786 */}
        <ChatbotContent aria-label={t('OpenShift Lightspeed chat history')}>
          <div className="ols-plugin__welcome-logo"></div>
          <Title className="ols-plugin__welcome-subheading" headingLevel="h5">
            {t(
              'Explore deeper insights, engage in meaningful discussions, and unlock new possibilities with Red Hat OpenShift Lightspeed. Answers are provided by generative AI technology, please use appropriate caution when following recommendations.',
            )}
          </Title>
          <AuthAlert authStatus={authStatus} />
          <PrivacyAlert />
          {chatHistory.toJS().map((entry: ChatEntry, i: number) => (
            <ChatHistoryEntry
              conversationID={conversationID}
              entry={entry}
              entryIndex={i}
              key={i}
            />
          ))}
          <ReadinessAlert />
          <div ref={chatHistoryEndRef} />
        </ChatbotContent>
      </StackItem>

      {authStatus !== AuthStatus.NotAuthenticated && authStatus !== AuthStatus.NotAuthorized && (
        <StackItem>
          {/* @ts-expect-error: TS2786 */}
          <ChatbotFooter>
            <Prompt scrollIntoView={scrollIntoView} />
            {/* @ts-expect-error: TS2786 */}
            <ChatbotFootnote label={t('Always review AI generated content prior to use.')} />
            <div className="ols-plugin__footnote">
              {t('Want to contact the OpenShift Lightspeed team?')}{' '}
              <ExternalLink href="mailto:openshift-lightspeed-contact-requests@redhat.com?subject=Contact the OpenShift Lightspeed team">
                Click here
              </ExternalLink>{' '}
              to email us.
            </div>
            <NewChatModal
              isOpen={isNewChatModalOpen}
              onClose={closeNewChatModal}
              onConfirm={onConfirmNewChat}
            />
          </ChatbotFooter>
        </StackItem>
      )}
    </Stack>
  );
};

export default GeneralPage;
