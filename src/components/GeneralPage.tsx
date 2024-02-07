import * as React from 'react';
import Helmet from 'react-helmet';
import {
  Button,
  Form,
  InputGroup,
  Page,
  PageSection,
  Spinner,
  TextArea,
  TextContent,
  Title,
} from '@patternfly/react-core';
import { cancellableFetch } from '../cancellable-fetch';
import './general-page.css';
import { useTranslation } from 'react-i18next';

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
        <div className="ols-plugin__chat-entry ols-plugin__chat-entry-ai ols-plugin__chat-entry-error">
          {entry.error}
        </div>
      );
    } else {
      return (
        <div className="ols-plugin__chat-entry ols-plugin__chat-entry-ai">
          {entry.text}
        </div>
      );
    }
  }
  if (entry.who === 'user') {
    return (
      <div className="ols-plugin__chat-entry ols-plugin__chat-entry-user">
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

  const [prompt, setPrompt] = React.useState('');
  const [history, setHistory] = React.useState<ChatEntry[]>([
    { text: t('Hello there. How can I help?'), who: 'ai' },
  ]);
  const [isWaiting, setIsWaiting] = React.useState(false);

  const onChange = React.useCallback((value) => {
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
          console.warn(response);
          setHistory([
            ...newHistory,
            { text: response.response, who: 'ai' },
          ]);
          setIsWaiting(false);
        })
        .catch((error) => {
          console.warn(error);
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
        <PageSection className="ols-plugin__chat-history" variant="light">
          <TextContent>
            {history.map((entry, i) => (
              <HistoryEntry key={i} entry={entry} />
            ))}
            {isWaiting && <HistoryEntryWaiting />}
          </TextContent>
        </PageSection>
        <PageSection className="ols-plugin__chat-prompt" variant="light">
          <Form onSubmit={onSubmit}>
            <InputGroup>
              <TextArea
                aria-label="OpenShift Lightspeed prompt"
                autoResize
                className="ols-plugin__chat-prompt-input"
                onChange={onChange}
                value={prompt}
              />
              <Button
                className="ols-plugin__chat-prompt-submit"
                type="submit"
                variant="primary"
              >
                {'>'}
              </Button>
            </InputGroup>
          </Form>
        </PageSection>
      </Page>
    </>
  );
};

export default GeneralPage;
