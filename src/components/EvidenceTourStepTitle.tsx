import * as React from 'react';
import { Button, Title } from '@patternfly/react-core';

import { getModelKindName, K8sModelRef } from '../pageContext';
import { ResourceRef } from '../resourceRefs';

type EvidenceTourStepTitleProps = {
  fallbackLabel: string;
  k8sModels: Record<string, K8sModelRef>;
  onOpenResource: (path: string) => void;
  path: string;
  resourceRef?: ResourceRef;
};

const EvidenceTourStepTitle: React.FC<EvidenceTourStepTitleProps> = ({
  fallbackLabel,
  k8sModels,
  onOpenResource,
  path,
  resourceRef,
}) => {
  if (!resourceRef) {
    return (
      <Title className="ols-plugin__guided-tour-label" headingLevel="h3" size="md">
        {fallbackLabel}
      </Title>
    );
  }

  const kindName = getModelKindName(resourceRef.kind, k8sModels);
  const namespaceSuffix = resourceRef.namespace ? ` (${resourceRef.namespace})` : '';

  return (
    <Title className="ols-plugin__guided-tour-label" headingLevel="h3" size="md">
      {kindName}/
      <Button
        className="ols-plugin__guided-tour-resource-link"
        data-test="ols-plugin__evidence-tour-resource-link"
        isInline
        onClick={(event) => {
          event.preventDefault();
          onOpenResource(path);
        }}
        variant="link"
      >
        {resourceRef.name}
      </Button>
      {namespaceSuffix}
    </Title>
  );
};

export default EvidenceTourStepTitle;
