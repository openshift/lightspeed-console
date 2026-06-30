import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Button,
  Content,
  Flex,
  FlexItem,
  Title,
} from '@patternfly/react-core';
import { AngleLeftIcon, AngleRightIcon } from '@patternfly/react-icons';

import { useConsoleNavigation } from '../hooks/useConsoleNavigation';
import { useK8sModels } from '@openshift-console/dynamic-plugin-sdk';
import { evidenceTourClose, evidenceTourNext, evidenceTourPrev } from '../redux-actions';
import { State } from '../redux-reducers';
import { EvidenceTourStep, EvidenceTourState } from '../types';
import LivingResourceCard from './LivingResourceCard';
import EvidenceTourStepTitle from './EvidenceTourStepTitle';

import './evidence-tour.css';
import './living-response.css';

type EvidenceTourPanelProps = {
  'aria-label': string;
};

const EvidenceTourPanel: React.FC<EvidenceTourPanelProps> = ({ 'aria-label': ariaLabel }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');
  const dispatch = useDispatch();
  const navigate = useConsoleNavigation();
  const [k8sModels] = useK8sModels();

  const tour = useSelector((s: State) => s.plugins?.ols?.get('evidenceTour')) as
    | EvidenceTourState
    | undefined;

  const { currentIndex, isActive, steps } = tour ?? {
    chatEntryId: null,
    currentIndex: 0,
    isActive: false,
    steps: [] as EvidenceTourStep[],
  };

  const currentStep = steps[currentIndex];
  const isFirst = currentIndex <= 0;
  const isLast = currentIndex >= steps.length - 1;
  const resolvedModels = React.useMemo(() => k8sModels ?? {}, [k8sModels]);
  const navigateRef = React.useRef(navigate);
  navigateRef.current = navigate;
  const navigatedStepIndexRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    if (!isActive) {
      navigatedStepIndexRef.current = undefined;
      return;
    }
    if (!currentStep?.path) {
      return;
    }
    if (navigatedStepIndexRef.current === currentIndex) {
      return;
    }

    navigatedStepIndexRef.current = currentIndex;
    const frame = window.requestAnimationFrame(() => {
      navigateRef.current(currentStep.path);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [currentIndex, currentStep?.path, isActive]);

  const onOpenResource = React.useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate],
  );

  const onEndTour = React.useCallback(() => {
    dispatch(evidenceTourClose());
  }, [dispatch]);

  const onNext = React.useCallback(() => {
    dispatch(evidenceTourNext());
  }, [dispatch]);

  const onPrev = React.useCallback(() => {
    dispatch(evidenceTourPrev());
  }, [dispatch]);

  if (!isActive) {
    return null;
  }

  if (!currentStep || steps.length === 0) {
    return (
      <section
        aria-label={ariaLabel}
        className="ols-plugin__guided-tour"
        data-test="ols-plugin__evidence-tour"
      >
        <Alert
          isInline
          title={t('Unable to start guided tour')}
          variant="warning"
        >
          <Button onClick={onEndTour} variant="link">
            {t('End tour')}
          </Button>
        </Alert>
      </section>
    );
  }

  const showLiveResource = Boolean(currentStep.resourceRef);
  const showNarration = !showLiveResource && currentStep.narration;

  return (
    <section
      aria-label={ariaLabel}
      className="ols-plugin__guided-tour"
      data-test="ols-plugin__evidence-tour"
    >
      <div className="ols-plugin__guided-tour-content">
        <Title className="ols-plugin__guided-tour-heading" headingLevel="h2" size="lg">
          {t('Guided tour')}
        </Title>
        <p
          className="ols-plugin__guided-tour-step-count"
          data-test="ols-plugin__evidence-tour-step-count"
        >
          {t('Step {{current}} of {{total}}', { current: currentIndex + 1, total: steps.length })}
        </p>
        <EvidenceTourStepTitle
          fallbackLabel={currentStep.label}
          k8sModels={resolvedModels}
          onOpenResource={onOpenResource}
          path={currentStep.path}
          resourceRef={currentStep.resourceRef}
        />
        {showLiveResource && currentStep.resourceRef && (
          <LivingResourceCard k8sModels={resolvedModels} resourceRef={currentStep.resourceRef} />
        )}
        {showNarration && (
          <Content className="ols-plugin__guided-tour-narration" component="p">
            {currentStep.narration}
          </Content>
        )}
      </div>
      <Flex
        alignItems={{ default: 'alignItemsCenter' }}
        className="ols-plugin__guided-tour-actions"
        justifyContent={{ default: 'justifyContentSpaceBetween' }}
      >
        <FlexItem>
          <Button
            data-test="ols-plugin__evidence-tour-prev"
            icon={<AngleLeftIcon />}
            isDisabled={isFirst}
            onClick={onPrev}
            variant="secondary"
          >
            {t('Previous')}
          </Button>
        </FlexItem>
        <FlexItem>
          <Flex
            alignItems={{ default: 'alignItemsCenter' }}
            gap={{ default: 'gapSm' }}
          >
            <Button
              data-test="ols-plugin__evidence-tour-end"
              onClick={onEndTour}
              variant="link"
            >
              {t('End tour')}
            </Button>
            <Button
              data-test="ols-plugin__evidence-tour-next"
              icon={<AngleRightIcon />}
              iconPosition="end"
              isDisabled={isLast}
              onClick={onNext}
              variant="primary"
            >
              {t('Next')}
            </Button>
          </Flex>
        </FlexItem>
      </Flex>
    </section>
  );
};

export default EvidenceTourPanel;
