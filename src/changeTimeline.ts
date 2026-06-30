import { K8sResourceKind } from '@openshift-console/dynamic-plugin-sdk';

import {
  buildResourceConsolePath,
  getModelKindName,
  K8sModelRef,
  ResourceRef,
} from './pageContext';
import {
  GenericCondition,
  isPhaseCondition,
  isStandardKubeCondition,
  variantForPhase,
} from './crStatus';
import { extractWatchableResourceRefs, isWatchableResource } from './livingResponse';
import { normalizeResourceRef } from './resourceRefs';
import { Tool } from './types';

export const DEFAULT_TIMELINE_WINDOW_MS = 2 * 60 * 60 * 1000;

const MAX_EVENT_TARGETS = 12;

const CHANGE_QUERY_PATTERN =
  /\b(what changed|what's changed|what has changed|recent changes|change timeline|history of changes|when did .+ change|what happened)\b/i;

const TROUBLESHOOTING_QUERY_PATTERN =
  /\b(fail(ing|ed|ure)?|crash(ing|ed)?|unhealthy|error|why\b|what went wrong|what happened)\b/i;

const TIMELINE_WORKLOAD_PRIORITY = [
  'Deployment',
  'DeploymentConfig',
  'StatefulSet',
  'DaemonSet',
  'ReplicaSet',
  'ReplicationController',
  'Job',
  'CronJob',
  'Pod',
];

export type TimelineEntryType = 'event' | 'rollout' | 'scale' | 'status';

export type TimelineSeverity = 'warning' | 'error' | 'normal' | 'info';

export type TimelineAnchor = ResourceRef;

export type ChangeTimelineEntry = {
  consolePath?: string;
  detail?: string;
  id: string;
  resourceRef?: ResourceRef;
  severity: TimelineSeverity;
  timestamp: Date;
  title: string;
  type: TimelineEntryType;
};

export type K8sEventLike = {
  eventTime?: string;
  firstTimestamp?: string;
  involvedObject?: {
    kind?: string;
    name?: string;
    namespace?: string;
  };
  lastTimestamp?: string;
  message?: string;
  metadata?: {
    creationTimestamp?: string;
    uid?: string;
  };
  reason?: string;
  type?: string;
};

export const isChangeTimelineQuery = (query?: string): boolean =>
  !!query && CHANGE_QUERY_PATTERN.test(query);

export const isTroubleshootingTimelineQuery = (query?: string): boolean =>
  !!query && TROUBLESHOOTING_QUERY_PATTERN.test(query);

export const hasEventsEvidence = (tools?: Record<string, Tool>): boolean =>
  Object.values(tools ?? {}).some(
    (tool) => tool.name === 'events_list' && tool.status !== 'error' && !tool.isDenied,
  );

export const shouldShowChangeTimeline = (
  query: string | undefined,
  tools: Record<string, Tool> | undefined,
  anchor: TimelineAnchor | null,
  models: Record<string, K8sModelRef>,
): boolean => {
  if (!anchor || !isTimelineEligibleAnchor(anchor, models)) {
    return false;
  }
  if (isChangeTimelineQuery(query)) {
    return true;
  }
  return isTroubleshootingTimelineQuery(query) && hasEventsEvidence(tools);
};

export const isTimelineEligibleAnchor = (
  ref: ResourceRef | undefined,
  models: Record<string, K8sModelRef>,
): ref is TimelineAnchor => !!ref && isWatchableResource(ref, models);

export const resolveTimelineAnchor = (
  pageKind: string | undefined,
  pageName: string | undefined,
  pageNamespace: string | undefined,
  tools: Record<string, Tool> | undefined,
  responseText: string | undefined,
  models: Record<string, K8sModelRef>,
): TimelineAnchor | null => {
  if (pageKind && pageName) {
    const pageRef = normalizeResourceRef(
      { kind: pageKind, name: pageName, namespace: pageNamespace },
      models,
    );
    if (pageRef && isTimelineEligibleAnchor(pageRef, models)) {
      return pageRef;
    }
  }

  const refs = extractWatchableResourceRefs(tools, responseText, models);
  const prioritized = TIMELINE_WORKLOAD_PRIORITY.flatMap((kindName) => {
    const modelKey = Object.keys(models).find((key) => models[key].kind === kindName);
    if (!modelKey) {
      return [];
    }
    return refs.filter((ref) => ref.kind === modelKey);
  });
  const fallback = refs.filter((ref) => !prioritized.includes(ref));
  const ordered = [...prioritized, ...fallback];

  const anchor = ordered.find((ref) => isTimelineEligibleAnchor(ref, models));
  return anchor
    ? { kind: anchor.kind, name: anchor.name, namespace: anchor.namespace }
    : null;
};

export const eventTimestamp = (event: K8sEventLike): Date | null => {
  const raw =
    event.lastTimestamp ??
    event.firstTimestamp ??
    event.eventTime ??
    event.metadata?.creationTimestamp;
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const eventSeverity = (event: K8sEventLike): TimelineSeverity => {
  if (event.type === 'Warning') {
    return 'warning';
  }
  if (event.type === 'Error') {
    return 'error';
  }
  if (event.reason === 'ScalingReplicaSet') {
    return 'info';
  }
  return 'normal';
};

export const eventEntryType = (event: K8sEventLike): TimelineEntryType => {
  if (event.reason === 'ScalingReplicaSet') {
    return 'scale';
  }
  return 'event';
};

export const formatEventTitle = (event: K8sEventLike): string => {
  const reason = event.reason?.trim();
  const involved = event.involvedObject;
  const objectLabel =
    involved?.kind && involved?.name ? `${involved.kind}/${involved.name}` : undefined;
  if (reason && objectLabel) {
    return `${reason} — ${objectLabel}`;
  }
  return reason || objectLabel || 'Cluster event';
};

export const eventToTimelineEntry = (
  event: K8sEventLike,
  models: Record<string, K8sModelRef>,
): ChangeTimelineEntry | null => {
  const timestamp = eventTimestamp(event);
  if (!timestamp) {
    return null;
  }

  const involved = event.involvedObject;
  const resourceRef =
    involved?.kind && involved?.name
      ? (normalizeResourceRef(
          {
            kind: involved.kind,
            name: involved.name,
            namespace: involved.namespace,
          },
          models,
        ) ?? undefined)
      : undefined;

  const consolePath = resourceRef
    ? (buildResourceConsolePath(resourceRef, models) ?? undefined)
    : undefined;

  return {
    consolePath,
    detail: event.message?.trim(),
    id: `event-${event.metadata?.uid ?? `${timestamp.getTime()}-${event.reason}-${involved?.name}`}`,
    resourceRef,
    severity: eventSeverity(event),
    timestamp,
    title: formatEventTitle(event),
    type: eventEntryType(event),
  };
};

const containerImageSummary = (resource?: K8sResourceKind): string | undefined => {
  const containers = resource?.spec?.template?.spec?.containers as { image?: string }[] | undefined;
  const image = containers?.[0]?.image;
  if (!image) {
    return undefined;
  }
  const tag = image.includes('@') ? image.split('@')[0] : image.split(':').pop();
  return tag ? `image ${tag}` : image;
};

export const replicaSetToTimelineEntry = (
  replicaSet: K8sResourceKind,
  models: Record<string, K8sModelRef>,
): ChangeTimelineEntry | null => {
  const name = replicaSet.metadata?.name;
  const namespace = replicaSet.metadata?.namespace;
  const created = replicaSet.metadata?.creationTimestamp;
  if (!name || !namespace || !created) {
    return null;
  }

  const timestamp = new Date(created);
  if (Number.isNaN(timestamp.getTime())) {
    return null;
  }

  const resourceRef = normalizeResourceRef({ kind: 'ReplicaSet', name, namespace }, models);
  if (!resourceRef) {
    return null;
  }

  const imageSummary = containerImageSummary(replicaSet);
  return {
    consolePath: buildResourceConsolePath(resourceRef, models) ?? undefined,
    detail: imageSummary,
    id: `rollout-${replicaSet.metadata?.uid ?? name}`,
    resourceRef,
    severity: 'info',
    timestamp,
    title: `New ReplicaSet ${name}`,
    type: 'rollout',
  };
};

export const mergeTimelineEntries = (
  entries: ChangeTimelineEntry[],
  windowMs: number = DEFAULT_TIMELINE_WINDOW_MS,
  nowMs: number = Date.now(),
): ChangeTimelineEntry[] => {
  const cutoff = nowMs - windowMs;
  const seen = new Set<string>();
  const merged: ChangeTimelineEntry[] = [];

  for (const entry of entries) {
    if (entry.timestamp.getTime() < cutoff) {
      continue;
    }
    if (seen.has(entry.id)) {
      continue;
    }
    seen.add(entry.id);
    merged.push(entry);
  }

  return merged.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

export const formatTimelineRelativeTime = (timestamp: Date, nowMs: number = Date.now()): string => {
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - timestamp.getTime()) / 1000));
  if (elapsedSeconds < 60) {
    return `${elapsedSeconds}s ago`;
  }
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const formatTimelineAnchorLabel = (
  anchor: TimelineAnchor,
  models: Record<string, K8sModelRef>,
): string => {
  const kindName = getModelKindName(anchor.kind, models);
  if (anchor.namespace) {
    return `${kindName}/${anchor.name} (${anchor.namespace})`;
  }
  return `${kindName}/${anchor.name}`;
};

export const buildEventFetchTargets = (
  anchor: TimelineAnchor,
  kindName: string | undefined,
  replicaSets: K8sResourceKind[] | undefined,
  pods: K8sResourceKind[] | undefined,
): { kind: string; name: string }[] => {
  const targets: { kind: string; name: string }[] = [];
  const seen = new Set<string>();

  const add = (kind: string, name?: string) => {
    if (!name) {
      return;
    }
    const key = `${kind}/${name}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    targets.push({ kind, name });
  };

  if (kindName) {
    add(kindName, anchor.name);
  }

  if (kindName === 'Deployment' || kindName === 'DeploymentConfig') {
    const sortedReplicaSets = [...(replicaSets ?? [])].sort((left, right) => {
      const leftTime = new Date(left.metadata?.creationTimestamp ?? 0).getTime();
      const rightTime = new Date(right.metadata?.creationTimestamp ?? 0).getTime();
      return rightTime - leftTime;
    });
    for (const replicaSet of sortedReplicaSets.slice(0, 5)) {
      add('ReplicaSet', replicaSet.metadata?.name);
    }

    const sortedPods = [...(pods ?? [])].sort((left, right) => {
      const leftTime = new Date(left.metadata?.creationTimestamp ?? 0).getTime();
      const rightTime = new Date(right.metadata?.creationTimestamp ?? 0).getTime();
      return rightTime - leftTime;
    });
    for (const pod of sortedPods.slice(0, 5)) {
      add('Pod', pod.metadata?.name);
    }
  } else if (kindName === 'Pod') {
    add('Pod', anchor.name);
  }

  return targets.slice(0, MAX_EVENT_TARGETS);
};

export const eventsListPath = (kind: string, name: string, namespace?: string): string => {
  const fieldSelector = `involvedObject.kind=${kind},involvedObject.name=${name}`;
  if (namespace) {
    return `/api/kubernetes/api/v1/namespaces/${namespace}/events?fieldSelector=${encodeURIComponent(fieldSelector)}`;
  }
  return `/api/kubernetes/api/v1/events?fieldSelector=${encodeURIComponent(fieldSelector)}`;
};

const conditionSeverity = (condition: GenericCondition): TimelineSeverity => {
  if (isStandardKubeCondition(condition)) {
    if (condition.type === 'Degraded' || condition.type === 'Failure') {
      return condition.status === 'True' ? 'error' : 'normal';
    }
    if (condition.status === 'False') {
      return 'warning';
    }
    return 'normal';
  }

  if (condition.phase) {
    const variant = variantForPhase(condition.phase, condition.reason);
    if (variant === 'danger') {
      return 'error';
    }
    if (variant === 'warning') {
      return 'warning';
    }
    return 'normal';
  }

  return 'info';
};

const formatConditionTitle = (condition: GenericCondition): string => {
  if (isStandardKubeCondition(condition)) {
    const reason = condition.reason || condition.type || 'Status changed';
    return condition.type ? `${condition.type}: ${reason}` : reason;
  }

  if (isPhaseCondition(condition)) {
    return condition.reason
      ? `${condition.phase}: ${condition.reason}`
      : (condition.phase ?? 'Status changed');
  }

  return condition.reason || condition.phase || 'Status changed';
};

export const statusConditionToTimelineEntry = (
  condition: GenericCondition,
  index: number,
  anchor: TimelineAnchor,
  models: Record<string, K8sModelRef>,
): ChangeTimelineEntry | null => {
  const raw = condition.lastTransitionTime;
  if (!raw) {
    return null;
  }

  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    return null;
  }

  const consolePath = buildResourceConsolePath(anchor, models) ?? undefined;

  return {
    consolePath,
    detail: condition.message?.trim(),
    id: `status-${timestamp.getTime()}-${condition.reason ?? condition.type ?? condition.phase ?? index}`,
    resourceRef: anchor,
    severity: conditionSeverity(condition),
    timestamp,
    title: formatConditionTitle(condition),
    type: 'status',
  };
};

export const resourceStatusToTimelineEntries = (
  resource: K8sResourceKind | undefined,
  anchor: TimelineAnchor,
  models: Record<string, K8sModelRef>,
): ChangeTimelineEntry[] => {
  const conditions = resource?.status?.conditions;
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return [];
  }

  return (conditions as GenericCondition[])
    .map((condition, index) => statusConditionToTimelineEntry(condition, index, anchor, models))
    .filter((entry): entry is ChangeTimelineEntry => entry !== null);
};
