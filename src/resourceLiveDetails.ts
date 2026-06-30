import { K8sResourceKind } from '@openshift-console/dynamic-plugin-sdk';

import { getTopLevelStatus, truncateDetailMessage } from './crStatus';

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

const formatOptionalCount = (value: number | undefined): string | undefined =>
  value === undefined ? undefined : `${value}`;

const formatSuspendFlag = (suspend: boolean | undefined): string | undefined => {
  if (suspend === true) {
    return 'true';
  }
  if (suspend === false) {
    return 'false';
  }
  return undefined;
};

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

const jobFields: LiveDetailExtractor = (resource) => {
  const completions = resource?.spec?.completions;
  const succeeded = resource?.status?.succeeded;
  const failed = resource?.status?.failed;
  const active = resource?.status?.active;

  return [
    ageField(resource),
    {
      labelKey: 'Living detail completions',
      value:
        succeeded !== undefined && completions !== undefined
          ? `${succeeded}/${completions}`
          : undefined,
    },
    {
      labelKey: 'Living detail succeeded',
      value: formatOptionalCount(succeeded),
    },
    {
      labelKey: 'Living detail failed',
      value: formatOptionalCount(failed),
    },
    {
      labelKey: 'Living detail active',
      value: formatOptionalCount(active),
    },
  ];
};

const cronJobFields: LiveDetailExtractor = (resource) => {
  const active = (resource?.status?.active as { name?: string }[] | undefined)?.length;

  return [
    ageField(resource),
    { labelKey: 'Living detail schedule', value: resource?.spec?.schedule },
    {
      labelKey: 'Living detail suspend',
      value: formatSuspendFlag(resource?.spec?.suspend),
    },
    {
      labelKey: 'Living detail last schedule',
      value: resource?.status?.lastScheduleTime,
    },
    {
      labelKey: 'Living detail active jobs',
      value: formatOptionalCount(active),
    },
  ];
};

const pvcFields: LiveDetailExtractor = (resource) => {
  const capacity = resource?.status?.capacity?.storage as string | undefined;

  return [
    ageField(resource),
    { labelKey: 'Living detail phase', value: resource?.status?.phase },
    { labelKey: 'Living detail capacity', value: capacity },
    {
      labelKey: 'Living detail storage class',
      value: resource?.spec?.storageClassName,
    },
    { labelKey: 'Living detail volume', value: resource?.spec?.volumeName },
  ];
};

const pvFields: LiveDetailExtractor = (resource) => {
  const capacity = resource?.spec?.capacity?.storage as string | undefined;
  const claim = resource?.spec?.claimRef as { namespace?: string; name?: string } | undefined;
  const claimRef =
    claim?.name && claim?.namespace ? `${claim.namespace}/${claim.name}` : claim?.name;

  return [
    ageField(resource),
    { labelKey: 'Living detail phase', value: resource?.status?.phase },
    { labelKey: 'Living detail capacity', value: capacity },
    { labelKey: 'Living detail storage class', value: resource?.spec?.storageClassName },
    { labelKey: 'Living detail claim', value: claimRef },
  ];
};

const hpaFields: LiveDetailExtractor = (resource) => [
  ageField(resource),
  {
    labelKey: 'Living detail current replicas',
    value: formatOptionalCount(resource?.status?.currentReplicas),
  },
  {
    labelKey: 'Living detail desired replicas',
    value: formatOptionalCount(resource?.status?.desiredReplicas),
  },
  {
    labelKey: 'Living detail min replicas',
    value: formatOptionalCount(resource?.spec?.minReplicas),
  },
  {
    labelKey: 'Living detail max replicas',
    value: formatOptionalCount(resource?.spec?.maxReplicas),
  },
];

const ingressFields: LiveDetailExtractor = (resource) => {
  const hosts = (resource?.spec?.rules as { host?: string }[] | undefined)
    ?.map((rule) => rule.host)
    .filter(Boolean)
    .join(', ');
  const loadBalancer = (
    resource?.status?.loadBalancer?.ingress as { hostname?: string; ip?: string }[] | undefined
  )
    ?.map((entry) => entry.hostname || entry.ip)
    .filter(Boolean)
    .join(', ');

  return [
    ageField(resource),
    { labelKey: 'Living detail hosts', value: hosts },
    { labelKey: 'Living detail ingress class', value: resource?.spec?.ingressClassName },
    { labelKey: 'Living detail load balancer', value: loadBalancer },
  ];
};

const genericStatusFields: LiveDetailExtractor = (resource) => {
  const topLevel = getTopLevelStatus(resource?.status);
  const fields: LiveDetailField[] = [ageField(resource)];

  if (topLevel.phase) {
    fields.push({ labelKey: 'Living detail phase', value: topLevel.phase });
  }
  if (topLevel.reason) {
    fields.push({ labelKey: 'Living detail reason', value: topLevel.reason });
  }
  if (topLevel.message) {
    fields.push({
      labelKey: 'Living detail message',
      value: truncateDetailMessage(topLevel.message),
    });
  }

  return fields;
};

const defaultFields: LiveDetailExtractor = genericStatusFields;

const LIVE_DETAIL_EXTRACTORS: Record<string, LiveDetailExtractor> = {
  Pod: podFields,
  Deployment: workloadFields,
  StatefulSet: workloadFields,
  DaemonSet: workloadFields,
  ReplicaSet: workloadFields,
  ReplicationController: workloadFields,
  DeploymentConfig: workloadFields,
  Job: jobFields,
  CronJob: cronJobFields,
  PersistentVolumeClaim: pvcFields,
  PersistentVolume: pvFields,
  HorizontalPodAutoscaler: hpaFields,
  Ingress: ingressFields,
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
