import {
  getModelKindName,
  K8sModelRef,
  resolveRefModelKey,
  resolveRefModelKeyOrKind,
} from './pageContext';
import { hasBulkResourceListTool } from './resourceListParsing';
import {
  extractResourceRefs,
  getMentionedResourceNames,
  isPlausibleResourceName,
  ResourceRef,
  resourceRefKey,
} from './resourceRefs';
import { Tool } from './types';

/** Default cap for mixed resource types (deployments, single pods, etc.). */
export const MAX_LINKED_RESOURCES = 3;

/** Higher cap when the response is driven by a namespace pod list tool. */
export const MAX_LINKED_RESOURCES_POD_LIST = 12;

export const prioritizeLinkedResources = (
  refs: ResourceRef[],
  responseText?: string,
  tools?: Record<string, Tool>,
): ResourceRef[] => {
  const mentionedNames = getMentionedResourceNames(responseText, tools).map((name) =>
    name.toLowerCase(),
  );
  if (mentionedNames.length === 0) {
    return refs;
  }

  const prioritized: ResourceRef[] = [];
  const used = new Set<string>();

  for (const name of mentionedNames) {
    for (const ref of refs) {
      if (ref.name.toLowerCase() !== name) {
        continue;
      }
      const key = resourceRefKey(ref);
      if (!used.has(key)) {
        prioritized.push(ref);
        used.add(key);
      }
    }
  }

  for (const ref of refs) {
    const key = resourceRefKey(ref);
    if (!used.has(key)) {
      prioritized.push(ref);
    }
  }

  return prioritized;
};

export const isPlausibleResourceRef = (
  ref: ResourceRef,
  models: Record<string, K8sModelRef>,
): boolean => {
  const modelKey = resolveRefModelKeyOrKind(ref, models);
  const kindName = getModelKindName(modelKey, models);
  if (ref.name === kindName) {
    return false;
  }
  return isPlausibleResourceName(ref.name);
};

export const isLinkableResource = (
  ref: ResourceRef,
  models: Record<string, K8sModelRef>,
): boolean => {
  if (!isPlausibleResourceRef(ref, models)) {
    return false;
  }

  const modelKey = resolveRefModelKey(ref, models);
  if (!modelKey) {
    return false;
  }

  const model = models[modelKey];
  if (model.namespaced && !ref.namespace) {
    return false;
  }

  return true;
};

const resolveLinkedResourceLimit = (
  tools: Record<string, Tool> | undefined,
  linkableCount: number,
): number => {
  if (hasBulkResourceListTool(tools) && linkableCount > MAX_LINKED_RESOURCES) {
    return Math.min(linkableCount, MAX_LINKED_RESOURCES_POD_LIST);
  }
  return MAX_LINKED_RESOURCES;
};

export const extractLinkableResourceRefs = (
  tools: Record<string, Tool> | undefined,
  responseText: string | undefined,
  models: Record<string, K8sModelRef>,
): ResourceRef[] =>
  extractResourceRefs(tools, responseText, models).filter((ref) => isLinkableResource(ref, models));

/** Capped list for a future footer LabelGroup; inline links use {@link getInlineLinkedResources}. */
export const extractLinkedResources = (
  tools: Record<string, Tool> | undefined,
  responseText: string | undefined,
  models: Record<string, K8sModelRef>,
): ResourceRef[] => {
  const linkable = extractLinkableResourceRefs(tools, responseText, models);
  const limit = resolveLinkedResourceLimit(tools, linkable.length);
  return prioritizeLinkedResources(linkable, responseText, tools).slice(0, limit);
};

export const getLinkedResourceOverflow = (
  tools: Record<string, Tool> | undefined,
  responseText: string | undefined,
  models: Record<string, K8sModelRef>,
): { shown: number; total: number } => {
  const linkable = extractLinkableResourceRefs(tools, responseText, models);
  const limit = resolveLinkedResourceLimit(tools, linkable.length);
  const shown = prioritizeLinkedResources(linkable, responseText, tools).slice(0, limit).length;
  return { shown, total: linkable.length };
};

/** Linkable resources whose names appear in the response prose (for inline injection). */
export const getInlineLinkedResources = (
  tools: Record<string, Tool> | undefined,
  responseText: string | undefined,
  models: Record<string, K8sModelRef>,
): ResourceRef[] => {
  if (!responseText?.trim()) {
    return [];
  }

  return extractLinkableResourceRefs(tools, responseText, models).filter((ref) =>
    responseText.includes(ref.name),
  );
};
