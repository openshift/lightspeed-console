import { K8sResourceKind } from '@openshift-console/dynamic-plugin-sdk';

import { StatusSummary } from './resourceStatus';

export type GenericCondition = {
  lastTransitionTime?: string;
  message?: string;
  phase?: string;
  reason?: string;
  status?: string;
  type?: string;
};

const SUCCESS_PHASES = new Set([
  'Active',
  'Available',
  'Bound',
  'Complete',
  'Completed',
  'Healthy',
  'Installed',
  'Online',
  'Ready',
  'Running',
  'Succeeded',
  'True',
]);

const WARNING_PHASES = new Set([
  'InstallReady',
  'Installing',
  'NeedsReinstall',
  'Pending',
  'Progressing',
  'Terminating',
  'Unknown',
  'Waiting',
]);

const DANGER_PHASES = new Set([
  'Degraded',
  'Error',
  'Expired',
  'Failed',
  'False',
  'Lost',
  'Released',
  'Unhealthy',
]);

const DANGER_REASONS = new Set([
  'ComponentUnhealthy',
  'RequirementsNotMet',
  'InstallComponentFailed',
  'Failed',
]);

export const variantForPhase = (phase: string, reason?: string): StatusSummary['variant'] => {
  if (SUCCESS_PHASES.has(phase)) {
    return 'success';
  }
  if (DANGER_PHASES.has(phase) || (reason && DANGER_REASONS.has(reason))) {
    return 'danger';
  }
  if (WARNING_PHASES.has(phase)) {
    return 'warning';
  }
  return 'info';
};

export const formatStatusLabel = (primary: string, secondary?: string): string => {
  if (!secondary || secondary === primary) {
    return primary;
  }
  return `${primary} (${secondary})`;
};

export const isStandardKubeCondition = (condition: GenericCondition): boolean =>
  typeof condition.type === 'string' && typeof condition.status === 'string';

export const isPhaseCondition = (condition: GenericCondition): boolean =>
  typeof condition.phase === 'string' && !condition.type;

const conditionTimestamp = (condition: GenericCondition): number => {
  const raw = condition.lastTransitionTime;
  if (!raw) {
    return 0;
  }
  const parsed = new Date(raw).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const pickLatestCondition = (
  conditions: GenericCondition[],
): GenericCondition | null => {
  if (conditions.length === 0) {
    return null;
  }

  return [...conditions].sort((left, right) => conditionTimestamp(right) - conditionTimestamp(left))[0];
};

export const getTopLevelStatus = (
  status?: K8sResourceKind['status'],
): { message?: string; phase?: string; reason?: string } => {
  if (!status || typeof status !== 'object') {
    return {};
  }

  const record = status as Record<string, unknown>;
  const phase = typeof record.phase === 'string' ? record.phase : undefined;
  const reason = typeof record.reason === 'string' ? record.reason : undefined;
  const message = typeof record.message === 'string' ? record.message : undefined;
  const state = typeof record.state === 'string' ? record.state : undefined;

  return {
    message,
    phase: phase ?? state,
    reason,
  };
};

const variantForStandardCondition = (status?: string): StatusSummary['variant'] => {
  if (status === 'True') {
    return 'success';
  }
  if (status === 'False') {
    return 'danger';
  }
  return 'warning';
};

const getStandardConditionStatus = (conditions: GenericCondition[]): StatusSummary | null => {
  const standard = conditions.filter(isStandardKubeCondition);
  if (standard.length === 0) {
    return null;
  }

  const priority = ['Ready', 'Available', 'Progressing', 'Degraded', 'Failure'];
  for (const type of priority) {
    const condition = standard.find((entry) => entry.type === type);
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
      variant: variantForStandardCondition(condition.status),
    };
  }

  const latest = pickLatestCondition(standard);
  if (!latest) {
    return null;
  }

  return {
    label: formatStatusLabel(latest.reason || latest.type || 'Unknown', latest.type),
    variant: variantForStandardCondition(latest.status),
  };
};

const getPhaseConditionStatus = (conditions: GenericCondition[]): StatusSummary | null => {
  const phaseConditions = conditions.filter(isPhaseCondition);
  if (phaseConditions.length === 0) {
    return null;
  }

  const latest = pickLatestCondition(phaseConditions);
  if (!latest?.phase) {
    return null;
  }

  return {
    label: formatStatusLabel(latest.phase, latest.reason),
    variant: variantForPhase(latest.phase, latest.reason),
  };
};

export const getGenericResourceStatus = (resource?: K8sResourceKind): StatusSummary => {
  if (!resource?.status) {
    return { label: '—', variant: 'info' };
  }

  const topLevel = getTopLevelStatus(resource.status);
  if (topLevel.phase) {
    return {
      label: formatStatusLabel(topLevel.phase, topLevel.reason),
      variant: variantForPhase(topLevel.phase, topLevel.reason),
    };
  }

  const conditions = resource.status.conditions;
  if (Array.isArray(conditions) && conditions.length > 0) {
    const typedConditions = conditions as GenericCondition[];
    const fromStandard = getStandardConditionStatus(typedConditions);
    if (fromStandard) {
      return fromStandard;
    }

    const fromPhase = getPhaseConditionStatus(typedConditions);
    if (fromPhase) {
      return fromPhase;
    }
  }

  return { label: 'Live', variant: 'info' };
};

export const truncateDetailMessage = (message: string, maxLength: number = 160): string =>
  message.length <= maxLength ? message : `${message.slice(0, maxLength - 1)}…`;
