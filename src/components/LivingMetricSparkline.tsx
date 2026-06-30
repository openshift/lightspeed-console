import * as React from 'react';
import { PrometheusResponse } from '@openshift-console/dynamic-plugin-sdk';

type SparklineProps = {
  height?: number;
  response: PrometheusResponse | undefined;
  width?: number;
};

const extractMetricValues = (response: PrometheusResponse | undefined): number[] => {
  const series = response?.data?.result?.[0];
  if (!series) {
    return [];
  }
  if (Array.isArray(series.values)) {
    return series.values
      .map(([, value]) => parseFloat(value))
      .filter((value) => Number.isFinite(value));
  }
  if (Array.isArray(series.value)) {
    const value = parseFloat(series.value[1]);
    return Number.isFinite(value) ? [value] : [];
  }
  return [];
};

const LivingMetricSparkline: React.FC<SparklineProps> = ({
  height = 36,
  response,
  width = 140,
}) => {
  const values = React.useMemo(() => extractMetricValues(response), [response]);

  if (values.length === 0) {
    return null;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pointCount = Math.max(values.length - 1, 1);
  const points = values
    .map((value, index) => {
      const x = (index / pointCount) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      aria-hidden="true"
      className="ols-plugin__living-sparkline"
      height={height}
      preserveAspectRatio="none"
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
    >
      <polyline fill="none" points={points} stroke="var(--pf-t--global--color--brand--default)" />
    </svg>
  );
};

export default LivingMetricSparkline;
