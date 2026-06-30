import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@patternfly/react-core';
import { HistoryIcon } from '@patternfly/react-icons';

import { isTimelineEligibleAnchor } from '../changeTimeline';
import { K8sModelRef, ResourceRef } from '../pageContext';
import ChangeTimelinePanel from './ChangeTimelinePanel';

import './change-timeline.css';

type LivingResourceTimelineToggleProps = {
  defaultExpanded?: boolean;
  embedded?: boolean;
  k8sModels: Record<string, K8sModelRef>;
  resourceRef: ResourceRef;
};

const LivingResourceTimelineToggle: React.FC<LivingResourceTimelineToggleProps> = ({
  defaultExpanded = false,
  embedded = true,
  k8sModels,
  resourceRef,
}) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  React.useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded, resourceRef.kind, resourceRef.name, resourceRef.namespace]);

  if (!isTimelineEligibleAnchor(resourceRef, k8sModels)) {
    return null;
  }

  return (
    <div className="ols-plugin__living-resource-timeline" data-test="ols-plugin__living-resource-timeline">
      <Button
        className="ols-plugin__living-resource-timeline-toggle"
        data-test="ols-plugin__living-resource-timeline-toggle"
        icon={<HistoryIcon />}
        onClick={() => setExpanded((current) => !current)}
        type="button"
        variant="link"
      >
        {expanded ? t('Hide timeline') : t('View timeline')}
      </Button>
      {expanded && (
        <ChangeTimelinePanel anchor={resourceRef} embedded={embedded} k8sModels={k8sModels} />
      )}
    </div>
  );
};

export default LivingResourceTimelineToggle;
