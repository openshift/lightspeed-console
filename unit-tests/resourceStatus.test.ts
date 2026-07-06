import { describe, it } from 'node:test';
import { strictEqual } from 'node:assert';

import { getResourceStatusSummary, isInformativeStatusLabel } from '../src/resourceStatus';

describe('getResourceStatusSummary', () => {
  it('uses Ready condition for operator CRDs', () => {
    const summary = getResourceStatusSummary('FlowCollector', {
      status: {
        conditions: [{ type: 'Ready', status: 'True', reason: 'Ready' }],
      },
    });
    strictEqual(summary.label, 'Ready');
    strictEqual(summary.variant, 'success');
  });

  it('surfaces Degraded conditions as danger', () => {
    const summary = getResourceStatusSummary('FlowCollector', {
      status: {
        conditions: [{ type: 'Degraded', status: 'True', reason: 'LokiNotReady' }],
      },
    });
    strictEqual(summary.label, 'LokiNotReady');
    strictEqual(summary.variant, 'danger');
  });

  it('uses CSV top-level phase instead of the first condition reason', () => {
    const summary = getResourceStatusSummary('ClusterServiceVersion', {
      status: {
        phase: 'Succeeded',
        reason: 'InstallSucceeded',
        conditions: [
          { phase: 'Pending', reason: 'RequirementsUnknown' },
          { phase: 'Succeeded', reason: 'InstallSucceeded' },
        ],
      },
    });
    strictEqual(summary.label, 'Succeeded (InstallSucceeded)');
    strictEqual(summary.variant, 'success');
  });

  it('reports CrashLoopBackOff from container state when phase is Running', () => {
    const summary = getResourceStatusSummary('Pod', {
      status: {
        phase: 'Running',
        containerStatuses: [
          {
            ready: false,
            state: { waiting: { reason: 'CrashLoopBackOff' } },
          },
        ],
      },
    });
    strictEqual(summary.label, 'CrashLoopBackOff');
    strictEqual(summary.variant, 'danger');
  });

  it('reports ImagePullBackOff from container waiting state', () => {
    const summary = getResourceStatusSummary('Pod', {
      status: {
        phase: 'Pending',
        containerStatuses: [
          {
            ready: false,
            state: { waiting: { reason: 'ImagePullBackOff' } },
          },
        ],
      },
    });
    strictEqual(summary.label, 'ImagePullBackOff');
    strictEqual(summary.variant, 'danger');
  });

  it('reports ContainerCreating instead of Pending phase', () => {
    const summary = getResourceStatusSummary('Pod', {
      status: {
        phase: 'Pending',
        containerStatuses: [
          {
            ready: false,
            state: { waiting: { reason: 'ContainerCreating' } },
          },
        ],
      },
    });
    strictEqual(summary.label, 'ContainerCreating');
    strictEqual(summary.variant, 'warning');
  });

  it('reports healthy Running pods from phase when containers are ready', () => {
    const summary = getResourceStatusSummary('Pod', {
      status: {
        phase: 'Running',
        containerStatuses: [{ ready: true, state: { running: {} } }],
      },
    });
    strictEqual(summary.label, 'Running');
    strictEqual(summary.variant, 'success');
  });

  it('reports Failed phase for failed pods', () => {
    const summary = getResourceStatusSummary('Pod', {
      status: { phase: 'Failed' },
    });
    strictEqual(summary.label, 'Failed');
    strictEqual(summary.variant, 'danger');
  });

  it('reports completed jobs from conditions', () => {
    const summary = getResourceStatusSummary('Job', {
      status: {
        succeeded: 1,
        conditions: [{ type: 'Complete', status: 'True', reason: 'Complete' }],
      },
    });
    strictEqual(summary.label, 'Complete');
    strictEqual(summary.variant, 'success');
  });

  it('reports failed jobs', () => {
    const summary = getResourceStatusSummary('Job', {
      status: {
        failed: 1,
        conditions: [{ type: 'Failed', status: 'True', reason: 'BackoffLimitExceeded' }],
      },
    });
    strictEqual(summary.label, 'Failed');
    strictEqual(summary.variant, 'danger');
  });

  it('reports suspended cronjobs', () => {
    const summary = getResourceStatusSummary('CronJob', {
      spec: { suspend: true },
      status: {},
    });
    strictEqual(summary.label, 'Suspended');
    strictEqual(summary.variant, 'warning');
  });

  it('reports PVC phase', () => {
    const summary = getResourceStatusSummary('PersistentVolumeClaim', {
      status: { phase: 'Bound' },
    });
    strictEqual(summary.label, 'Bound');
    strictEqual(summary.variant, 'success');
  });

  it('reports namespace phase', () => {
    const summary = getResourceStatusSummary('Namespace', {
      status: { phase: 'Terminating' },
    });
    strictEqual(summary.label, 'Terminating');
    strictEqual(summary.variant, 'warning');
  });

  it('reports pending load balancer services', () => {
    const summary = getResourceStatusSummary('Service', {
      spec: { type: 'LoadBalancer' },
      status: { loadBalancer: {} },
    });
    strictEqual(summary.label, 'Pending');
    strictEqual(summary.variant, 'warning');
  });

  it('returns em dash for ClusterIP services (type is not status)', () => {
    const summary = getResourceStatusSummary('Service', {
      spec: { type: 'ClusterIP' },
    });
    strictEqual(summary.label, '—');
    strictEqual(isInformativeStatusLabel(summary.label), false);
  });

  it('reports HPA replica counts', () => {
    const summary = getResourceStatusSummary('HorizontalPodAutoscaler', {
      status: { currentReplicas: 2, desiredReplicas: 3 },
    });
    strictEqual(summary.label, '2/3 replicas');
    strictEqual(summary.variant, 'warning');
  });

  it('reports ingress readiness from load balancer status', () => {
    const summary = getResourceStatusSummary('Ingress', {
      status: { loadBalancer: { ingress: [{ ip: '10.0.0.1' }] } },
    });
    strictEqual(summary.label, 'Ready');
    strictEqual(summary.variant, 'success');
  });

  it('returns em dash for status-less resources like ConfigMap', () => {
    const summary = getResourceStatusSummary('ConfigMap', {
      metadata: { name: 'app-config' },
    });
    strictEqual(summary.label, '—');
    strictEqual(isInformativeStatusLabel(summary.label), false);
  });
});

describe('isInformativeStatusLabel', () => {
  it('rejects empty and placeholder labels', () => {
    strictEqual(isInformativeStatusLabel(''), false);
    strictEqual(isInformativeStatusLabel('   '), false);
    strictEqual(isInformativeStatusLabel('-'), false);
    strictEqual(isInformativeStatusLabel('—'), false);
  });

  it('accepts real status text', () => {
    strictEqual(isInformativeStatusLabel('Running'), true);
    strictEqual(isInformativeStatusLabel('2/3 ready'), true);
  });
});
