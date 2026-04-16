import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';
import {
  ActionList,
  ActionListGroup,
  ActionListItem,
  Button,
  Card,
  CardBody,
  CardFooter,
  ExpandableSection,
  Title,
} from '@patternfly/react-core';
import { ExclamationTriangleIcon } from '@patternfly/react-icons';

import { getApiUrl } from '../config';
import { getRequestInitWithAuthHeader } from '../hooks/useAuth';
import { chatHistoryUpdateTool } from '../redux-actions';
import { Tool } from '../types';

const TOOL_APPROVAL_ENDPOINT = getApiUrl('/v1/tool-approvals/decision');
const REQUEST_TIMEOUT = 5 * 60 * 1000;

type ToolApprovalCardProps = {
  chatEntryID: string;
  tool: Tool;
  toolID: string;
};

const ToolApproval: React.FC<ToolApprovalCardProps> = ({ chatEntryID, tool, toolID }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');
  const dispatch = useDispatch();

  const onApprove = React.useCallback(() => {
    consoleFetchJSON
      .post(
        TOOL_APPROVAL_ENDPOINT,
        // eslint-disable-next-line camelcase
        { approval_id: tool.approvalID, approved: true },
        getRequestInitWithAuthHeader(),
        REQUEST_TIMEOUT,
      )
      .then(() => {
        dispatch(chatHistoryUpdateTool(chatEntryID, toolID, { isApproved: true }));
      })
      .catch((err) => {
        dispatch(
          chatHistoryUpdateTool(chatEntryID, toolID, {
            content: `${t('Approval failed:')} ${err?.json?.description || err.message}`,
            status: 'error',
          }),
        );
      });
  }, [chatEntryID, dispatch, t, tool.approvalID, toolID]);

  const onDeny = React.useCallback(() => {
    consoleFetchJSON
      .post(
        TOOL_APPROVAL_ENDPOINT,
        // eslint-disable-next-line camelcase
        { approval_id: tool.approvalID, approved: false },
        getRequestInitWithAuthHeader(),
        REQUEST_TIMEOUT,
      )
      .then(() => {
        dispatch(chatHistoryUpdateTool(chatEntryID, toolID, { isDenied: true }));
      })
      .catch((err) => {
        dispatch(
          chatHistoryUpdateTool(chatEntryID, toolID, {
            content: `${t('Denial failed:')} ${err?.json?.description || err.message}`,
            status: 'error',
          }),
        );
      });
  }, [chatEntryID, dispatch, t, tool.approvalID, toolID]);

  return (
    <Card className="ols-plugin__tool-call" isCompact>
      <CardBody>
        <div className="ols-plugin__tool-call-header">
          <ExclamationTriangleIcon className="ols-plugin__tool-call-icon" />
          <Title headingLevel="h4" size="md">
            {t('Review required')}
          </Title>
        </div>
        {tool.description && (
          <p className="ols-plugin__tool-call-description">{tool.description}</p>
        )}
        <ExpandableSection toggleText={t('View action details')}>
          <code className="ols-plugin__code-inline">{tool.name}</code>
          <pre className="ols-plugin__tool-call-args">
            {Object.entries(tool.args)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? JSON.stringify(v) : v}`)
              .join('\n')}
          </pre>
        </ExpandableSection>
      </CardBody>
      <CardFooter>
        <ActionList>
          <ActionListGroup>
            <ActionListItem>
              <Button onClick={onDeny} variant="secondary">
                {t('Reject')}
              </Button>
            </ActionListItem>
            <ActionListItem>
              <Button onClick={onApprove} variant="warning">
                {t('Approve')}
              </Button>
            </ActionListItem>
          </ActionListGroup>
        </ActionList>
      </CardFooter>
    </Card>
  );
};

export default ToolApproval;
