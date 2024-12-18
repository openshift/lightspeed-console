import { dump } from 'js-yaml';
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
import { FileCodeIcon, InfoCircleIcon, PlusCircleIcon, TaskIcon } from '@patternfly/react-icons';

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

const FilteredYAMLInfo = () => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  return (
    <Tooltip content={t('Attach kind, metadata and status YAML')}>
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
      if (!kind || !name) {
        setError(t('Could not get context'));
        return;
      }

      if (attachmentType === AttachmentTypes.Events) {
        openEventsModal();
        close();
      } else if (attachmentType === AttachmentTypes.Log) {
        openLogModal();
        close();
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
                const yaml = dump(alert, { lineWidth: -1 }).trim();
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
        attachmentType === AttachmentTypes.YAML ||
        attachmentType === AttachmentTypes.YAMLStatus
      ) {
        const data = cloneDeep(
          attachmentType === AttachmentTypes.YAMLStatus
            ? { kind: context.kind, metadata: context.metadata, status: context.status }
            : context,
        );
        // We ignore the managedFields section because it doesn't have much value
        delete data.metadata.managedFields;
        try {
          const yaml = dump(data, { lineWidth: -1 }).trim();
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

  const isDisabled = !kind || !name;

  const toggle = React.useCallback(
    (toggleRef: React.Ref<MenuToggleElement>) => (
      <Tooltip
        content={
          isDisabled
            ? t('The current page your are viewing does not contain any supported context')
            : t('Attach context')
        }
        style={isOpen ? { visibility: 'hidden' } : undefined}
      >
        <div>
          <MenuToggle
            className="ols-plugin__attach-menu"
            isDisabled={isDisabled}
            isExpanded={isOpen && !isDisabled}
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
    [isDisabled, isOpen, t, toggleIsOpen],
  );

  const showEvents = [
    'CronJob',
    'DaemonSet',
    'Deployment',
    'HorizontalPodAutoscaler',
    'Job',
    'kubevirt.io~v1~VirtualMachine',
    'kubevirt.io~v1~VirtualMachineInstance',
    'Pod',
    'PodDisruptionBudget',
    'ReplicaSet',
    'StatefulSet',
  ].includes(kind);

  const showLogs = [
    'DaemonSet',
    'Deployment',
    'HorizontalPodAutoscaler',
    'Job',
    'kubevirt.io~v1~VirtualMachine',
    'kubevirt.io~v1~VirtualMachineInstance',
    'Pod',
    'PodDisruptionBudget',
    'ReplicaSet',
    'StatefulSet',
  ].includes(kind);

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
      {showLogs && context && (
        <AttachLogModal isOpen={isLogModalOpen} onClose={closeLogModal} resource={context} />
      )}

      <Select isOpen={isOpen} onOpenChange={setIsOpen} onSelect={onSelect} toggle={toggle}>
        <SelectList className="ols-plugin__context-menu">
          <>
            <Title className="ols-plugin__context-menu-heading" headingLevel="h5">
              {t('Currently viewing')}
            </Title>
            <Label
              className="ols-plugin__context-label"
              textMaxWidth="10rem"
              title={t('{{kind}} {{name}} in namespace {{namespace}}', { kind, name, namespace })}
            >
              <ResourceIcon kind={kind} /> {name}
            </Label>

            <Title className="ols-plugin__context-menu-heading" headingLevel="h5">
              {t('Attach')}
            </Title>

            {kind === 'Alert' ? (
              <SelectOption value={AttachmentTypes.YAML}>
                <FileCodeIcon /> {t('Alert')} {isLoading && <Spinner size="md" />}
              </SelectOption>
            ) : (
              <>
                <SelectOption value={AttachmentTypes.YAML}>
                  <FileCodeIcon /> YAML
                </SelectOption>
                <SelectOption value={AttachmentTypes.YAMLStatus}>
                  <FileCodeIcon /> YAML (filtered) <FilteredYAMLInfo />
                </SelectOption>
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
          </>

          {error && (
            <Alert
              className="ols-plugin__alert"
              isInline
              title={t('Failed to attach context')}
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
