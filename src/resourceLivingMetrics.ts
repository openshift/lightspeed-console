import { getModelKindName, K8sModelRef } from './pageContext';
import { ResourceRef } from './resourceRefs';

export type LivingMetricDef = {
  id: string;
  labelKey: string;
  query: string;
};

type MetricBuilderContext = {
  kindName: string;
  name: string;
  namespace?: string;
};

type MetricBuilder = (context: MetricBuilderContext) => LivingMetricDef[];

const promQlLabel = (value: string): string =>
  `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

const labelSelector = (labels: Record<string, string>): string =>
  Object.entries(labels)
    .map(([key, value]) => `${key}=${promQlLabel(value)}`)
    .join(',');

const containerCpuMetric = (selector: string): LivingMetricDef => ({
  id: 'cpu',
  labelKey: 'Living metric CPU',
  query: `sum(rate(container_cpu_usage_seconds_total{${selector},container!="",container!="POD"}[5m]))`,
});

const containerMemoryMetric = (selector: string): LivingMetricDef => ({
  id: 'memory',
  labelKey: 'Living metric memory',
  query: `sum(container_memory_working_set_bytes{${selector},container!="",container!="POD"})`,
});

const kubeStateMetric = (
  metric: string,
  labels: Record<string, string>,
  id: string,
  labelKey: string,
): LivingMetricDef => ({
  id,
  labelKey,
  query: `${metric}{${labelSelector(labels)}}`,
});

const podMetrics: MetricBuilder = ({ name, namespace }) => {
  if (!namespace) {
    return [];
  }
  const selector = labelSelector({ namespace, pod: name });
  return [containerCpuMetric(selector), containerMemoryMetric(selector)];
};

const namespaceAggregateMetrics: MetricBuilder = ({ name }) => {
  const selector = labelSelector({ namespace: name });
  return [containerCpuMetric(selector), containerMemoryMetric(selector)];
};

const nodeMetrics: MetricBuilder = ({ name }) => {
  const selector = labelSelector({ node: name });
  return [containerCpuMetric(selector), containerMemoryMetric(selector)];
};

const pvcMetrics: MetricBuilder = ({ name, namespace }) => {
  if (!namespace) {
    return [];
  }
  const labels = { namespace, persistentvolumeclaim: name };
  return [
    kubeStateMetric(
      'kubelet_volume_stats_used_bytes',
      labels,
      'storage_used',
      'Living metric storage used',
    ),
    kubeStateMetric(
      'kubelet_volume_stats_capacity_bytes',
      labels,
      'storage_capacity',
      'Living metric storage capacity',
    ),
  ];
};

type WorkloadMetricSpec = {
  containerLabel: string;
  replicaLabel: string;
  replicaMetric: string;
  replicaMetricLabelKey?: string;
};

const workloadMetrics =
  ({ containerLabel, replicaLabel, replicaMetric, replicaMetricLabelKey }: WorkloadMetricSpec): MetricBuilder =>
  ({ name, namespace }) => {
    if (!namespace) {
      return [];
    }
    const workloadLabels = { namespace, [containerLabel]: name };
    const replicaLabels = { namespace, [replicaLabel]: name };
    return [
      kubeStateMetric(
        replicaMetric,
        replicaLabels,
        'replicas',
        replicaMetricLabelKey ?? 'Living metric replicas',
      ),
      containerCpuMetric(labelSelector(workloadLabels)),
      containerMemoryMetric(labelSelector(workloadLabels)),
    ];
  };

const METRIC_BUILDERS: Record<string, MetricBuilder> = {
  Pod: podMetrics,
  Deployment: workloadMetrics({
    containerLabel: 'deployment',
    replicaLabel: 'deployment',
    replicaMetric: 'kube_deployment_status_replicas_available',
  }),
  StatefulSet: workloadMetrics({
    containerLabel: 'statefulset',
    replicaLabel: 'statefulset',
    replicaMetric: 'kube_statefulset_status_replicas_ready',
  }),
  DaemonSet: workloadMetrics({
    containerLabel: 'daemonset',
    replicaLabel: 'daemonset',
    replicaMetric: 'kube_daemonset_status_number_ready',
    replicaMetricLabelKey: 'Living metric ready scheduled',
  }),
  ReplicaSet: workloadMetrics({
    containerLabel: 'replicaset',
    replicaLabel: 'replicaset',
    replicaMetric: 'kube_replicaset_status_ready_replicas',
  }),
  ReplicationController: workloadMetrics({
    containerLabel: 'replicationcontroller',
    replicaLabel: 'replicationcontroller',
    replicaMetric: 'kube_replicationcontroller_status_ready_replicas',
  }),
  DeploymentConfig: workloadMetrics({
    containerLabel: 'deploymentconfig',
    replicaLabel: 'deploymentconfig',
    replicaMetric: 'kube_deploymentconfig_status_replicas_available',
  }),
  Namespace: namespaceAggregateMetrics,
  Node: nodeMetrics,
  PersistentVolumeClaim: pvcMetrics,
};

const metricContext = (ref: ResourceRef, kindName: string): MetricBuilderContext | null => {
  if (kindName === 'Namespace') {
    return { kindName, name: ref.name, namespace: ref.name };
  }
  if (kindName === 'Node') {
    return { kindName, name: ref.name };
  }
  if (!ref.namespace) {
    return null;
  }
  return { kindName, name: ref.name, namespace: ref.namespace };
};

export const buildLivingMetrics = (
  ref: ResourceRef,
  models: Record<string, K8sModelRef>,
): LivingMetricDef[] => {
  const kindName = getModelKindName(ref.kind, models);
  const context = metricContext(ref, kindName);
  if (!context) {
    return [];
  }

  const build = METRIC_BUILDERS[kindName];
  if (!build) {
    return [];
  }

  return build(context);
};
