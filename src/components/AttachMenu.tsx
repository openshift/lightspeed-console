import { dump as dumpYAML, load as loadYAML } from 'js-yaml';
import { cloneDeep, each, isMatch } from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import {
  consoleFetchJSON,
  K8sResourceKind,
  useK8sWatchResource,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  Icon,
  Label,
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
  Spinner,
  Title,
  Tooltip,
} from '@patternfly/react-core';
import {
  FileCodeIcon,
  FileUploadIcon,
  InfoCircleIcon,
  PlusCircleIcon,
  TaskIcon,
} from '@patternfly/react-icons';

import { AttachmentTypes } from '../attachments';
import { getRequestInitWithAuthHeader } from '../hooks/useAuth';
import { useBoolean } from '../hooks/useBoolean';
import { useLocationContext } from '../hooks/useLocationContext';
import { attachmentSet } from '../redux-actions';
import { State } from '../redux-reducers';
import AttachEventsModal from './AttachEventsModal';
import AttachLogModal from './AttachLogModal';
import ResourceIcon from './ResourceIcon';

const ALERTS_ENDPOINT = '/api/prometheus/api/v1/rules?type=alert';

// Managed clusters have an additional info object that lives in a namespace whose name matches the cluster name
const fetchManagedClusterInfo = async (clusterName: string): Promise<K8sResourceKind> => {
  const endpoint = `/api/kubernetes/apis/internal.open-cluster-management.io/v1beta1/namespaces/${clusterName}/managedclusterinfos/${clusterName}`;
  const response = await consoleFetchJSON(endpoint, 'get', getRequestInitWithAuthHeader());
  return response;
};

// Sanity check on the YAML file size
const MAX_FILE_SIZE_KB = 500;

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

  const onChange = React.useCallback(
    (e) => {
      const file = e.target.files[0];
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
          const yaml = event.target.result as string;
          const content = loadYAML(yaml);
          if (typeof content !== 'object') {
            setError(t('Uploaded file is not valid YAML'));
            return;
          }
          const name = content.metadata?.name;
          dispatch(
            attachmentSet(
              AttachmentTypes.YAML,
              content.kind || '?',
              name ? `${name} (${file.name})` : file.name,
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
        onChange={onChange}
        ref={fileInput}
        style={{ display: 'none' }}
        type="file"
      />
    </SelectOption>
  );
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

const AttachMenu: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const dispatch = useDispatch();

  const events = useSelector((s: State) => s.plugins?.ols?.get('contextEvents'));
  const isEventsLoading = useSelector((s: State) => s.plugins?.ols?.get('isContextEventsLoading'));

  const [error, setError] = React.useState<string>();
  const [isEventsModalOpen, , openEventsModal, closeEventsModal] = useBoolean(false);
  const [isLogModalOpen, , openLogModal, closeLogModal] = useBoolean(false);
  const [isLoading, , setLoading, setLoaded] = useBoolean(false);
  const [isOpen, toggleIsOpen, , close, setIsOpen] = useBoolean(false);

  const [kind, name, namespace] = useLocationContext();

  const k8sContext = useK8sWatchResource<K8sResourceKind>(
    kind && kind !== 'Alert' && name ? { isList: false, kind, name, namespace } : null,
  );

  const [context] = kind === 'Alert' && name ? [] : k8sContext;

  const onSelect = React.useCallback(
    (_e: React.MouseEvent | undefined, attachmentType: string) => {
      if (attachmentType === AttachmentTypes.Events) {
        openEventsModal();
        close();
      } else if (attachmentType === AttachmentTypes.Log) {
        openLogModal();
        close();
      } else if (kind === 'Alert') {
        setLoading();
        const labels = Object.fromEntries(new URLSearchParams(location.search));
        consoleFetchJSON(ALERTS_ENDPOINT)
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
                close();
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
        if (context) {
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
              close();
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
          close();
        } catch (e) {
          setError(t('Error converting to YAML: {{e}}', { e }));
        }
      }
    },
    [
      close,
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

export default AttachMenu;
