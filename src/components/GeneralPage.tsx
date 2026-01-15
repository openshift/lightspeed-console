import { List as ImmutableList, Map as ImmutableMap } from 'immutable';
import { defer } from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Badge,
  Button,
  CodeBlock,
  CodeBlockAction,
  CodeBlockCode,
  ExpandableSection,
  HelperText,
  HelperTextItem,
  Label,
  LabelGroup,
  Page,
  PageSection,
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
  TimesIcon,
  WindowMinimizeIcon,
} from '@patternfly/react-icons';

import { AuthStatus, useAuth } from '../hooks/useAuth';
import { useBoolean } from '../hooks/useBoolean';
import { useFirstTimeUser } from '../hooks/useFirstTimeUser';
import {
  attachmentDelete,
  attachmentsClear,
  chatHistoryClear,
  setConversationID,
} from '../redux-actions';
import { State } from '../redux-reducers';
import { Attachment, ChatEntry, ReferencedDoc } from '../types';
import AttachmentModal from './AttachmentModal';
import AttachmentLabel from './AttachmentLabel';
import AttachmentsSizeAlert from './AttachmentsSizeAlert';
import CopyAction from './CopyAction';
import ImportAction from './ImportAction';
import Feedback from './Feedback';
import NewChatModal from './NewChatModal';
import Prompt from './Prompt';
import ReadinessAlert from './ReadinessAlert';
import ResponseTools from './ResponseTools';
import ToolModal from './ResponseToolModal';
import WelcomeNotice from './WelcomeNotice';

import './general-page.css';

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
      <div
        className="ols-plugin__chat-entry ols-plugin__chat-entry--ai"
        data-test="ols-plugin__chat-entry-ai"
      >
        <div className="ols-plugin__chat-entry-name">OpenShift Lightspeed</div>
        <Markdown components={{ code: Code }}>{entry.text}</Markdown>
        {!entry.text && !entry.isCancelled && (
          <HelperText>
            <HelperTextItem variant="indeterminate">
              {t('Waiting for LLM provider...')} <Spinner size="lg" />
            </HelperTextItem>
          </HelperText>
        )}
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
      </div>
    );
  }
  if (entry.who === 'user') {
    return (
      <div
        className="ols-plugin__chat-entry ols-plugin__chat-entry--user"
        data-test="ols-plugin__chat-entry-user"
      >
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
  const chatHistory: ImmutableList<ImmutableMap<string, unknown>> = useSelector((s: State) =>
    s.plugins?.ols?.get('chatHistory'),
  );

  const conversationID: string = useSelector((s: State) => s.plugins?.ols?.get('conversationID'));

  const [authStatus] = useAuth();
  const [isFirstTimeUser] = useFirstTimeUser();

  const [isNewChatModalOpen, , openNewChatModal, closeNewChatModal] = useBoolean(false);
  const [isCopied, , setCopied, setNotCopied] = useBoolean(false);

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

  const isWelcomePage = chatHistory.size === 0;

  const copyConversation = React.useCallback(async () => {
    try {
      const chatEntries = chatHistory.toJS();
      let conversationText = '';

      chatEntries.forEach((entry: ChatEntry) => {
        if (entry.who === 'user') {
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
    <Page>
      <PageSection className={isWelcomePage ? undefined : 'ols-plugin__header'} variant="light">
        <div className="ols-plugin__header-actions">
          {chatHistory.size > 0 && (
            <>
              <Tooltip content={t('Clear chat')}>
                <Button
                  className="ols-plugin__popover-control"
                  data-test="ols-plugin__clear-chat-button"
                  icon={<TimesIcon />}
                  onClick={openNewChatModal}
                  variant="plain"
                />
              </Tooltip>
              <Tooltip content={isCopied ? t('Copied') : t('Copy conversation')}>
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
          {onCollapse && (
            <Tooltip content={t('Collapse')}>
              <Button
                className="ols-plugin__popover-control"
                data-test="ols-plugin__popover-collapse-button"
                icon={<CompressIcon />}
                onClick={onCollapse}
                title={t('Collapse')}
                variant="plain"
              />
            </Tooltip>
          )}
          {onExpand && (
            <Tooltip content={t('Expand')}>
              <Button
                className="ols-plugin__popover-control"
                data-test="ols-plugin__popover-expand-button"
                icon={<ExpandIcon />}
                onClick={onExpand}
                title={t('Expand')}
                variant="plain"
              />
            </Tooltip>
          )}
          <Tooltip content={t('Minimize')}>
            <Button
              className="ols-plugin__popover-control"
              data-test="ols-plugin__popover-minimize-button"
              icon={<WindowMinimizeIcon />}
              onClick={onClose}
              title={t('Minimize')}
              variant="plain"
            />
          </Tooltip>
        </div>
        {!isWelcomePage && (
          <Title className="ols-plugin__heading" headingLevel="h1">
            {t('Red Hat OpenShift Lightspeed')}
          </Title>
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
        {isFirstTimeUser && <WelcomeNotice />}
        {chatHistory.toJS().map((entry: ChatEntry, i: number) => (
          <ChatHistoryEntry conversationID={conversationID} entry={entry} entryIndex={i} key={i} />
        ))}
        <AttachmentsSizeAlert />
        <ReadinessAlert />
        <div ref={chatHistoryEndRef} />
      </PageSection>

      {authStatus !== AuthStatus.NotAuthenticated && authStatus !== AuthStatus.NotAuthorized && (
        <PageSection className="ols-plugin__chat-prompt" isFilled={false} variant="light">
          <Prompt scrollIntoView={scrollIntoView} />
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
        </PageSection>
      )}
    </Page>
  );
};

export default GeneralPage;
