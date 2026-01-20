import { List as ImmutableList, Map as ImmutableMap } from 'immutable';
import { dump as dumpYAML, load as loadYAML } from 'js-yaml';
import { cloneDeep, each, isEmpty, isMatch, omit, uniqueId } from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import {
  consoleFetch,
  consoleFetchJSON,
  K8sResourceKind,
  useK8sWatchResource,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  Button,
  Form,
  Icon,
  Label,
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
  Spinner,
  Split,
  SplitItem,
  TextArea,
  Title,
  Tooltip,
} from '@patternfly/react-core';
import {
  FileCodeIcon,
  FileUploadIcon,
  InfoCircleIcon,
  PaperPlaneIcon,
  PlusCircleIcon,
  StopIcon,
  TaskIcon,
} from '@patternfly/react-icons';

import { AttachmentTypes, toOLSAttachment } from '../attachments';
import { getApiUrl } from '../config';
import { getFetchErrorMessage } from '../error';
import { getRequestInitWithAuthHeader } from '../hooks/useAuth';
import { useBoolean } from '../hooks/useBoolean';
import { useLocationContext } from '../hooks/useLocationContext';
import {
  attachmentsClear,
  attachmentSet,
  chatHistoryPush,
  chatHistoryUpdateByID,
  chatHistoryUpdateTool,
  setConversationID,
  setQuery,
} from '../redux-actions';
import { State } from '../redux-reducers';
import AttachEventsModal from './AttachEventsModal';
import AttachLogModal from './AttachLogModal';
import ResourceIcon from './ResourceIcon';

const ALERTS_ENDPOINT = '/api/prometheus/api/v1/rules?type=alert';
const QUERY_ENDPOINT = getApiUrl('/v1/streaming_query');

// Sanity check on the upload file size
const MAX_FILE_SIZE_MB = 1;

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

type FileUploadSelectOptionProps = {
  setError: (error: string) => void;
};

const FileUploadSelectOption: React.FC<FileUploadSelectOptionProps> = ({ setError }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const dispatch = useDispatch();

  const fileInput = React.useRef(null);

  const onClick = () => {
    fileInput.current.click();
  };

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

  return (
    <SelectOption onClick={onClick} value={AttachmentTypes.YAMLUpload}>
      <FileUploadIcon /> {t('Upload from computer')}
      <input
        accept=".yaml,.yml"
        data-test="ols-plugin__file-upload"
        onChange={handleFileUpload}
        ref={fileInput}
        style={{ display: 'none' }}
        type="file"
      />
    </SelectOption>
  );
};

const AttachMenu: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const dispatch = useDispatch();

  const events = useSelector((s: State) => s.plugins?.ols?.get('contextEvents'));
  const isEventsLoading = useSelector((s: State) => s.plugins?.ols?.get('isContextEventsLoading'));

  const [error, setError] = React.useState<string>();
  const [isEventsModalOpen, , openEventsModal, closeEventsModal] = useBoolean(false);
  const [isLogModalOpen, , openLogModal, closeLogModal] = useBoolean(false);
  const [isLoading, , setLoading, setLoaded] = useBoolean(false);
  const [isOpen, toggleIsOpen, , closeMenu, setIsOpen] = useBoolean(false);

  const [kind, name, namespace] = useLocationContext();

  const k8sContext = useK8sWatchResource<K8sResourceKind>(
    kind && kind !== 'Alert' && name ? { isList: false, kind, name, namespace } : null,
  );

  const [context] = kind === 'Alert' && name ? [] : k8sContext;

  const onSelect = React.useCallback(
    (_ev: React.MouseEvent, attachmentType: string) => {
      if (attachmentType === AttachmentTypes.Events) {
        openEventsModal();
        closeMenu();
      } else if (attachmentType === AttachmentTypes.Log) {
        openLogModal();
        closeMenu();
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
                closeMenu();
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
              closeMenu();
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
          closeMenu();
        } catch (e) {
          setError(t('Error converting to YAML: {{e}}', { e }));
        }
      }
    },
    [
      closeMenu,
      context,
      dispatch,
      kind,
      name,
      namespace,
      openEventsModal,
      openLogModal,
      setLoaded,
      setLoading,
      t,
    ],
  );

  const toggle = React.useCallback(
    (toggleRef: React.Ref<MenuToggleElement>) => (
      <Tooltip content={t('Attach context')} style={isOpen ? { visibility: 'hidden' } : undefined}>
        <div>
          <MenuToggle
            className="ols-plugin__attach-menu"
            isExpanded={isOpen}
            onClick={toggleIsOpen}
            ref={toggleRef}
            variant="plain"
          >
            <Icon size="md">
              <PlusCircleIcon
                className={isOpen ? 'ols-plugin__context-menu-icon--active' : undefined}
              />
            </Icon>
          </MenuToggle>
        </div>
      </Tooltip>
    ),
    [isOpen, t, toggleIsOpen],
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

  const isResourceContext = !!context && !!kind && !!name;

  return (
    <>
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

      <Select isOpen={isOpen} onOpenChange={setIsOpen} onSelect={onSelect} toggle={toggle}>
        <SelectList className="ols-plugin__context-menu">
          <>
            {isResourceContext && (
              <>
                <Title className="ols-plugin__context-menu-heading" headingLevel="h5">
                  {t('Currently viewing')}
                </Title>
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
              </>
            )}

            <Title className="ols-plugin__context-menu-heading" headingLevel="h5">
              {t('Attach')}
            </Title>

            {kind === 'Alert' ? (
              <SelectOption value={AttachmentTypes.YAML}>
                <FileCodeIcon /> {t('Alert')} {isLoading && <Spinner size="md" />}
              </SelectOption>
            ) : kind === 'cluster.open-cluster-management.io~v1~ManagedCluster' ? (
              <SelectOption value={AttachmentTypes.YAML}>
                <TaskIcon /> {t('Attach cluster info')}
                {isLoading && <Spinner size="md" />}
              </SelectOption>
            ) : (
              <>
                {isResourceContext && (
                  <>
                    <SelectOption value={AttachmentTypes.YAML}>
                      <FileCodeIcon /> Full YAML file
                    </SelectOption>
                    <SelectOption value={AttachmentTypes.YAMLFiltered}>
                      <FileCodeIcon /> Filtered YAML <FilteredYAMLInfo />
                    </SelectOption>
                  </>
                )}
                {showEvents && (
                  <div title={!isEventsLoading && events.length === 0 ? t('No events') : undefined}>
                    <SelectOption
                      isDisabled={!isEventsLoading && events.length === 0}
                      value={AttachmentTypes.Events}
                    >
                      <TaskIcon /> {t('Events')}
                    </SelectOption>
                  </div>
                )}
                {showLogs && (
                  <SelectOption value={AttachmentTypes.Log}>
                    <TaskIcon /> {t('Logs')}
                  </SelectOption>
                )}
              </>
            )}
            <FileUploadSelectOption setError={setError} />
          </>

          {error && (
            <Alert
              className="ols-plugin__alert"
              isInline
              title={t('Failed to attach')}
              variant="danger"
            >
              {error}
            </Alert>
          )}
        </SelectList>
      </Select>
    </>
  );
};

type PromptProps = {
  scrollIntoView: (behavior?: string) => void;
};

const Prompt: React.FC<PromptProps> = ({ scrollIntoView }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const dispatch = useDispatch();

  const attachments = useSelector((s: State) => s.plugins?.ols?.get('attachments'));
  const chatHistory: ImmutableList<ImmutableMap<string, unknown>> = useSelector((s: State) =>
    s.plugins?.ols?.get('chatHistory'),
  );
  const conversationID: string = useSelector((s: State) => s.plugins?.ols?.get('conversationID'));
  const query: string = useSelector((s: State) => s.plugins?.ols?.get('query'));

  const [validated, setValidated] = React.useState<'default' | 'error'>('default');
  const [streamController, setStreamController] = React.useState(new AbortController());

  const promptRef = React.useRef(null);

  const onChange = React.useCallback(
    (_e, value) => {
      if (value.trim().length > 0) {
        setValidated('default');
      }
      dispatch(setQuery(value));
    },
    [dispatch],
  );

  const isStreaming = !!chatHistory.last()?.get('isStreaming');

  const onSubmit = React.useCallback(
    (e) => {
      e.preventDefault();

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

        // Use buffer because long strings (e.g. tool call output) may be split into multiple chunks
        let buffer = '';

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
      promptRef.current?.focus();
    },
    [attachments, conversationID, dispatch, isStreaming, query, scrollIntoView, t],
  );

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

  return (
    <Form onSubmit={isStreaming ? onStreamCancel : onSubmit}>
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
            {isStreaming ? <StopIcon /> : <PaperPlaneIcon />}
          </Button>
        </SplitItem>
      </Split>
    </Form>
  );
};

export default Prompt;
