import { ResourceRef } from './pageContext';
import { Tool } from './types';

export const K8S_NODE_NAME_RE = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;

const RESOURCE_AGE_LINE = /^\d+([wdhms]\d*)+$/i;

const NAMESPACE_STATUS_WORDS = new Set(['active', 'terminating']);

const VERTICAL_LIST_SKIP_WORDS = new Set([
  'active',
  'terminating',
  'running',
  'pending',
  'succeeded',
  'failed',
  'unknown',
  'ready',
  'true',
  'false',
  'available',
  'progressing',
  'replicafailure',
  'worker',
  'master',
  'control-plane',
]);

const READY_FRACTION_LINE = /^\d+\/\d+$/;
const PERCENT_LINE = /^\d+%$/;
const IP_LINE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

const RESOURCE_LIST_TOOL_NAMES = new Set([
  'resources_list',
  'pods_list',
  'pods_list_in_namespace',
  'namespaces_list',
  'projects_list',
]);

const isApiVersionToken = (token: string): boolean => token === 'v1' || token.includes('/');

const isTableHeaderLine = (line: string): boolean => /^(NAME|NAMESPACE|APIVERSION)\b/i.test(line);

export const isNamespaceStatusLine = (line: string): boolean =>
  NAMESPACE_STATUS_WORDS.has(line.toLowerCase());

export const isVerticalListNoiseLine = (line: string): boolean => {
  const lower = line.toLowerCase();
  if (RESOURCE_AGE_LINE.test(line)) {
    return true;
  }
  if (isNamespaceStatusLine(line)) {
    return true;
  }
  if (VERTICAL_LIST_SKIP_WORDS.has(lower)) {
    return true;
  }
  if (READY_FRACTION_LINE.test(line)) {
    return true;
  }
  if (PERCENT_LINE.test(line)) {
    return true;
  }
  if (IP_LINE.test(line)) {
    return true;
  }
  if (/^\d+$/.test(line)) {
    return true;
  }
  return false;
};

export type ResourceListToolContext = {
  kind: string;
  namespace?: string;
};

export const toNamespaceRef = (ref: ResourceRef): ResourceRef =>
  ref.kind === 'Project' ? { kind: 'Namespace', name: ref.name, useProjectRoute: true } : ref;

export const extractResourcesFromMcpTableContent = (content: string): ResourceRef[] => {
  const refs: ResourceRef[] = [];
  const seen = new Set<string>();

  const add = (ref: ResourceRef) => {
    const normalized = toNamespaceRef(ref);
    const key = `${normalized.kind}/${normalized.namespace ?? ''}/${normalized.name}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    refs.push(normalized);
  };

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || isTableHeaderLine(trimmed)) {
      continue;
    }

    const parts = trimmed.split(/\s+/);
    if (parts.length < 3) {
      continue;
    }

    if (isApiVersionToken(parts[0])) {
      const kind = parts[1];
      const name = parts[2];
      add({ kind, name });
      continue;
    }

    if (parts.length >= 4 && isApiVersionToken(parts[1])) {
      const namespace = parts[0];
      const kind = parts[2];
      const name = parts[3];
      add({ kind, name, namespace });
    }
  }

  return refs;
};

export const applyListToolNamespaceDefault = (
  refs: ResourceRef[],
  namespace?: string,
): ResourceRef[] => {
  if (!namespace) {
    return refs;
  }
  return refs.map((ref) => (ref.namespace ? ref : { ...ref, namespace }));
};

export const resourceListToolContextFromTool = (tool: Tool): ResourceListToolContext | null => {
  if (tool.isDenied || tool.status === 'error') {
    return null;
  }

  const args = tool.args ?? {};

  switch (tool.name) {
    case 'resources_list': {
      const kind = typeof args.kind === 'string' ? args.kind : undefined;
      if (!kind) {
        return null;
      }
      const namespace = typeof args.namespace === 'string' ? args.namespace : undefined;
      return { kind, namespace };
    }
    case 'pods_list':
      return { kind: 'Pod' };
    case 'pods_list_in_namespace': {
      const namespace = typeof args.namespace === 'string' ? args.namespace : undefined;
      if (!namespace) {
        return null;
      }
      return { kind: 'Pod', namespace };
    }
    case 'namespaces_list':
    case 'projects_list':
      return { kind: 'Namespace' };
    case 'nodes_top':
      if (typeof args.name === 'string' && args.name) {
        return null;
      }
      return { kind: 'Node' };
    default:
      return null;
  }
};

export const getResourceListToolContexts = (
  tools?: Record<string, Tool>,
): ResourceListToolContext[] => {
  const contexts: ResourceListToolContext[] = [];
  const seen = new Set<string>();

  for (const tool of Object.values(tools ?? {})) {
    const context = resourceListToolContextFromTool(tool);
    if (!context) {
      continue;
    }
    const key = `${context.kind}/${context.namespace ?? ''}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    contexts.push(context);
  }

  return contexts;
};

export const isResourceListToolName = (toolName?: string): boolean =>
  !!toolName && RESOURCE_LIST_TOOL_NAMES.has(toolName);

export const hasBulkResourceListTool = (tools?: Record<string, Tool>): boolean =>
  getResourceListToolContexts(tools).length > 0;

const lineMatchesListContext = (line: string, context: ResourceListToolContext): boolean => {
  if (context.kind === 'Node') {
    return line.includes('.') && K8S_NODE_NAME_RE.test(line);
  }
  if (context.kind === 'Namespace') {
    return !isNamespaceStatusLine(line);
  }
  return true;
};

export const extractResourcesFromVerticalListing = (
  text: string,
  contexts: ResourceListToolContext[],
  isPlausibleName: (name: string) => boolean,
): ResourceRef[] => {
  if (contexts.length === 0) {
    return [];
  }

  const refs: ResourceRef[] = [];
  const seen = new Set<string>();

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.includes(' ')) {
      continue;
    }
    if (isVerticalListNoiseLine(trimmed)) {
      continue;
    }
    if (!isPlausibleName(trimmed)) {
      continue;
    }

    for (const context of contexts) {
      if (!lineMatchesListContext(trimmed, context)) {
        continue;
      }
      const ref: ResourceRef = {
        kind: context.kind,
        name: trimmed,
        namespace: context.namespace,
      };
      const key = `${ref.kind}/${ref.namespace ?? ''}/${ref.name}`;
      if (seen.has(key)) {
        break;
      }
      seen.add(key);
      refs.push(ref);
      break;
    }
  }

  return refs;
};
