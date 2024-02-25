import { dump } from 'js-yaml';
import { defer } from 'lodash';
import * as React from 'react';
import Helmet from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import {
  Alert,
  AlertActionLink,
  Button,
  Form,
  HelperText,
  HelperTextItem,
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
} from '@patternfly/react-core';
import { FileImportIcon, PaperPlaneIcon } from '@patternfly/react-icons';

import { cancellableFetch } from '../cancellable-fetch';
import { useBoolean } from '../hooks/useBoolean';
import { State } from '../redux-reducers';

import './general-page.css';

const QUERY_ENDPOINT = '/api/proxy/plugin/lightspeed-console-plugin/ols/v1/query';
const QUERY_TIMEOUT = 60 * 1000;

type QueryResponse = {
  conversation_id: string;
  query: string;
  response: string;
};

type ChatEntry = {
  error?: string;
  text?: string;
  who: string;
};

type HistoryEntryProps = {
  entry: ChatEntry;
};

const HistoryEntry: React.FC<HistoryEntryProps> = ({ entry }) => {
  if (entry.who === 'ai') {
    if (entry.error) {
      return (
        <div className="ols-plugin__chat-entry ols-plugin__chat-entry-ai">
          <div className="ols-plugin__chat-entry-name">OpenShift Lightspeed</div>
          <div className="ols-plugin__chat-entry-error">{entry.error}</div>
        </div>
      );
    } else {
      return (
        <div className="ols-plugin__chat-entry ols-plugin__chat-entry-ai">
          <div className="ols-plugin__chat-entry-name">OpenShift Lightspeed</div>
          {entry.text}
        </div>
      );
    }
  }
  if (entry.who === 'user') {
    return (
      <div className="ols-plugin__chat-entry ols-plugin__chat-entry-user">
        <div className="ols-plugin__chat-entry-name">You</div>
        {entry.text}
      </div>
    );
  }
  return null;
};

const HistoryEntryWaiting = () => (
  <div className="ols-plugin__chat-entry ols-plugin__chat-entry-ai">
    <Spinner size="md" />
  </div>
);

const GeneralPage = () => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const context = useSelector((s: State) => s.plugins?.ols?.get('context'));

  let initialQuery = '';
  if (context && context.metadata && typeof context.kind === 'string') {
    initialQuery = `Can you help me with ${context.kind.toLowerCase()} "${context.metadata.name}" in namespace "${context.metadata.namespace}"?`;
  }

  const initialHistory = [
    {
      text: t('Hello there. How can I help?'),
      who: 'ai',
    },
  ];

  const [query, setQuery] = React.useState(initialQuery);
  const [isPrivacyAlertShown, , , dismissPrivacyAlert] = useBoolean(true);
  const [history, setHistory] = React.useState<ChatEntry[]>(initialHistory);
  const [isWaiting, setIsWaiting] = React.useState(false);

  const promptRef = React.useRef(null);

  const onInsertYAML = (e) => {
    e.preventDefault();

    if (context && promptRef?.current) {
      const { selectionStart, selectionEnd } = promptRef.current;

      console.warn({ selectionStart, selectionEnd });
      let yaml = '';
      try {
        yaml = dump(context, { lineWidth: -1 }).trim();
      } catch (e) {
        yaml = t('Error getting YAML: {{e}}', { e });
      }

      const textBeforeCursor = query.substring(0, selectionStart);
      const textAfterCursor = query.substring(selectionEnd, query.length);
      setQuery(textBeforeCursor + yaml + textAfterCursor);

      // Restore focus back to prompt input with the same cursor position
      // Defer so that this is called after the prompt text is updated
      defer(() => {
        promptRef.current.setSelectionRange(selectionStart, selectionStart);
        promptRef.current.focus();
      });
    }
  };

  const clearChat = (_e) => {
    setHistory(initialHistory);
  };

  const onChange = React.useCallback((_e, value) => {
    setQuery(value);
  }, []);

  const onSubmit = React.useCallback(
    (e) => {
      e.preventDefault();

      if (!query) {
        return;
      }

      const newHistory = [...history, { text: query, who: 'user' }];
      setHistory(newHistory);
      setIsWaiting(true);

      // TODO: Also send the conversation_id ID
      const headers = {
        'Content-Type': 'application/json',
      };
      const body = JSON.stringify({ query });
      const requestData = { body, method: 'POST', headers, timeout: QUERY_TIMEOUT };
      const { request } = cancellableFetch<QueryResponse>(QUERY_ENDPOINT, requestData);

      request()
        .then((response: QueryResponse) => {
          // TODO: Also store the conversation_id in history
          setHistory([...newHistory, { text: response.response, who: 'ai' }]);
          setIsWaiting(false);
        })
        .catch((error) => {
          setHistory([
            ...newHistory,
            { error: error.toString(), text: undefined, who: 'ai' },
          ]);
          setIsWaiting(false);
        });
    },
    [history, query],
  );

  return (
    <>
      <Helmet>
        <title>{t('OpenShift Lightspeed')}</title>
      </Helmet>
      <Page>
        <PageSection className="ols-plugin__page-title" variant="light">
          <Level>
            <LevelItem>
              <Title headingLevel="h1">{t('Red Hat OpenShift Lightspeed')}</Title>
            </LevelItem>
            <LevelItem>
              <Button onClick={clearChat} variant="primary">
                New chat
              </Button>
            </LevelItem>
          </Level>
        </PageSection>

        <PageSection className="ols-plugin__chat-history" isFilled variant="light">
          {isPrivacyAlertShown && (
            <Alert
              actionLinks={
                <>
                  <AlertActionLink onClick={dismissPrivacyAlert}>Got it</AlertActionLink>
                  <AlertActionLink onClick={() => {}}>Don&apos;t show again (TODO)</AlertActionLink>
                </>
              }
              className="ols-plugin__alert"
              isInline
              title="Data privacy"
              variant="info"
            >
              <p>TODO: Data privacy info wording line 1</p>
              <p>TODO: Data privacy info wording line 2</p>
            </Alert>
          )}

          <TextContent>
            {history.map((entry, i) => (
              <HistoryEntry key={i} entry={entry} />
            ))}
            {isWaiting && <HistoryEntryWaiting />}
          </TextContent>
        </PageSection>

        <PageSection className="ols-plugin__chat-prompt" isFilled={false} variant="light">
          {context && typeof context.kind === 'string' && (
            <>
              <Alert
                className="ols-plugin__alert"
                isInline
                title={`You are asking about ${context.kind.toLowerCase()} "${context.metadata.name}"`}
                variant="info"
              >
                <Button icon={<FileImportIcon />} onClick={onInsertYAML} variant="secondary">
                  Insert {context.kind.toLowerCase()} YAML at cursor
                </Button>
              </Alert>
            </>
          )}

          <Form onSubmit={onSubmit}>
            <Split hasGutter>
              <SplitItem isFilled>
                <TextArea
                  aria-label="OpenShift Lightspeed prompt"
                  autoFocus
                  autoResize
                  className="ols-plugin__chat-prompt-input"
                  onChange={onChange}
                  placeholder="Send a message..."
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
            <HelperTextItem className="ols-plugin__chat-footer" variant="indeterminate">
              TODO: Footer info wording
            </HelperTextItem>
          </HelperText>
        </PageSection>
      </Page>
    </>
  );
};

export default GeneralPage;
