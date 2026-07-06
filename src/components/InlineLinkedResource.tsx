import * as React from 'react';
import { Button } from '@patternfly/react-core';

import LinkedResourceStatus from './LinkedResourceStatus';
import ResourceIcon from './ResourceIcon';
import { buildResourceConsolePath, getResourceIconKind, K8sModelRef } from '../pageContext';
import { shouldShowLinkedResourceStatus } from '../linkedResourceWatch';
import { ResourceRef, resourceRefKey } from '../resourceRefs';

import './linked-resources.css';

type InlineLinkedResourceProps = {
  children: React.ReactNode;
  k8sModels: Record<string, K8sModelRef>;
  navigate: (path: string) => void;
  resourceRef: ResourceRef;
};

const InlineLinkedResource: React.FC<InlineLinkedResourceProps> = ({
  children,
  k8sModels,
  navigate,
  resourceRef,
}) => {
  const path = buildResourceConsolePath(resourceRef, k8sModels);
  const iconKind = getResourceIconKind(resourceRef, k8sModels);

  return (
    <span
      className="ols-plugin__inline-linked-resource"
      data-test="ols-plugin__inline-linked-resource"
    >
      <Button
        className="ols-plugin__inline-linked-resource-link"
        isInline
        onClick={(event) => {
          event.preventDefault();
          if (path) {
            navigate(path);
          }
        }}
        variant="link"
      >
        <span className="ols-plugin__inline-linked-resource-content">
          <ResourceIcon className="ols-plugin__inline-linked-resource-kind-icon" kind={iconKind} />
          <span className="ols-plugin__inline-linked-resource-name">{children}</span>
        </span>
      </Button>
      {shouldShowLinkedResourceStatus(resourceRef, k8sModels) && (
        <LinkedResourceStatus
          k8sModels={k8sModels}
          key={resourceRefKey(resourceRef)}
          resourceRef={resourceRef}
        />
      )}
    </span>
  );
};

export default InlineLinkedResource;
