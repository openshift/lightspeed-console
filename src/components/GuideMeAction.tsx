import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { Button } from '@patternfly/react-core';
import { RouteIcon } from '@patternfly/react-icons';

import { extractEvidenceSteps } from '../evidenceTour';
import { K8sModelRef } from '../pageContext';
import { evidenceTourStart } from '../redux-actions';
import { Tool } from '../types';

type GuideMeActionProps = {
  chatEntryId: string;
  className?: string;
  k8sModels: Record<string, K8sModelRef>;
  onBeforeStart?: () => void;
  responseText?: string;
  tools?: Record<string, Tool>;
  variant?: 'primary' | 'secondary' | 'tertiary';
};

const GuideMeAction: React.FC<GuideMeActionProps> = ({
  chatEntryId,
  className = 'ols-plugin__guide-me-action',
  k8sModels,
  onBeforeStart,
  responseText,
  tools,
  variant = 'secondary',
}) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');
  const dispatch = useDispatch();

  const steps = React.useMemo(
    () => extractEvidenceSteps(tools, responseText, k8sModels),
    [k8sModels, responseText, tools],
  );

  const onGuideMe = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (steps.length === 0) {
        return;
      }
      onBeforeStart?.();
      dispatch(evidenceTourStart(chatEntryId, steps));
    },
    [chatEntryId, dispatch, onBeforeStart, steps],
  );

  if (steps.length === 0) {
    return null;
  }

  return (
    <Button
      className={className}
      data-test="ols-plugin__guide-me-button"
      icon={<RouteIcon />}
      onClick={onGuideMe}
      type="button"
      variant={variant}
    >
      {t('Guide me')}
    </Button>
  );
};

export default GuideMeAction;
