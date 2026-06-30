import * as React from 'react';

import { K8sModelRef, ResourceRef } from '../pageContext';
import LivingResourceCard from './LivingResourceCard';
import LivingResourceTimelineToggle from './LivingResourceTimelineToggle';

type LivingResourceSourceBodyProps = {
  k8sModels: Record<string, K8sModelRef>;
  onUnavailable?: () => void;
  resourceRef: ResourceRef;
  timelineDefaultExpanded?: boolean;
};

const LivingResourceSourceBody: React.FC<LivingResourceSourceBodyProps> = ({
  k8sModels,
  onUnavailable,
  resourceRef,
  timelineDefaultExpanded = false,
}) => (
  <div className="ols-plugin__living-resource-preview" data-test="ols-plugin__living-resource-preview">
    <LivingResourceCard
      k8sModels={k8sModels}
      onUnavailable={onUnavailable}
      resourceRef={resourceRef}
    />
    <LivingResourceTimelineToggle
      defaultExpanded={timelineDefaultExpanded}
      k8sModels={k8sModels}
      resourceRef={resourceRef}
    />
  </div>
);

export default LivingResourceSourceBody;
