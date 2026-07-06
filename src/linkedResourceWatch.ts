import { K8sResourceKind } from '@openshift-console/dynamic-plugin-sdk';

import { getModelKindName, K8sModelRef, resolveRefModelKey } from './pageContext';
import { ResourceRef } from './resourceRefs';

export type ResourceWatchProps = {
  isList: false;
  kind: string;
  name: string;
  namespace?: string;
};

export const buildResourceWatchProps = (
  resourceRef: ResourceRef,
  k8sModels: Record<string, K8sModelRef>,
): ResourceWatchProps | null => {
  const modelKey = resolveRefModelKey(resourceRef, k8sModels);
  if (!modelKey) {
    return null;
  }

  const model = k8sModels[modelKey];
  if (model?.namespaced) {
    if (!resourceRef.namespace) {
      return null;
    }
    return {
      isList: false,
      kind: modelKey,
      name: resourceRef.name,
      namespace: resourceRef.namespace,
    };
  }

  return {
    isList: false,
    kind: modelKey,
    name: resourceRef.name,
  };
};

export const matchesResourceRef = (
  resource: K8sResourceKind | undefined,
  resourceRef: ResourceRef,
  k8sModels: Record<string, K8sModelRef>,
): boolean => {
  if (!resource?.metadata?.name) {
    return false;
  }
  if (resource.metadata.name !== resourceRef.name) {
    return false;
  }
  if (
    resourceRef.namespace !== undefined &&
    resource.metadata.namespace !== resourceRef.namespace
  ) {
    return false;
  }
  const modelKey = resolveRefModelKey(resourceRef, k8sModels);
  if (modelKey && resource.kind) {
    const expectedKind = getModelKindName(modelKey, k8sModels);
    if (resource.kind !== expectedKind) {
      return false;
    }
  }
  return true;
};

/** Namespace/project phase (e.g. Active) reflects lifecycle, not console selection — skip the badge. */
const KINDS_WITHOUT_STATUS_BADGE = new Set(['Namespace', 'ConfigMap', 'Secret']);

export const shouldShowLinkedResourceStatus = (
  resourceRef: ResourceRef,
  k8sModels: Record<string, K8sModelRef>,
): boolean => {
  const modelKey = resolveRefModelKey(resourceRef, k8sModels);
  if (!modelKey) {
    return false;
  }
  if (KINDS_WITHOUT_STATUS_BADGE.has(modelKey)) {
    return false;
  }
  return true;
};
