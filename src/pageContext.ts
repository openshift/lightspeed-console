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

export const getModelKindName = (modelKey: string, models: Record<string, K8sModelRef>): string =>
  models[modelKey]?.kind ?? modelKey.split('~').pop() ?? modelKey;

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

  const modelKey = resolveKindToModelKey(ref.kind, models);
  if (!modelKey) {
    return null;
  }

  const model = models[modelKey];
  const urlSegment = getModelUrlSegment(modelKey, models);
  if (!urlSegment) {
    return null;
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
