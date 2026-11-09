import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  K8sResourceKind,
  StatusComponent,
  useK8sWatchResource,
} from '@openshift-console/dynamic-plugin-sdk';
import { Badge, Spinner } from '@patternfly/react-core';

import { getLinkedResourceStatusDisplay } from '../linkedResourceStatusDisplay';
import { buildResourceWatchProps, matchesResourceRef } from '../linkedResourceWatch';
import { getModelKindName, K8sModelRef, resolveRefModelKeyOrKind } from '../pageContext';
import { ResourceRef } from '../resourceRefs';
import { getResourceStatusSummaryForRef, isInformativeStatusLabel } from '../resourceStatus';

type LinkedResourceStatusProps = {
  k8sModels: Record<string, K8sModelRef>;
  resourceRef: ResourceRef;
};

const LinkedResourceStatus: React.FC<LinkedResourceStatusProps> = ({ k8sModels, resourceRef }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');
  const watchProps = buildResourceWatchProps(resourceRef, k8sModels);

  const [resource, loaded, loadError] = useK8sWatchResource<K8sResourceKind>(watchProps);

  const hasMatchingResource = matchesResourceRef(resource, resourceRef, k8sModels);

  if (!watchProps) {
    return null;
  }

  if (loadError || (loaded && !hasMatchingResource)) {
    return null;
  }

  if (!loaded) {
    return <Spinner aria-label={t('Loading resource status')} isInline size="sm" />;
  }

  const modelKey = resolveRefModelKeyOrKind(resourceRef, k8sModels);
  const kindName = getModelKindName(modelKey, k8sModels);
  const status = getResourceStatusSummaryForRef(modelKey, k8sModels, resource);
  if (!isInformativeStatusLabel(status.label)) {
    return null;
  }

  const display = getLinkedResourceStatusDisplay(status, kindName, modelKey);
  if (display.mode === 'icon') {
    return (
      <span
        className="ols-plugin__linked-resource-status-icon"
        data-test="ols-plugin__linked-resource-status-icon"
      >
        <StatusComponent iconOnly status={display.status} title={display.title} />
      </span>
    );
  }

  return (
    <Badge
      className="ols-plugin__linked-resource-status"
      data-test="ols-plugin__linked-resource-status"
      isRead
    >
      {status.label}
    </Badge>
  );
};

export default LinkedResourceStatus;
