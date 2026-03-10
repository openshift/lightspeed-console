import { Map as ImmutableMap } from 'immutable';
import * as React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Label, LabelGroup } from '@patternfly/react-core';
import { CodeIcon, ExternalLinkAltIcon, InfoCircleIcon } from '@patternfly/react-icons';

import { openToolSet } from '../redux-actions';
import { State } from '../redux-reducers';

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

type ResponseToolsProps = {
  entryIndex: number;
};

const ResponseTools: React.FC<ResponseToolsProps> = ({ entryIndex }) => {
  const tools: ImmutableMap<string, ImmutableMap<string, unknown>> = useSelector((s: State) =>
    s.plugins?.ols?.getIn(['chatHistory', entryIndex, 'tools']),
  );

  return (
    <LabelGroup numLabels={4}>
      {tools.keySeq().map((toolID) => (
        <ToolLabel entryIndex={entryIndex} key={toolID} toolID={toolID} />
      ))}
    </LabelGroup>
  );
};

export default ResponseTools;
