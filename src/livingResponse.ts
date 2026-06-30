import { getModelKindName, K8sModelRef, resolveKindToModelKey } from './pageContext';
import { buildLivingMetrics } from './resourceLivingMetrics';
import {
  extractResourceRefs,
  getMentionedResourceNames,
  hasBulkResourceListTool,
  isPlausibleResourceName,
  ResourceRef,
} from './resourceRefs';
import { isVerticalListNoiseLine } from './resourceListParsing';
import { Tool } from './types';

export type { LivingMetricDef } from './resourceLivingMetrics';
export { buildLivingMetrics };

/** Default cap for mixed resource types (deployments, single pods, etc.). */
export const MAX_LIVING_WIDGETS = 3;

/** Higher cap when the response is driven by a namespace pod list tool. */
export const MAX_LIVING_WIDGETS_POD_LIST = 12;

export const prioritizeLivingResources = (
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

  const byName = new Map(refs.map((ref) => [ref.name.toLowerCase(), ref]));
  const prioritized: ResourceRef[] = [];
  const used = new Set<string>();

  for (const name of mentionedNames) {
    const ref = byName.get(name);
    if (ref) {
      prioritized.push(ref);
      used.add(name);
    }
  }

  for (const ref of refs) {
    const key = ref.name.toLowerCase();
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
  const kindName = getModelKindName(ref.kind, models);
  if (ref.name === kindName) {
    return false;
  }
  return isPlausibleResourceName(ref.name);
};

export const isWatchableResource = (
  ref: ResourceRef,
  models: Record<string, K8sModelRef>,
): boolean => {
  if (!isPlausibleResourceRef(ref, models)) {
    return false;
  }

  const modelKey = resolveKindToModelKey(ref.kind, models);
  if (!modelKey) {
    return false;
  }

  const model = models[modelKey];
  if (model.namespaced && !ref.namespace) {
    return false;
  }

  return true;
};

export const hasCompactableResourceListTool = (tools?: Record<string, Tool>): boolean =>
  hasBulkResourceListTool(tools);

const resolveLivingWidgetLimit = (
  tools: Record<string, Tool> | undefined,
  watchableCount: number,
): number => {
  if (hasCompactableResourceListTool(tools) && watchableCount > MAX_LIVING_WIDGETS) {
    return Math.min(watchableCount, MAX_LIVING_WIDGETS_POD_LIST);
  }
  return MAX_LIVING_WIDGETS;
};

export const extractWatchableResourceRefs = (
  tools: Record<string, Tool> | undefined,
  responseText: string | undefined,
  models: Record<string, K8sModelRef>,
): ResourceRef[] =>
  extractResourceRefs(tools, responseText, models).filter((ref) => isWatchableResource(ref, models));

export const extractLivingResources = (
  tools: Record<string, Tool> | undefined,
  responseText: string | undefined,
  models: Record<string, K8sModelRef>,
): ResourceRef[] => {
  const watchable = extractWatchableResourceRefs(tools, responseText, models);
  const limit = resolveLivingWidgetLimit(tools, watchable.length);
  return prioritizeLivingResources(watchable, responseText, tools).slice(0, limit);
};

export const getLivingResourceOverflow = (
  tools: Record<string, Tool> | undefined,
  responseText: string | undefined,
  models: Record<string, K8sModelRef>,
): { shown: number; total: number } => {
  const watchable = extractWatchableResourceRefs(tools, responseText, models);
  const shown = extractLivingResources(tools, responseText, models).length;
  return { shown, total: watchable.length };
};

const POD_DETAIL_FIELD_LINE = /^(Name|Ready|Status|Restarts|Age|IP|Node):\s*.+/i;
const NODE_METRIC_LINE = /^\d+m$|^\d+Mi$/;

const isListingContinuationLine = (line: string, listedNames: Set<string>): boolean => {
  const trimmed = line.trim();
  if (!trimmed) {
    return true;
  }
  if (POD_DETAIL_FIELD_LINE.test(trimmed)) {
    return true;
  }
  if (isVerticalListNoiseLine(trimmed)) {
    return true;
  }
  if (NODE_METRIC_LINE.test(trimmed)) {
    return true;
  }
  if (!trimmed.includes(' ') && listedNames.has(trimmed.toLowerCase())) {
    return true;
  }
  if (!trimmed.includes(' ') && isPlausibleResourceName(trimmed)) {
    return true;
  }
  return false;
};

const startsNameFieldListingBlock = (line: string, listedNames: Set<string>): boolean => {
  const match = line.trim().match(/^Name:\s*(\S+)/i);
  return match ? listedNames.has(match[1].toLowerCase()) : false;
};

const startsResourceNameListingBlock = (line: string, listedNames: Set<string>): boolean => {
  const trimmed = line.trim();
  return (
    !!trimmed &&
    !trimmed.includes(' ') &&
    listedNames.has(trimmed.toLowerCase()) &&
    isPlausibleResourceName(trimmed)
  );
};

const skipListingBlock = (lines: string[], startIndex: number, listedNames: Set<string>): number => {
  let index = startIndex;
  while (index < lines.length) {
    const trimmed = lines[index].trim();
    if (!trimmed) {
      let next = index + 1;
      while (next < lines.length && !lines[next].trim()) {
        next++;
      }
      if (next < lines.length && isListingContinuationLine(lines[next].trim(), listedNames)) {
        index++;
        continue;
      }
      break;
    }
    if (!isListingContinuationLine(trimmed, listedNames)) {
      break;
    }
    index++;
  }
  return index;
};

const stripVerticalListingBlocks = (text: string, listedNames: Set<string>): string => {
  if (listedNames.size === 0) {
    return text;
  }

  const lines = text.split('\n');
  const result: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (
      startsResourceNameListingBlock(line, listedNames) ||
      startsNameFieldListingBlock(line, listedNames)
    ) {
      index = skipListingBlock(lines, index + 1, listedNames);
      continue;
    }

    result.push(line);
    index++;
  }

  return result.join('\n');
};

const stripMarkdownTableBlocks = (text: string): string => {
  const lines = text.split('\n');
  const result: string[] = [];
  let index = 0;

  while (index < lines.length) {
    if (lines[index].trim().startsWith('|')) {
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        index++;
      }
      continue;
    }
    result.push(lines[index]);
    index++;
  }

  return result.join('\n');
};

const normalizeCompactedText = (text: string): string =>
  text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export const compactResponseForLivingResources = (
  responseText: string | undefined,
  tools: Record<string, Tool> | undefined,
  models: Record<string, K8sModelRef>,
): string | undefined => {
  if (!responseText?.trim()) {
    return responseText;
  }

  const livingRefs = extractLivingResources(tools, responseText, models);
  if (livingRefs.length === 0 || !hasCompactableResourceListTool(tools)) {
    return responseText;
  }

  const listedNames = new Set(
    extractWatchableResourceRefs(tools, responseText, models).map((ref) => ref.name.toLowerCase()),
  );

  let compacted = stripVerticalListingBlocks(responseText, listedNames);
  compacted = stripMarkdownTableBlocks(compacted);
  compacted = normalizeCompactedText(compacted);

  return compacted || responseText;
};
