import { describe, it } from 'node:test';
import { strictEqual } from 'node:assert';

import { getResourceLiveDetails } from '../src/resourceLiveDetails';

const fieldValue = (fields: ReturnType<typeof getResourceLiveDetails>, labelKey: string) =>
  fields.find((field) => field.labelKey === labelKey)?.value;

describe('getResourceLiveDetails', () => {
  it('extracts pod fields', () => {
    const created = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const fields = getResourceLiveDetails('Pod', {
      metadata: { creationTimestamp: created },
      spec: { nodeName: 'worker-1' },
      status: {
        containerStatuses: [{ ready: true, restartCount: 2 }],
        podIP: '10.129.0.22',
        phase: 'Running',
      },
    });

    strictEqual(fieldValue(fields, 'Living detail ready'), '1/1');
    strictEqual(fieldValue(fields, 'Living detail restarts'), '2');
    strictEqual(fieldValue(fields, 'Living detail IP'), '10.129.0.22');
    strictEqual(fieldValue(fields, 'Living detail node'), 'worker-1');
    strictEqual(fieldValue(fields, 'Living detail age'), '5m');
  });

  it('extracts deployment replica fields', () => {
    const fields = getResourceLiveDetails('Deployment', {
      metadata: { creationTimestamp: new Date().toISOString() },
      status: {
        readyReplicas: 2,
        replicas: 3,
        updatedReplicas: 2,
        availableReplicas: 2,
      },
    });

    strictEqual(fieldValue(fields, 'Living detail replicas'), '2/3');
    strictEqual(fieldValue(fields, 'Living detail updated'), '2');
    strictEqual(fieldValue(fields, 'Living detail available'), '2');
  });

  it('extracts node networking and role fields', () => {
    const fields = getResourceLiveDetails('Node', {
      metadata: {
        labels: {
          'node-role.kubernetes.io/worker': '',
        },
      },
      status: {
        addresses: [{ type: 'InternalIP', address: '10.0.0.5' }],
        nodeInfo: { kubeletVersion: 'v1.30.0' },
      },
    });

    strictEqual(fieldValue(fields, 'Living detail internal IP'), '10.0.0.5');
    strictEqual(fieldValue(fields, 'Living detail roles'), 'worker');
    strictEqual(fieldValue(fields, 'Living detail version'), 'v1.30.0');
  });

  it('extracts route host and tls fields', () => {
    const fields = getResourceLiveDetails('Route', {
      metadata: { creationTimestamp: new Date().toISOString() },
      spec: {
        host: 'payments.example.com',
        path: '/api',
        tls: { termination: 'edge' },
      },
    });

    strictEqual(fieldValue(fields, 'Living detail host'), 'payments.example.com');
    strictEqual(fieldValue(fields, 'Living detail path'), '/api');
    strictEqual(fieldValue(fields, 'Living detail TLS'), 'edge');
  });

  it('falls back to age for unknown kinds', () => {
    const fields = getResourceLiveDetails('CustomResource', {
      metadata: { creationTimestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
    });

    strictEqual(fields.length, 1);
    strictEqual(fields[0].labelKey, 'Living detail age');
    strictEqual(fields[0].value, '2h');
  });

  it('extracts generic status fields for custom resources', () => {
    const fields = getResourceLiveDetails('ClusterServiceVersion', {
      metadata: { creationTimestamp: new Date().toISOString() },
      status: {
        phase: 'Installing',
        reason: 'InstallWaiting',
        message: 'waiting for install components to report healthy',
      },
    });

    strictEqual(fieldValue(fields, 'Living detail phase'), 'Installing');
    strictEqual(fieldValue(fields, 'Living detail reason'), 'InstallWaiting');
    strictEqual(fieldValue(fields, 'Living detail message'), 'waiting for install components to report healthy');
  });

  it('extracts job completion fields', () => {
    const fields = getResourceLiveDetails('Job', {
      metadata: { creationTimestamp: new Date().toISOString() },
      spec: { completions: 1 },
      status: { succeeded: 1, failed: 0, active: 0 },
    });

    strictEqual(fieldValue(fields, 'Living detail completions'), '1/1');
    strictEqual(fieldValue(fields, 'Living detail succeeded'), '1');
  });

  it('extracts PVC storage fields', () => {
    const fields = getResourceLiveDetails('PersistentVolumeClaim', {
      metadata: { creationTimestamp: new Date().toISOString() },
      spec: { storageClassName: 'gp3', volumeName: 'pvc-123' },
      status: { phase: 'Bound', capacity: { storage: '10Gi' } },
    });

    strictEqual(fieldValue(fields, 'Living detail phase'), 'Bound');
    strictEqual(fieldValue(fields, 'Living detail capacity'), '10Gi');
    strictEqual(fieldValue(fields, 'Living detail storage class'), 'gp3');
    strictEqual(fieldValue(fields, 'Living detail volume'), 'pvc-123');
  });

  it('extracts HPA replica fields', () => {
    const fields = getResourceLiveDetails('HorizontalPodAutoscaler', {
      metadata: { creationTimestamp: new Date().toISOString() },
      spec: { minReplicas: 1, maxReplicas: 5 },
      status: { currentReplicas: 2, desiredReplicas: 3 },
    });

    strictEqual(fieldValue(fields, 'Living detail current replicas'), '2');
    strictEqual(fieldValue(fields, 'Living detail desired replicas'), '3');
    strictEqual(fieldValue(fields, 'Living detail min replicas'), '1');
    strictEqual(fieldValue(fields, 'Living detail max replicas'), '5');
  });
});
