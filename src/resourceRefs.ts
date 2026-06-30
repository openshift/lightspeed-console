import { load as loadYAML } from 'js-yaml';

import { getModelKindName, K8sModelRef, resolveKindToModelKey, ResourceRef } from './pageContext';
import {
  applyListToolNamespaceDefault,
  extractResourcesFromMcpTableContent,
  extractResourcesFromVerticalListing,
  getResourceListToolContexts,
  hasBulkResourceListTool,
  isResourceListToolName,
  toNamespaceRef,
} from './resourceListParsing';
import { Tool } from './types';

export type { ResourceRef } from './pageContext';
export { buildResourceConsolePath } from './pageContext';
export {
  extractResourcesFromMcpTableContent,
  getResourceListToolContexts,
  hasBulkResourceListTool,
  isNamespaceStatusLine,
} from './resourceListParsing';

const TEXT_RESOURCE_PATTERN = /\b([A-Z][a-zA-Z0-9]+)\s+[`'"]?([a-z0-9][a-z0-9.-]*)/g;

const POD_NAME_FIELD_PATTERN = /\bName:\s*([a-z0-9][a-z0-9.-]*)/gi;

const POD_NAME_SUFFIX_PATTERN = /\b([a-z0-9][a-z0-9.-]*)\s+pods?\b/gi;

const NAMESPACE_PATTERN = /namespace\s+[`'"]?([a-z0-9][a-z0-9-]*)[`'"]?/gi;

const K8S_RESOURCE_NAME_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;

const RESOURCE_NAME_STOP_WORDS = new Set([
  'is',
  'will',
  'object',
  'not',
  'has',
  'are',
  'was',
  'were',
  'been',
  'being',
  'the',
  'and',
  'for',
  'that',
  'this',
  'when',
  'more',
  'some',
  'any',
  'all',
  'can',
  'may',
  'our',
  'out',
  'own',
  'too',
  'very',
  'just',
  'now',
  'then',
  'than',
  'also',
  'into',
  'over',
  'such',
  'only',
  'other',
  'about',
  'after',
  'before',
  'between',
  'during',
  'without',
  'within',
  'never',
  'always',
  'properly',
  'configured',
  'means',
  'need',
  'check',
  'consider',
  'failure',
  'ensure',
  'working',
  'active',
  'finish',
  'updating',
  'unavailable',
]);

export const isPlausibleResourceName = (
  name: string,
  options?: { fromText?: boolean },
): boolean => {
  if (!name || name.length < 2) {
    return false;
  }
  if (!K8S_RESOURCE_NAME_RE.test(name)) {
    return false;
  }
  if (RESOURCE_NAME_STOP_WORDS.has(name)) {
    return false;
  }
  // Prose like "ClusterVersion object" or "MachineConfigPool will" — require workload-like names.
  if (options?.fromText && !/[0-9-]/.test(name)) {
    return false;
  }
  return true;
};


const K8S_NODE_NAME_RE = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;

export const extractNodesFromTopContent = (content: string): ResourceRef[] => {
  const refs: ResourceRef[] = [];
  const seen = new Set<string>();

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || /^NAME\b/i.test(trimmed)) {
      continue;
    }

    const name = trimmed.split(/\s+/)[0];
    if (!name || !K8S_NODE_NAME_RE.test(name) || !isPlausibleResourceName(name)) {
      continue;
    }

    const key = name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    refs.push({ kind: 'Node', name });
  }

  return refs;
};

export const extractNamespacesFromListContent = (content: string): ResourceRef[] =>
  extractResourcesFromMcpTableContent(content).filter((ref) => ref.kind === 'Namespace');

export const extractNodesFromResourcesListContent = (content: string): ResourceRef[] =>
  extractResourcesFromMcpTableContent(content).filter((ref) => ref.kind === 'Node');

export const hasNodesTopListTool = (tools?: Record<string, Tool>): boolean =>
  Object.values(tools ?? {}).some((tool) => {
    if (tool.isDenied || tool.status === 'error' || tool.name !== 'nodes_top') {
      return false;
    }
    if (typeof tool.args?.name === 'string' && tool.args.name) {
      return false;
    }
    return extractNodesFromTopContent(tool.content ?? '').length > 0;
  });

export const hasResourceListNodesTool = (tools?: Record<string, Tool>): boolean =>
  Object.values(tools ?? {}).some((tool) => {
    if (tool.isDenied || tool.status === 'error' || tool.name !== 'resources_list') {
      return false;
    }
    return tool.args?.kind === 'Node';
  });

export const hasBulkNodeListTool = (tools?: Record<string, Tool>): boolean =>
  hasNodesTopListTool(tools) || hasResourceListNodesTool(tools);

export const hasNamespacesListTool = (tools?: Record<string, Tool>): boolean =>
  getResourceListToolContexts(tools).some((context) => context.kind === 'Namespace');

export const hasBulkNamespaceListTool = (tools?: Record<string, Tool>): boolean =>
  hasNamespacesListTool(tools);

export const hasPodListTool = (tools?: Record<string, Tool>): boolean =>
  getResourceListToolContexts(tools).some((context) => context.kind === 'Pod');

type EventInvolvedObject = {
  Kind?: string;
  Name?: string;
  Namespace?: string;
  kind?: string;
  name?: string;
  namespace?: string;
};

type EventDocument = {
  InvolvedObject?: EventInvolvedObject;
  involvedObject?: EventInvolvedObject;
  Namespace?: string;
  metadata?: { namespace?: string };
};

const pickStringField = (record: Record<string, unknown>, ...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value) {
      return value;
    }
  }
  return undefined;
};

const extractRefsFromStructuredListItems = (
  structured: Record<string, unknown> | undefined,
  toolArgs: Record<string, unknown>,
  toolName?: string,
): ResourceRef[] => {
  const items = structured?.items;
  if (!Array.isArray(items)) {
    return [];
  }

  const defaultKind =
    typeof toolArgs.kind === 'string'
      ? toolArgs.kind
      : toolName === 'namespaces_list'
        ? 'Namespace'
        : toolName === 'projects_list'
          ? 'Project'
          : undefined;
  const defaultNamespace = typeof toolArgs.namespace === 'string' ? toolArgs.namespace : undefined;
  const refs: ResourceRef[] = [];

  for (const item of items) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const row = item as Record<string, unknown>;
    const name = pickStringField(row, 'Name', 'name');
    const kind = pickStringField(row, 'kind', 'Kind') ?? defaultKind;
    if (!name || !kind) {
      continue;
    }
    const namespace = pickStringField(row, 'Namespace', 'namespace') ?? defaultNamespace;
    refs.push(toNamespaceRef({ kind, name, namespace }));
  }

  return refs;
};

const listElementKind = (listKind: string): string | undefined =>
  listKind.endsWith('List') ? listKind.slice(0, -4) : undefined;

const extractRefFromObject = (obj: unknown): ResourceRef | null => {
  if (!obj || typeof obj !== 'object') {
    return null;
  }
  const record = obj as { kind?: string; metadata?: { name?: string; namespace?: string } };
  const kind = record.kind;
  const name = record.metadata?.name;
  const namespace = record.metadata?.namespace;
  if (kind && name) {
    return { kind, name, namespace };
  }
  return null;
};

const extractRefsFromDocumentArray = (parsed: unknown): ResourceRef[] => {
  if (!Array.isArray(parsed)) {
    return [];
  }

  const refs: ResourceRef[] = [];
  for (const item of parsed) {
    const ref = extractRefFromObject(item);
    if (ref) {
      refs.push(toNamespaceRef(ref));
    }
  }
  return refs;
};

export const extractRefsFromEventsDocument = (parsed: unknown): ResourceRef[] => {
  const events = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  const refs: ResourceRef[] = [];
  const seen = new Set<string>();

  for (const event of events) {
    if (!event || typeof event !== 'object') {
      continue;
    }
    const record = event as EventDocument;
    const involved = record.InvolvedObject ?? record.involvedObject;
    if (!involved) {
      continue;
    }
    const kind = involved.Kind ?? involved.kind;
    const name = involved.Name ?? involved.name;
    if (!kind || !name || !isPlausibleResourceName(name)) {
      continue;
    }
    const namespace =
      involved.Namespace ??
      involved.namespace ??
      record.Namespace ??
      record.metadata?.namespace;
    const ref = toNamespaceRef({ kind, name, namespace });
    const key = `${ref.kind}/${ref.namespace ?? ''}/${ref.name}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    refs.push(ref);
  }

  return refs;
};

const hasPodInvestigationTools = (tools?: Record<string, Tool>): boolean =>
  Object.values(tools ?? {}).some(
    (tool) => tool.name.startsWith('pods_') || tool.name === 'events_list',
  );

const extractRefsFromListDocument = (
  parsed: { kind?: string; items?: unknown[] },
  fallbackNamespace?: string,
): ResourceRef[] => {
  if (!Array.isArray(parsed.items)) {
    return [];
  }
  const defaultKind = parsed.kind ? listElementKind(parsed.kind) : undefined;
  const refs: ResourceRef[] = [];
  for (const item of parsed.items) {
    const ref = extractRefFromObject(item);
    if (!ref) {
      continue;
    }
    refs.push({
      kind: ref.kind ?? defaultKind ?? 'Pod',
      name: ref.name,
      namespace: ref.namespace ?? fallbackNamespace,
    });
  }
  return refs;
};

const resolveModelKeyFromToolPrefix = (
  toolPrefix: string,
  models: Record<string, K8sModelRef>,
): string | undefined => {
  const normalized = toolPrefix.toLowerCase();
  return Object.keys(models).find((key) => {
    const model = models[key];
    return (
      key.toLowerCase() === normalized ||
      model.kind?.toLowerCase() === normalized ||
      model.plural?.toLowerCase() === normalized
    );
  });
};

export const normalizeResourceRef = (
  ref: ResourceRef,
  models: Record<string, K8sModelRef>,
): ResourceRef | null => {
  if (!isPlausibleResourceName(ref.name)) {
    return null;
  }
  const modelKey = resolveKindToModelKey(ref.kind, models);
  if (!modelKey) {
    return null;
  }
  return { kind: modelKey, name: ref.name, namespace: ref.namespace };
};

export const extractResourceFromToolArgs = (
  toolName: string,
  args: Record<string, unknown>,
  models: Record<string, K8sModelRef>,
): ResourceRef | null => {
  const name = typeof args.name === 'string' ? args.name : undefined;
  const namespace = typeof args.namespace === 'string' ? args.namespace : undefined;

  if (toolName === 'pods_get' || toolName === 'pods_log' || toolName === 'pods_delete') {
    return name ? { kind: 'Pod', name, namespace } : null;
  }

  if (toolName === 'resources_get' || toolName === 'resources_delete') {
    const kind = typeof args.kind === 'string' ? args.kind : undefined;
    if (kind && name) {
      return { kind, name, namespace };
    }
  }

  if (toolName === 'resources_list' || toolName === 'resources_scale') {
    const kind = typeof args.kind === 'string' ? args.kind : undefined;
    if (kind && namespace) {
      return { kind, name: kind, namespace };
    }
  }

  if (toolName === 'nodes_log' || toolName === 'nodes_top') {
    return name ? { kind: 'Node', name } : null;
  }

  if (name) {
    const modelKey = resolveModelKeyFromToolPrefix(toolName.split('_')[0], models);
    if (modelKey) {
      return { kind: modelKey, name, namespace };
    }
  }

  return null;
};

export const extractResourcesFromToolContent = (
  content: string,
  toolName?: string,
  toolArgs?: Record<string, unknown>,
): ResourceRef[] => {
  if (!content) {
    return [];
  }

  const fallbackNamespace =
    typeof toolArgs?.namespace === 'string' ? toolArgs.namespace : undefined;

  try {
    const parsed = JSON.parse(content) as unknown;
    const fromArray = extractRefsFromDocumentArray(parsed);
    if (fromArray.length > 0) {
      return fromArray;
    }
    const listDoc = parsed as { kind?: string; items?: unknown[] };
    const fromList = extractRefsFromListDocument(listDoc, fallbackNamespace);
    if (fromList.length > 0) {
      return fromList;
    }
    const single = extractRefFromObject(parsed);
    if (single) {
      return [toNamespaceRef(single)];
    }
  } catch {
    // Not JSON.
  }

  try {
    const parsed = loadYAML(content) as unknown;
    if (toolName === 'events_list') {
      const fromEvents = extractRefsFromEventsDocument(parsed);
      if (fromEvents.length > 0) {
        return fromEvents;
      }
    }
    const fromArray = extractRefsFromDocumentArray(parsed);
    if (fromArray.length > 0) {
      return fromArray;
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const listDoc = parsed as { kind?: string; items?: unknown[] };
      const fromList = extractRefsFromListDocument(listDoc, fallbackNamespace);
      if (fromList.length > 0) {
        return fromList;
      }
      const single = extractRefFromObject(parsed);
      if (single) {
        return [toNamespaceRef(single)];
      }
    }
  } catch {
    // Not YAML.
  }

  if (toolName === 'nodes_top') {
    return extractNodesFromTopContent(content);
  }

  if (isResourceListToolName(toolName)) {
    const fromTable = extractResourcesFromMcpTableContent(content);
    if (fromTable.length > 0) {
      return applyListToolNamespaceDefault(fromTable, fallbackNamespace);
    }
  }

  return [];
};

export const extractResourceFromToolContent = (content: string): ResourceRef | null =>
  extractResourcesFromToolContent(content)[0] ?? null;

export const extractResourcesFromText = (
  text: string,
  models: Record<string, K8sModelRef>,
  tools?: Record<string, Tool>,
): ResourceRef[] => {
  const refs: ResourceRef[] = [];
  const namespaces = [...text.matchAll(NAMESPACE_PATTERN)].map((m) => m[1]);
  const defaultNamespace = namespaces[0];

  for (const match of text.matchAll(TEXT_RESOURCE_PATTERN)) {
    const kindCandidate = match[1];
    const name = match[2];
    if (!isPlausibleResourceName(name, { fromText: true })) {
      continue;
    }
    const modelKey = resolveKindToModelKey(kindCandidate, models);
    if (!modelKey) {
      continue;
    }
    refs.push({
      kind: modelKey,
      name,
      namespace: defaultNamespace,
    });
  }

  const podsNamespace = tools
    ? Object.values(tools).find((tool) => tool.name === 'pods_list_in_namespace')?.args
        ?.namespace
    : undefined;
  const podNamespace =
    typeof podsNamespace === 'string' ? podsNamespace : defaultNamespace;

  if (tools && hasPodInvestigationTools(tools)) {
    for (const match of text.matchAll(POD_NAME_FIELD_PATTERN)) {
      const name = match[1];
      if (!isPlausibleResourceName(name)) {
        continue;
      }
      refs.push({
        kind: 'Pod',
        name,
        namespace: podNamespace,
      });
    }

    for (const match of text.matchAll(POD_NAME_SUFFIX_PATTERN)) {
      const name = match[1];
      if (!isPlausibleResourceName(name, { fromText: true })) {
        continue;
      }
      refs.push({
        kind: 'Pod',
        name,
        namespace: podNamespace,
      });
    }
  }

  if (tools && hasBulkResourceListTool(tools)) {
    const listContexts = getResourceListToolContexts(tools);
    for (const ref of extractResourcesFromVerticalListing(text, listContexts, isPlausibleResourceName)) {
      refs.push(ref);
    }
  }

  return refs;
};

const resourceKey = (ref: ResourceRef): string => `${ref.kind}/${ref.namespace ?? ''}/${ref.name}`;

export const resourceRefKey = resourceKey;

export const getMentionedPodNames = (responseText?: string): string[] => {
  if (!responseText) {
    return [];
  }

  const names: string[] = [];
  const seen = new Set<string>();
  const addName = (name: string) => {
    if (!isPlausibleResourceName(name, { fromText: true })) {
      return;
    }
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      names.push(name);
    }
  };
  for (const match of responseText.matchAll(POD_NAME_FIELD_PATTERN)) {
    addName(match[1]);
  }
  for (const match of responseText.matchAll(POD_NAME_SUFFIX_PATTERN)) {
    addName(match[1]);
  }
  return names;
};

export const getMentionedNodeNames = (responseText?: string): string[] =>
  extractResourcesFromVerticalListing(
    responseText ?? '',
    [{ kind: 'Node' }],
    isPlausibleResourceName,
  ).map((ref) => ref.name);

export const getMentionedResourceNames = (
  responseText?: string,
  tools?: Record<string, Tool>,
): string[] => {
  const names: string[] = [];
  const seen = new Set<string>();
  const addName = (name: string) => {
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      names.push(name);
    }
  };

  for (const name of getMentionedPodNames(responseText)) {
    addName(name);
  }
  if (hasBulkResourceListTool(tools)) {
    for (const ref of extractResourcesFromVerticalListing(
      responseText ?? '',
      getResourceListToolContexts(tools),
      isPlausibleResourceName,
    )) {
      addName(ref.name);
    }
  }
  return names;
};

export const getMentionedNamespaceNames = (responseText?: string): string[] =>
  extractResourcesFromVerticalListing(
    responseText ?? '',
    [{ kind: 'Namespace' }],
    isPlausibleResourceName,
  ).map((ref) => ref.name);

export const getPreferredResourceName = (responseText?: string): string | undefined =>
  getMentionedPodNames(responseText)[0];

export const extractResourceRefs = (
  tools: Record<string, Tool> | undefined,
  responseText: string | undefined,
  models: Record<string, K8sModelRef>,
): ResourceRef[] => {
  const seen = new Set<string>();
  const refs: ResourceRef[] = [];

  const addRef = (ref: ResourceRef | null) => {
    const normalized = ref ? normalizeResourceRef(ref, models) : null;
    if (!normalized) {
      return;
    }
    const key = resourceKey(normalized);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    refs.push(normalized);
  };

  if (tools) {
    Object.values(tools).forEach((tool) => {
      if (tool.isDenied || tool.status === 'error') {
        return;
      }
      const args = (tool.args ?? {}) as Record<string, unknown>;
      addRef(extractResourceFromToolArgs(tool.name, args, models));
      extractResourcesFromToolContent(tool.content, tool.name, args).forEach((ref) => addRef(ref));
      extractRefsFromStructuredListItems(tool.structuredContent, args, tool.name).forEach((ref) =>
        addRef(ref),
      );
    });
  }

  if (responseText) {
    extractResourcesFromText(responseText, models, tools).forEach(addRef);
  }

  return refs;
};

export const formatResourceLabel = (
  ref: ResourceRef,
  models: Record<string, K8sModelRef>,
): string => {
  const kindName = getModelKindName(ref.kind, models);
  const ns = ref.namespace ? ` (${ref.namespace})` : '';
  return `${kindName}/${ref.name}${ns}`;
};
