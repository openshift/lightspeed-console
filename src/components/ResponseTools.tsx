import { Map as ImmutableMap } from 'immutable';
import * as React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Label, LabelGroup } from '@patternfly/react-core';
import { CodeIcon, ExternalLinkAltIcon, InfoCircleIcon } from '@patternfly/react-icons';

import { openToolSet } from '../redux-actions';
import { State } from '../redux-reducers';
import MCPAppFrame from './MCPAppFrame';

type ToolProps = {
  entryIndex: number;
  toolID: string;
};

const ToolLabel: React.FC<ToolProps> = ({ entryIndex, toolID }) => {
  const dispatch = useDispatch();

  const tool: ImmutableMap<string, unknown> = useSelector((s: State) =>
    s.plugins?.ols?.getIn(['chatHistory', entryIndex, 'tools', toolID]),
  );

  const onClick = React.useCallback(() => {
    dispatch(openToolSet(entryIndex, toolID));
  }, [dispatch, entryIndex, toolID]);

  const status = tool.get('status') as string | undefined;
  const isError = status === 'error';
  const isTruncated = status === 'truncated';
  const hasUI = !!tool.get('uiResourceUri');

  const color = isError ? 'red' : isTruncated ? 'yellow' : hasUI ? 'blue' : undefined;
  const icon = isError ? (
    <InfoCircleIcon />
  ) : isTruncated ? (
    <InfoCircleIcon />
  ) : hasUI ? (
    <ExternalLinkAltIcon />
  ) : (
    <CodeIcon />
  );

  return (
    <Label color={color} icon={icon} onClick={onClick} textMaxWidth="16ch">
      {tool.get('name') as string}
    </Label>
  );
};

type MCPAppToolProps = {
  entryIndex: number;
  toolID: string;
};

const MCPAppTool: React.FC<MCPAppToolProps> = ({ entryIndex, toolID }) => {
  const tool: ImmutableMap<string, unknown> = useSelector((s: State) =>
    s.plugins?.ols?.getIn(['chatHistory', entryIndex, 'tools', toolID]),
  );

  const resourceUri = tool.get('uiResourceUri') as string | undefined;
  const serverName = tool.get('serverName') as string | undefined;
  const toolStatus = tool.get('status') as string | undefined;
  const rawArgs = tool.get('args');
  const toolArgs = React.useMemo(
    () =>
      rawArgs && typeof (rawArgs as ImmutableMap<string, unknown>).toJS === 'function'
        ? ((rawArgs as ImmutableMap<string, unknown>).toJS() as Record<string, unknown>)
        : (rawArgs as Record<string, unknown> | undefined),
    [rawArgs],
  );
  const toolContent = tool.get('content') as string | undefined;
  const toolName = tool.get('name') as string;

  if (!resourceUri || !serverName) {
    return null;
  }

  return (
    <MCPAppFrame
      resourceUri={resourceUri}
      serverName={serverName}
      status={toolStatus}
      toolArgs={toolArgs}
      toolContent={toolContent}
      toolName={toolName}
    />
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
      <LabelGroup numLabels={4}>
        {tools
          .keySeq()
          .toArray()
          .map((toolID) => (
            <ToolLabel entryIndex={entryIndex} key={toolID} toolID={toolID} />
          ))}
      </LabelGroup>
      {toolsWithUI
        .keySeq()
        .toArray()
        .map((toolID) => (
          <MCPAppTool entryIndex={entryIndex} key={`mcp-app-${toolID}`} toolID={toolID} />
        ))}
    </>
  );
};

export default ResponseTools;
