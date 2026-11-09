import { buildResourceConsolePath, K8sModelRef } from './pageContext';
import { isVerticalListNoiseLine } from './resourceListParsing';
import { ResourceRef } from './resourceRefs';

const CODE_FENCE_PATTERN = /```[\s\S]*?```/g;
const INLINE_CODE_PATTERN = /`[^`\n]+`/g;
const MARKDOWN_LINK_PATTERN = /\[[^\]]*\]\([^)]*\)/g;

type Replacement = { end: number; replacement: string; start: number };

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getProtectedRanges = (text: string): [number, number][] => {
  const ranges: [number, number][] = [];
  for (const pattern of [CODE_FENCE_PATTERN, INLINE_CODE_PATTERN, MARKDOWN_LINK_PATTERN]) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      if (match.index === undefined) {
        continue;
      }
      ranges.push([match.index, match.index + match[0].length]);
    }
  }

  let offset = 0;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && isVerticalListNoiseLine(trimmed)) {
      ranges.push([offset, offset + line.length]);
    }
    offset += line.length + 1;
  }

  return ranges;
};

const isProtected = (start: number, end: number, ranges: [number, number][]): boolean =>
  ranges.some(([rangeStart, rangeEnd]) => start >= rangeStart && end <= rangeEnd);

const overlapsReplacement = (start: number, end: number, replacements: Replacement[]): boolean =>
  replacements.some((existing) => start < existing.end && end > existing.start);

const collectReplacementsForRef = (
  text: string,
  ref: ResourceRef,
  path: string,
  protectedRanges: [number, number][],
  existing: Replacement[],
): Replacement[] => {
  const replacements: Replacement[] = [];
  const escaped = escapeRegExp(ref.name);

  const nameFieldPattern = new RegExp(`(^|\\n)(Name:\\s*)(${escaped})(?=\\s*(?:\\n|$))`, 'gi');
  for (const match of text.matchAll(nameFieldPattern)) {
    if (match.index === undefined || match[3] === undefined) {
      continue;
    }
    const prefixLength = match[1].length + match[2].length;
    const start = match.index + prefixLength;
    const end = start + match[3].length;
    if (
      !isProtected(start, end, protectedRanges) &&
      !overlapsReplacement(start, end, existing) &&
      !overlapsReplacement(start, end, replacements)
    ) {
      replacements.push({
        end,
        replacement: `[${ref.name}](${path})`,
        start,
      });
    }
  }

  const boldPattern = new RegExp(`\\*\\*(${escaped})\\*\\*`, 'g');
  for (const match of text.matchAll(boldPattern)) {
    if (match.index === undefined) {
      continue;
    }
    const start = match.index;
    const end = start + match[0].length;
    if (
      !isProtected(start, end, protectedRanges) &&
      !overlapsReplacement(start, end, existing) &&
      !overlapsReplacement(start, end, replacements)
    ) {
      replacements.push({
        end,
        replacement: `[${ref.name}](${path})`,
        start,
      });
    }
  }

  const standalonePattern = new RegExp(`(^|\\n)(${escaped})(?=\\n|$)`, 'g');
  for (const match of text.matchAll(standalonePattern)) {
    if (match.index === undefined || match[2] === undefined) {
      continue;
    }
    const start = match.index + match[1].length;
    const end = start + match[2].length;
    if (
      !isProtected(start, end, protectedRanges) &&
      !overlapsReplacement(start, end, existing) &&
      !overlapsReplacement(start, end, replacements)
    ) {
      replacements.push({
        end,
        replacement: `[${ref.name}](${path})`,
        start,
      });
    }
  }

  return replacements;
};

export const injectResourceLinksInMarkdown = (
  text: string,
  refs: ResourceRef[],
  models: Record<string, K8sModelRef>,
): string => {
  if (!text || refs.length === 0) {
    return text;
  }

  const protectedRanges = getProtectedRanges(text);
  const sortedRefs = [...refs].sort((a, b) => b.name.length - a.name.length);
  const allReplacements: Replacement[] = [];

  for (const ref of sortedRefs) {
    const path = buildResourceConsolePath(ref, models);
    if (!path) {
      continue;
    }
    allReplacements.push(
      ...collectReplacementsForRef(text, ref, path, protectedRanges, allReplacements),
    );
  }

  let result = text;
  for (const replacement of allReplacements.sort((a, b) => b.start - a.start)) {
    result =
      result.slice(0, replacement.start) + replacement.replacement + result.slice(replacement.end);
  }

  return result;
};
