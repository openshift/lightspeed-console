import { describe, it } from 'node:test';
import { strictEqual } from 'node:assert';

import { buildLivingMetrics } from '../src/resourceLivingMetrics';
import { testK8sModels } from './fixtures/k8sModels';

describe('buildLivingMetrics', () => {
  it('builds pod cpu and memory queries', () => {
    const metrics = buildLivingMetrics(
      { kind: 'Pod', name: 'payments-api', namespace: 'payments' },
      testK8sModels,
    );
    strictEqual(metrics.length, 2);
    strictEqual(metrics[0].id, 'cpu');
    strictEqual(metrics[0].query.includes('namespace="payments"'), true);
    strictEqual(metrics[0].query.includes('pod="payments-api"'), true);
  });

  it('builds deployment replica and workload utilization queries', () => {
    const metrics = buildLivingMetrics(
      { kind: 'Deployment', name: 'reporting-service', namespace: 'shared-services' },
      testK8sModels,
    );
    strictEqual(metrics.length, 3);
    strictEqual(metrics[0].id, 'replicas');
    strictEqual(
      metrics[0].query,
      'kube_deployment_status_replicas_available{namespace="shared-services",deployment="reporting-service"}',
    );
    strictEqual(metrics[1].query.includes('deployment="reporting-service"'), true);
    strictEqual(metrics[2].query.includes('deployment="reporting-service"'), true);
  });

  it('builds statefulset replica and utilization queries', () => {
    const metrics = buildLivingMetrics(
      { kind: 'StatefulSet', name: 'postgres', namespace: 'shared-services' },
      testK8sModels,
    );
    strictEqual(metrics.length, 3);
    strictEqual(
      metrics[0].query,
      'kube_statefulset_status_replicas_ready{namespace="shared-services",statefulset="postgres"}',
    );
  });

  it('builds node utilization queries without a namespace', () => {
    const metrics = buildLivingMetrics({ kind: 'Node', name: 'worker-1.example.internal' }, testK8sModels);
    strictEqual(metrics.length, 2);
    strictEqual(metrics[0].query.includes('node="worker-1.example.internal"'), true);
  });

  it('builds namespace aggregate utilization queries', () => {
    const metrics = buildLivingMetrics({ kind: 'Namespace', name: 'payments' }, testK8sModels);
    strictEqual(metrics.length, 2);
    strictEqual(metrics[0].query.includes('namespace="payments"'), true);
  });

  it('builds pvc storage queries', () => {
    const metrics = buildLivingMetrics(
      { kind: 'PersistentVolumeClaim', name: 'data', namespace: 'payments' },
      testK8sModels,
    );
    strictEqual(metrics.length, 2);
    strictEqual(metrics[0].id, 'storage_used');
    strictEqual(
      metrics[0].query,
      'kubelet_volume_stats_used_bytes{namespace="payments",persistentvolumeclaim="data"}',
    );
  });

  it('builds deploymentconfig metrics for OpenShift workloads', () => {
    const metrics = buildLivingMetrics(
      { kind: 'DeploymentConfig', name: 'frontend', namespace: 'payments' },
      testK8sModels,
    );
    strictEqual(metrics.length, 3);
    strictEqual(
      metrics[0].query,
      'kube_deploymentconfig_status_replicas_available{namespace="payments",deploymentconfig="frontend"}',
    );
    strictEqual(metrics[1].query.includes('deploymentconfig="frontend"'), true);
  });

  it('returns no metrics for unsupported kinds', () => {
    strictEqual(
      buildLivingMetrics({ kind: 'Service', name: 'api', namespace: 'payments' }, testK8sModels)
        .length,
      0,
    );
  });
});
