import * as React from 'react';
import type { MessageProps } from '@patternfly/chatbot';

import InlineLinkedResource from '../components/InlineLinkedResource';
import { useConsoleNavigation } from '../hooks/useConsoleNavigation';
import { getInlineLinkedResources } from '../linkedResources';
import { injectResourceLinksInMarkdown } from '../linkedResourceText';
import { buildResourceConsolePath, K8sModelRef } from '../pageContext';
import { ResourceRef, resourceRefKey } from '../resourceRefs';
import { Tool } from '../types';

type ReactMarkdownProps = NonNullable<MessageProps['reactMarkdownProps']>;

type UseLinkedResourceMarkdownOptions = {
  enabled: boolean;
  k8sModels: Record<string, K8sModelRef>;
  responseText?: string;
  tools?: Record<string, Tool>;
};

type UseLinkedResourceMarkdownResult = {
  content?: string;
  reactMarkdownProps?: ReactMarkdownProps;
};

export const useLinkedResourceMarkdown = ({
  enabled,
  k8sModels,
  responseText,
  tools,
}: UseLinkedResourceMarkdownOptions): UseLinkedResourceMarkdownResult => {
  const navigate = useConsoleNavigation();

  const linkedRefs = React.useMemo(
    () => (enabled ? getInlineLinkedResources(tools, responseText, k8sModels) : []),
    [enabled, k8sModels, responseText, tools],
  );

  const refsByPath = React.useMemo(() => {
    const map = new Map<string, ResourceRef>();
    for (const ref of linkedRefs) {
      const path = buildResourceConsolePath(ref, k8sModels);
      if (path) {
        map.set(path, ref);
      }
    }
    return map;
  }, [k8sModels, linkedRefs]);

  const content = React.useMemo(() => {
    if (!enabled || !responseText) {
      return responseText;
    }
    return injectResourceLinksInMarkdown(responseText, linkedRefs, k8sModels);
  }, [enabled, k8sModels, linkedRefs, responseText]);

  const reactMarkdownProps = React.useMemo((): ReactMarkdownProps | undefined => {
    if (!enabled || linkedRefs.length === 0) {
      return undefined;
    }

    return {
      components: {
        a: ({ children, href, ...props }: React.ComponentPropsWithoutRef<'a'>) => {
          const resourceRef = href ? refsByPath.get(href) : undefined;
          if (resourceRef) {
            return (
              <InlineLinkedResource
                k8sModels={k8sModels}
                key={resourceRefKey(resourceRef)}
                navigate={navigate}
                resourceRef={resourceRef}
              >
                {children}
              </InlineLinkedResource>
            );
          }

          return (
            <a href={href} {...props}>
              {children}
            </a>
          );
        },
      },
    };
  }, [enabled, k8sModels, linkedRefs, navigate, refsByPath]);

  return { content, reactMarkdownProps };
};
