import * as React from 'react';
import { Map as ImmutableMap } from 'immutable';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Alert } from '@patternfly/react-core';
import { State } from '../redux-reducers';
import { useToolUIMapping } from '../hooks/useToolUIMapping';
import type { OlsToolUIComponent, Tool } from '../types';
import ErrorBoundary from './ErrorBoundary';

type OlsToolUIProps = {
  tool: Tool;
  toolUIComponent: OlsToolUIComponent;
};

const OlsToolUI: React.FC<OlsToolUIProps> = ({ tool, toolUIComponent: ToolComponent }) => (
  <ErrorBoundary>
    <ToolComponent tool={tool} />
  </ErrorBoundary>
);

type OlsToolUIsProps = {
  entryIndex: number;
};

const OlsToolUIs: React.FC<OlsToolUIsProps> = ({ entryIndex }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');
  const [toolUIMapping] = useToolUIMapping();

  const toolsData: ImmutableMap<string, ImmutableMap<string, unknown>> = useSelector((s: State) =>
    s.plugins?.ols?.getIn(['chatHistory', entryIndex, 'tools']),
  );

  if (!toolsData) {
    return null;
  }

  // Successful tools carrying an olsToolUiID are kept even when their UI
  // component cannot be resolved: the tool's UI extension (e.g. the Perses
  // chart contributed by the monitoring-console-plugin) may not exist on the
  // console the plugin runs in, and silently dropping it leaves the user with
  // a chat answer describing a chart that never rendered.
  const olsToolsWithUI = toolsData
    .map((value) => {
      const tool = value.toJS() as Tool;
      const toolUIComponent = tool.olsToolUiID && toolUIMapping[tool.olsToolUiID];
      return { tool, toolUIComponent };
    })
    .filter(({ tool }) => tool.status !== 'error' && !!tool.olsToolUiID);

  return (
    <>
      {olsToolsWithUI
        .map(({ tool, toolUIComponent }, toolID) =>
          toolUIComponent ? (
            <OlsToolUI
              key={`ols-tool-ui-${toolID}`}
              tool={tool}
              toolUIComponent={toolUIComponent}
            />
          ) : (
            <Alert
              className="ols-plugin__alert"
              isInline
              key={`ols-tool-ui-unsupported-${toolID}`}
              title={t('Chart rendering is not supported in this version of OpenShift')}
              variant="info"
            />
          ),
        )
        .valueSeq()}
    </>
  );
};

export default OlsToolUIs;
