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
  Page,
  PageSection,
  Spinner,
  Split,
  SplitItem,
  TextArea,
  TextContent,
  Title,
} from '@patternfly/react-core';
import { PaperPlaneIcon } from '@patternfly/react-icons';

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
    if (!!entry.error) {
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

  const initialPrompt = useSelector((s: State) => s.plugins?.ols?.get('prompt'));

  const [prompt, setPrompt] = React.useState(initialPrompt ?? '');
  const [isPrivacyAlertShown, , , dismissPrivacyAlert] = useBoolean(true);
  const [history, setHistory] = React.useState<ChatEntry[]>([
    { text: t('Hello there. How can I help?'), who: 'ai' },
  ]);
  const [isWaiting, setIsWaiting] = React.useState(false);

  const onChange = React.useCallback((_event, value) => {
    setPrompt(value);
  }, []);

  const onSubmit = React.useCallback(
    (e) => {
      e.preventDefault();

      if (!prompt) {
        return;
      }

      const newHistory = [...history, { text: prompt, who: 'user' }];
      setHistory(newHistory);
      setIsWaiting(true);

      const body = JSON.stringify({ query: prompt });
      const requestData = { body, method: 'POST', timeout: QUERY_TIMEOUT};
      const { request } = cancellableFetch<QueryResponse>(QUERY_ENDPOINT, requestData);

      request()
        .then((response: QueryResponse) => {
          setHistory([
            ...newHistory,
            { text: response.response, who: 'ai' },
          ]);
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
    [history, prompt],
  );

  return (
    <>
      <Helmet>
        <title>{t('OpenShift Lightspeed')}</title>
      </Helmet>
      <Page>
        <PageSection variant="light">
          <Title headingLevel="h1">{t('OpenShift Lightspeed')}</Title>
        </PageSection>

        <PageSection className="ols-plugin__chat-history" isFilled variant="light">
          {isPrivacyAlertShown && (
            <Alert
              actionLinks={
                <>
                  <AlertActionLink onClick={dismissPrivacyAlert}>Got it</AlertActionLink>
                  <AlertActionLink onClick={() => {}}>Don't show again (TODO)</AlertActionLink>
                </>
              }
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
          <Form onSubmit={onSubmit}>
            <Split hasGutter>
              <SplitItem isFilled>
                <TextArea
                  aria-label="OpenShift Lightspeed prompt"
                  autoResize
                  className="ols-plugin__chat-prompt-input"
                  onChange={onChange}
                  placeholder="Send a message..."
                  resizeOrientation="vertical"
                  rows={1}
                  value={prompt}
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
            <HelperTextItem
              className="ols-plugin__chat-footer"
              variant="indeterminate"
            >
              TODO: Footer info wording
            </HelperTextItem>
          </HelperText>
        </PageSection>
      </Page>
    </>
  );
};

export default GeneralPage;
