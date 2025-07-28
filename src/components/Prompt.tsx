import { Map as ImmutableMap } from 'immutable';
import { dump as dumpYAML, load as loadYAML } from 'js-yaml';
import { cloneDeep, each, isMatch, omit, uniqueId } from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import {
  consoleFetch,
  consoleFetchJSON,
  K8sResourceKind,
  useK8sWatchResource,
} from '@openshift-console/dynamic-plugin-sdk';
import { MessageBar } from '@patternfly/chatbot';
import {
  Alert,
  AlertActionCloseButton,
  DropdownItem,
  DropdownList,
  Label,
  Spinner,
  Title,
  Tooltip,
} from '@patternfly/react-core';
import { FileCodeIcon, FileUploadIcon, InfoCircleIcon, TaskIcon } from '@patternfly/react-icons';

import { AttachmentTypes, toOLSAttachment } from '../attachments';
import { getFetchErrorMessage } from '../error';
import { getRequestInitWithAuthHeader } from '../hooks/useAuth';
import { useBoolean } from '../hooks/useBoolean';
import { useLocationContext } from '../hooks/useLocationContext';
import {
  attachmentDelete,
  attachmentsClear,
  attachmentSet,
  chatHistoryPush,
  chatHistoryUpdateByID,
  chatHistoryUpdateTool,
  setConversationID,
  setQuery,
} from '../redux-actions';
import { State } from '../redux-reducers';
import { Attachment } from '../types';
import AttachEventsModal from './AttachEventsModal';
import AttachLogModal from './AttachLogModal';
import AttachmentLabel from './AttachmentLabel';
import AttachmentModal from './AttachmentModal';
import ResourceIcon from './ResourceIcon';
import ToolModal from './ResponseToolModal';

const ALERTS_ENDPOINT = '/api/prometheus/api/v1/rules?type=alert';
const QUERY_ENDPOINT = '/api/proxy/plugin/lightspeed-console-plugin/ols/v1/streaming_query';

// Sanity check on the YAML file size
const MAX_FILE_SIZE_KB = 500;

const INPUT_ELEMENT_ID = 'ols-plugin__prompt-input';
const SUBMIT_BUTTON_ELEMENT_CLASS = 'pf-chatbot__button--send';

const focusPromptInput = () => {
  // We use getElementById instead of a ref because of problems with getting the ref forwarded to
  // MessageBar's underlying textarea element
  (document.getElementById(INPUT_ELEMENT_ID) as HTMLTextAreaElement).focus();
};

const FilteredYAMLInfo = () => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  return (
    <Tooltip content={t('Kind, Metadata, and Status sections only')}>
      <span className="ols-plugin__inline-icon">
        <InfoCircleIcon />
      </span>
    </Tooltip>
  );
};

type PromptProps = {
  scrollIntoView: () => void;
};

const Prompt: React.FC<PromptProps> = ({ scrollIntoView }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');
  const dispatch = useDispatch();

  const attachments = useSelector((s: State) => s.plugins?.ols?.get('attachments'));
  const chatHistory = useSelector((s: State) => s.plugins?.ols?.get('chatHistory'));
  const conversationID: string = useSelector((s: State) => s.plugins?.ols?.get('conversationID'));
  const events = useSelector((s: State) => s.plugins?.ols?.get('contextEvents'));
  const isEventsLoading = useSelector((s: State) => s.plugins?.ols?.get('isContextEventsLoading'));
  const query: string = useSelector((s: State) => s.plugins?.ols?.get('query'));

  const [error, setError] = React.useState<string>();
  const [isEventsModalOpen, , openEventsModal, closeEventsModal] = useBoolean(false);
  const [isLogModalOpen, , openLogModal, closeLogModal] = useBoolean(false);
  const [isLoading, , setLoading, setLoaded] = useBoolean(false);
  const [isOpen, setIsOpen] = React.useState<boolean>(false);
  const [streamController, setStreamController] = React.useState(new AbortController());
  const [validated, setValidated] = React.useState<'default' | 'error'>('default');

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [kind, name, namespace] = useLocationContext();

  const k8sContext = useK8sWatchResource<K8sResourceKind>(
    kind && kind !== 'Alert' && name ? { isList: false, kind, name, namespace } : null,
  );
  const [context] = kind === 'Alert' && name ? [] : k8sContext;

  const isStreaming = !!chatHistory.last()?.get('isStreaming');

  // Focus the prompt input when the UI is first opened
  React.useEffect(() => {
    focusPromptInput();
  }, []);

  const handleFileUpload = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) {
        return;
      }
      if (file.size > MAX_FILE_SIZE_KB * 1024) {
        setError(
          t('Uploaded file is too large. Max size is {{max}} KB.', { max: MAX_FILE_SIZE_KB }),
        );
        return;
      }
      setError(undefined);

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const yaml = event.target?.result as string;
          const content = loadYAML(yaml);
          if (typeof content !== 'object') {
            setError(t('Uploaded file is not valid YAML'));
            return;
          }
          const fileName = content.metadata?.name;
          dispatch(
            attachmentSet(
              AttachmentTypes.YAML,
              content.kind || '?',
              fileName ? `${fileName} (${file.name})` : file.name,
              undefined,
              content.metadata?.namespace,
              yaml,
            ),
          );
        } catch {
          setError(t('Uploaded file is not valid YAML'));
        }
      };
      reader.readAsText(file);
    },
    [dispatch, setError, t],
  );

  const showEvents =
    !!context &&
    [
      'CronJob',
      'DaemonSet',
      'Deployment',
      'DeploymentConfig',
      'HorizontalPodAutoscaler',
      'Job',
      'kubevirt.io~v1~VirtualMachine',
      'kubevirt.io~v1~VirtualMachineInstance',
      'Pod',
      'PodDisruptionBudget',
      'ReplicaSet',
      'ReplicationController',
      'StatefulSet',
    ].includes(kind);

  const showLogs =
    !!context &&
    [
      'DaemonSet',
      'Deployment',
      'DeploymentConfig',
      'HorizontalPodAutoscaler',
      'Job',
      'kubevirt.io~v1~VirtualMachine',
      'kubevirt.io~v1~VirtualMachineInstance',
      'Pod',
      'PodDisruptionBudget',
      'ReplicaSet',
      'ReplicationController',
      'StatefulSet',
    ].includes(kind);

  const isResourceContext = !!context && !!kind && !!name;

  const attachMenuItems = React.useMemo(
    () => [
      <DropdownList key="menu-list">
        {isResourceContext && (
          <Title headingLevel="h5" key="currently-viewing-title">
            {t('Currently viewing')}
          </Title>
        )}
        {isResourceContext && (
          <div
            key="currently-viewing-label"
            style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}
          >
            <Label
              className="ols-plugin__context-label"
              textMaxWidth="10rem"
              title={t('{{kind}} {{name}} in namespace {{namespace}}', {
                kind,
                name,
                namespace,
              })}
            >
              <ResourceIcon kind={kind} /> {name}
            </Label>
          </div>
        )}
        {(isResourceContext || showEvents || showLogs) && (
          <Title headingLevel="h5" key="attach-title">
            {t('Attach')}
          </Title>
        )}
        {isResourceContext && (
          <DropdownItem
            icon={<FileCodeIcon />}
            id="yaml-full"
            key="yaml-full"
            value={AttachmentTypes.YAML}
          >
            {t('Full YAML file')} {isLoading && <Spinner size="md" />}
          </DropdownItem>
        )}
        {isResourceContext && (
          <DropdownItem
            icon={<FileCodeIcon />}
            id="yaml-filtered"
            key="yaml-filtered"
            value={AttachmentTypes.YAMLFiltered}
          >
            {t('Filtered YAML')} <FilteredYAMLInfo />
          </DropdownItem>
        )}
        {showEvents && (
          <DropdownItem
            icon={<TaskIcon />}
            id="events"
            isDisabled={!isEventsLoading && events.length === 0}
            key="events"
            value={AttachmentTypes.Events}
          >
            {t('Events')}
          </DropdownItem>
        )}
        {showLogs && (
          <DropdownItem icon={<TaskIcon />} id="logs" key="logs" value={AttachmentTypes.Log}>
            {t('Logs')}
          </DropdownItem>
        )}
        <DropdownItem icon={<FileUploadIcon />} key="upload" value={AttachmentTypes.YAMLUpload}>
          {t('Upload from computer')}
        </DropdownItem>
      </DropdownList>,
    ],
    [
      events.length,
      isEventsLoading,
      isLoading,
      isResourceContext,
      kind,
      name,
      namespace,
      showEvents,
      showLogs,
      t,
    ],
  );

  const onAttachMenuSelect = React.useCallback(
    (_ev: React.MouseEvent, attachmentType: string) => {
      setIsOpen(false);

      if (attachmentType === AttachmentTypes.Events) {
        openEventsModal();
      } else if (attachmentType === AttachmentTypes.Log) {
        openLogModal();
      } else if (attachmentType === AttachmentTypes.YAMLUpload) {
        // Trigger file upload
        fileInputRef.current?.click();
      } else if (kind === 'Alert') {
        setLoading();
        const labels = Object.fromEntries(new URLSearchParams(location.search));
        consoleFetchJSON(ALERTS_ENDPOINT, 'get', getRequestInitWithAuthHeader())
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
                const yaml = dumpYAML(alert, { lineWidth: -1 }).trim();
                dispatch(
                  attachmentSet(AttachmentTypes.YAML, kind, name, undefined, namespace, yaml),
                );
              } catch (e) {
                setError(t('Error converting to YAML: {{e}}', { e }));
              }
            } else {
              setError(t('Failed to find definition YAML for alert'));
            }
            setLoaded();
          })
          .catch((err) => {
            setError(t('Error fetching alerting rules: {{err}}', { err }));
            setLoaded();
          });
      } else if (
        context &&
        (attachmentType === AttachmentTypes.YAML || attachmentType === AttachmentTypes.YAMLFiltered)
      ) {
        const data = cloneDeep(
          attachmentType === AttachmentTypes.YAMLFiltered
            ? { kind: context.kind, metadata: context.metadata, status: context.status }
            : context,
        );
        // We ignore the managedFields section because it doesn't have much value
        delete data.metadata.managedFields;
        try {
          const yaml = dumpYAML(data, { lineWidth: -1 }).trim();
          dispatch(attachmentSet(attachmentType, kind, name, undefined, namespace, yaml));
        } catch (e) {
          setError(t('Error converting to YAML: {{e}}', { e }));
        }
      }
    },
    [
      context,
      dispatch,
      kind,
      name,
      namespace,
      openEventsModal,
      openLogModal,
      setIsOpen,
      setLoaded,
      setLoading,
      t,
    ],
  );

  const onChange = React.useCallback(
    (_e, value) => {
      if (value.trim().length > 0) {
        setValidated('default');
      }
      dispatch(setQuery(value));
    },
    [dispatch],
  );

  const onSubmit = React.useCallback(() => {
    if (isStreaming) {
      return;
    }

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
    const chatEntryID = uniqueId('ChatEntry_');
    dispatch(
      chatHistoryPush({
        id: chatEntryID,
        isCancelled: false,
        isStreaming: true,
        isTruncated: false,
        references: [],
        text: '',
        tools: ImmutableMap(),
        who: 'ai',
      }),
    );
    scrollIntoView();

    const requestJSON = {
      attachments: attachments.valueSeq().map(toOLSAttachment),
      // eslint-disable-next-line camelcase
      conversation_id: conversationID,
      // eslint-disable-next-line camelcase
      media_type: 'application/json',
      query,
    };

    const streamResponse = async () => {
      const controller = new AbortController();
      setStreamController(controller);
      const response = await consoleFetch(QUERY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestJSON),
        signal: controller.signal,
      });
      if (response.ok === false) {
        dispatch(
          chatHistoryUpdateByID(chatEntryID, {
            error: getFetchErrorMessage({ response }, t),
            isStreaming: false,
            isTruncated: false,
            who: 'ai',
          }),
        );
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let responseText = '';
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        const text = decoder.decode(value);
        text
          .split('\n')
          .filter((s) => s.startsWith('data: '))
          .forEach((s) => {
            const line = s.slice(5).trim();
            let json;
            try {
              json = JSON.parse(line);
            } catch (parseError) {
              // eslint-disable-next-line no-console
              console.error(`Failed to parse JSON string "${line}"`, parseError);
            }
            if (json && json.event && json.data) {
              if (json.event === 'start') {
                dispatch(setConversationID(json.data.conversation_id));
              } else if (json.event === 'token') {
                responseText += json.data.token;
                dispatch(chatHistoryUpdateByID(chatEntryID, { text: responseText }));
              } else if (json.event === 'end') {
                dispatch(
                  chatHistoryUpdateByID(chatEntryID, {
                    isStreaming: false,
                    isTruncated: json.data.truncated === true,
                    references: json.data.referenced_documents,
                  }),
                );
              } else if (json.event === 'tool_call') {
                const { args, id, name: toolName } = json.data;
                dispatch(chatHistoryUpdateTool(chatEntryID, id, { name: toolName, args }));
              } else if (json.event === 'tool_result') {
                const { content, id, status } = json.data;
                dispatch(chatHistoryUpdateTool(chatEntryID, id, { content, status }));
              } else if (json.event === 'error') {
                dispatch(
                  chatHistoryUpdateByID(chatEntryID, {
                    error: getFetchErrorMessage({ json: { detail: json.data } }, t),
                    isStreaming: false,
                  }),
                );
              } else {
                // eslint-disable-next-line no-console
                console.warn(`Unrecognized event in response stream:`, JSON.stringify(json));
              }
            }
          });
      }
    };
    streamResponse().catch((streamError) => {
      if (streamError.name !== 'AbortError') {
        dispatch(
          chatHistoryUpdateByID(chatEntryID, {
            error: getFetchErrorMessage(streamError, t),
            isStreaming: false,
            isTruncated: false,
            who: 'ai',
          }),
        );
      }
      scrollIntoView();
    });

    // Clear prompt input and return focus to it
    dispatch(setQuery(''));
    dispatch(attachmentsClear());
    focusPromptInput();
  }, [attachments, conversationID, dispatch, isStreaming, query, scrollIntoView, t]);

  const streamingResponseID: string = isStreaming
    ? (chatHistory.last()?.get('id') as string)
    : undefined;

  const onStreamCancel = React.useCallback(
    (e) => {
      e.preventDefault();
      if (streamingResponseID) {
        streamController.abort();
        dispatch(
          chatHistoryUpdateByID(streamingResponseID, {
            isCancelled: true,
            isStreaming: false,
          }),
        );
      }
    },
    [dispatch, streamController, streamingResponseID],
  );

  const onKeyPress = React.useCallback((e) => {
    // Enter key alone submits the prompt, Shift+Enter inserts a newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      (
        document.getElementsByClassName(SUBMIT_BUTTON_ELEMENT_CLASS)[0] as HTMLButtonElement
      )?.click();
    }
  }, []);

  // Prevent default keyboard submit event so we can handle it with onKeyPress
  const onKeyDown = React.useCallback(() => {}, []);

  return (
    <div>
      {/* @ts-expect-error: TS2786 */}
      <MessageBar
        alwayShowSendButton
        attachMenuProps={{
          attachMenuItems,
          isAttachMenuOpen: isOpen,
          onAttachMenuInputChange: () => {},
          onAttachMenuSelect,
          onAttachMenuToggleClick: () => setIsOpen(!isOpen),
          setIsAttachMenuOpen: setIsOpen,
        }}
        className="ols-plugin__prompt"
        handleStopButton={() => {
          onStreamCancel({ preventDefault: () => {} } as unknown as React.FormEvent);
        }}
        hasStopButton={isStreaming}
        id={INPUT_ELEMENT_ID}
        isSendButtonDisabled={!query || query.trim().length === 0}
        onChange={(e) => onChange(e, e.target.value)}
        onKeyDown={onKeyDown}
        onKeyPress={onKeyPress}
        onSendMessage={onSubmit}
        placeholder={t('Send a message...')}
        validated={validated}
        value={query}
      />
      <div className="ols-plugin__prompt-attachments">
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

      <AttachmentModal />
      <ToolModal />

      <input
        accept=".yaml,.yml"
        onChange={handleFileUpload}
        ref={fileInputRef}
        style={{ display: 'none' }}
        type="file"
      />

      {showEvents && context && context.metadata?.uid && (
        <AttachEventsModal
          isOpen={isEventsModalOpen}
          kind={context.kind}
          name={name}
          namespace={namespace}
          onClose={closeEventsModal}
          uid={context.metadata?.uid}
        />
      )}

      {showLogs && (
        <AttachLogModal isOpen={isLogModalOpen} onClose={closeLogModal} resource={context} />
      )}

      {error && (
        <Alert
          actionClose={<AlertActionCloseButton onClose={() => setError(undefined)} />}
          className="ols-plugin__alert"
          isInline
          title={t('Failed to attach')}
          variant="danger"
        >
          {error}
        </Alert>
      )}
    </div>
  );
};

export default Prompt;
