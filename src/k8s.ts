import { each } from 'lodash';
import { K8sResourceKind } from '@openshift-console/dynamic-plugin-sdk';

export const jobStatus = (job: K8sResourceKind): string => {
  if (!job || !job.status) {
    return '';
  }
  return job.status.conditions?.[0]?.type || 'In progress';
};

// Copied from https://github.com/openshift/console
export const podStatus = (pod: K8sResourceKind): string => {
  if (!pod || !pod.status) {
    return '';
  }

  if (pod.metadata.deletionTimestamp) {
    return 'Terminating';
  }

  if (pod.status.reason === 'NodeLost') {
    return 'Unknown';
  }

  if (pod.status.reason === 'Evicted') {
    return 'Evicted';
  }

  let initializing = false;
  let phase = pod.status.phase || pod.status.reason;

  each(pod.status.initContainerStatuses, (container, i: number) => {
    const { terminated, waiting } = container.state;
    if (terminated && terminated.exitCode === 0) {
      return true;
    }

    initializing = true;
    if (terminated && terminated.reason) {
      phase = `Init:${terminated.reason}`;
    } else if (terminated && !terminated.reason) {
      phase = terminated.signal
        ? `Init:Signal:${terminated.signal}`
        : `Init:ExitCode:${terminated.exitCode}`;
    } else if (waiting && waiting.reason && waiting.reason !== 'PodInitializing') {
      phase = `Init:${waiting.reason}`;
    } else {
      phase = `Init:${i}/${pod.status.initContainerStatuses.length}`;
    }
    return false;
  });

  if (!initializing) {
    let hasRunning = false;
    const containerStatuses = pod.status.containerStatuses || [];
    for (let i = containerStatuses.length - 1; i >= 0; i--) {
      const {
        state: { running, terminated, waiting },
        ready,
      } = containerStatuses[i];
      if (terminated && terminated.reason) {
        phase = terminated.reason;
      } else if (waiting && waiting.reason) {
        phase = waiting.reason;
      } else if (waiting && !waiting.reason) {
        phase = terminated.signal
          ? `Signal:${terminated.signal}`
          : `ExitCode:${terminated.exitCode}`;
      } else if (running && ready) {
        hasRunning = true;
      }
    }

    // Change pod status back to "Running" if there is at least one container still reporting as
    // "Running" status
    if (phase === 'Completed' && hasRunning) {
      phase = 'Running';
    }
  }

  return phase;
};
