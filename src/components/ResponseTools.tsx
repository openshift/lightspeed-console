import { Map as ImmutableMap } from 'immutable';
import * as React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Label, LabelGroup } from '@patternfly/react-core';
import { CodeIcon, ExternalLinkAltIcon, InfoCircleIcon } from '@patternfly/react-icons';

import { openToolSet } from '../redux-actions';
import { State } from '../redux-reducers';
import { Tool } from '../types';
import MCPApp from './MCPApp';

type ToolProps = {
  entryIndex: number;
  toolID: string;
};

const ToolLabel: React.FC<ToolProps> = ({ entryIndex, toolID }) => {
  const dispatch = useDispatch();

  const toolMap = useSelector((s: State) =>
    s.plugins?.ols?.getIn(['chatHistory', entryIndex, 'tools', toolID]),
  );
  const tool: Tool | undefined = React.useMemo(() => toolMap?.toJS(), [toolMap]);

  const onClick = React.useCallback(() => {
    dispatch(openToolSet(entryIndex, toolID));
  }, [dispatch, entryIndex, toolID]);

  if (!tool) {
    return null;
  }

  const isError = tool.status === 'error';
  const isTruncated = tool.status === 'truncated';
  const hasUI = !!tool.uiResourceUri;

  const color = isError ? 'red' : isTruncated ? 'gold' : hasUI ? 'blue' : undefined;
  const icon =
    isError || isTruncated ? <InfoCircleIcon /> : hasUI ? <ExternalLinkAltIcon /> : <CodeIcon />;

  return (
    <Label color={color} icon={icon} onClick={onClick} textMaxWidth="16ch">
      {tool.name}
    </Label>
  );
};

type ResponseToolsProps = {
  entryIndex: number;
};

const ResponseTools: React.FC<ResponseToolsProps> = ({ entryIndex }) => {
  const tools: ImmutableMap<string, ImmutableMap<string, unknown>> = useSelector((s: State) =>
    s.plugins?.ols?.getIn(['chatHistory', entryIndex, 'tools']),
  );

  const toolsWithUI = tools.filter((tool) => !!tool.get('uiResourceUri'));

  return (
    <>
      <div className="ols-plugin__references">
        {toolsWithUI
          .keySeq()
          .toArray()
          .map((toolID) => (
            <MCPApp entryIndex={entryIndex} key={`mcp-app-${toolID}`} toolID={toolID} />
          ))}
      </div>
      <div className="ols-plugin__references">
        <LabelGroup numLabels={4}>
          {tools
            .keySeq()
            .toArray()
            .map((toolID) => (
              <ToolLabel entryIndex={entryIndex} key={toolID} toolID={toolID} />
            ))}
        </LabelGroup>
      </div>
    </>
  );
};

export default ResponseTools;
