import { buildResourceConsolePath, K8sModelRef } from './pageContext';
import { extractWatchableResourceRefs, isWatchableResource, prioritizeLivingResources } from './livingResponse';
import { formatResourceLabel, normalizeResourceRef, ResourceRef } from './resourceRefs';
import { EvidenceTourStep, Tool } from './types';

type PodLiveDetails = {
  age?: string;
  ip?: string;
  node?: string;
  ready?: string;
  restarts?: string;
};

const humanizeToolName = (toolName: string): string =>
  toolName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const NAME_BLOCK_LINE_PATTERN = /^[A-Z][a-zA-Z0-9 ]*:\s*.+$/;

const extractNarrationFromResponse = (resourceName: string, responseText?: string): string | undefined => {
  if (!responseText) {
    return undefined;
  }

  const nameBlockPattern = new RegExp(
    `\\bName:\\s*${escapeRegExp(resourceName)}\\s*\\n([\\s\\S]*?)(?=\\n\\n|\\nName:|$)`,
    'i',
  );
  const nameBlockMatch = responseText.match(nameBlockPattern);
  if (nameBlockMatch?.[1]) {
    const detailLines = nameBlockMatch[1]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => NAME_BLOCK_LINE_PATTERN.test(line));
    if (detailLines.length > 0) {
      return detailLines.join(' · ');
    }
  }

  const sentencePattern = new RegExp(`[^.!?\\n]*\\b${escapeRegExp(resourceName)}\\b[^.!?\\n]*`, 'gi');
  const sentences = [...responseText.matchAll(sentencePattern)]
    .map((match) => match[0].trim())
    .filter((sentence) => sentence.length > resourceName.length + 10);

  if (sentences.length > 0) {
    return sentences[0];
  }

  return undefined;
};

const extractTableRowNarration = (content: string, resourceName: string): string | undefined => {
  const podDetails = parsePodTableRowDetails(content, resourceName);
  if (podDetails) {
    return formatPodDetailsNarration(podDetails.details, podDetails.status);
  }

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes(resourceName)) {
      continue;
    }

    const columns = trimmed.split(/\s+/);
    const nameIndex = columns.findIndex((column) => column === resourceName);
    if (nameIndex < 0) {
      continue;
    }

    const details = columns.slice(nameIndex + 1).join(' ');
    if (details) {
      return details;
    }
  }

  return undefined;
};

const POD_TABLE_DATA_ROW =
  /^([a-z0-9][a-z0-9-]*)\s+v1\s+Pod\s+([a-z0-9][a-z0-9.-]*)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(\S+))?(?:\s+(\S+))?/;

export const parsePodTableRowDetails = (
  content: string,
  podName: string,
): { details: PodLiveDetails; status: string } | undefined => {
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.includes(podName)) {
      continue;
    }

    const match = trimmed.match(POD_TABLE_DATA_ROW);
    if (!match || match[2] !== podName) {
      continue;
    }

    const [, , , ready, status, restarts, age, ip, node] = match;
    return {
      details: {
        age,
        ip: ip && ip !== '<none>' ? ip : undefined,
        node: node && node !== '<none>' ? node : undefined,
        ready,
        restarts,
      },
      status,
    };
  }

  return undefined;
};

export const formatPodDetailsNarration = (details: PodLiveDetails, status?: string): string => {
  const lines: string[] = [];
  if (status) {
    lines.push(`Status: ${status}`);
  }
  if (details.ready) {
    lines.push(`Ready: ${details.ready}`);
  }
  if (details.restarts) {
    lines.push(`Restarts: ${details.restarts}`);
  }
  if (details.age) {
    lines.push(`Age: ${details.age}`);
  }
  if (details.ip) {
    lines.push(`IP: ${details.ip}`);
  }
  if (details.node) {
    lines.push(`Node: ${details.node}`);
  }
  return lines.join('\n');
};

const extractNarrationFromTools = (
  ref: ResourceRef,
  tools?: Record<string, Tool>,
): { narration?: string; toolName?: string } => {
  if (!tools) {
    return {};
  }

  for (const tool of Object.values(tools)) {
    if (tool.isDenied || tool.status === 'error' || !tool.content) {
      continue;
    }

    const tableNarration = extractTableRowNarration(tool.content, ref.name);
    if (tableNarration) {
      return { narration: tableNarration, toolName: tool.name };
    }
  }

  return {};
};

export const buildResourceNarration = (
  ref: ResourceRef,
  models: Record<string, K8sModelRef>,
  responseText?: string,
  tools?: Record<string, Tool>,
): string => {
  const fromResponse = extractNarrationFromResponse(ref.name, responseText);
  if (fromResponse) {
    return fromResponse;
  }

  const fromTool = extractNarrationFromTools(ref, tools);
  if (fromTool.narration) {
    return fromTool.narration;
  }

  const resolvedToolName = fromTool.toolName;
  if (resolvedToolName) {
    return `Evidence from ${humanizeToolName(resolvedToolName)}.`;
  }

  return `Referenced in the response: ${formatResourceLabel(ref, models)}.`;
};

const stepFromResource = (
  ref: ResourceRef,
  models: Record<string, K8sModelRef>,
  responseText: string | undefined,
  tools: Record<string, Tool> | undefined,
): EvidenceTourStep | null => {
  const normalized = normalizeResourceRef(ref, models);
  if (!normalized || !isWatchableResource(normalized, models)) {
    return null;
  }
  const path = buildResourceConsolePath(normalized, models);
  if (!path) {
    return null;
  }
  return {
    id: path,
    label: formatResourceLabel(normalized, models),
    narration: buildResourceNarration(normalized, models, responseText, tools),
    path,
    resourceRef: normalized,
    source: 'tool',
  };
};

export const extractEvidenceSteps = (
  tools: Record<string, Tool> | undefined,
  responseText: string | undefined,
  models: Record<string, K8sModelRef>,
): EvidenceTourStep[] =>
  prioritizeLivingResources(
    extractWatchableResourceRefs(tools, responseText, models),
    responseText,
    tools,
  ).flatMap((ref) => {
    const step = stepFromResource(ref, models, responseText, tools);
    return step ? [step] : [];
  });

export const hasEvidenceTour = (
  tools: Record<string, Tool> | undefined,
  responseText: string | undefined,
  models: Record<string, K8sModelRef>,
): boolean => extractEvidenceSteps(tools, responseText, models).length > 0;
