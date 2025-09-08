import { debounce, isEmpty, throttle } from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import {
  consoleFetchText,
  K8sResourceKind,
  ResourceIcon,
  useK8sWatchResource,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  ActionGroup,
  Alert,
  Button,
  CodeBlock,
  CodeBlockAction,
  CodeBlockCode,
  Dropdown,
  DropdownItem,
  DropdownList,
  Form,
  FormGroup,
  MenuToggle,
  Radio,
  Slider,
  SliderOnChangeEvent,
  Spinner,
  Text,
} from '@patternfly/react-core';

import { AttachmentTypes } from '../attachments';
import { useBoolean } from '../hooks/useBoolean';
import { attachmentSet } from '../redux-actions';
import CopyAction from './CopyAction';
import Modal from './Modal';

const DEFAULT_LOG_LINES = 25;

type ContainerInputProps = {
  containers: string[];
  selectedContainer: string;
  setContainer: (string) => void;
};

const ContainerDropdown: React.FC<ContainerInputProps> = ({
  containers,
  selectedContainer,
  setContainer,
}) => {
  const [isOpen, toggleIsOpen, , close, setIsOpen] = useBoolean(false);

  const onSelect = React.useCallback(
    (_e: React.MouseEvent<Element, MouseEvent> | undefined, newValue: string) => {
      close();
      setContainer(newValue);
    },
    [close, setContainer],
  );

  return (
    <Dropdown
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      onSelect={onSelect}
      toggle={(toggleRef) => (
        <MenuToggle isExpanded={isOpen} onClick={toggleIsOpen} ref={toggleRef}>
          <ResourceIcon kind="Container" /> {selectedContainer}
        </MenuToggle>
      )}
    >
      <DropdownList>
        {containers.map((container) => (
          <DropdownItem key={container} value={container}>
            <ResourceIcon kind="Container" /> {container}
          </DropdownItem>
        ))}
      </DropdownList>
    </Dropdown>
  );
};

const ContainerRadios: React.FC<ContainerInputProps> = ({
  containers,
  selectedContainer,
  setContainer,
}) => (
  <>
    {containers.map((container) => (
      <Radio
        className="ols-plugin__radio"
        id={container}
        isChecked={container === selectedContainer}
        isLabelWrapped
        key={container}
        label={
          <>
            <ResourceIcon kind="Container" /> {container}
          </>
        }
        name="container"
        onChange={(_e: React.FormEvent<HTMLInputElement>, isChecked: boolean) => {
          if (isChecked) {
            setContainer(container);
          }
        }}
      />
    ))}
  </>
);

const ContainerInput: React.FC<ContainerInputProps> = ({
  containers,
  selectedContainer,
  setContainer,
}) =>
  containers.length < 6 ? (
    <ContainerRadios
      containers={containers}
      selectedContainer={selectedContainer}
      setContainer={setContainer}
    />
  ) : (
    <ContainerDropdown
      containers={containers}
      selectedContainer={selectedContainer}
      setContainer={setContainer}
    />
  );

type PodInputProps = {
  pods: K8sResourceKind[];
  selectedPod: K8sResourceKind;
  setPod: (K8sResourceKind) => void;
};

const PodDropdown: React.FC<PodInputProps> = ({ pods, selectedPod, setPod }) => {
  const [isOpen, toggleIsOpen, , close, setIsOpen] = useBoolean(false);

  const onSelect = React.useCallback(
    (_e: React.MouseEvent<Element, MouseEvent> | undefined, newPod: K8sResourceKind) => {
      close();
      setPod(newPod);
    },
    [close, setPod],
  );

  return (
    <Dropdown
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      onSelect={onSelect}
      toggle={(toggleRef) => (
        <MenuToggle isExpanded={isOpen} onClick={toggleIsOpen} ref={toggleRef}>
          <ResourceIcon kind="Pod" /> {selectedPod?.metadata?.name}
        </MenuToggle>
      )}
    >
      <DropdownList>
        {pods.map((pod) => (
          <DropdownItem key={pod.metadata?.uid} value={pod}>
            <ResourceIcon kind="Pod" /> {pod.metadata?.name}
          </DropdownItem>
        ))}
      </DropdownList>
    </Dropdown>
  );
};

const PodRadios: React.FC<PodInputProps> = ({ pods, selectedPod, setPod }) => (
  <>
    {pods.map((pod) => (
      <Radio
        className="ols-plugin__radio"
        id={pod.metadata?.uid}
        isChecked={pod.metadata?.uid === selectedPod?.metadata?.uid}
        isLabelWrapped
        key={pod.metadata?.uid}
        label={
          <>
            <ResourceIcon kind="Pod" /> {pod.metadata?.name}
          </>
        }
        name="pod"
        onChange={(_e: React.FormEvent<HTMLInputElement>, isChecked: boolean) => {
          if (isChecked) {
            setPod(pod);
          }
        }}
      />
    ))}
  </>
);

const PodInput: React.FC<PodInputProps> = ({ pods, selectedPod, setPod }) =>
  pods.length < 6 ? (
    <PodRadios pods={pods} selectedPod={selectedPod} setPod={setPod} />
  ) : (
    <PodDropdown pods={pods} selectedPod={selectedPod} setPod={setPod} />
  );

type ErrorProps = {
  children: React.ReactNode;
  title: React.ReactNode;
};

const Error: React.FC<ErrorProps> = ({ children, title }) => (
  <Alert className="ols-plugin__alert" isInline title={title} variant="danger">
    {children}
  </Alert>
);

type AttachLogModalProps = {
  isOpen: boolean;
  onClose: () => void;
  resource: K8sResourceKind;
};

const AttachLogModal: React.FC<AttachLogModalProps> = ({ isOpen, onClose, resource }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const dispatch = useDispatch();

  const isCronJob = resource.kind === 'CronJob';
  const isHPA = resource.kind === 'HorizontalPodAutoscaler';
  const kind = isHPA ? resource.spec?.scaleTargetRef?.kind : resource.kind;
  const name = isHPA ? resource.spec?.scaleTargetRef?.name : resource.metadata?.name;
  const namespace = resource.metadata?.namespace;

  const showPodInput = kind !== 'Pod';

  const [container, setContainer] = React.useState<string>(
    kind === 'Pod' ? resource.spec?.containers?.[0]?.name : undefined,
  );
  const [containers, setContainers] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string>();
  const [isLoading, setIsLoading] = React.useState(false);
  const [lines, setLines] = React.useState<number>(DEFAULT_LOG_LINES);
  const [pod, setPod] = React.useState<K8sResourceKind>();
  const [preview, setPreview] = React.useState<string>();
  const [previewError, setPreviewError] = React.useState<string>();
  const [isPreviewLoading, setIsPreviewLoading] = React.useState(false);

  const [scaleTarget, scaleTargetLoaded, scaleTargetError] = useK8sWatchResource<K8sResourceKind>(
    isHPA ? { isList: false, kind, name, namespace } : null,
  );

  // For CronJobs, find jobs owned by the CronJob then select pods with a matching "job-name" label
  const [jobs, jobsLoaded, jobsError] = useK8sWatchResource<K8sResourceKind[]>(
    isCronJob ? { isList: true, kind: 'Job', namespace } : null,
  );

  let selector;
  if (kind === 'Job') {
    selector = { 'job-name': name };
  } else if (isCronJob) {
    const ownedJobNames = (jobs || [])
      .filter((job) =>
        job.metadata?.ownerReferences?.find((owner) => owner.uid === resource?.metadata?.uid),
      )
      .map((job) => job.metadata?.name)
      .filter(Boolean);
    if (jobsLoaded && ownedJobNames.length > 0) {
      selector = { matchExpressions: [{ key: 'job-name', operator: 'In', values: ownedJobNames }] };
    } else if (jobsLoaded) {
      // No owned jobs found, so keep selector empty to yield zero pods
      selector = { matchLabels: { 'job-name': '__none__' } };
    } else {
      selector = undefined;
    }
  } else if (kind === 'VirtualMachine' || kind === 'VirtualMachineInstance') {
    selector = { 'vm.kubevirt.io/name': name };
  } else if (scaleTarget && scaleTargetLoaded && !scaleTargetError) {
    selector = scaleTarget.spec?.selector;
  } else {
    selector = resource.spec?.selector;
  }

  const [pods, podsLoaded, podsError] = useK8sWatchResource<K8sResourceKind[]>(
    showPodInput && selector !== undefined
      ? { isList: true, kind: 'Pod', namespace, selector }
      : null,
  );

  const changePod = (newPod: K8sResourceKind) => {
    if (newPod) {
      setPod(newPod);
      const newContainers = newPod.spec?.containers?.map((c) => c.name).sort() ?? [];
      setContainers(newContainers);
      setContainer(newContainers[0]);
    }
  };

  // Call onClose when the component is unmounted
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => onClose, []);

  // When the resource changes, reset the default pod (and container) options
  React.useEffect(() => {
    changePod(kind === 'Pod' ? resource : undefined);
  }, [kind, resource]);

  // When the pods are loaded, use the first pod as the default pod value
  React.useEffect(() => {
    changePod(podsLoaded && pods ? pods[0] : undefined);
  }, [pods, podsLoaded]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onLinesChange = React.useCallback(
    throttle((_e: SliderOnChangeEvent, value: number) => setLines(value), 50),
    [],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadPreview = React.useCallback(
    debounce((url: string) => {
      setIsPreviewLoading(true);
      setPreviewError(undefined);
      consoleFetchText(url)
        .then((response) => {
          if (isEmpty(response) || typeof response !== 'string') {
            setPreviewError(t('No logs found'));
          } else {
            setPreview(response);
          }
          setIsPreviewLoading(false);
        })
        .catch((err) => {
          setIsPreviewLoading(false);
          setPreviewError(err.message || t('Failed to fetch logs'));
        });
    }, 500),
    [],
  );

  React.useEffect(() => {
    const podName = pod?.metadata?.name;
    if (container && lines && namespace && podName) {
      loadPreview(
        `/api/kubernetes/api/v1/namespaces/${namespace}/pods/${podName}/log?container=${container}&tailLines=${lines}`,
      );
    }
  }, [container, loadPreview, lines, namespace, pod]);

  const onSubmit = React.useCallback(
    (e) => {
      e.preventDefault();

      const podName = pod?.metadata?.name;
      const url = `/api/kubernetes/api/v1/namespaces/${namespace}/pods/${podName}/log?container=${container}&tailLines=${lines}`;
      setIsLoading(true);
      setError(undefined);
      consoleFetchText(url)
        .then((response: string) => {
          setIsLoading(false);
          if (isEmpty(response) || typeof response !== 'string') {
            setError(t('Failed to fetch logs'));
          } else {
            dispatch(
              attachmentSet(
                AttachmentTypes.Log,
                'Container',
                container,
                podName,
                namespace,
                `Most recent lines from the log for Container '${container}', belonging to pod '${podName}':\n\n${response?.trim()}`,
              ),
            );
            onClose();
          }
        })
        .catch((err) => {
          setIsLoading(false);
          setError(err.message || t('Failed to fetch logs'));
        });
    },
    [container, dispatch, lines, namespace, onClose, pod, t],
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('Configure log attachment')}>
      <Text>
        {t(
          'You can select a container and specify the most recent number of lines of its log file to include as an attachment for detailed troubleshooting and analysis.',
        )}
      </Text>
      {scaleTargetError && (
        <Error title={t('Failed to load scale target')}>{scaleTargetError.message}</Error>
      )}
      <Form>
        {!scaleTargetError && (
          <>
            {showPodInput && (
              <FormGroup label="Pod">
                {podsError && <Error title={t('Failed to load pods')}>{podsError.message}</Error>}
                {jobsError && isCronJob && (
                  <Error title={t('Failed to load jobs')}>{jobsError.message}</Error>
                )}
                {podsLoaded && pods ? (
                  pods.length === 0 ? (
                    <Alert
                      className="ols-plugin__alert"
                      isInline
                      title={t('No pods found')}
                      variant="info"
                    >
                      {t('No pods found for {{kind}} {{name}}', { kind, name })}
                    </Alert>
                  ) : (
                    <PodInput pods={pods} selectedPod={pod} setPod={changePod} />
                  )
                ) : (
                  <Spinner isInline size="md" />
                )}
              </FormGroup>
            )}
            {(!showPodInput || (podsLoaded && pods && pods.length > 0)) && (
              <>
                <FormGroup label="Container">
                  <ContainerInput
                    containers={containers}
                    selectedContainer={container}
                    setContainer={setContainer}
                  />
                </FormGroup>
                <FormGroup label={t('Most recent {{lines}} lines', { lines })}>
                  <Slider max={100} min={1} onChange={onLinesChange} value={lines} />
                </FormGroup>
              </>
            )}
            {preview && (
              <CodeBlock
                actions={
                  <>
                    <CodeBlockAction />
                    <CodeBlockAction>
                      <CopyAction value={preview} />
                    </CodeBlockAction>
                  </>
                }
                className="ols-plugin__code-block ols-plugin__code-block--preview"
              >
                {isPreviewLoading && (
                  <CodeBlockCode className="ols-plugin__code-block-code">
                    <Spinner size="md" />
                  </CodeBlockCode>
                )}
                {!isPreviewLoading && !previewError && (
                  <CodeBlockCode
                    className="ols-plugin__code-block-code"
                    style={{ whiteSpace: 'pre' }}
                  >
                    {preview}
                  </CodeBlockCode>
                )}
              </CodeBlock>
            )}
            {previewError && <Error title={t('Failed to load logs')}>{previewError}</Error>}
          </>
        )}
        {error && <Error title={t('Failed to attach context')}>{error}</Error>}
        <ActionGroup>
          <Button
            isDisabled={!container || !!previewError}
            onClick={onSubmit}
            type="submit"
            variant="primary"
          >
            {t('Attach')}
          </Button>
          <Button onClick={onClose} type="submit" variant="link">
            {t('Cancel')}
          </Button>
        </ActionGroup>
        {isLoading && <Spinner size="md" />}
      </Form>
    </Modal>
  );
};

export default AttachLogModal;
