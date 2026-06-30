import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SourcesCard, type SourcesCardProps } from '@patternfly/chatbot';

import './living-response.css';

type LivingResourcesPanelProps = {
  overflow?: { shown: number; total: number };
  sources: SourcesCardProps;
};

const LivingResourcesPanel: React.FC<LivingResourcesPanelProps> = ({ overflow, sources }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  return (
    <div className="ols-plugin__living-resources-panel" data-test="ols-plugin__living-resources-panel">
      {overflow && (
        <p className="ols-plugin__living-resources-overflow" data-test="ols-plugin__living-resources-overflow">
          {t('Showing {{shown}} of {{total}} live resources', overflow)}
        </p>
      )}
      <SourcesCard {...sources} isCompact />
    </div>
  );
};

export default LivingResourcesPanel;
