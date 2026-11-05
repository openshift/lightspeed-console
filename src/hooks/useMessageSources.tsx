import * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { SourcesCardProps } from '@patternfly/chatbot';

import { ReferencedDoc } from '../types';

const isURL = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const buildDocSources = (references: ReferencedDoc[] | undefined): SourcesCardProps['sources'] =>
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
  references?: ReferencedDoc[];
};

type UseMessageSourcesResult = {
  messageSources?: SourcesCardProps;
};

export const useMessageSources = ({
  enabled,
  references,
}: UseMessageSourcesOptions): UseMessageSourcesResult => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const docSources = React.useMemo(
    () => (enabled ? buildDocSources(references) : []),
    [enabled, references],
  );

  const messageSources = React.useMemo((): SourcesCardProps | undefined => {
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
  }, [docSources, t]);

  return { messageSources };
};
