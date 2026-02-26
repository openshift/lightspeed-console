import * as React from 'react';
import { useTranslation } from 'react-i18next';
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
  TimesIcon,
  WindowRestoreIcon,
} from '@patternfly/react-icons';

import { getRequestInitWithAuthHeader } from '../hooks/useAuth';
import { useIsDarkTheme } from '../hooks/useIsDarkTheme';

import './mcp-app-card.css';

type MCPAppFrameProps = {
  resourceUri: string;
  serverName: string;
  status?: string;
  toolArgs?: Record<string, unknown>;
  toolContent?: string;
  toolName: string;
};

// Ext-apps protocol message types
type ExtAppsRequest = {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
};

type ExtAppsResponse = {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

// Generate generic HTML for structured data
const generateGenericDataHtml = (
  data: Record<string, unknown>,
  toolName: string,
  isDarkTheme: boolean,
): string => {
  const bgColor = isDarkTheme ? '#1b1d21' : '#ffffff';
  const textColor = isDarkTheme ? '#e0e0e0' : '#151515';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'RedHatText', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${bgColor};
      color: ${textColor};
      padding: 16px;
      font-size: 14px;
    }
    h2 { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
    pre {
      background: ${isDarkTheme ? '#292c30' : '#f5f5f5'};
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 12px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <h2>${toolName}</h2>
  
  <pre>${JSON.stringify(data, null, 2)}</pre>
  
  <script>
    function notifyResize() {
      window.parent.postMessage({ type: 'mcp-app-resize', height: document.body.scrollHeight + 32 }, '*');
    }
    notifyResize();
    new ResizeObserver(notifyResize).observe(document.body);
  </script>
</body>
</html>`;
};

// Generate simple HTML wrapper for raw content
const wrapHtmlContent = (html: string, isDarkTheme: boolean): string => {
  const bgColor = isDarkTheme ? '#1b1d21' : '#ffffff';
  const textColor = isDarkTheme ? '#e0e0e0' : '#151515';
  const borderColor = isDarkTheme ? '#3c3f42' : '#d2d2d2';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px;
      font-family: 'RedHatText', -apple-system, sans-serif;
      font-size: 14px;
      background: ${bgColor};
      color: ${textColor};
    }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid ${borderColor}; padding: 8px; text-align: left; }
    th { background: ${isDarkTheme ? '#292c30' : '#f0f0f0'}; }
  </style>
</head>
<body>
${html}
<script>
  function notifyResize() {
    window.parent.postMessage({ type: 'mcp-app-resize', height: document.body.scrollHeight + 24 }, '*');
  }
  notifyResize();
  new ResizeObserver(notifyResize).observe(document.body);
</script>
</body>
</html>`;
};

const IFRAME_HEIGHT_MIN = 60;
const IFRAME_HEIGHT_MAX = 960;

const MCPAppFrame: React.FC<MCPAppFrameProps> = ({
  resourceUri,
  serverName,
  status,
  toolArgs,
  toolContent,
  toolName,
}) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');
  const [isDarkTheme] = useIsDarkTheme();

  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [content, setContent] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [iframeHeight, setIframeHeight] = React.useState(IFRAME_HEIGHT_MIN);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [useExtApps, setUseExtApps] = React.useState(false);
  const [isClosed, setIsClosed] = React.useState(false);
  const [isMinimized, setIsMinimized] = React.useState(false);

  // Handle tool call from ext-apps iframe
  const handleToolCall = React.useCallback(
    async (
      requestedToolName: string,
      args: Record<string, unknown>,
    ): Promise<{
      content: Array<{ type: string; text: string }>;
      isError?: boolean;
      structuredContent?: unknown;
    }> => {
      const toolEndpoint = `/api/proxy/plugin/lightspeed-console-plugin/ols/v1/mcp-apps/tools/call`;
      /* eslint-disable camelcase */
      const response = await consoleFetchJSON.post(
        toolEndpoint,
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

  // Send ext-apps response to iframe
  const sendExtAppsResponse = React.useCallback((response: ExtAppsResponse) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(response, '*');
    }
  }, []);

  // Handle refresh triggered from card header button
  const handleRefresh = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      const result = await handleToolCall(toolName, toolArgs || {});

      if (useExtApps) {
        // Re-send tool input arguments so the app can update headers/context
        iframeRef.current?.contentWindow?.postMessage(
          {
            jsonrpc: '2.0',
            method: 'ui/notifications/tool-input',
            params: { arguments: toolArgs || {} },
          },
          '*',
        );
        // Push new data into the ext-apps iframe via the standard protocol
        iframeRef.current?.contentWindow?.postMessage(
          {
            jsonrpc: '2.0',
            method: 'ui/notifications/tool-result',
            params: result,
          },
          '*',
        );
      } else {
        // Fallback mode: render data generically
        const data = result.structuredContent || result.content;
        if (data && typeof data === 'object') {
          setContent(
            generateGenericDataHtml(data as Record<string, unknown>, toolName, isDarkTheme),
          );
        }
      }
    } catch (err) {
      setError(t('Failed to refresh data: {{error}}', { error: String(err) }));
    } finally {
      setIsRefreshing(false);
    }
  }, [handleToolCall, toolName, toolArgs, useExtApps, isDarkTheme, t]);

  // Handle messages from iframe
  React.useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const message = event.data;

      // Handle simple resize message (our generated HTML or any iframe posting mcp-app-resize)
      if (message?.type === 'mcp-app-resize' && typeof message.height === 'number') {
        setIframeHeight(Math.min(Math.max(message.height, IFRAME_HEIGHT_MIN), IFRAME_HEIGHT_MAX));
        return;
      }

      // Handle ext-apps JSON-RPC protocol
      if (message?.jsonrpc === '2.0' && message?.method) {
        const request = message as ExtAppsRequest;
        // Ext-apps SDK uses ui/ prefix for methods
        const method = request.method.replace(/^ui\//, '');

        switch (method) {
          case 'tools/call': {
            const params = request.params || {};
            const reqToolName = (params.name as string) || toolName;
            const reqArgs = (params.arguments as Record<string, unknown>) || {};

            try {
              const result = await handleToolCall(reqToolName, reqArgs);
              sendExtAppsResponse({
                jsonrpc: '2.0',
                id: request.id,
                result,
              });
            } catch (err) {
              sendExtAppsResponse({
                jsonrpc: '2.0',
                id: request.id,
                error: {
                  code: -32603,
                  message: String(err),
                },
              });
            }
            break;
          }

          case 'initialize': {
            // Respond to initialize request from ext-apps SDK
            sendExtAppsResponse({
              jsonrpc: '2.0',
              id: request.id,
              result: {
                protocolVersion: '2024-11-05',
                hostInfo: {
                  name: 'lightspeed-console',
                  version: '1.0.0',
                },
                hostCapabilities: {
                  tools: { call: true, list: true },
                },
                hostContext: {
                  theme: isDarkTheme ? 'dark' : 'light',
                  toolName,
                  serverName,
                },
              },
            });
            break;
          }

          case 'notifications/initialized': {
            // The ext-apps SDK completed initialization and is ready for data.
            // Fetch the tool result directly from the MCP server via the proxy
            // endpoint. The stream only provides metadata (ui_resource_uri,
            // server_name, args); actual data comes from the MCP server.
            if (!iframeRef.current?.contentWindow) {
              break;
            }

            // Send host context (including theme) so apps can apply it
            // immediately. The hostContext in the initialize response is stored
            // by the SDK but apps commonly rely on the
            // onhostcontextchanged callback to apply the theme, which only
            // fires for this notification.
            iframeRef.current.contentWindow.postMessage(
              {
                jsonrpc: '2.0',
                method: 'ui/notifications/host-context-changed',
                params: {
                  theme: isDarkTheme ? 'dark' : 'light',
                },
              },
              '*',
            );

            // Send tool input arguments so the app can display them
            // (e.g., the PromQL query string or chart title)
            iframeRef.current.contentWindow.postMessage(
              {
                jsonrpc: '2.0',
                method: 'ui/notifications/tool-input',
                params: { arguments: toolArgs || {} },
              },
              '*',
            );

            try {
              const result = await handleToolCall(toolName, toolArgs || {});
              iframeRef.current?.contentWindow?.postMessage(
                {
                  jsonrpc: '2.0',
                  method: 'ui/notifications/tool-result',
                  params: result,
                },
                '*',
              );
            } catch {
              // Proxy call failed - fall back to streamed text content
              iframeRef.current?.contentWindow?.postMessage(
                {
                  jsonrpc: '2.0',
                  method: 'ui/notifications/tool-result',
                  params: {
                    content: [{ type: 'text', text: toolContent || '' }],
                    ...(status === 'error' && { isError: true }),
                  },
                },
                '*',
              );
            }
            break;
          }

          case 'tools/list': {
            // Return available tool for this context
            sendExtAppsResponse({
              jsonrpc: '2.0',
              id: request.id,
              result: {
                tools: [
                  {
                    name: toolName,
                    description: `Call ${toolName} tool`,
                    inputSchema: { type: 'object', properties: {} },
                  },
                ],
              },
            });
            break;
          }

          case 'notifications/size-changed': {
            // Ext-apps SDK auto-resize notification
            const params = request.params || {};
            const height = params.height as number | undefined;
            if (typeof height === 'number') {
              setIframeHeight(Math.min(Math.max(height, IFRAME_HEIGHT_MIN), IFRAME_HEIGHT_MAX));
            }
            break;
          }

          default:
            // Unknown method - only send error for requests (with id), not notifications
            if (request.id !== undefined) {
              sendExtAppsResponse({
                jsonrpc: '2.0',
                id: request.id,
                error: {
                  code: -32601,
                  message: `Method not found: ${request.method}`,
                },
              });
            }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [
    handleToolCall,
    isDarkTheme,
    sendExtAppsResponse,
    serverName,
    status,
    toolArgs,
    toolContent,
    toolName,
  ]);

  // Notify ext-apps iframe when the theme changes after initial load
  React.useEffect(() => {
    if (useExtApps && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          jsonrpc: '2.0',
          method: 'ui/notifications/host-context-changed',
          params: {
            theme: isDarkTheme ? 'dark' : 'light',
          },
        },
        '*',
      );
    }
  }, [isDarkTheme, useExtApps]);

  // Load content - try MCP resource first (decoupled approach), fall back to generated HTML
  React.useEffect(() => {
    const loadContent = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // APPROACH 1: Try to load HTML resource from MCP server (decoupled - server provides UI)
        try {
          const resourceEndpoint = `/api/proxy/plugin/lightspeed-console-plugin/ols/v1/mcp-apps/resources`;
          /* eslint-disable camelcase */
          const resourceResponse = await consoleFetchJSON.post(
            resourceEndpoint,
            {
              resource_uri: resourceUri,
            },
            getRequestInitWithAuthHeader(),
          );
          /* eslint-enable camelcase */

          if (resourceResponse?.content) {
            // Successfully loaded MCP app HTML - use ext-apps mode
            // The HTML will use ext-apps SDK to call tools via postMessage
            setUseExtApps(true);
            // Pre-inject the theme attribute so CSS variables are correct from first render,
            // avoiding a flash of the wrong theme before the ext-apps init handshake completes.
            const themeAttr = `data-theme="${isDarkTheme ? 'dark' : 'light'}"`;
            const themedHtml = resourceResponse.content.replace(
              /<html([^>]*)>/i,
              `<html$1 ${themeAttr}>`,
            );
            setContent(themedHtml);
            return;
          }
        } catch (resourceErr) {
          // Resource loading failed, fall back to generated HTML
          // eslint-disable-next-line no-console
          console.debug('MCP App resource loading failed, using fallback:', resourceErr);
        }

        // APPROACH 2: Fall back to generic data view
        // Call the tool directly via proxy and render the result generically
        setUseExtApps(false);

        const toolEndpoint = `/api/proxy/plugin/lightspeed-console-plugin/ols/v1/mcp-apps/tools/call`;
        /* eslint-disable camelcase */
        const toolResponse = await consoleFetchJSON.post(
          toolEndpoint,
          {
            server_name: serverName,
            tool_name: toolName,
            arguments: toolArgs || {},
          },
          getRequestInitWithAuthHeader(),
        );
        /* eslint-enable camelcase */

        const data = toolResponse.structured_content || toolResponse.content || toolResponse;
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
          setContent(generateGenericDataHtml(data, toolName, isDarkTheme));
        } else {
          setContent(
            wrapHtmlContent(
              `<p style="padding: 20px; text-align: center;">Interactive view for <strong>${toolName}</strong>. See detailed data in the chat response above.</p>`,
              isDarkTheme,
            ),
          );
        }
      } catch (err) {
        setError(t('Failed to load MCP App: {{error}}', { error: String(err) }));
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [resourceUri, serverName, toolArgs, isDarkTheme, t, toolName]);

  // Toggle expand
  const handleToggleExpand = React.useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Minimize the card to a compact bar
  const handleMinimize = React.useCallback(() => {
    setIsMinimized(true);
    setIsExpanded(false);
  }, []);

  // Restore from minimized state
  const handleRestore = React.useCallback(() => {
    setIsMinimized(false);
  }, []);

  // Close/dismiss the card entirely
  const handleClose = React.useCallback(() => {
    setIsClosed(true);
    setIsExpanded(false);
  }, []);

  if (isClosed) {
    return null;
  }

  if (isMinimized && content) {
    return (
      <Card className="ols-plugin__mcp-app-card ols-plugin__mcp-app-card--minimized" isCompact>
        <CardHeader
          actions={{
            actions: (
              <>
                <Button
                  aria-label={t('Restore')}
                  icon={<WindowRestoreIcon />}
                  onClick={handleRestore}
                  title={t('Restore')}
                  variant="plain"
                />
                <Button
                  aria-label={t('Close')}
                  icon={<TimesIcon />}
                  onClick={handleClose}
                  title={t('Close')}
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
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="ols-plugin__mcp-app-card">
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

  if (!content) {
    return null;
  }

  const cardClassName = isExpanded
    ? 'ols-plugin__mcp-app-card ols-plugin__mcp-app-card--expanded'
    : 'ols-plugin__mcp-app-card';

  return (
    <Card className={cardClassName} isCompact>
      <CardHeader
        actions={{
          actions: (
            <>
              <Button
                aria-label={t('Refresh')}
                icon={isRefreshing ? <Spinner size="md" /> : <SyncAltIcon />}
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
              <Button
                aria-label={t('Close')}
                icon={<TimesIcon />}
                onClick={handleClose}
                title={t('Close')}
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
          sandbox={useExtApps ? 'allow-scripts allow-same-origin' : 'allow-scripts'}
          srcDoc={content}
          style={{ height: isExpanded ? '500px' : `${iframeHeight}px` }}
          title={t('MCP App: {{toolName}}', { toolName })}
        />
      </CardBody>
    </Card>
  );
};

export default MCPAppFrame;
