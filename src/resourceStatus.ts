import { K8sResourceKind } from '@openshift-console/dynamic-plugin-sdk';

import { getGenericResourceStatus, variantForPhase } from './crStatus';
import { getModelKindName, K8sModelRef } from './pageContext';

export type StatusSummary = {
  label: string;
  variant: 'success' | 'warning' | 'danger' | 'info';
};

type ResourceCondition = {
  message?: string;
  reason?: string;
  status?: string;
  type?: string;
};

const statusFromPhase = (phase: string): StatusSummary => ({
  label: phase,
  variant: variantForPhase(phase),
});

const workloadReplicaStatus = (resource: K8sResourceKind): StatusSummary => {
  const ready = resource.status?.readyReplicas ?? resource.status?.numberReady ?? 0;
  const total =
    resource.status?.replicas ??
    resource.status?.desiredNumberScheduled ??
    resource.status?.replicas ??
    ready;
  const label = `${ready}/${total} ready`;
  if (ready === total && total > 0) {
    return { label, variant: 'success' };
  }
  if (ready > 0) {
    return { label, variant: 'warning' };
  }
  return { label, variant: 'danger' };
};

const jobStatus = (resource: K8sResourceKind): StatusSummary => {
  const conditions = resource.status?.conditions as ResourceCondition[] | undefined;
  const failed = resource.status?.failed ?? 0;
  const active = resource.status?.active ?? 0;

  if (failed > 0) {
    return { label: 'Failed', variant: 'danger' };
  }

  const failedCondition = conditions?.find(
    (condition) => condition.type === 'Failed' && condition.status === 'True',
  );
  if (failedCondition) {
    return { label: failedCondition.reason || 'Failed', variant: 'danger' };
  }

  const completeCondition = conditions?.find(
    (condition) => condition.type === 'Complete' && condition.status === 'True',
  );
  if (completeCondition) {
    return { label: completeCondition.reason || 'Complete', variant: 'success' };
  }

  if (active > 0) {
    return { label: 'Running', variant: 'info' };
  }

  return { label: 'Pending', variant: 'warning' };
};

const cronJobStatus = (resource: K8sResourceKind): StatusSummary => {
  if (resource.spec?.suspend) {
    return { label: 'Suspended', variant: 'warning' };
  }

  const active = (resource.status?.active as unknown[] | undefined)?.length ?? 0;
  if (active > 0) {
    return { label: `${active} active`, variant: 'info' };
  }

  if (resource.status?.lastSuccessfulTime) {
    return { label: 'Scheduled', variant: 'success' };
  }

  return { label: 'No runs yet', variant: 'info' };
};

const loadBalancerReady = (resource: K8sResourceKind): boolean => {
  const ingress = resource.status?.loadBalancer?.ingress as unknown[] | undefined;
  return (ingress?.length ?? 0) > 0;
};

const hpaStatus = (resource: K8sResourceKind): StatusSummary => {
  const conditions = resource.status?.conditions as ResourceCondition[] | undefined;
  const scalingLimited = conditions?.find(
    (condition) => condition.type === 'ScalingLimited' && condition.status === 'True',
  );
  if (scalingLimited) {
    return { label: scalingLimited.reason || 'ScalingLimited', variant: 'warning' };
  }

  const unableToScale = conditions?.find(
    (condition) => condition.type === 'AbleToScale' && condition.status === 'False',
  );
  if (unableToScale) {
    return { label: unableToScale.reason || 'Unable to scale', variant: 'danger' };
  }

  const current = resource.status?.currentReplicas;
  const desired = resource.status?.desiredReplicas;
  if (current !== undefined && desired !== undefined) {
    return {
      label: `${current}/${desired} replicas`,
      variant: current === desired ? 'success' : 'warning',
    };
  }

  return getGenericResourceStatus(resource);
};

export const getResourceStatusSummary = (
  kindName: string,
  resource?: K8sResourceKind,
): StatusSummary => {
  if (!resource) {
    return { label: '—', variant: 'info' };
  }

  switch (kindName) {
    case 'Pod': {
      const phase = resource.status?.phase ?? 'Unknown';
      if (phase === 'Running' || phase === 'Succeeded') {
        return { label: phase, variant: 'success' };
      }
      if (phase === 'Pending') {
        return { label: phase, variant: 'warning' };
      }
      return { label: phase, variant: 'danger' };
    }
    case 'Deployment':
    case 'StatefulSet':
    case 'DaemonSet':
    case 'ReplicaSet':
    case 'ReplicationController':
    case 'DeploymentConfig':
      return workloadReplicaStatus(resource);
    case 'Job':
      return jobStatus(resource);
    case 'CronJob':
      return cronJobStatus(resource);
    case 'PersistentVolumeClaim':
    case 'PersistentVolume': {
      const phase = resource.status?.phase;
      if (typeof phase === 'string') {
        return statusFromPhase(phase);
      }
      return getGenericResourceStatus(resource);
    }
    case 'Namespace': {
      const phase = resource.status?.phase ?? 'Active';
      return statusFromPhase(phase);
    }
    case 'Service': {
      const type = resource.spec?.type ?? 'ClusterIP';
      if (type === 'LoadBalancer') {
        return loadBalancerReady(resource)
          ? { label: 'LoadBalancer ready', variant: 'success' }
          : { label: 'Pending', variant: 'warning' };
      }
      if (type === 'ExternalName') {
        return { label: 'ExternalName', variant: 'info' };
      }
      return { label: type, variant: 'success' };
    }
    case 'Ingress':
      return loadBalancerReady(resource)
        ? { label: 'Ready', variant: 'success' }
        : { label: 'Pending', variant: 'warning' };
    case 'HorizontalPodAutoscaler':
      return hpaStatus(resource);
    case 'Node': {
      const readyCondition = resource.status?.conditions?.find(
        (condition: ResourceCondition) => condition.type === 'Ready',
      );
      const isReady = readyCondition?.status === 'True';
      return {
        label: isReady ? 'Ready' : 'NotReady',
        variant: isReady ? 'success' : 'danger',
      };
    }
    default:
      return getGenericResourceStatus(resource);
  }
};

export const getResourceStatusSummaryForRef = (
  modelKey: string,
  models: Record<string, K8sModelRef>,
  resource?: K8sResourceKind,
): StatusSummary => getResourceStatusSummary(getModelKindName(modelKey, models), resource);
