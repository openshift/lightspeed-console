import * as React from 'react';
import { Map as ImmutableMap } from 'immutable';
import { useSelector } from 'react-redux';
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
  const [toolUIMapping] = useToolUIMapping();

  const toolsData: ImmutableMap<string, ImmutableMap<string, unknown>> = useSelector((s: State) =>
    s.plugins?.ols?.getIn(['chatHistory', entryIndex, 'tools']),
  );

  if (!toolsData) {
    return null;
  }

  const olsToolsWithUI = toolsData
    .map((value) => {
      const tool = value.toJS() as Tool;
      const toolUIComponent = tool.olsToolUiID && toolUIMapping[tool.olsToolUiID];
      return { tool, toolUIComponent };
    })
    .filter(({ tool, toolUIComponent }) => tool.status !== 'error' && !!toolUIComponent);

  return (
    <>
      {olsToolsWithUI
        .map(({ tool, toolUIComponent }, toolID) => (
          <OlsToolUI key={`ols-tool-ui-${toolID}`} tool={tool} toolUIComponent={toolUIComponent} />
        ))
        .valueSeq()}
    </>
  );
};

export default OlsToolUIs;
