import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  K8sResourceKind,
  PrometheusEndpoint,
  useK8sWatchResource,
  usePrometheusPoll,
} from '@openshift-console/dynamic-plugin-sdk';
import { Spinner, Stack, StackItem } from '@patternfly/react-core';

import { buildLivingMetrics } from '../livingResponse';
import { isTimelineEligibleAnchor } from '../changeTimeline';
import { LivingMetricDef } from '../resourceLivingMetrics';
import { getModelKindName, K8sModelRef } from '../pageContext';
import { ResourceRef } from '../resourceRefs';
import { getResourceLiveDetails } from '../resourceLiveDetails';
import { getResourceStatusSummaryForRef } from '../resourceStatus';
import LiveFieldGrid from './LiveFieldGrid';
import ChangeTimelinePanel from './ChangeTimelinePanel';
import LivingMetricSparkline from './LivingMetricSparkline';
import ResourceLiveDetailsView from './ResourceLiveDetailsView';

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

type LivingMetricValueProps = {
  namespace?: string;
  query: string;
};

const LivingMetricValue: React.FC<LivingMetricValueProps> = ({ namespace, query }) => {
  const [response, loaded, error] = usePrometheusPoll({
    endpoint: PrometheusEndpoint.QUERY_RANGE,
    namespace,
    query,
    samples: 30,
    timespan: THIRTY_MINUTES_MS,
  });

  if (!loaded && !error) {
    return <Spinner isInline size="sm" />;
  }
  if (loaded && !error && response) {
    return <LivingMetricSparkline response={response} />;
  }
  return <span className="ols-plugin__living-metric-unavailable">—</span>;
};

type LivingMetricFieldsProps = {
  metrics: LivingMetricDef[];
  prometheusNamespace?: string;
};

const LivingMetricFields: React.FC<LivingMetricFieldsProps> = ({
  metrics,
  prometheusNamespace,
}) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  return (
    <LiveFieldGrid
      className="ols-plugin__living-metrics"
      items={metrics.map((metric) => ({
        id: metric.id,
        label: t(metric.labelKey),
        value: <LivingMetricValue namespace={prometheusNamespace} query={metric.query} />,
      }))}
    />
  );
};

type LivingResourceCardProps = {
  k8sModels: Record<string, K8sModelRef>;
  onUnavailable?: () => void;
  resourceRef: ResourceRef;
  showTimeline?: boolean;
};

const LivingResourceCard: React.FC<LivingResourceCardProps> = ({
  k8sModels,
  onUnavailable,
  resourceRef,
  showTimeline = false,
}) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');
  const model = k8sModels[resourceRef.kind];

  const watchProps = model?.namespaced
    ? {
        isList: false as const,
        kind: resourceRef.kind,
        name: resourceRef.name,
        namespace: resourceRef.namespace,
      }
    : {
        isList: false as const,
        kind: resourceRef.kind,
        name: resourceRef.name,
      };

  const [resource, loaded, loadError] = useK8sWatchResource<K8sResourceKind>(watchProps);

  React.useEffect(() => {
    if (loadError || (loaded && !resource)) {
      onUnavailable?.();
    }
  }, [loadError, loaded, onUnavailable, resource]);

  const metrics = React.useMemo(
    () => buildLivingMetrics(resourceRef, k8sModels),
    [k8sModels, resourceRef],
  );
  const kindName = getModelKindName(resourceRef.kind, k8sModels);
  const status = getResourceStatusSummaryForRef(resourceRef.kind, k8sModels, resource);
  const detailFields = getResourceLiveDetails(kindName, resource);
  const prometheusNamespace = kindName === 'Namespace' ? resourceRef.name : resourceRef.namespace;

  if (loadError || (loaded && !resource)) {
    return null;
  }

  return (
    <div className="ols-plugin__living-resource" data-test="ols-plugin__living-resource">
      {!loaded && <Spinner aria-label={t('Loading live resource status')} isInline size="sm" />}
      {loaded && (
        <Stack hasGutter>
          <StackItem>
            <ResourceLiveDetailsView fields={detailFields} status={status} />
          </StackItem>
          {metrics.length > 0 && (
            <StackItem>
              <LivingMetricFields metrics={metrics} prometheusNamespace={prometheusNamespace} />
            </StackItem>
          )}
          {showTimeline && isTimelineEligibleAnchor(resourceRef, k8sModels) && (
            <StackItem>
              <ChangeTimelinePanel anchor={resourceRef} embedded k8sModels={k8sModels} />
            </StackItem>
          )}
        </Stack>
      )}
    </div>
  );
};

export default LivingResourceCard;
