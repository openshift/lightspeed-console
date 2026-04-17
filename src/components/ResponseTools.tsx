import { Map as ImmutableMap } from 'immutable';
import * as React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Label, LabelGroup } from '@patternfly/react-core';
import { BanIcon, CodeIcon, ExternalLinkAltIcon, InfoCircleIcon } from '@patternfly/react-icons';

import { openToolSet } from '../redux-actions';
import { State } from '../redux-reducers';
import { Tool } from '../types';
import MCPApp from './MCPApp';
import OlsToolUIs from './OlsToolUIs';

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

  let color: React.ComponentProps<typeof Label>['color'];
  let icon: React.ReactNode;

  if (tool.isDenied) {
    color = 'grey';
    icon = <BanIcon />;
  } else if (isError) {
    color = 'red';
    icon = <InfoCircleIcon />;
  } else if (isTruncated) {
    color = 'yellow';
    icon = <InfoCircleIcon />;
  } else if (hasUI) {
    color = 'blue';
    icon = <ExternalLinkAltIcon />;
  } else {
    icon = <CodeIcon />;
  }

  return (
    <Label
      color={color}
      icon={icon}
      onClick={onClick}
      textMaxWidth="16ch"
      variant={tool.isDenied ? undefined : 'outline'}
    >
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
  const completedTools = tools.filter(
    (tool) => !tool.get('isUserApproval') || !!tool.get('isApproved') || !!tool.get('isDenied'),
  );

  return (
    <>
      {toolsWithUI
        .keySeq()
        .toArray()
        .map((toolID) => (
          <MCPApp entryIndex={entryIndex} key={`mcp-app-${toolID}`} toolID={toolID} />
        ))}
      <OlsToolUIs entryIndex={entryIndex} />
      <LabelGroup numLabels={4}>
        {completedTools
          .keySeq()
          .toArray()
          .map((toolID) => (
            <ToolLabel entryIndex={entryIndex} key={toolID} toolID={toolID} />
          ))}
      </LabelGroup>
    </>
  );
};

export default ResponseTools;
