import { describe, it } from 'node:test';
import { strictEqual } from 'node:assert';

import { getResourceStatusSummary } from '../src/resourceStatus';

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
      status: { failed: 1, conditions: [{ type: 'Failed', status: 'True', reason: 'BackoffLimitExceeded' }] },
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
});
