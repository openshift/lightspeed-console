import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Spinner,
} from '@patternfly/react-core';
import {
  CompressIcon,
  ExpandIcon,
  MinusIcon,
  SyncAltIcon,
  WindowRestoreIcon,
} from '@patternfly/react-icons';

import { getApiUrl } from '../config';
import { getRequestInitWithAuthHeader } from '../hooks/useAuth';
import { useIsDarkTheme } from '../hooks/useIsDarkTheme';
import { State } from '../redux-reducers';
import { Tool } from '../types';

import './mcp-app.css';

type MCPAppProps = {
  entryIndex: number;
  toolID: string;
};

type ExtAppsRequest = {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
};

type ToolCallResult = {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
  structuredContent?: unknown;
};

type CardState = 'normal' | 'expanded' | 'minimized';

const IFRAME_HEIGHT_MIN = 120;
const IFRAME_HEIGHT_MAX = 960;
const TOOLS_ENDPOINT = getApiUrl('/v1/mcp-apps/tools/call');
const RESOURCES_ENDPOINT = getApiUrl('/v1/mcp-apps/resources');

const MCPApp: React.FC<MCPAppProps> = ({ entryIndex, toolID }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');
  const [isDarkTheme] = useIsDarkTheme();

  const toolMap = useSelector((s: State) =>
    s.plugins?.ols?.getIn(['chatHistory', entryIndex, 'tools', toolID]),
  );
  const tool = React.useMemo<Tool | undefined>(() => toolMap?.toJS(), [toolMap]);

  const {
    args: toolArgs = {},
    content: toolContent,
    name: toolName,
    serverName,
    status,
    uiResourceUri,
  } = tool || {};

  const theme = isDarkTheme ? 'dark' : 'light';

  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [htmlContent, setHtmlContent] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [iframeHeight, setIframeHeight] = React.useState(IFRAME_HEIGHT_MIN);
  const [cardState, setCardState] = React.useState<CardState>('normal');
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleToolCall = React.useCallback(
    async (requestedToolName: string, args: Record<string, unknown>): Promise<ToolCallResult> => {
      /* eslint-disable camelcase */
      const response = await consoleFetchJSON.post(
        TOOLS_ENDPOINT,
        {
          server_name: serverName,
          tool_name: requestedToolName,
          arguments: args,
        },
        getRequestInitWithAuthHeader(),
      );
      /* eslint-enable camelcase */

      return {
        content: response.content || [{ type: 'text', text: JSON.stringify(response) }],
        ...(response.is_error && { isError: true }),
        ...(response.structured_content && { structuredContent: response.structured_content }),
      };
    },
    [serverName],
  );

  const sendMessage = React.useCallback((fields: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage({ jsonrpc: '2.0', ...fields }, '*');
  }, []);

  const sendToolData = React.useCallback(async () => {
    sendMessage({ method: 'ui/notifications/tool-input', params: { arguments: toolArgs } });

    const result = await handleToolCall(toolName, toolArgs);
    sendMessage({ method: 'ui/notifications/tool-result', params: result });
  }, [handleToolCall, sendMessage, toolArgs, toolName]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await sendToolData();
    } catch (err) {
      setError(t('Failed to refresh data: {{error}}', { error: String(err) }));
    } finally {
      setIsRefreshing(false);
    }
  };

  React.useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const message = event.data;

      if (message?.jsonrpc !== '2.0' || !message?.method) {
        return;
      }

      const request = message as ExtAppsRequest;
      const method = request.method.replace(/^ui\//, '');

      switch (method) {
        case 'tools/call': {
          const params = request.params || {};
          const reqToolName = (params.name as string) || toolName;
          const reqArgs = (params.arguments as Record<string, unknown>) || {};

          try {
            const result = await handleToolCall(reqToolName, reqArgs);
            sendMessage({ id: request.id, result });
          } catch (err) {
            sendMessage({ id: request.id, error: { code: -32603, message: String(err) } });
          }
          break;
        }

        case 'initialize': {
          sendMessage({
            id: request.id,
            result: {
              protocolVersion: '2025-11-25',
              hostInfo: { name: 'lightspeed-console', version: '1.0.0' },
              hostCapabilities: { serverTools: {} },
              hostContext: { theme, toolName, serverName },
            },
          });
          break;
        }

        case 'notifications/initialized': {
          sendMessage({ method: 'ui/notifications/host-context-changed', params: { theme } });

          try {
            await sendToolData();
          } catch {
            sendMessage({
              method: 'ui/notifications/tool-result',
              params: {
                content: [{ type: 'text', text: toolContent || '' }],
                ...(status === 'error' && { isError: true }),
              },
            });
          }
          break;
        }

        case 'notifications/size-changed': {
          const params = request.params || {};
          const height = params.height as number | undefined;
          if (typeof height === 'number') {
            setIframeHeight(Math.min(Math.max(height, IFRAME_HEIGHT_MIN), IFRAME_HEIGHT_MAX));
          }
          break;
        }

        default:
          if (request.id !== undefined) {
            sendMessage({
              id: request.id,
              error: { code: -32601, message: `Method not found: ${request.method}` },
            });
          }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleToolCall, sendMessage, sendToolData, serverName, status, theme, toolContent, toolName]);

  React.useEffect(() => {
    if (htmlContent) {
      sendMessage({ method: 'ui/notifications/host-context-changed', params: { theme } });
    }
  }, [htmlContent, sendMessage, theme]);

  React.useEffect(() => {
    if (!uiResourceUri || !serverName) {
      return;
    }

    let cancelled = false;

    const loadContent = async () => {
      try {
        setIsLoading(true);
        setError(null);

        /* eslint-disable camelcase */
        const resourceResponse = await consoleFetchJSON.post(
          RESOURCES_ENDPOINT,
          {
            resource_uri: uiResourceUri,
            server_name: serverName,
          },
          getRequestInitWithAuthHeader(),
        );
        /* eslint-enable camelcase */

        if (cancelled) {
          return;
        }

        if (!resourceResponse?.content) {
          throw new Error('MCP server returned empty UI resource');
        }

        const themeAttr = `data-theme="${theme}"`;
        const themedHtml = resourceResponse.content.replace(
          /<html([^>]*)>/i,
          `<html$1 ${themeAttr}>`,
        );
        setHtmlContent(themedHtml);
      } catch (err) {
        if (!cancelled) {
          setError(t('Failed to load MCP App: {{error}}', { error: String(err) }));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadContent();
    return () => {
      cancelled = true;
    };
  }, [uiResourceUri, serverName, t, theme]);

  const handleToggleExpand = () =>
    setCardState((prev) => (prev === 'expanded' ? 'normal' : 'expanded'));
  const handleMinimize = () => setCardState('minimized');
  const handleRestore = () => setCardState('normal');
  if (!uiResourceUri || !serverName || !toolName) {
    return null;
  }

  if (cardState === 'minimized' && htmlContent) {
    return (
      <Card className="ols-plugin__mcp-app" isCompact>
        <CardHeader
          actions={{
            actions: (
              <Button
                aria-label={t('Restore')}
                icon={<WindowRestoreIcon />}
                onClick={handleRestore}
                title={t('Restore')}
                variant="plain"
              />
            ),
          }}
        >
          <CardTitle className="ols-plugin__mcp-app-title">
            {t('Interactive view from {{toolName}}', { toolName })}
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="ols-plugin__mcp-app">
        <CardBody>
          <Spinner size="md" /> {t('Loading MCP App...')}
        </CardBody>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert className="ols-plugin__alert" isInline title={t('MCP App Error')} variant="danger">
        {error}
      </Alert>
    );
  }

  if (!htmlContent) {
    return null;
  }

  const isExpanded = cardState === 'expanded';

  return (
    <Card
      className={`ols-plugin__mcp-app${isExpanded ? ' ols-plugin__mcp-app--expanded' : ''}`}
      isCompact
    >
      <CardHeader
        actions={{
          actions: (
            <>
              <Button
                aria-label={t('Refresh')}
                icon={isRefreshing ? <Spinner size="sm" /> : <SyncAltIcon />}
                isDisabled={isRefreshing}
                onClick={handleRefresh}
                title={t('Refresh')}
                variant="plain"
              />
              <Button
                aria-label={isExpanded ? t('Collapse') : t('Expand')}
                icon={isExpanded ? <CompressIcon /> : <ExpandIcon />}
                onClick={handleToggleExpand}
                title={isExpanded ? t('Collapse') : t('Expand')}
                variant="plain"
              />
              <Button
                aria-label={t('Minimize')}
                icon={<MinusIcon />}
                onClick={handleMinimize}
                title={t('Minimize')}
                variant="plain"
              />
            </>
          ),
        }}
      >
        <CardTitle className="ols-plugin__mcp-app-title">
          {t('Interactive view from {{toolName}}', { toolName })}
        </CardTitle>
      </CardHeader>
      <CardBody className="ols-plugin__mcp-app-body">
        <iframe
          className="ols-plugin__mcp-app-iframe"
          ref={iframeRef}
          sandbox="allow-scripts"
          srcDoc={htmlContent}
          style={{ height: `${iframeHeight}px` }}
          title={t('MCP App: {{toolName}}', { toolName })}
        />
      </CardBody>
    </Card>
  );
};

export default MCPApp;
