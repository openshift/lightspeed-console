import * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { SourcesCardProps } from '@patternfly/chatbot';

import LivingResourceCard from '../components/LivingResourceCard';
import { hasEvidenceTour } from '../evidenceTour';
import { useConsoleNavigation } from '../hooks/useConsoleNavigation';
import { extractLivingResources, getLivingResourceOverflow } from '../livingResponse';
import { buildResourceConsolePath, K8sModelRef } from '../pageContext';
import { formatResourceLabel, resourceRefKey } from '../resourceRefs';
import { ReferencedDoc, Tool } from '../types';

const isURL = (value: string): boolean => {
  try {
    const url = new URL(value);
    return !!(url.protocol && url.host);
  } catch {
    return false;
  }
};

const buildDocSources = (
  references: ReferencedDoc[] | undefined,
): SourcesCardProps['sources'] =>
  (references ?? [])
    .filter(
      (reference) =>
        reference &&
        typeof reference.doc_title === 'string' &&
        typeof reference.doc_url === 'string' &&
        isURL(reference.doc_url),
    )
    .map((reference) => ({
      isExternal: true,
      link: reference.doc_url,
      title: reference.doc_title,
    }));

type UseMessageSourcesOptions = {
  enabled: boolean;
  k8sModels: Record<string, K8sModelRef>;
  references?: ReferencedDoc[];
  responseText?: string;
  tools?: Record<string, Tool>;
};

type UseMessageSourcesResult = {
  clusterSources?: SourcesCardProps;
  docSources: SourcesCardProps['sources'];
  livingResourceOverflow?: { shown: number; total: number };
  messageSources?: SourcesCardProps;
  showGuide: boolean;
};

export const useMessageSources = ({
  enabled,
  k8sModels,
  references,
  responseText,
  tools,
}: UseMessageSourcesOptions): UseMessageSourcesResult => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');
  const navigate = useConsoleNavigation();

  const clusterRefs = React.useMemo(
    () => (enabled ? extractLivingResources(tools, responseText, k8sModels) : []),
    [enabled, k8sModels, responseText, tools],
  );

  const livingResourceOverflow = React.useMemo(() => {
    if (!enabled) {
      return undefined;
    }
    const { shown, total } = getLivingResourceOverflow(tools, responseText, k8sModels);
    return shown < total ? { shown, total } : undefined;
  }, [enabled, k8sModels, responseText, tools]);

  const [availableKeys, setAvailableKeys] = React.useState<Set<string>>(
    () => new Set(clusterRefs.map(resourceRefKey)),
  );

  React.useEffect(() => {
    setAvailableKeys(new Set(clusterRefs.map(resourceRefKey)));
  }, [clusterRefs]);

  const markUnavailable = React.useCallback((key: string) => {
    setAvailableKeys((current) => {
      if (!current.has(key)) {
        return current;
      }
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }, []);

  const visibleClusterRefs = React.useMemo(
    () => clusterRefs.filter((ref) => availableKeys.has(resourceRefKey(ref))),
    [availableKeys, clusterRefs],
  );

  const showGuide = enabled && hasEvidenceTour(tools, responseText, k8sModels);

  const clusterSourceItems = React.useMemo((): SourcesCardProps['sources'] => {
    return visibleClusterRefs.map((ref) => {
      const path = buildResourceConsolePath(ref, k8sModels) ?? '#';
      const key = resourceRefKey(ref);

      return {
        body: (
          <LivingResourceCard
            k8sModels={k8sModels}
            onUnavailable={() => markUnavailable(key)}
            resourceRef={ref}
          />
        ),
        link: path,
        onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
          event.preventDefault();
          if (path !== '#') {
            navigate(path);
          }
        },
        subtitle: t('Live cluster resource'),
        title: formatResourceLabel(ref, k8sModels),
      };
    });
  }, [k8sModels, markUnavailable, navigate, t, visibleClusterRefs]);

  const docSources = React.useMemo(
    () => (enabled ? buildDocSources(references) : []),
    [enabled, references],
  );

  const clusterSources = React.useMemo((): SourcesCardProps | undefined => {
    if (clusterSourceItems.length === 0) {
      return undefined;
    }

    return {
      paginationAriaLabel: t('Live cluster resources'),
      sourceWord: t('live resource'),
      sourceWordPlural: t('live resources'),
      sources: clusterSourceItems,
      toNextPageAriaLabel: t('Next live resource'),
      toPreviousPageAriaLabel: t('Previous live resource'),
    };
  }, [clusterSourceItems, t]);

  const messageSources = React.useMemo((): SourcesCardProps | undefined => {
    if (clusterSources) {
      return undefined;
    }

    if (docSources.length === 0) {
      return undefined;
    }

    return {
      paginationAriaLabel: t('Evidence sources'),
      sourceWord: t('source'),
      sourceWordPlural: t('sources'),
      sources: docSources,
      toNextPageAriaLabel: t('Next source'),
      toPreviousPageAriaLabel: t('Previous source'),
    };
  }, [clusterSources, docSources, t]);

  return {
    clusterSources,
    docSources: clusterSources ? [] : docSources,
    livingResourceOverflow,
    messageSources,
    showGuide,
  };
};
