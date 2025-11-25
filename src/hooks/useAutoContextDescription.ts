import * as React from 'react';
import { useLocation } from 'react-router-dom-v5-compat';
import { useLocationContext } from './useLocationContext';

/**
 * Converts API resource names to user-friendly display names
 */
const formatResourceType = (resourceType: string): string => {
  // Handle console API format like "core~v1~Pod" or "apps~v1~Deployment"
  if (resourceType.includes('~')) {
    const parts = resourceType.split('~');
    if (parts.length === 3) {
      const [, , kind] = parts;
      // Return the kind directly for tilde-separated formats
      return kind;
    }
  }

  const typeMap: { [key: string]: string } = {
    // Core resources
    pods: 'Pod',
    deployments: 'Deployment',
    services: 'Service',
    configmaps: 'ConfigMap',
    secrets: 'Secret',
    persistentvolumes: 'PersistentVolume',
    persistentvolumeclaims: 'PersistentVolumeClaim',
    nodes: 'Node',
    namespaces: 'Namespace',
    events: 'Event',

    // Apps
    replicasets: 'ReplicaSet',
    daemonsets: 'DaemonSet',
    statefulsets: 'StatefulSet',
    jobs: 'Job',
    cronjobs: 'CronJob',

    // Network
    ingresses: 'Ingress',
    networkpolicies: 'NetworkPolicy',

    // RBAC
    roles: 'Role',
    rolebindings: 'RoleBinding',
    clusterroles: 'ClusterRole',
    clusterrolebindings: 'ClusterRoleBinding',
    serviceaccounts: 'ServiceAccount',

    // Storage
    storageclasses: 'StorageClass',
    volumeattachments: 'VolumeAttachment',

    // OpenShift specific
    routes: 'Route',
    buildconfigs: 'BuildConfig',
    builds: 'Build',
    deploymentconfigs: 'DeploymentConfig',
    imagestreams: 'ImageStream',

    // Operators
    operators: 'Operator',
    operatorgroups: 'OperatorGroup',
    subscriptions: 'Subscription',
    installplans: 'InstallPlan',
    catalogsources: 'CatalogSource',

    // Monitoring
    servicemonitors: 'ServiceMonitor',
    prometheusrules: 'PrometheusRule',
    alertmanagers: 'Alertmanager',

    // Machine API
    machines: 'Machine',
    machinesets: 'MachineSet',
    machineconfigpools: 'MachineConfigPool',

    // Virtualization
    virtualmachines: 'VirtualMachine',
    virtualmachineinstances: 'VirtualMachineInstance',
  };

  return typeMap[resourceType] || resourceType;
};

/**
 * Extracts resource type from URL path patterns
 */
const extractResourceTypeFromPath = (pathname: string): string | null => {
  // Pattern: /k8s/ns/{namespace}/{resourceType} or /k8s/cluster/{resourceType}
  const patterns = [
    /\/k8s\/ns\/[^/]+\/([^/]+)\/?$/, // Namespaced list pages
    /\/k8s\/cluster\/([^/]+)\/?$/, // Cluster-scoped list pages
    /\/k8s\/ns\/[^/]+\/([^/]+)\/[^/]+$/, // Resource detail pages (extract type)
    /\/k8s\/cluster\/([^/]+)\/[^/]+$/, // Cluster detail pages (extract type)
  ];

  for (const pattern of patterns) {
    const match = pathname.match(pattern);
    if (match) {
      const resourceType = match[1];
      // Convert plural API resource names to friendly names
      return formatResourceType(resourceType);
    }
  }

  return null;
};

/**
 * Generates context description based on current page information
 */
const generateContextDescription = (
  pathname: string,
  kind?: string,
  name?: string,
  namespace?: string,
): string | null => {
  // Resource detail pages
  if (kind && name) {
    if (namespace) {
      return `User is viewing ${kind} "${name}" in namespace "${namespace}"`;
    }
    return `User is viewing cluster-scoped ${kind} "${name}"`;
  }

  // Extract namespace directly from URL if not provided by useLocationContext
  let detectedNamespace = namespace;
  const namespaceMatch = pathname.match(/\/k8s\/ns\/([^/]+)/);
  if (namespaceMatch && !detectedNamespace) {
    detectedNamespace = namespaceMatch[1];
  }

  // List pages - prioritize k8s namespace patterns
  if (pathname.includes('/k8s/ns/')) {
    const resourceType = extractResourceTypeFromPath(pathname);
    if (resourceType && detectedNamespace) {
      return `User is looking at the ${resourceType} list in the "${detectedNamespace}" namespace`;
    }
    // Fallback if we can't extract resource type but have namespace
    if (detectedNamespace) {
      return `User is viewing resources in the "${detectedNamespace}" namespace`;
    }
  }

  // Cluster-scoped list pages
  if (pathname.includes('/k8s/cluster/')) {
    const resourceType = extractResourceTypeFromPath(pathname);
    if (resourceType) {
      return `User is looking at the cluster-scoped ${resourceType} list`;
    }
  }

  // Special pages
  if (pathname.includes('/monitoring/alerts')) {
    return 'User is on the monitoring alerts page';
  }

  if (pathname.includes('/workloads')) {
    return 'User is on the workloads overview page';
  }

  if (pathname.includes('/topology')) {
    return 'User is on the topology view page';
  }

  if (pathname.includes('/project-details')) {
    return 'User is on the project details page';
  }

  if (pathname === '/' || pathname.includes('/overview')) {
    return 'User is on the OpenShift console overview page';
  }

  if (pathname.includes('/search')) {
    return 'User is on the search page';
  }

  if (pathname.includes('/catalog')) {
    return 'User is on the developer catalog page';
  }

  if (pathname.includes('/helm-releases')) {
    return 'User is on the Helm releases page';
  }

  if (pathname.includes('/operatorhub')) {
    return 'User is on the OperatorHub page';
  }

  if (pathname.includes('/builds')) {
    return 'User is on the builds page';
  }

  if (pathname.includes('/pipelines')) {
    return 'User is on the pipelines page';
  }

  if (pathname.includes('/secrets')) {
    return 'User is on the secrets page';
  }

  if (pathname.includes('/configmaps')) {
    return 'User is on the config maps page';
  }

  if (pathname.includes('/networking')) {
    return 'User is on the networking page';
  }

  if (pathname.includes('/storage')) {
    return 'User is on the storage page';
  }

  if (pathname.includes('/compute')) {
    return 'User is on the compute page';
  }

  if (pathname.includes('/administration')) {
    return 'User is on the administration page';
  }

  // ACM-specific pages
  if (pathname.includes('/multicloud')) {
    if (pathname.includes('/clusters')) {
      return 'User is on the Advanced Cluster Management clusters page';
    }
    if (pathname.includes('/applications')) {
      return 'User is on the Advanced Cluster Management applications page';
    }
    return 'User is on an Advanced Cluster Management page';
  }

  // For unknown pages, provide basic path info
  if (pathname && pathname !== '/') {
    return `User is on page: ${pathname}`;
  }

  // No useful context available
  return null;
};

/**
 * Generates a human-readable description of the user's current page context
 * for automatic inclusion in OpenShift Lightspeed prompts.
 * This context is invisible to the user but helps the LLM understand what page they're on.
 */
export const useAutoContextDescription = (): string | null => {
  const location = useLocation();
  const [kind, name, namespace] = useLocationContext();

  return React.useMemo(
    () => generateContextDescription(location.pathname, kind, name, namespace),
    [location.pathname, kind, name, namespace],
  );
};
