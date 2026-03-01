import * as React from 'react';
import { debounce } from 'lodash';
import { QueryBrowser } from '@openshift-console/dynamic-plugin-sdk';
import { Spinner, TextArea } from '@patternfly/react-core';

const QueryBrowserGraph: React.FC<{ query: string }> = ({ query: initialQuery }) => {
  const [inputValue, setInputValue] = React.useState('');
  const [query, setQuery] = React.useState('');

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

  const onChange = React.useCallback(
    (_event: React.ChangeEvent<HTMLTextAreaElement>, value: string) => {
      setInputValue(value);
    },
    [],
  );

  return (
    <>
      <React.Suspense fallback={<Spinner size="md" />}>
        {query ? <QueryBrowser queries={[query]} showStackedControl /> : <Spinner size="md" />}
      </React.Suspense>
      <TextArea
        aria-label="PromQL query"
        autoResize
        className="ols-plugin__query-browser-input"
        onChange={onChange}
        resizeOrientation="vertical"
        rows={3}
        value={inputValue || initialQuery}
      />
    </>
  );
};

export default QueryBrowserGraph;
