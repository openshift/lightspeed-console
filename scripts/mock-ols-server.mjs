#!/usr/bin/env node
/**
 * Minimal mock OpenShift Lightspeed API for local linked-resources testing.
 *
 * Mock MCP tool output and SSE events align with kubernetes-mcp-server
 * (list_output=table, projects_list YAML, nodes_top metrics) and
 * lightspeed-service streaming (tool_result/end event shapes).
 *
 * Usage (three terminals):
 *   1. npm run start-mock-ols
 *   2. npm run start
 *   3. oc login && npm run start-console
 *
 * No OpenShift cluster? Use a local kind cluster:
 *   kind create cluster
 *   npm run start-console-kind   # mints a dev token (ALLOW_DEV_TOKEN_MINT=1)
 *
 * Then open http://localhost:9000, open Lightspeed, and try e.g.:
 *   - "show pods"                  → pods in MOCK_NAMESPACE
 *   - "list projects"              → projects_list
 *   - "list namespaces"            → namespaces_list
 *   - "list configmaps"              → resources_list (ConfigMap)
 *   - "list secrets"                 → resources_list (Secret)
 *   - "list services"                → resources_list (Service)
 *   - "list deployments"             → resources_list (Deployment)
 *   - "list statefulsets"            → resources_list (StatefulSet)
 *   - "list routes"                  → resources_list (Route)
 *   - "show nodes"                   → nodes_top
 *   - "check deployment foo"         → resources_get (single Deployment)
 *
 * Resource kinds mirror unit-tests/fixtures/k8sModels.ts (minus Pod/Namespace/Node
 * which use dedicated scenarios). Each list kind supports MOCK_<PLURAL> env override.
 *
 * Environment:
 *   OLS_PORT              Port (default: 8080)
 *   MOCK_OLS_SCENARIO     Force scenario (see startup log for keys)
 *   MOCK_NAMESPACE        Namespace for namespaced resources (default: default)
 *   MOCK_PODS             Comma-separated pod names
 *   MOCK_POD_LIMIT        Max pods from cluster (default: all; set e.g. 12 to cap)
 *   MOCK_DIVERSE_POD_STATUSES  Set to 1 or true to cycle demo statuses in tool output (default: off)
 *   MOCK_LIST_LIMIT       Max names for other list resources (default: 4)
 *   MOCK_DEPLOYMENT       Deployment name for single-deployment scenario
 *   MOCK_DEPLOYMENTS      Comma-separated deployment names (list scenario)
 *   MOCK_PROJECTS         Comma-separated project names
 *   MOCK_NAMESPACES       Comma-separated namespace names
 *   MOCK_NODES            Comma-separated node names
 *   MOCK_<PLURAL>         Comma-separated names per list resource (e.g. MOCK_SECRETS)
 */

import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.OLS_PORT ?? 8080);
const MOCK_NAMESPACE = process.env.MOCK_NAMESPACE ?? 'default';

/** 0 or unset means no cap when fetching names from the cluster via oc. */
const parseListLimit = (value, fallback) => {
  if (value === undefined || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const DEFAULT_LIST_LIMIT = parseListLimit(process.env.MOCK_LIST_LIMIT, 4);
const POD_LIST_LIMIT = parseListLimit(process.env.MOCK_POD_LIMIT, 0);
const MOCK_DIVERSE_POD_STATUSES =
  process.env.MOCK_DIVERSE_POD_STATUSES === '1' || process.env.MOCK_DIVERSE_POD_STATUSES === 'true';

/** Demo statuses for MCP table + assistant prose (icons still come from live cluster watch). */
const DIVERSE_POD_STATUS_PRESETS = [
  { ready: '1/1', status: 'Running', restarts: '0' },
  { ready: '0/1', status: 'Pending', restarts: '0' },
  { ready: '0/1', status: 'ContainerCreating', restarts: '0' },
  { ready: '0/1', status: 'CrashLoopBackOff', restarts: '12' },
  { ready: '0/1', status: 'ImagePullBackOff', restarts: '0' },
  { ready: '0/1', status: 'Error', restarts: '3' },
  { ready: '0/1', status: 'Failed', restarts: '0' },
  { ready: '1/1', status: 'Succeeded', restarts: '0' },
];

const PLACEHOLDER_POD_NAMES = [
  'mock-pod-running',
  'mock-pod-pending',
  'mock-pod-crash',
  'mock-pod-imagepull',
  'mock-pod-error',
  'mock-pod-failed',
];

const splitEnvList = (value) =>
  value
    ?.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean) ?? [];

const tryOc = (args) => {
  try {
    return execFileSync('oc', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 10_000,
    }).trim();
  } catch {
    return null;
  }
};

const tryOcJson = (args) => {
  try {
    return JSON.parse(
      execFileSync('oc', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 10_000,
      }),
    );
  } catch {
    return null;
  }
};

const podReadyString = (pod) => {
  const containers = pod.status?.containerStatuses ?? [];
  if (containers.length === 0) {
    return '0/1';
  }
  const ready = containers.filter((container) => container.ready).length;
  return `${ready}/${containers.length}`;
};

const podRestarts = (pod) =>
  (pod.status?.containerStatuses ?? []).reduce(
    (sum, container) => sum + (container.restartCount ?? 0),
    0,
  );

const podDisplayStatus = (pod) => {
  const phase = pod.status?.phase ?? 'Unknown';
  for (const container of pod.status?.containerStatuses ?? []) {
    const waitingReason = container.state?.waiting?.reason;
    if (waitingReason) {
      return waitingReason;
    }
    const terminatedReason = container.state?.terminated?.reason;
    if (terminatedReason && phase !== 'Running' && phase !== 'Succeeded') {
      return terminatedReason;
    }
  }
  return phase;
};

const snapshotFromPod = (pod, index) => ({
  name: pod.metadata?.name ?? `pod-${index}`,
  ready: podReadyString(pod),
  status: podDisplayStatus(pod),
  restarts: String(podRestarts(pod)),
  age: '5m',
  ip: pod.status?.podIP ?? '<none>',
  node: pod.spec?.nodeName ?? '<none>',
});

const snapshotWithPreset = (name, index, useDiverseStatuses) => {
  const preset = useDiverseStatuses
    ? DIVERSE_POD_STATUS_PRESETS[index % DIVERSE_POD_STATUS_PRESETS.length]
    : DIVERSE_POD_STATUS_PRESETS[0];
  return {
    name,
    ready: preset.ready,
    status: preset.status,
    restarts: preset.restarts,
    age: '5m',
    ip: `10.0.0.${index + 1}`,
    node: 'worker-1',
  };
};

const resolvePodSnapshots = (namespace) => {
  const fromEnv = splitEnvList(process.env.MOCK_PODS);
  if (fromEnv.length > 0) {
    return fromEnv.map((name, index) => snapshotWithPreset(name, index, MOCK_DIVERSE_POD_STATUSES));
  }

  const list = tryOcJson(['get', 'pods', '-n', namespace, '-o', 'json']);
  if (list?.items?.length > 0) {
    const items = POD_LIST_LIMIT > 0 ? list.items.slice(0, POD_LIST_LIMIT) : list.items;
    const snapshots = items.map(snapshotFromPod);
    if (MOCK_DIVERSE_POD_STATUSES) {
      return snapshots.map((snapshot, index) => ({
        ...snapshot,
        ...DIVERSE_POD_STATUS_PRESETS[index % DIVERSE_POD_STATUS_PRESETS.length],
        name: snapshot.name,
        ip: snapshot.ip,
        node: snapshot.node,
      }));
    }
    return snapshots;
  }

  return PLACEHOLDER_POD_NAMES.map((name, index) =>
    snapshotWithPreset(name, index, MOCK_DIVERSE_POD_STATUSES),
  );
};

const resolveNames = ({
  envVar,
  ocArgs,
  ocFallbackArgs,
  placeholders,
  limit = DEFAULT_LIST_LIMIT,
}) => {
  const fromEnv = splitEnvList(process.env[envVar]);
  if (fromEnv.length > 0) {
    return fromEnv;
  }
  const fromCluster = tryOc(ocArgs) || (ocFallbackArgs ? tryOc(ocFallbackArgs) : null);
  if (fromCluster) {
    const allNames = fromCluster.split(/\s+/).filter(Boolean);
    const names = limit > 0 ? allNames.slice(0, limit) : allNames;
    if (names.length > 0) {
      return names;
    }
  }
  return placeholders;
};

const envVarForPlural = (plural) => `MOCK_${plural.replace(/-/g, '_').toUpperCase()}`;

const listedResourceNames = (names) => names.join('\n');

const defaultListTokens = (kindLabel, { namespace, names, primary, namespaced }) => {
  const count = names.length;
  const plural = count === 1 ? kindLabel : `${kindLabel}s`;
  const intro = namespaced
    ? `I found ${count} ${plural} in the **${namespace}** namespace.\n\n`
    : `I found ${count} ${plural} in this cluster.\n\n`;
  return [
    intro,
    names.map((name) => `**${name}**`).join('\n'),
    `\n\n**${primary}** is a good place to start if you need more detail.`,
  ];
};

const workloadTable = (apiVersion, kind) => (namespace, names) =>
  names.map((name) => `${namespace} ${apiVersion} ${kind} ${name} 1/1 1 1 5m app=mock`).join('\n');

const WORKLOAD_TABLE_HEADER =
  'NAMESPACE APIVERSION KIND NAME READY UP-TO-DATE AVAILABLE AGE LABELS';

const POD_TABLE_HEADER =
  'NAMESPACE APIVERSION KIND NAME READY STATUS RESTARTS AGE IP NODE NOMINATED NODE READINESS GATES LABELS';

/**
 * List-resource definitions aligned with unit-tests/fixtures/k8sModels.ts.
 * Pods, Namespaces, Nodes, and Projects use dedicated scenarios below.
 */
const LIST_RESOURCE_DEFS = [
  {
    key: 'configmaps',
    kind: 'ConfigMap',
    plural: 'configmaps',
    namespaced: true,
    apiVersion: 'v1',
    placeholders: ['kube-root-ca.crt', 'mock-app-config'],
    detect: (q) => /\bconfigmaps?\b/.test(q) || /\bconfig maps?\b/.test(q),
    tableHeader: 'NAMESPACE APIVERSION KIND NAME DATA AGE LABELS',
    buildTable: (namespace, names) =>
      names
        .map((name, index) => `${namespace} v1 ConfigMap ${name} ${index + 1} 5m app=mock`)
        .join('\n'),
  },
  {
    key: 'secrets',
    kind: 'Secret',
    plural: 'secrets',
    namespaced: true,
    apiVersion: 'v1',
    placeholders: ['builder-dockercfg-mock', 'mock-tls'],
    detect: (q) => /\bsecrets?\b/.test(q),
    tableHeader: 'NAMESPACE APIVERSION KIND NAME TYPE DATA AGE LABELS',
    buildTable: (namespace, names) =>
      names.map((name) => `${namespace} v1 Secret ${name} Opaque 2 5m <none>`).join('\n'),
  },
  {
    key: 'serviceaccounts',
    kind: 'ServiceAccount',
    plural: 'serviceaccounts',
    namespaced: true,
    apiVersion: 'v1',
    placeholders: ['default', 'builder'],
    detect: (q) => /\bserviceaccounts?\b/.test(q) || /\bservice accounts?\b/.test(q),
    tableHeader: 'NAMESPACE APIVERSION KIND NAME SECRETS AGE LABELS',
    buildTable: (namespace, names) =>
      names.map((name) => `${namespace} v1 ServiceAccount ${name} 1 5m <none>`).join('\n'),
  },
  {
    key: 'services',
    kind: 'Service',
    plural: 'services',
    namespaced: true,
    apiVersion: 'v1',
    placeholders: ['kubernetes', 'mock-api'],
    detect: (q) => /\bservices?\b/.test(q),
    tableHeader: 'NAMESPACE APIVERSION KIND NAME TYPE CLUSTER-IP EXTERNAL-IP PORT(S) AGE SELECTOR',
    buildTable: (namespace, names) =>
      names
        .map(
          (name, index) =>
            `${namespace} v1 Service ${name} ClusterIP 10.96.${index + 1}.1 <none> 80/TCP 5m app=mock`,
        )
        .join('\n'),
  },
  {
    key: 'deployments',
    kind: 'Deployment',
    plural: 'deployments',
    namespaced: true,
    apiVersion: 'apps/v1',
    placeholders: ['mock-deployment-a', 'mock-deployment-b'],
    detect: (q) => /\bdeployments\b/.test(q) || /\blist deployments?\b/.test(q),
    tableHeader: WORKLOAD_TABLE_HEADER,
    buildTable: workloadTable('apps/v1', 'Deployment'),
  },
  {
    key: 'statefulsets',
    kind: 'StatefulSet',
    plural: 'statefulsets',
    namespaced: true,
    apiVersion: 'apps/v1',
    placeholders: ['mock-statefulset-a', 'mock-statefulset-b'],
    detect: (q) => /\bstatefulsets?\b/.test(q) || /\bstateful sets?\b/.test(q),
    tableHeader: WORKLOAD_TABLE_HEADER,
    buildTable: workloadTable('apps/v1', 'StatefulSet'),
  },
  {
    key: 'daemonsets',
    kind: 'DaemonSet',
    plural: 'daemonsets',
    namespaced: true,
    apiVersion: 'apps/v1',
    placeholders: ['mock-daemonset-a'],
    detect: (q) => /\bdaemonsets?\b/.test(q) || /\bdaemon sets?\b/.test(q),
    tableHeader: WORKLOAD_TABLE_HEADER,
    buildTable: workloadTable('apps/v1', 'DaemonSet'),
  },
  {
    key: 'replicasets',
    kind: 'ReplicaSet',
    plural: 'replicasets',
    namespaced: true,
    apiVersion: 'apps/v1',
    placeholders: ['mock-replicaset-a'],
    detect: (q) => /\breplicasets?\b/.test(q) || /\breplica sets?\b/.test(q),
    tableHeader: WORKLOAD_TABLE_HEADER,
    buildTable: workloadTable('apps/v1', 'ReplicaSet'),
  },
  {
    key: 'replicationcontrollers',
    kind: 'ReplicationController',
    plural: 'replicationcontrollers',
    namespaced: true,
    apiVersion: 'v1',
    placeholders: ['mock-rc-a'],
    detect: (q) => /\breplicationcontrollers?\b/.test(q) || /\breplication controllers?\b/.test(q),
    tableHeader: 'NAMESPACE APIVERSION KIND NAME DESIRED CURRENT READY AGE SELECTOR LABELS',
    buildTable: (namespace, names) =>
      names
        .map((name) => `${namespace} v1 ReplicationController ${name} 1 1 1 5m app=mock <none>`)
        .join('\n'),
  },
  {
    key: 'deploymentconfigs',
    kind: 'DeploymentConfig',
    plural: 'deploymentconfigs',
    namespaced: true,
    apiVersion: 'apps.openshift.io/v1',
    placeholders: ['mock-dc-a', 'mock-dc-b'],
    detect: (q) => /\bdeploymentconfigs?\b/.test(q) || /\bdeployment configs?\b/.test(q),
    tableHeader: 'NAMESPACE APIVERSION KIND NAME REVISION DESIRED CURRENT TRIGGERED BY LABELS',
    buildTable: (namespace, names) =>
      names
        .map(
          (name) =>
            `${namespace} apps.openshift.io/v1 DeploymentConfig ${name} 1 1 1 config <none>`,
        )
        .join('\n'),
  },
  {
    key: 'jobs',
    kind: 'Job',
    plural: 'jobs',
    namespaced: true,
    apiVersion: 'batch/v1',
    placeholders: ['mock-job-a'],
    detect: (q) => /\bjobs?\b/.test(q) && !/\bcronjobs?\b/.test(q),
    tableHeader: 'NAMESPACE APIVERSION KIND NAME COMPLETIONS DURATION AGE LABELS',
    buildTable: (namespace, names) =>
      names.map((name) => `${namespace} batch/v1 Job ${name} 1/1 12s 5m <none>`).join('\n'),
  },
  {
    key: 'cronjobs',
    kind: 'CronJob',
    plural: 'cronjobs',
    namespaced: true,
    apiVersion: 'batch/v1',
    placeholders: ['mock-cronjob-a'],
    detect: (q) => /\bcronjobs?\b/.test(q) || /\bcron jobs?\b/.test(q),
    tableHeader: 'NAMESPACE APIVERSION KIND NAME SCHEDULE SUSPEND ACTIVE LAST SCHEDULE AGE LABELS',
    buildTable: (namespace, names) =>
      names
        .map((name) => `${namespace} batch/v1 CronJob ${name} */5 * * * * False 0 <none> 5m <none>`)
        .join('\n'),
  },
  {
    key: 'ingresses',
    kind: 'Ingress',
    plural: 'ingresses',
    namespaced: true,
    apiVersion: 'networking.k8s.io/v1',
    placeholders: ['mock-ingress'],
    detect: (q) => /\bingresses?\b/.test(q),
    tableHeader: 'NAMESPACE APIVERSION KIND NAME CLASS HOSTS ADDRESS PORTS AGE LABELS',
    buildTable: (namespace, names) =>
      names
        .map(
          (name, index) =>
            `${namespace} networking.k8s.io/v1 Ingress ${name} openshift-default mock-${index + 1}.apps.example.com 10.0.0.1 80 5m <none>`,
        )
        .join('\n'),
  },
  {
    key: 'routes',
    kind: 'Route',
    plural: 'routes',
    namespaced: true,
    apiVersion: 'route.openshift.io/v1',
    placeholders: ['mock-route'],
    detect: (q) => /\broutes?\b/.test(q),
    tableHeader: 'NAMESPACE APIVERSION KIND NAME AGE LABELS',
    buildTable: (namespace, names) =>
      names.map((name) => `${namespace} route.openshift.io/v1 Route ${name} 5m <none>`).join('\n'),
  },
  {
    key: 'persistentvolumeclaims',
    kind: 'PersistentVolumeClaim',
    plural: 'persistentvolumeclaims',
    namespaced: true,
    apiVersion: 'v1',
    placeholders: ['mock-pvc-a'],
    detect: (q) =>
      /\bpersistentvolumeclaims?\b/.test(q) ||
      /\bpersistent volume claims?\b/.test(q) ||
      /\bpvcs?\b/.test(q),
    tableHeader:
      'NAMESPACE APIVERSION KIND NAME STATUS VOLUME CAPACITY ACCESS MODES STORAGECLASS AGE LABELS',
    buildTable: (namespace, names) =>
      names
        .map(
          (name) =>
            `${namespace} v1 PersistentVolumeClaim ${name} Bound pv-mock 1Gi RWO mock-sc 5m <none>`,
        )
        .join('\n'),
  },
  {
    key: 'persistentvolumes',
    kind: 'PersistentVolume',
    plural: 'persistentvolumes',
    namespaced: false,
    apiVersion: 'v1',
    placeholders: ['pv-mock-a'],
    detect: (q) =>
      /\bpersistentvolumes?\b/.test(q) ||
      /\bpersistent volumes?\b/.test(q) ||
      (/\bpvs?\b/.test(q) && !/\bpvcs?\b/.test(q)),
    tableHeader:
      'APIVERSION KIND NAME CAPACITY ACCESS MODES RECLAIM POLICY STATUS CLAIM STORAGECLASS',
    buildTable: (_namespace, names) =>
      names
        .map((name) => `v1 PersistentVolume ${name} 1Gi RWO Delete Bound default/${name} mock-sc`)
        .join('\n'),
  },
  {
    key: 'horizontalpodautoscalers',
    kind: 'HorizontalPodAutoscaler',
    plural: 'horizontalpodautoscalers',
    namespaced: true,
    apiVersion: 'autoscaling/v2',
    placeholders: ['mock-hpa'],
    detect: (q) =>
      /\bhorizontalpodautoscalers?\b/.test(q) ||
      /\bhorizontal pod autoscalers?\b/.test(q) ||
      /\bhpas?\b/.test(q),
    tableHeader:
      'NAMESPACE APIVERSION KIND NAME REFERENCE TARGETS MINPODS MAXPODS REPLICAS AGE LABELS',
    buildTable: (namespace, names) =>
      names
        .map(
          (name) =>
            `${namespace} autoscaling/v2 HorizontalPodAutoscaler ${name} Deployment/mock-deployment 50%/60% 1 5 2 5m <none>`,
        )
        .join('\n'),
  },
  {
    key: 'subscriptions',
    kind: 'Subscription',
    plural: 'subscriptions',
    namespaced: true,
    apiVersion: 'operators.coreos.com/v1alpha1',
    placeholders: ['openshift-operators-redhat'],
    detect: (q) => /\bsubscriptions?\b/.test(q),
    tableHeader: 'NAMESPACE APIVERSION KIND NAME PACKAGE SOURCE CHANNEL LABELS',
    buildTable: (namespace, names) =>
      names
        .map(
          (name) =>
            `${namespace} operators.coreos.com/v1alpha1 Subscription ${name} netobserv-operator redhat-operators stable <none>`,
        )
        .join('\n'),
  },
  {
    key: 'virtualmachines',
    kind: 'VirtualMachine',
    plural: 'virtualmachines',
    namespaced: true,
    apiVersion: 'kubevirt.io/v1',
    placeholders: ['mock-vm-a'],
    detect: (q) =>
      /\bvirtualmachines?\b/.test(q) ||
      /\bvirtual machines?\b/.test(q) ||
      (/\bvms?\b/.test(q) && !/\bhpas?\b/.test(q)),
    tableHeader: 'NAMESPACE APIVERSION KIND NAME AGE STATUS READY LABELS',
    buildTable: (namespace, names) =>
      names
        .map((name) => `${namespace} kubevirt.io/v1 VirtualMachine ${name} 5m Running True <none>`)
        .join('\n'),
  },
  {
    key: 'flowcollectors',
    kind: 'FlowCollector',
    plural: 'flowcollectors',
    namespaced: false,
    apiVersion: 'flows.netobserv.io/v1beta2',
    placeholders: ['cluster'],
    detect: (q) => /\bflowcollectors?\b/.test(q) || /\bflow collectors?\b/.test(q),
    tableHeader: 'APIVERSION KIND NAME STATUS AGE',
    buildTable: (_namespace, names) =>
      names.map((name) => `flows.netobserv.io/v1beta2 FlowCollector ${name} Ready 5m`).join('\n'),
  },
  {
    key: 'flowcollectorslices',
    kind: 'FlowCollectorSlice',
    plural: 'flowcollectorslices',
    namespaced: true,
    apiVersion: 'flows.netobserv.io/v1beta2',
    placeholders: ['workers'],
    detect: (q) => /\bflowcollectorslices?\b/.test(q) || /\bflow collector slices?\b/.test(q),
    tableHeader: 'NAMESPACE APIVERSION KIND NAME STATUS AGE LABELS',
    buildTable: (namespace, names) =>
      names
        .map(
          (name) =>
            `${namespace} flows.netobserv.io/v1beta2 FlowCollectorSlice ${name} Ready 5m <none>`,
        )
        .join('\n'),
  },
  {
    key: 'clusterversions',
    kind: 'ClusterVersion',
    plural: 'clusterversions',
    namespaced: false,
    apiVersion: 'config.openshift.io/v1',
    placeholders: ['version'],
    detect: (q) => /\bclusterversions?\b/.test(q) || /\bcluster versions?\b/.test(q),
    tableHeader: 'APIVERSION KIND NAME VERSION AVAILABLE PROGRESSING DEGRADED SINCE',
    buildTable: (_namespace, names) =>
      names
        .map((name) => `config.openshift.io/v1 ClusterVersion ${name} 4.16.0 True False False 5m`)
        .join('\n'),
  },
  {
    key: 'machineconfigpools',
    kind: 'MachineConfigPool',
    plural: 'machineconfigpools',
    namespaced: false,
    apiVersion: 'machineconfiguration.openshift.io/v1',
    placeholders: ['worker', 'master'],
    detect: (q) => /\bmachineconfigpools?\b/.test(q) || /\bmachine config pools?\b/.test(q),
    tableHeader: 'APIVERSION KIND NAME CONFIG UPDATED UPDATING DEGRADED MACHINECOUNT',
    buildTable: (_namespace, names) =>
      names
        .map(
          (name) =>
            `machineconfiguration.openshift.io/v1 MachineConfigPool ${name} rendered-${name} True False False 3`,
        )
        .join('\n'),
  },
  {
    key: 'ingresscontrollers',
    kind: 'IngressController',
    plural: 'ingresscontrollers',
    namespaced: false,
    apiVersion: 'operator.openshift.io/v1',
    placeholders: ['default'],
    detect: (q) => /\bingresscontrollers?\b/.test(q) || /\bingress controllers?\b/.test(q),
    tableHeader: 'APIVERSION KIND NAME DOMAIN AVAILABLE PROGRESSING DEGRADED',
    buildTable: (_namespace, names) =>
      names
        .map(
          (name) =>
            `operator.openshift.io/v1 IngressController ${name} apps.example.com True False False`,
        )
        .join('\n'),
  },
];

const listResourceRuntime = LIST_RESOURCE_DEFS.map((def) => {
  const envVar = envVarForPlural(def.plural);
  const ocArgs = def.namespaced
    ? ['get', def.plural, '-n', MOCK_NAMESPACE, '-o', 'jsonpath={.items[*].metadata.name}']
    : ['get', def.plural, '-o', 'jsonpath={.items[*].metadata.name}'];

  const names = resolveNames({
    envVar,
    ocArgs,
    placeholders: def.placeholders,
    limit: def.limit ?? DEFAULT_LIST_LIMIT,
  });

  const scenario = () => {
    const namespace = MOCK_NAMESPACE;
    const primary = names[0];
    const toolArgs = def.namespaced
      ? { apiVersion: def.apiVersion, kind: def.kind, namespace }
      : { apiVersion: def.apiVersion, kind: def.kind };
    const formatTokens = def.formatTokens ?? defaultListTokens;
    return {
      toolName: 'resources_list',
      toolArgs,
      toolContent: `${def.tableHeader}\n${def.buildTable(def.namespaced ? namespace : undefined, names)}`,
      tokens: formatTokens(def.kind, {
        namespace,
        names,
        primary,
        namespaced: def.namespaced,
      }),
    };
  };

  return { ...def, envVar, names, scenario, rule: { key: def.key, test: def.detect } };
});

const POD_SNAPSHOTS = resolvePodSnapshots(MOCK_NAMESPACE);
const POD_NAMES = POD_SNAPSHOTS.map((pod) => pod.name);

const DEPLOYMENT_NAME = (() => {
  if (process.env.MOCK_DEPLOYMENT) {
    return process.env.MOCK_DEPLOYMENT;
  }
  return (
    tryOc([
      'get',
      'deployments',
      '-n',
      MOCK_NAMESPACE,
      '-o',
      'jsonpath={.items[0].metadata.name}',
    ]) || 'mock-deployment'
  );
})();

const PROJECT_NAMES = resolveNames({
  envVar: 'MOCK_PROJECTS',
  ocArgs: ['get', 'projects', '-o', 'jsonpath={.items[*].metadata.name}'],
  ocFallbackArgs: ['get', 'namespaces', '-o', 'jsonpath={.items[*].metadata.name}'],
  placeholders: ['default', 'kube-system'],
  limit: DEFAULT_LIST_LIMIT,
});

const NAMESPACE_NAMES = resolveNames({
  envVar: 'MOCK_NAMESPACES',
  ocArgs: ['get', 'namespaces', '-o', 'jsonpath={.items[*].metadata.name}'],
  placeholders: ['default', 'kube-system', 'kube-public'],
  limit: DEFAULT_LIST_LIMIT,
});

const NODE_NAMES = resolveNames({
  envVar: 'MOCK_NODES',
  ocArgs: ['get', 'nodes', '-o', 'jsonpath={.items[*].metadata.name}'],
  placeholders: ['worker-1.example.internal', 'worker-2.example.internal'],
  limit: DEFAULT_LIST_LIMIT,
});

const sseLine = (event, data) => `data: ${JSON.stringify({ event, data })}\n\n`;

const buildPodsTable = (namespace, pods) =>
  pods
    .map(
      (pod) =>
        `${namespace} v1 Pod ${pod.name} ${pod.ready} ${pod.status} ${pod.restarts} ${pod.age} ${pod.ip} ${pod.node} <none> <none> app=mock`,
    )
    .join('\n');

const buildProjectsYaml = (projects) =>
  projects
    .map(
      (name) => `- apiVersion: project.openshift.io/v1
  kind: Project
  metadata:
    name: ${name}
  status:
    phase: Active`,
    )
    .join('\n');

const buildDeploymentYaml = (namespace, name) => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: ${namespace}
  labels:
    app: mock
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mock
  template:
    metadata:
      labels:
        app: mock
    spec:
      containers:
        - name: mock
          image: registry/mock/${name}:latest
status:
  replicas: 1
  readyReplicas: 1
  availableReplicas: 1`;

const buildNamespacesTable = (namespaces) =>
  namespaces
    .map((name) => `v1 Namespace ${name} Active 3h38m kubernetes.io/metadata.name=${name}`)
    .join('\n');

const buildNodesTopTable = (nodeNames) =>
  [
    'NAME CPU(cores) MEMORY(bytes)',
    ...nodeNames.map((name, index) => `${name} ${100 + index * 10}m ${3000 + index * 100}Mi`),
  ].join('\n');

/** Markdown hard line break (two trailing spaces before newline). */
const mdLine = (line) => `${line}  `;

const labeledPodBlock = (pod) =>
  [
    mdLine(`Name: ${pod.name}`),
    mdLine(`Ready: ${pod.ready}`),
    mdLine(`Status: ${pod.status}`),
    mdLine(`Restarts: ${pod.restarts}`),
    mdLine(`Age: ${pod.age}`),
  ].join('\n');

const verticalPodListing = (pods) => pods.map(labeledPodBlock).join('\n\n');

const labeledNodeBlock = (name, index) =>
  [
    mdLine(`Name: ${name}`),
    mdLine(`CPU: ${100 + index * 10}m`),
    mdLine(`Memory: ${3000 + index * 100}Mi`),
  ].join('\n');

const verticalNodeListing = (nodeNames) => nodeNames.map(labeledNodeBlock).join('\n\n');

const scenarios = Object.fromEntries(
  listResourceRuntime.map(({ key, scenario }) => [key, scenario]),
);

Object.assign(scenarios, {
  pods: () => {
    const namespace = MOCK_NAMESPACE;
    const primaryPod = POD_NAMES[0];
    const count = POD_NAMES.length;
    return {
      toolName: 'pods_list_in_namespace',
      toolArgs: { namespace },
      toolContent: `${POD_TABLE_HEADER}\n${buildPodsTable(namespace, POD_SNAPSHOTS)}`,
      tokens: [
        `I found ${count} pod${count === 1 ? '' : 's'} in the **${namespace}** namespace.\n\n`,
        verticalPodListing(POD_SNAPSHOTS),
        `\n\nPod **${primaryPod}** is a good place to start troubleshooting.`,
      ],
    };
  },
  projects: () => {
    const primary = PROJECT_NAMES[0];
    const count = PROJECT_NAMES.length;
    return {
      toolName: 'projects_list',
      toolArgs: {},
      toolContent: buildProjectsYaml(PROJECT_NAMES),
      tokens: [
        `I found ${count} project${count === 1 ? '' : 's'} on this cluster.\n\n`,
        PROJECT_NAMES.map((name) => `**${name}**`).join('\n'),
        `\n\nProject **${primary}** is a common starting point.`,
      ],
    };
  },
  deployment: () => {
    const namespace = MOCK_NAMESPACE;
    const name = DEPLOYMENT_NAME;
    return {
      toolName: 'resources_get',
      toolArgs: { apiVersion: 'apps/v1', kind: 'Deployment', name, namespace },
      toolContent: buildDeploymentYaml(namespace, name),
      tokens: [
        `Deployment **${name}** in the **${namespace}** namespace may need attention.\n\n`,
        `Open **${name}** in the console to inspect replica status and rollout history.`,
      ],
    };
  },
  namespaces: () => {
    const primary = NAMESPACE_NAMES[0];
    const count = NAMESPACE_NAMES.length;
    return {
      toolName: 'namespaces_list',
      toolArgs: {},
      toolContent: `APIVERSION KIND NAME STATUS AGE LABELS\n${buildNamespacesTable(NAMESPACE_NAMES)}`,
      tokens: [
        `I found ${count} namespace${count === 1 ? '' : 's'} in this cluster.\n\n`,
        listedResourceNames(NAMESPACE_NAMES),
        `\n\nNamespace **${primary}** is often used for application workloads.`,
      ],
    };
  },
  nodes: () => {
    const primary = NODE_NAMES[0];
    const count = NODE_NAMES.length;
    return {
      toolName: 'nodes_top',
      toolArgs: {},
      toolContent: buildNodesTopTable(NODE_NAMES),
      tokens: [
        `Here are ${count} node${count === 1 ? '' : 's'} with current CPU and memory usage:\n\n`,
        verticalNodeListing(NODE_NAMES),
        `\n\nNode **${primary}** has the most relevant metrics right now.`,
      ],
    };
  },
});

const SCENARIO_HINTS = Object.keys(scenarios).join(' | ');

/** Strip console page context prepended by the plugin (`Context: …\n\n<user query>`). */
const extractUserQuery = (query) => {
  const normalized = (query ?? '').trim();
  const match = normalized.match(/^context:\s*[\s\S]*?\n\n([\s\S]*)$/i);
  return (match?.[1] ?? normalized).trim();
};

const SCENARIO_RULES = [
  ...listResourceRuntime.map(({ rule }) => rule),
  {
    key: 'namespaces',
    test: (q) => /\bnamespaces?\b/.test(q) && !/\bpods?\b/.test(q),
  },
  {
    key: 'nodes',
    test: (q) => /\bnodes?\b/.test(q),
  },
  {
    key: 'projects',
    test: (q) => /\bprojects?\b/.test(q),
  },
  {
    key: 'deployment',
    test: (q) => /\bdeployment\b/.test(q) || /\bdeploy\b/.test(q),
  },
  {
    key: 'pods',
    test: (q) => /\bpods?\b/.test(q),
  },
];

const detectScenario = (rawQuery) => {
  const forced = process.env.MOCK_OLS_SCENARIO?.toLowerCase();
  if (forced && scenarios[forced]) {
    return forced;
  }

  const userQuery = extractUserQuery(rawQuery).toLowerCase();
  const matched = SCENARIO_RULES.find((rule) => rule.test(userQuery));
  return matched?.key ?? 'pods';
};

const buildStreamBody = (query) => {
  const scenarioKey = detectScenario(query);
  const scenario = scenarios[scenarioKey]();
  const conversationId = randomUUID();
  const toolId = `tool-${scenarioKey}-1`;
  const lines = [
    sseLine('start', { conversation_id: conversationId }),
    sseLine('tool_call', { id: toolId, name: scenario.toolName, args: scenario.toolArgs }),
    sseLine('tool_result', {
      id: toolId,
      name: scenario.toolName,
      type: 'tool_result',
      round: 1,
      content: scenario.toolContent,
      status: 'success',
    }),
  ];

  scenario.tokens.forEach((token, index) => {
    lines.push(sseLine('token', { id: index, token }));
  });

  lines.push(
    sseLine('end', {
      referenced_documents: [],
      truncated: false,
      input_tokens: 120,
      output_tokens: 80,
      reasoning_tokens: 0,
    }),
  );
  return { body: lines.join(''), scenarioKey, conversationId };
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

const json = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
};

const server = createServer(async (req, res) => {
  const { method, url } = req;

  if (method === 'GET' && url === '/readiness') {
    return json(res, 200, { ready: true });
  }

  if (method === 'POST' && url === '/authorized') {
    return json(res, 200, { user_id: 'mock-user', username: 'mock-user' });
  }

  if (method === 'GET' && url === '/v1/feedback/status') {
    return json(res, 200, { status: { enabled: true } });
  }

  if (method === 'POST' && url === '/v1/feedback') {
    return json(res, 200, { message: 'Feedback received' });
  }

  if (method === 'POST' && url === '/v1/streaming_query') {
    let query = '';
    try {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      query = body.query ?? '';
    } catch {
      // Ignore parse errors; still return a mock stream.
    }

    const { body, scenarioKey } = buildStreamBody(query);
    console.log(
      `[mock-ols] streaming_query scenario=${scenarioKey} query=${JSON.stringify(query)}`,
    );

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.end(body);
    return;
  }

  console.log(`[mock-ols] ${method} ${url} → 404`);
  json(res, 404, { detail: `Not found: ${method} ${url}` });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Mock OLS listening on http://127.0.0.1:${PORT}`);
  console.log(`  namespace:    ${MOCK_NAMESPACE}`);
  console.log(`  scenarios:    ${SCENARIO_HINTS}`);
  console.log(
    `  pods:         ${POD_SNAPSHOTS.map((pod) => `${pod.name}(${pod.status})`).join(', ')}`,
  );
  if (MOCK_DIVERSE_POD_STATUSES) {
    console.log(
      '  note:         MOCK_DIVERSE_POD_STATUSES overrides tool-output status (icons use live watch)',
    );
  }
  console.log(`  projects:     ${PROJECT_NAMES.join(', ')}`);
  console.log(`  namespaces:   ${NAMESPACE_NAMES.join(', ')}`);
  console.log(`  nodes:        ${NODE_NAMES.join(', ')}`);
  for (const { key, names } of listResourceRuntime) {
    console.log(`  ${key.padEnd(13)} ${names.join(', ')}`);
  }
  console.log('');
  console.log('Try in Lightspeed: "list secrets", "list routes", "list statefulsets", …');
  console.log('Force a scenario: MOCK_OLS_SCENARIO=routes npm run start-mock-ols');
  console.log('');
  console.log('Next: npm run start  (terminal 2)');
  console.log('');
  console.log('Then: oc login && npm run start-console  (terminal 3)');
  console.log('      or: kind create cluster && npm run start-console  (no OpenShift needed)');
  console.log('');
  console.log('Finally: open http://localhost:9000');
});
