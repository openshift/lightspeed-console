import { K8sModelRef } from '../../src/pageContext';

export const testK8sModels: Record<string, K8sModelRef> = {
  ConfigMap: { kind: 'ConfigMap', plural: 'configmaps', namespaced: true },
  CronJob: { kind: 'CronJob', plural: 'cronjobs', namespaced: true },
  DaemonSet: { kind: 'DaemonSet', plural: 'daemonsets', namespaced: true },
  Deployment: { kind: 'Deployment', plural: 'deployments', namespaced: true },
  DeploymentConfig: { kind: 'DeploymentConfig', plural: 'deploymentconfigs', namespaced: true },
  HorizontalPodAutoscaler: {
    kind: 'HorizontalPodAutoscaler',
    plural: 'horizontalpodautoscalers',
    namespaced: true,
  },
  Ingress: { kind: 'Ingress', plural: 'ingresses', namespaced: true },
  Job: { kind: 'Job', plural: 'jobs', namespaced: true },
  Node: { kind: 'Node', plural: 'nodes', namespaced: false },
  Namespace: { kind: 'Namespace', plural: 'namespaces', namespaced: false },
  Pod: { kind: 'Pod', plural: 'pods', namespaced: true },
  ReplicaSet: { kind: 'ReplicaSet', plural: 'replicasets', namespaced: true },
  ReplicationController: {
    kind: 'ReplicationController',
    plural: 'replicationcontrollers',
    namespaced: true,
  },
  PersistentVolume: { kind: 'PersistentVolume', plural: 'persistentvolumes', namespaced: false },
  PersistentVolumeClaim: {
    kind: 'PersistentVolumeClaim',
    plural: 'persistentvolumeclaims',
    namespaced: true,
  },
  ServiceAccount: { kind: 'ServiceAccount', plural: 'serviceaccounts', namespaced: true },
  'config.openshift.io~v1~ClusterVersion': {
    kind: 'ClusterVersion',
    plural: 'clusterversions',
    namespaced: false,
  },
  'machineconfiguration.openshift.io~v1~MachineConfigPool': {
    kind: 'MachineConfigPool',
    plural: 'machineconfigpools',
    namespaced: false,
  },
  'operators.coreos.com~v1alpha1~Subscription': {
    kind: 'Subscription',
    plural: 'subscriptions',
    namespaced: true,
  },
  'operator.openshift.io~v1~IngressController': {
    kind: 'IngressController',
    plural: 'ingresscontrollers',
    namespaced: false,
  },
  'route.openshift.io~v1~Route': {
    kind: 'Route',
    plural: 'routes',
    namespaced: true,
  },
  Secret: { kind: 'Secret', plural: 'secrets', namespaced: true },
  Service: { kind: 'Service', plural: 'services', namespaced: true },
  StatefulSet: { kind: 'StatefulSet', plural: 'statefulsets', namespaced: true },
  'kubevirt.io~v1~VirtualMachine': {
    kind: 'VirtualMachine',
    plural: 'virtualmachines',
    namespaced: true,
  },
  'flows.netobserv.io~v1beta2~FlowCollector': {
    kind: 'FlowCollector',
    plural: 'flowcollectors',
    namespaced: false,
  },
  'flows.netobserv.io~v1beta2~FlowCollectorSlice': {
    kind: 'FlowCollectorSlice',
    plural: 'flowcollectorslices',
    namespaced: true,
  },
};
