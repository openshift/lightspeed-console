import { StatusSummary } from './resourceStatus';

/**
 * StatusComponent maps `status` strings to icons in a switch statement; those case
 * values are not exported from @openshift-console/dynamic-plugin-sdk.
 * @see node_modules/@openshift-console/dynamic-plugin-sdk/lib/app/components/status/Status.js
 */

/** Built-in kinds with custom summary text that should stay as text badges. */
const TEXT_ONLY_BUILTIN_KINDS = new Set(['HorizontalPodAutoscaler']);

/** Container waiting/terminated reasons that StatusComponent renders with an icon. */
const CONTAINER_REASONS_WITH_ICON = new Set([
  'ContainerCannotRun',
  'ContainerCreating',
  'CrashLoopBackOff',
  'ErrImagePull',
  'Error',
  'ImagePullBackOff',
]);

export type LinkedResourceStatusDisplay =
  | { mode: 'icon'; status: string; title: string }
  | { mode: 'text' };

export type ConsoleStatusMapping = {
  status: string;
  useIcon: boolean;
};

export const usesConsoleStatusIcon = (kindName: string, modelKey: string): boolean => {
  if (modelKey.includes('~')) {
    return false;
  }
  return !TEXT_ONLY_BUILTIN_KINDS.has(kindName);
};

const mapReplicaLabel = (summary: StatusSummary): string => {
  if (summary.variant === 'success') {
    return 'Running';
  }
  if (summary.variant === 'warning') {
    return 'Warning';
  }
  return 'Failed';
};

const withIcon = (status: string): ConsoleStatusMapping => ({ status, useIcon: true });
const asText = (status: string): ConsoleStatusMapping => ({ status, useIcon: false });

export const toConsoleStatusKey = (
  summary: StatusSummary,
  kindName: string,
): ConsoleStatusMapping => {
  const { label, variant } = summary;

  if (label === 'NotReady') {
    return withIcon('Not Ready');
  }

  if (CONTAINER_REASONS_WITH_ICON.has(label)) {
    return withIcon(label);
  }

  if (label === 'LoadBalancer ready') {
    return withIcon('Ready');
  }

  if (label.endsWith(' ready')) {
    return withIcon(mapReplicaLabel(summary));
  }

  if (kindName === 'Job') {
    if (variant === 'danger') {
      return withIcon('Failed');
    }
    if (label === 'Complete' || variant === 'success') {
      return withIcon('Complete');
    }
  }

  if (kindName === 'CronJob') {
    if (label === 'Suspended') {
      return withIcon('Warning');
    }
    if (label.endsWith(' active')) {
      return withIcon('Running');
    }
    if (label === 'Scheduled') {
      return withIcon('Ready');
    }
    if (label === 'No runs yet') {
      return withIcon('Info');
    }
  }

  if (
    ['Running', 'Succeeded', 'Ready', 'Bound', 'Complete', 'Failed', 'Pending', 'Unknown'].includes(
      label,
    )
  ) {
    return withIcon(label);
  }

  // Unmapped condition/reason text — text badge (CRD phases, HPA reasons, etc.)
  if (kindName !== 'Job' && kindName !== 'CronJob') {
    return asText(label);
  }

  if (variant === 'success') {
    return withIcon('Ready');
  }
  if (variant === 'warning') {
    return withIcon('Warning');
  }
  if (variant === 'danger') {
    return withIcon('Failed');
  }

  return asText(label);
};

export const getLinkedResourceStatusDisplay = (
  summary: StatusSummary,
  kindName: string,
  modelKey: string,
): LinkedResourceStatusDisplay => {
  if (!usesConsoleStatusIcon(kindName, modelKey)) {
    return { mode: 'text' };
  }

  const mapped = toConsoleStatusKey(summary, kindName);
  if (!mapped.useIcon) {
    return { mode: 'text' };
  }

  return { mode: 'icon', status: mapped.status, title: summary.label };
};
