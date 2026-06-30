import { K8sResourceKind } from '@openshift-console/dynamic-plugin-sdk';

export type LiveDetailField = {
  labelKey: string;
  value?: string;
};

type ContainerStatus = {
  ready?: boolean;
  restartCount?: number;
};

type LiveDetailExtractor = (resource?: K8sResourceKind) => LiveDetailField[];

const formatAge = (creationTimestamp?: string): string | undefined => {
  if (!creationTimestamp) {
    return undefined;
  }

  const createdMs = new Date(creationTimestamp).getTime();
  if (Number.isNaN(createdMs)) {
    return undefined;
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - createdMs) / 1000));
  if (elapsedSeconds < 60) {
    return `${elapsedSeconds}s`;
  }

  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d`;
};

const ageField = (resource?: K8sResourceKind): LiveDetailField => ({
  labelKey: 'Living detail age',
  value: formatAge(resource?.metadata?.creationTimestamp),
});

const podFields: LiveDetailExtractor = (resource) => {
  const containerStatuses = [
    ...((resource?.status?.containerStatuses as ContainerStatus[] | undefined) ?? []),
    ...((resource?.status?.initContainerStatuses as ContainerStatus[] | undefined) ?? []),
  ];
  const readyCount = containerStatuses.filter((container) => container.ready).length;
  const restartCount = containerStatuses.reduce(
    (total, container) => total + (container.restartCount ?? 0),
    0,
  );

  return [
    {
      labelKey: 'Living detail ready',
      value:
        containerStatuses.length > 0 ? `${readyCount}/${containerStatuses.length}` : undefined,
    },
    {
      labelKey: 'Living detail restarts',
      value: containerStatuses.length > 0 ? `${restartCount}` : undefined,
    },
    ageField(resource),
    { labelKey: 'Living detail IP', value: resource?.status?.podIP },
    { labelKey: 'Living detail node', value: resource?.spec?.nodeName },
  ];
};

const workloadFields: LiveDetailExtractor = (resource) => {
  const ready = resource?.status?.readyReplicas ?? resource?.status?.numberReady;
  const total = resource?.status?.replicas ?? resource?.status?.desiredNumberScheduled;
  const updated = resource?.status?.updatedReplicas;
  const available = resource?.status?.availableReplicas;

  return [
    ageField(resource),
    {
      labelKey: 'Living detail replicas',
      value:
        ready !== undefined && total !== undefined ? `${ready}/${total}` : undefined,
    },
    {
      labelKey: 'Living detail updated',
      value: updated !== undefined ? `${updated}` : undefined,
    },
    {
      labelKey: 'Living detail available',
      value: available !== undefined ? `${available}` : undefined,
    },
  ];
};

const nodeFields: LiveDetailExtractor = (resource) => {
  const addresses = resource?.status?.addresses as { type?: string; address?: string }[] | undefined;
  const internalIP = addresses?.find((entry) => entry.type === 'InternalIP')?.address;
  const roles = Object.keys(resource?.metadata?.labels ?? {})
    .filter((label) => label.startsWith('node-role.kubernetes.io/'))
    .map((label) => label.replace('node-role.kubernetes.io/', ''))
    .join(', ');

  return [
    ageField(resource),
    { labelKey: 'Living detail internal IP', value: internalIP },
    { labelKey: 'Living detail roles', value: roles || undefined },
    {
      labelKey: 'Living detail version',
      value: resource?.status?.nodeInfo?.kubeletVersion,
    },
  ];
};

const namespaceFields: LiveDetailExtractor = (resource) => [
  ageField(resource),
  { labelKey: 'Living detail phase', value: resource?.status?.phase },
];

const serviceFields: LiveDetailExtractor = (resource) => {
  const ports = (resource?.spec?.ports as { port?: number; protocol?: string }[] | undefined)
    ?.map((entry) => `${entry.port ?? ''}/${entry.protocol ?? 'TCP'}`.replace(/^\//, ''))
    .filter(Boolean)
    .join(', ');

  return [
    ageField(resource),
    { labelKey: 'Living detail type', value: resource?.spec?.type },
    { labelKey: 'Living detail cluster IP', value: resource?.spec?.clusterIP },
    { labelKey: 'Living detail ports', value: ports },
  ];
};

const routeFields: LiveDetailExtractor = (resource) => [
  ageField(resource),
  { labelKey: 'Living detail host', value: resource?.spec?.host },
  { labelKey: 'Living detail path', value: resource?.spec?.path },
  { labelKey: 'Living detail TLS', value: resource?.spec?.tls?.termination },
];

const keyValueDataFields: LiveDetailExtractor = (resource) => {
  const record = resource as { data?: Record<string, unknown>; binaryData?: Record<string, unknown> };
  const data = record?.data ?? record?.binaryData;
  const keyCount = data ? Object.keys(data).length : undefined;

  return [
    ageField(resource),
    {
      labelKey: 'Living detail data keys',
      value: keyCount !== undefined ? `${keyCount}` : undefined,
    },
  ];
};

const defaultFields: LiveDetailExtractor = (resource) => [ageField(resource)];

const LIVE_DETAIL_EXTRACTORS: Record<string, LiveDetailExtractor> = {
  Pod: podFields,
  Deployment: workloadFields,
  StatefulSet: workloadFields,
  DaemonSet: workloadFields,
  ReplicaSet: workloadFields,
  DeploymentConfig: workloadFields,
  Node: nodeFields,
  Namespace: namespaceFields,
  Service: serviceFields,
  Route: routeFields,
  ConfigMap: keyValueDataFields,
  Secret: keyValueDataFields,
};

export const getResourceLiveDetails = (
  kindName: string,
  resource?: K8sResourceKind,
): LiveDetailField[] => {
  const extract = LIVE_DETAIL_EXTRACTORS[kindName] ?? defaultFields;
  return extract(resource).filter((field) => field.value);
};
