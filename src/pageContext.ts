import { isValidNamespaceName, isValidResourceName } from './validation';

export type K8sModelRef = {
  kind?: string;
  plural?: string;
  namespaced?: boolean;
};

export type ResourceRef = {
  kind: string;
  name: string;
  namespace?: string;
  /** Use the OpenShift project route (/k8s/cluster/projects/…) instead of namespaces. */
  useProjectRoute?: boolean;
};

// Resolve a URL resource key to a k8s model key. The URL segment can be a direct model key
// (e.g. "Pod"), a plural (e.g. "pods"), or a group~version~kind reference where the model
// is stored under just the kind (e.g. "core~v1~Pod" → "Pod").
export const resolveModelKey = (
  urlKey: string,
  models: Record<string, K8sModelRef>,
): string | undefined => {
  if (models[urlKey]) {
    return urlKey;
  }
  const byPlural = Object.keys(models).find((k) => models[k].plural === urlKey);
  if (byPlural) {
    return byPlural;
  }
  if (urlKey.includes('~')) {
    const kindPart = urlKey.split('~').pop();
    if (kindPart && models[kindPart]) {
      return kindPart;
    }
    return Object.keys(models).find((key) => key === urlKey || key.endsWith(`~${kindPart}`));
  }
  return undefined;
};

export const resolveKindToModelKey = (
  kind: string,
  models: Record<string, K8sModelRef>,
): string | undefined => {
  if (kind === 'Project' && models.Namespace) {
    return 'Namespace';
  }

  if (models[kind]) {
    return kind;
  }

  const byKindField = Object.keys(models).find((key) => models[key].kind === kind);
  if (byKindField) {
    return byKindField;
  }

  if (kind.includes('~')) {
    const kindPart = kind.split('~').pop();
    if (kindPart && models[kindPart]) {
      return kindPart;
    }
    return Object.keys(models).find((key) => key === kind || key.endsWith(`~${kindPart}`));
  }

  return undefined;
};

/** Resolve a {@link ResourceRef} to a console k8s model key. */
export const resolveRefModelKey = (
  ref: ResourceRef,
  models: Record<string, K8sModelRef>,
): string | undefined => {
  if (ref.useProjectRoute && models.Namespace) {
    return 'Namespace';
  }
  return resolveKindToModelKey(ref.kind, models);
};

/** Like {@link resolveRefModelKey}, but falls back to `ref.kind` when models are unknown. */
export const resolveRefModelKeyOrKind = (
  ref: ResourceRef,
  models: Record<string, K8sModelRef>,
): string => resolveRefModelKey(ref, models) ?? ref.kind;

export const getModelKindName = (modelKey: string, models: Record<string, K8sModelRef>): string =>
  models[modelKey]?.kind ?? modelKey.split('~').pop() ?? modelKey;

/** Model reference for console ResourceIcon (e.g. Pod or group~version~kind for CRDs). */
export const getResourceIconKind = (
  ref: ResourceRef,
  models: Record<string, K8sModelRef>,
): string => {
  if (ref.useProjectRoute) {
    return 'Project';
  }
  return resolveRefModelKeyOrKind(ref, models);
};

export const isClusterScopedRef = (
  ref: ResourceRef,
  models: Record<string, K8sModelRef>,
): boolean => {
  const modelKey = resolveRefModelKey(ref, models);
  if (!modelKey) {
    return false;
  }
  return models[modelKey]?.namespaced === false;
};

export const isNamespacedRef = (ref: ResourceRef, models: Record<string, K8sModelRef>): boolean => {
  const modelKey = resolveRefModelKey(ref, models);
  if (!modelKey) {
    return true;
  }
  return models[modelKey]?.namespaced !== false;
};

export const getModelUrlSegment = (
  modelKey: string,
  models: Record<string, K8sModelRef>,
): string | undefined => {
  if (modelKey.includes('~')) {
    return modelKey;
  }
  return models[modelKey]?.plural;
};

export const buildResourceConsolePath = (
  ref: ResourceRef,
  models: Record<string, K8sModelRef>,
): string | null => {
  const { name, namespace } = ref;
  if (!isValidResourceName(name)) {
    return null;
  }
  if (namespace !== undefined && !isValidNamespaceName(namespace)) {
    return null;
  }

  const modelKey = resolveRefModelKey(ref, models);
  if (!modelKey) {
    return null;
  }

  const model = models[modelKey];
  const urlSegment = getModelUrlSegment(modelKey, models);
  if (!urlSegment) {
    return null;
  }

  if (modelKey === 'Namespace' && ref.useProjectRoute) {
    return `/k8s/cluster/projects/${name}`;
  }

  if (model.namespaced) {
    if (!namespace) {
      return null;
    }
    return `/k8s/ns/${namespace}/${urlSegment}/${name}`;
  }

  return `/k8s/cluster/${urlSegment}/${name}`;
};

export const buildPageContext = (
  kind: string | undefined,
  name: string | undefined,
  namespace: string | undefined,
): string | undefined => {
  if (!kind) {
    return undefined;
  }

  if (name) {
    const ns = namespace ? ` in namespace "${namespace}"` : '';
    return `The user is viewing the details of ${kind} "${name}"${ns} in the OpenShift web console.`;
  }

  const ns = namespace ? ` in namespace "${namespace}"` : ' across all namespaces';
  return `The user is viewing a list of ${kind} resources${ns} in the OpenShift web console.`;
};
