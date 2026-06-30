import * as React from 'react';

import {
  resolveTimelineAnchor,
  shouldShowChangeTimeline,
  TimelineAnchor,
} from '../changeTimeline';
import { useLocationContext } from './useLocationContext';
import { K8sModelRef } from '../pageContext';
import { Tool } from '../types';

export const useChangeTimeline = (
  enabled: boolean,
  query: string | undefined,
  tools: Record<string, Tool> | undefined,
  responseText: string | undefined,
  k8sModels: Record<string, K8sModelRef>,
): { anchor: TimelineAnchor | null; showTimeline: boolean } => {
  const [pageKind, pageName, pageNamespace] = useLocationContext();

  const anchor = React.useMemo(
    () =>
      enabled
        ? resolveTimelineAnchor(
            pageKind,
            pageName,
            pageNamespace,
            tools,
            responseText,
            k8sModels,
          )
        : null,
    [enabled, k8sModels, pageKind, pageName, pageNamespace, responseText, tools],
  );

  const showTimeline = enabled && shouldShowChangeTimeline(query, tools, anchor, k8sModels);

  return { anchor, showTimeline };
};
