import { dump } from 'js-yaml';
import { defer } from 'lodash';
import * as React from 'react';
import Helmet from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { K8sResourceKind, ResourceLink } from '@openshift-console/dynamic-plugin-sdk';
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
import { dismissPrivacyAlert, setHistory } from '../redux-actions';
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

  const dispatch = useDispatch();

  const context: K8sResourceKind = useSelector((s: State) => s.plugins?.ols?.get('context'));
  const history: ChatEntry[] = useSelector((s: State) => s.plugins?.ols?.get('history'));
  const isPrivacyAlertDismissed: boolean = useSelector((s: State) =>
    s.plugins?.ols?.get('isPrivacyAlertDismissed'),
  );

  // Do we have a context that looks like a k8s resource with sufficient information
  const isK8sResourceContext =
    context &&
    typeof context.kind === 'string' &&
    typeof context.metadata?.name === 'string' &&
    typeof context.metadata?.namespace === 'string';

  let initialQuery = '';
  if (isK8sResourceContext) {
    initialQuery = `Can you help me with ${context.kind.toLowerCase()} "${
      context.metadata.name
    }" in namespace "${context.metadata.namespace}"?`;
  }

  const [query, setQuery] = React.useState(initialQuery);
  const [isPrivacyAlertShown, , , hidePrivacyAlert] = useBoolean(!isPrivacyAlertDismissed);
  const [isWaiting, setIsWaiting] = React.useState(false);

  const promptRef = React.useRef(null);

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
      setQuery(textBeforeCursor + yaml + textAfterCursor);

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
    dispatch(setHistory([]));
  }, [dispatch]);

  const hidePrivacyAlertPersistent = React.useCallback(() => {
    hidePrivacyAlert();
    dispatch(dismissPrivacyAlert());
  }, [dispatch, hidePrivacyAlert]);

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
      dispatch(setHistory(newHistory));
      setIsWaiting(true);

      const headers = {
        'Content-Type': 'application/json',
      };
      // TODO: Also send the conversation_id
      const body = JSON.stringify({ query });
      const requestData = { body, method: 'POST', headers, timeout: QUERY_TIMEOUT };
      const { request } = cancellableFetch<QueryResponse>(QUERY_ENDPOINT, requestData);

      request()
        .then((response: QueryResponse) => {
          // TODO: Also store the conversation_id in history
          dispatch(setHistory([...newHistory, { text: response.response, who: 'ai' }]));
          setIsWaiting(false);
        })
        .catch((error) => {
          dispatch(
            setHistory([...newHistory, { error: error.toString(), text: undefined, who: 'ai' }]),
          );
          setIsWaiting(false);
        });
    },
    [dispatch, history, query],
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
              <p>TODO: Data privacy info wording line 1</p>
              <p>TODO: Data privacy info wording line 2</p>
            </Alert>
          )}

          <TextContent>
            <HistoryEntry entry={{ text: t('Hello there. How can I help?'), who: 'ai' }} />
            {history.map((entry, i) => (
              <HistoryEntry key={i} entry={entry} />
            ))}
            {isWaiting && <HistoryEntryWaiting />}
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
                    Asking about
                    <ResourceLink inline kind="Namespace" name={context.metadata.namespace} />
                    /
                    <ResourceLink
                      inline
                      kind={context.kind}
                      name={context.metadata.name}
                      title={context.metadata.uid}
                    />
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
