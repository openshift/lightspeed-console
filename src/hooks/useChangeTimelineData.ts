import * as React from 'react';
import {
  consoleFetchJSON,
  K8sResourceKind,
  Selector,
  useK8sWatchResource,
} from '@openshift-console/dynamic-plugin-sdk';

import {
  buildEventFetchTargets,
  ChangeTimelineEntry,
  DEFAULT_TIMELINE_WINDOW_MS,
  eventToTimelineEntry,
  eventsListPath,
  isTimelineEligibleAnchor,
  K8sEventLike,
  mergeTimelineEntries,
  replicaSetToTimelineEntry,
  resourceStatusToTimelineEntries,
  TimelineAnchor,
} from '../changeTimeline';
import { getRequestInitWithAuthHeader } from '../hooks/useAuth';
import { getModelKindName, K8sModelRef } from '../pageContext';

type EventListResponse = {
  items?: K8sEventLike[];
};

const isDeploymentLike = (kindName?: string): boolean =>
  kindName === 'Deployment' || kindName === 'DeploymentConfig';

export const useChangeTimelineData = (
  anchor: TimelineAnchor | null,
  k8sModels: Record<string, K8sModelRef>,
  windowMs: number = DEFAULT_TIMELINE_WINDOW_MS,
): { entries: ChangeTimelineEntry[]; error?: string; loaded: boolean } => {
  const [entries, setEntries] = React.useState<ChangeTimelineEntry[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState<string>();

  const kindName = anchor ? getModelKindName(anchor.kind, k8sModels) : undefined;

  const [workload, workloadLoaded, workloadError] = useK8sWatchResource<K8sResourceKind>(
    anchor
      ? {
          isList: false,
          kind: anchor.kind,
          name: anchor.name,
          namespace: anchor.namespace,
        }
      : null,
  );

  const selector = React.useMemo((): Selector | undefined => {
    if (!isDeploymentLike(kindName)) {
      return undefined;
    }
    return workload?.spec?.selector;
  }, [kindName, workload?.spec?.selector]);

  const [replicaSets, replicaSetsLoaded, replicaSetsError] = useK8sWatchResource<K8sResourceKind[]>(
    anchor?.namespace && isDeploymentLike(kindName) && selector
      ? {
          isList: true,
          kind: 'ReplicaSet',
          namespace: anchor.namespace,
          selector,
        }
      : null,
  );

  const [pods, podsLoaded, podsError] = useK8sWatchResource<K8sResourceKind[]>(
    anchor?.namespace && selector
      ? {
          isList: true,
          kind: 'Pod',
          namespace: anchor.namespace,
          selector,
        }
      : null,
  );

  const listsReady =
    workloadLoaded &&
    (!isDeploymentLike(kindName) || (replicaSetsLoaded && podsLoaded));

  React.useEffect(() => {
    if (!anchor?.name || !isTimelineEligibleAnchor(anchor, k8sModels) || !listsReady) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoaded(false);
      setError(undefined);

      const targets = buildEventFetchTargets(anchor, kindName, replicaSets, pods);
      const eventResponses = await Promise.all(
        targets.map(async (target) => {
          const response = (await consoleFetchJSON(
            eventsListPath(target.kind, target.name, anchor.namespace),
            'get',
            getRequestInitWithAuthHeader(),
          )) as EventListResponse;
          return response.items ?? [];
        }),
      );

      const timelineEntries: ChangeTimelineEntry[] = [];
      eventResponses.flat().forEach((event) => {
        const entry = eventToTimelineEntry(event, k8sModels);
        if (entry) {
          timelineEntries.push(entry);
        }
      });

      if (isDeploymentLike(kindName)) {
        (replicaSets ?? []).forEach((replicaSet) => {
          const entry = replicaSetToTimelineEntry(replicaSet, k8sModels);
          if (entry) {
            timelineEntries.push(entry);
          }
        });
      }

      resourceStatusToTimelineEntries(workload, anchor, k8sModels).forEach((entry) => {
        timelineEntries.push(entry);
      });

      if (!cancelled) {
        setEntries(mergeTimelineEntries(timelineEntries, windowMs));
        setLoaded(true);
      }
    };

    load().catch((err: unknown) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : String(err));
        setLoaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    anchor,
    kindName,
    k8sModels,
    listsReady,
    pods,
    replicaSets,
    windowMs,
    workload,
  ]);

  React.useEffect(() => {
    if (workloadError || replicaSetsError || podsError) {
      setError(workloadError || replicaSetsError || podsError);
      setLoaded(true);
    }
  }, [podsError, replicaSetsError, workloadError]);

  return { entries, error, loaded };
};
