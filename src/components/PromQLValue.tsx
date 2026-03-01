import * as React from 'react';
import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';
import { Spinner, TextArea } from '@patternfly/react-core';
import { debounce } from 'lodash';

const PROMETHEUS_BASE_PATH = '/api/prometheus';
const PROMETHEUS_TENANCY_BASE_PATH = '/api/prometheus-tenancy';
const POLL_INTERVAL = 15 * 1000;

type PrometheusResponse = {
  status: string;
  data: {
    resultType: 'vector' | 'scalar' | 'matrix' | 'string';
    result: Array<{
      metric: Record<string, string>;
      value: [number, string];
    }>;
  };
};

const formatValue = (value: string): string => {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return value;
  }
  // Format large numbers with appropriate units
  if (Math.abs(num) >= 1e9) {
    return `${(num / 1e9).toFixed(2)}B`;
  }
  if (Math.abs(num) >= 1e6) {
    return `${(num / 1e6).toFixed(2)}M`;
  }
  if (Math.abs(num) >= 1e3) {
    return `${(num / 1e3).toFixed(2)}K`;
  }
  // Format decimals nicely
  if (num % 1 !== 0) {
    return num.toFixed(4).replace(/\.?0+$/, '');
  }
  return num.toString();
};

const PromQLValue: React.FC<{ query: string }> = ({ query: initialQuery }) => {
  const [inputValue, setInputValue] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<
    Array<{ metric: Record<string, string>; value: string }>
  >([]);
  const [updateKey, setUpdateKey] = React.useState(0);

  const debouncedSetQuery = React.useMemo(
    () =>
      debounce((value: string) => {
        setQuery(value);
      }, 500),
    [],
  );

  const effectiveQuery = inputValue || initialQuery;

  React.useEffect(() => {
    debouncedSetQuery(effectiveQuery);
  }, [debouncedSetQuery, effectiveQuery]);

  const fetchData = React.useCallback(
    async (isInitialLoad: boolean) => {
      if (isInitialLoad) {
        setLoading(true);
      }
      setError(null);

      const encodedQuery = encodeURIComponent(query);
      const url = `${PROMETHEUS_BASE_PATH}/api/v1/query?query=${encodedQuery}`;

      try {
        const response: PrometheusResponse = await consoleFetchJSON(url);

        if (response.status !== 'success') {
          setError('Query failed');
          return;
        }

        const data = response.data;
        if (data.resultType === 'scalar') {
          // Scalar result is [timestamp, value]
          const scalarResult = data.result as unknown as [number, string];
          setResults([{ metric: {}, value: scalarResult[1] }]);
          setUpdateKey((k) => k + 1);
        } else if (data.resultType === 'vector') {
          setResults(
            data.result.map((r) => ({
              metric: r.metric,
              value: r.value[1],
            })),
          );
          setUpdateKey((k) => k + 1);
        } else {
          setError(`Unexpected result type: ${data.resultType}`);
        }
      } catch (err) {
        // Try tenancy endpoint as fallback
        try {
          const tenancyUrl = `${PROMETHEUS_TENANCY_BASE_PATH}/api/v1/query?query=${encodedQuery}`;
          const response: PrometheusResponse = await consoleFetchJSON(tenancyUrl);

          if (response.status !== 'success') {
            setError('Query failed');
            return;
          }

          const data = response.data;
          if (data.resultType === 'scalar') {
            const scalarResult = data.result as unknown as [number, string];
            setResults([{ metric: {}, value: scalarResult[1] }]);
            setUpdateKey((k) => k + 1);
          } else if (data.resultType === 'vector') {
            setResults(
              data.result.map((r) => ({
                metric: r.metric,
                value: r.value[1],
              })),
            );
            setUpdateKey((k) => k + 1);
          } else {
            setError(`Unexpected result type: ${data.resultType}`);
          }
        } catch {
          setError(err instanceof Error ? err.message : 'Failed to fetch data');
        }
      } finally {
        if (isInitialLoad) {
          setLoading(false);
        }
      }
    },
    [query],
  );

  React.useEffect(() => {
    if (!query) {
      return;
    }

    fetchData(true);

    const intervalId = setInterval(() => {
      fetchData(false);
    }, POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [fetchData, query]);

  const onChange = React.useCallback(
    (_event: React.ChangeEvent<HTMLTextAreaElement>, value: string) => {
      setInputValue(value);
    },
    [],
  );

  const renderResults = () => {
    if (loading) {
      return <Spinner size="md" />;
    }

    if (error) {
      return <span className="ols-plugin__promql-value-error">{error}</span>;
    }

    if (results.length === 0) {
      return <span className="ols-plugin__promql-value-empty">No data</span>;
    }

    if (results.length === 1 && Object.keys(results[0].metric).length === 0) {
      // Single scalar value
      return (
        <span className="ols-plugin__promql-value-badge" key={updateKey}>
          {formatValue(results[0].value)}
        </span>
      );
    }

    // Multiple results with labels
    return (
      <div className="ols-plugin__promql-value-list" key={updateKey}>
        {results.map((result, index) => {
          const labelStr = Object.entries(result.metric)
            .map(([k, v]) => `${k}="${v}"`)
            .join(', ');
          return (
            <div className="ols-plugin__promql-value-item" key={index}>
              <span className="ols-plugin__promql-value-badge">{formatValue(result.value)}</span>
              {labelStr && <span className="ols-plugin__promql-value-labels">{labelStr}</span>}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="ols-plugin__promql-value">
      {renderResults()}
      <TextArea
        aria-label="PromQL query"
        autoResize
        className="ols-plugin__promql-value-input"
        onChange={onChange}
        resizeOrientation="vertical"
        rows={2}
        value={inputValue || initialQuery}
      />
    </div>
  );
};

export default PromQLValue;
