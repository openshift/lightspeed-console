import { K8sResourceKind } from '@openshift-console/dynamic-plugin-sdk';

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

const variantForCondition = (status?: string): StatusSummary['variant'] => {
  if (status === 'True') {
    return 'success';
  }
  if (status === 'False') {
    return 'danger';
  }
  return 'warning';
};

const getConditionStatus = (conditions: ResourceCondition[]): StatusSummary | null => {
  const priority = ['Ready', 'Available', 'Progressing', 'Degraded', 'Failure'];
  for (const type of priority) {
    const condition = conditions.find((entry) => entry.type === type);
    if (!condition) {
      continue;
    }
    const label = condition.reason || condition.type || type;
    if (type === 'Degraded' || type === 'Failure') {
      return {
        label,
        variant: condition.status === 'True' ? 'danger' : 'success',
      };
    }
    return {
      label,
      variant: variantForCondition(condition.status),
    };
  }

  const first = conditions[0];
  if (!first) {
    return null;
  }
  return {
    label: first.reason || first.type || 'Unknown',
    variant: variantForCondition(first.status),
  };
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
    case 'ReplicaSet': {
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
    }
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
    default: {
      const conditions = resource.status?.conditions;
      if (Array.isArray(conditions) && conditions.length > 0) {
        const fromConditions = getConditionStatus(conditions as ResourceCondition[]);
        if (fromConditions) {
          return fromConditions;
        }
      }

      const phase = resource.status?.phase;
      if (typeof phase === 'string') {
        if (phase === 'Running' || phase === 'Ready' || phase === 'Available') {
          return { label: phase, variant: 'success' };
        }
        if (phase === 'Pending') {
          return { label: phase, variant: 'warning' };
        }
        return { label: phase, variant: 'danger' };
      }

      return { label: 'Live', variant: 'info' };
    }
  }
};

export const getResourceStatusSummaryForRef = (
  modelKey: string,
  models: Record<string, K8sModelRef>,
  resource?: K8sResourceKind,
): StatusSummary => getResourceStatusSummary(getModelKindName(modelKey, models), resource);
