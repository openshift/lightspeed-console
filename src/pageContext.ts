// Resolve a URL resource key to a k8s model key. The URL segment can be a direct model key
// (e.g. "Pod"), a plural (e.g. "pods"), or a group~version~kind reference where the model
// is stored under just the kind (e.g. "core~v1~Pod" → "Pod").
export const resolveModelKey = (
  urlKey: string,
  models: Record<string, { kind?: string; plural?: string }>,
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
  }
  return undefined;
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
