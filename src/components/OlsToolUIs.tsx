import * as React from 'react';
import { Map as ImmutableMap } from 'immutable';
import { useSelector } from 'react-redux';
import { State } from '../redux-reducers';
import { useToolUIMapping } from '../hooks/useToolUIMapping';
import type { OlsToolUIComponent, Tool } from '../types';

type OlsToolUIProps = {
  tool: Tool;
  toolUIComponent: OlsToolUIComponent;
};

export const OlsToolUI: React.FC<OlsToolUIProps> = ({ tool, toolUIComponent: toolUIElement }) => {
  const ToolComponent = toolUIElement;
  return <ToolComponent tool={tool} />;
};

type OlsUIToolsProps = {
  entryIndex: number;
};

export const OlsToolUIs: React.FC<OlsUIToolsProps> = ({ entryIndex }) => {
  const [toolUIMapping] = useToolUIMapping();

  const toolsData: ImmutableMap<string, ImmutableMap<string, unknown>> = useSelector((s: State) =>
    s.plugins?.ols?.getIn(['chatHistory', entryIndex, 'tools']),
  );

  const olsToolsWithUI = toolsData
    .map((value) => {
      const tool = value.toJS() as Tool;
      const olsUiID = tool.tool_meta?.olsUi?.id;
      const toolUIComponent = olsUiID && toolUIMapping[olsUiID];
      return { tool, toolUIComponent };
    })
    .filter(({ toolUIComponent }) => !!toolUIComponent);

  return (
    <>
      {olsToolsWithUI
        .map(({ tool, toolUIComponent }, toolID) => (
          <OlsToolUI key={`ols-app-${toolID}`} tool={tool} toolUIComponent={toolUIComponent} />
        ))
        .valueSeq()}
    </>
  );
};

export default OlsToolUIs;
