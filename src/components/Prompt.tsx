import { Map as ImmutableMap } from 'immutable';
import { dump as dumpYAML, load as loadYAML } from 'js-yaml';
import { cloneDeep, each, isEmpty, isMatch, omit, throttle, uniqueId } from 'lodash';
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
  Divider,
  DropdownItem,
  DropdownList,
  Label,
  Spinner,
  Title,
  Tooltip,
} from '@patternfly/react-core';
import {
  FileCodeIcon,
  FileUploadIcon,
  InfoCircleIcon,
  OutlinedQuestionCircleIcon,
  PlusIcon,
  TaskIcon,
  WrenchIcon,
} from '@patternfly/react-icons';

import { AttachmentTypes, toOLSAttachment } from '../attachments';
import { getApiUrl } from '../config';
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
  setAutoSubmit,
  setConversationID,
  setHidePrompt,
  setIsTroubleshooting,
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
const ALERTS_THANOS_ENDPOINT =
  '/api/proxy/plugin/monitoring-console-plugin/thanos-proxy/api/v1/rules?type=alert';
const QUERY_ENDPOINT = getApiUrl('/v1/streaming_query');

// Sanity check on the upload file size
const MAX_FILE_SIZE_MB = 1;

const WORKLOAD_KINDS = [
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
];

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

// Managed clusters have an additional info object that lives in a namespace whose name matches the cluster name
const fetchManagedClusterInfo = async (clusterName: string): Promise<K8sResourceKind> => {
  const endpoint = `/api/kubernetes/apis/internal.open-cluster-management.io/v1beta1/namespaces/${clusterName}/managedclusterinfos/${clusterName}`;
  const response = await consoleFetchJSON(endpoint, 'get', getRequestInitWithAuthHeader());
  return response;
};

type PromptProps = {
  scrollIntoView: () => void;
};

const Prompt: React.FC<PromptProps> = ({ scrollIntoView }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');
  const dispatch = useDispatch();

  const attachments = useSelector((s: State) => s.plugins?.ols?.get('attachments'));
  const autoSubmit: boolean = useSelector((s: State) => s.plugins?.ols?.get('autoSubmit'));
  const chatHistory = useSelector((s: State) => s.plugins?.ols?.get('chatHistory'));
  const conversationID: string = useSelector((s: State) => s.plugins?.ols?.get('conversationID'));
  const events = useSelector((s: State) => s.plugins?.ols?.get('contextEvents'));
  const hidePrompt: boolean = useSelector((s: State) => s.plugins?.ols?.get('hidePrompt'));
  const isEventsLoading = useSelector((s: State) => s.plugins?.ols?.get('isContextEventsLoading'));
  const isTroubleshooting: boolean = useSelector((s: State) =>
    s.plugins?.ols?.get('isTroubleshooting'),
  );
  const query: string = useSelector((s: State) => s.plugins?.ols?.get('query'));

  const [error, setError] = React.useState<string>();
  const [isEventsModalOpen, , openEventsModal, closeEventsModal] = useBoolean(false);
  const [isLogModalOpen, , openLogModal, closeLogModal] = useBoolean(false);
  const [isLoading, , setLoading, setLoaded] = useBoolean(false);
  const [isOpen, setIsOpen] = React.useState<boolean>(false);
  const [streamController, setStreamController] = React.useState(new AbortController());
  const [validated, setValidated] = React.useState<'default' | 'error'>('default');

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const [kind, name, namespace] = useLocationContext();

  const k8sContext = useK8sWatchResource<K8sResourceKind>(
    kind && kind !== 'Alert' && name ? { isList: false, kind, name, namespace } : null,
  );
  const [context] = kind === 'Alert' && name ? [] : k8sContext;

  const isStreaming = !!chatHistory.last()?.get('isStreaming');

  // Focus the prompt input when the UI is first opened
  React.useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleFileUpload = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) {
        return;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setError(
          t('Uploaded file is too large. Max size is {{max}} MB.', { max: MAX_FILE_SIZE_MB }),
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

  const showEvents = !isEmpty(context) && WORKLOAD_KINDS.includes(kind);
  const showLogs = !isEmpty(context) && WORKLOAD_KINDS.includes(kind);

  const isResourceContext = !isEmpty(context) && !!kind && !!name;

  const attachMenuItems = React.useMemo(
    () => [
      <DropdownList key="menu-list">
        {isResourceContext && (
          <>
            <Title headingLevel="h5" key="currently-viewing-title">
              {t('Currently viewing')}
            </Title>
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
          </>
        )}
        {(isResourceContext || showEvents || showLogs) && (
          <Title headingLevel="h5" key="attach-title">
            {t('Attach')}
          </Title>
        )}
        {isResourceContext &&
          (kind === 'cluster.open-cluster-management.io~v1~ManagedCluster' ? (
            <DropdownItem
              icon={<TaskIcon />}
              id="yaml-cluster"
              key="yaml-cluster"
              value={AttachmentTypes.YAML}
            >
              {t('Attach cluster info')} {isLoading && <Spinner size="md" />}
            </DropdownItem>
          ) : (
            <>
              <DropdownItem
                icon={<FileCodeIcon />}
                id="yaml-full"
                key="yaml-full"
                value={AttachmentTypes.YAML}
              >
                {t('Full YAML file')} {isLoading && <Spinner size="md" />}
              </DropdownItem>
              <DropdownItem
                icon={<FileCodeIcon />}
                id="yaml-filtered"
                key="yaml-filtered"
                value={AttachmentTypes.YAMLFiltered}
              >
                {t('Filtered YAML')} <FilteredYAMLInfo />
              </DropdownItem>
            </>
          ))}
        {kind === 'Alert' && (
          <DropdownItem
            icon={<FileCodeIcon />}
            id="alert-yaml"
            key="alert-yaml"
            value={AttachmentTypes.YAML}
          >
            {t('Alert')} {isLoading && <Spinner size="md" />}
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
        <Divider key="divider-1" />
        {isTroubleshooting ? (
          <DropdownItem
            description={t('Expert guidance and clear answers')}
            icon={<OutlinedQuestionCircleIcon />}
            id="ask"
            value="ask"
          >
            {t('Ask')}
          </DropdownItem>
        ) : (
          <DropdownItem
            description={t('Diagnosing issues and finding solutions')}
            icon={<WrenchIcon />}
            id="troubleshooting"
            value="troubleshooting"
          >
            {t('Troubleshooting')}
          </DropdownItem>
        )}
      </DropdownList>,
    ],
    [
      events.length,
      isEventsLoading,
      isLoading,
      isResourceContext,
      isTroubleshooting,
      kind,
      name,
      namespace,
      showEvents,
      showLogs,
      t,
    ],
  );

  const onAttachMenuSelect = React.useCallback(
    (_ev: React.MouseEvent, attachmentType: string | number) => {
      setIsOpen(false);

      if (attachmentType === 'ask') {
        // Delay update until menu fade out is complete
        requestAnimationFrame(() => {
          setTimeout(() => dispatch(setIsTroubleshooting(false)), 0);
        });
      } else if (attachmentType === 'troubleshooting') {
        // Delay update until menu fade out is complete
        requestAnimationFrame(() => {
          setTimeout(() => dispatch(setIsTroubleshooting(true)), 0);
        });
      } else if (attachmentType === AttachmentTypes.Events) {
        openEventsModal();
      } else if (attachmentType === AttachmentTypes.Log) {
        openLogModal();
      } else if (attachmentType === AttachmentTypes.YAMLUpload) {
        // Trigger file upload
        fileInputRef.current?.click();
      } else if (kind === 'Alert') {
        setLoading();
        const labels = Object.fromEntries(new URLSearchParams(location.search));
        const alertsEndpoint = labels.cluster ? ALERTS_THANOS_ENDPOINT : ALERTS_ENDPOINT;
        consoleFetchJSON(alertsEndpoint, 'get', getRequestInitWithAuthHeader())
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
                // Generate a unique ID for the alert
                const sortedLabels = Object.keys(alert.labels)
                  .sort()
                  .map((key) => `${key}=${alert.labels[key]}`)
                  .join(',');
                const alertId = `${AttachmentTypes.YAML}_${kind}_${sortedLabels}`;

                const yaml = dumpYAML(alert, { lineWidth: -1 }).trim();
                dispatch(
                  attachmentSet(
                    AttachmentTypes.YAML,
                    kind,
                    name,
                    undefined,
                    namespace,
                    yaml,
                    undefined,
                    alertId,
                  ),
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
        // Only show this attachment option when the object in play is a ManagedCluster
        kind === 'cluster.open-cluster-management.io~v1~ManagedCluster' &&
        attachmentType === AttachmentTypes.YAML
      ) {
        setLoading();

        // First attach the ManagedCluster object
        if (!isEmpty(context)) {
          const clusterData = cloneDeep(context);
          delete clusterData.metadata.managedFields;
          try {
            const clusterYaml = dumpYAML(clusterData, { lineWidth: -1 }).trim();
            dispatch(
              attachmentSet(AttachmentTypes.YAML, kind, name, undefined, namespace, clusterYaml),
            );
          } catch (e) {
            setError(t('Error converting ManagedCluster to YAML: {{e}}', { e }));
            setLoaded();
            return;
          }
        }

        // Then fetch and attach the ManagedClusterInfo object
        fetchManagedClusterInfo(name)
          .then((clusterInfo) => {
            const data = cloneDeep(clusterInfo);
            delete data.metadata.managedFields;
            try {
              const yaml = dumpYAML(data, { lineWidth: -1 }).trim();
              dispatch(
                attachmentSet(
                  AttachmentTypes.YAML,
                  'ManagedClusterInfo',
                  name,
                  undefined,
                  name,
                  yaml,
                ),
              );
            } catch (e) {
              setError(t('Error converting ManagedClusterInfo to YAML: {{e}}', { e }));
            }
            setLoaded();
          })
          .catch((err) => {
            setError(t('Error fetching cluster info: {{err}}', { err }));
            setLoaded();
          });
      } else if (
        !isEmpty(context) &&
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
    (_e: React.SyntheticEvent, value: string) => {
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
        hidden: hidePrompt,
        text: query,
        who: 'user',
      }),
    );

    // Reset hidePrompt after using it
    if (hidePrompt) {
      dispatch(setHidePrompt(false));
    }
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
      mode: isTroubleshooting ? 'troubleshooting' : 'ask',
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

      // Throttle response text updates to prevent excessive re-renders during streaming
      const dispatchTokens = throttle(
        () => dispatch(chatHistoryUpdateByID(chatEntryID, { text: responseText })),
        100,
        { leading: false, trailing: true },
      );

      // Use buffer because long strings (e.g. tool call output) may be split into multiple chunks
      let buffer = '';

      // OLS does not yet provide an ID to link approval_required to tool_call/tool_result, so for
      // now we use a combination of tool name + arguments, which should be equivalent in practice
      const toolKeyToID = new Map<string, string>();
      const makeToolKey = (toolName: string, args: unknown) =>
        `${toolName}:${JSON.stringify(args)}`;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Keep the last line in the buffer. If the chunk ended mid-line, this holds the incomplete
        // line until more data arrives. If the chunk ended with '\n', split() produces an empty
        // string as the last element, so we just hold an empty buffer and process all lines.
        buffer = lines.pop() ?? '';

        lines
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
                dispatchTokens();
              } else if (json.event === 'end') {
                dispatchTokens.flush();
                dispatch(
                  chatHistoryUpdateByID(chatEntryID, {
                    isStreaming: false,
                    isTruncated: json.data.truncated === true,
                    references: json.data.referenced_documents,
                  }),
                );
              } else if (json.event === 'tool_call') {
                const { args, id, name: toolName } = json.data;
                toolKeyToID.set(makeToolKey(toolName, args), id);
                dispatch(chatHistoryUpdateTool(chatEntryID, id, { args, name: toolName }));
              } else if (json.event === 'approval_required') {
                const {
                  approval_id: approvalID,
                  tool_args: args,
                  tool_description: description,
                  tool_name: toolName,
                } = json.data;
                const toolCallID = toolKeyToID.get(makeToolKey(toolName, args));
                if (toolCallID) {
                  dispatch(
                    chatHistoryUpdateTool(chatEntryID, toolCallID, {
                      approvalID,
                      args,
                      description,
                      isUserApproval: true,
                    }),
                  );
                }
              } else if (json.event === 'tool_result') {
                const {
                  content,
                  id,
                  status,
                  server_name: serverName,
                  structured_content: structuredContent,
                  tool_meta: toolMeta,
                } = json.data;
                const uiResourceUri = toolMeta?.ui?.resourceUri as string | undefined;
                const olsToolUiID = toolMeta?.olsUi?.id as string | undefined;
                dispatch(
                  chatHistoryUpdateTool(chatEntryID, id, {
                    content,
                    isUserApproval: false,
                    status,
                    ...(uiResourceUri && { uiResourceUri }),
                    ...(serverName && { serverName }),
                    ...(structuredContent && { structuredContent }),
                    ...(olsToolUiID && { olsToolUiID }),
                  }),
                );
              } else if (json.event === 'error') {
                dispatchTokens.flush();
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
    textareaRef.current?.focus();
  }, [
    attachments,
    conversationID,
    dispatch,
    hidePrompt,
    isStreaming,
    isTroubleshooting,
    query,
    scrollIntoView,
    t,
  ]);

  React.useEffect(() => {
    if (autoSubmit) {
      dispatch(setAutoSubmit(false));
      // Click send button so MessageBar handles both submission and clearing its internal state.
      // Just calling onSubmit would not clear MessageBar's internal state.
      textareaRef.current
        ?.closest('.pf-chatbot__message-bar')
        ?.querySelector<HTMLButtonElement>('.pf-chatbot__button--send')
        ?.click();
    }
  }, [autoSubmit, dispatch]);

  const streamingResponseID: string = isStreaming
    ? (chatHistory.last()?.get('id') as string)
    : undefined;

  const onStreamCancel = React.useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
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

  return (
    <div>
      {/* @ts-expect-error: TS2786 */}
      <MessageBar
        additionalActions={
          isTroubleshooting ? (
            <Label
              closeBtnAriaLabel={t('Remove Troubleshooting mode')}
              onClose={() => dispatch(setIsTroubleshooting(false))}
            >
              {t('Troubleshooting')}
            </Label>
          ) : (
            // TODO: Workaround for PatternFly bug that causes attach menu to move. Remove once
            // issue is addressed in PatternFly.
            <div></div>
          )
        }
        alwayShowSendButton
        attachButtonPosition="start"
        attachMenuProps={{
          attachMenuItems,
          isAttachMenuOpen: isOpen,
          onAttachMenuSelect,
          onAttachMenuToggleClick: () => setIsOpen(!isOpen),
          setIsAttachMenuOpen: setIsOpen,
        }}
        buttonProps={{
          attach: {
            icon: <PlusIcon />,
            tooltipContent: t('Message actions'),
            'aria-label': t('Message actions'),
          },
        }}
        className="ols-plugin__prompt"
        handleStopButton={() => onStreamCancel()}
        hasStopButton={isStreaming}
        innerRef={textareaRef}
        isSendButtonDisabled={!query || query.trim().length === 0}
        onChange={(e) => onChange(e, e.target.value)}
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

      <input
        accept=".yaml,.yml"
        data-test="ols-plugin__file-upload"
        onChange={handleFileUpload}
        ref={fileInputRef}
        style={{ display: 'none' }}
        type="file"
      />

      <AttachmentModal />
      <ToolModal />

      {showEvents && context.metadata?.uid && (
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
