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
import { CompressIcon, ExpandIcon, SyncAltIcon } from '@patternfly/react-icons';

import { getRequestInitWithAuthHeader } from '../hooks/useAuth';
import { useIsDarkTheme } from '../hooks/useIsDarkTheme';

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

type PodMetrics = {
  name: string;
  namespace: string;
  cpu: number;
  memory: number;
  status?: string;
};

type StructuredPodData = {
  timestamp?: string;
  pods?: PodMetrics[];
  summary?: {
    totalPods?: number;
    avgCpu?: number;
    avgMemory?: number;
  };
};

type NamespaceInfo = {
  name: string;
  status?: string;
  labels?: Record<string, string>;
  createdAt?: string;
};

type StructuredNamespaceData = {
  timestamp?: string;
  namespaces?: NamespaceInfo[];
  total?: number;
};

type WorkloadInfo = {
  name: string;
  namespace: string;
  kind: string;
  replicas?: number;
  readyReplicas?: number;
  status?: string;
};

type StructuredWorkloadData = {
  timestamp?: string;
  workloads?: WorkloadInfo[];
  total?: number;
};

// Generate HTML for pod utilization data
const generatePodUtilizationHtml = (data: StructuredPodData, isDarkTheme: boolean): string => {
  const pods = data.pods || [];
  const summary = data.summary || {};
  const timestamp = data.timestamp || new Date().toISOString();

  const bgColor = isDarkTheme ? '#1b1d21' : '#ffffff';
  const textColor = isDarkTheme ? '#e0e0e0' : '#151515';
  const borderColor = isDarkTheme ? '#3c3f42' : '#d2d2d2';
  const headerBg = isDarkTheme ? '#292c30' : '#f0f0f0';
  const cardBg = isDarkTheme ? '#292c30' : '#f5f5f5';

  const getBarColor = (value: number, type: 'cpu' | 'memory'): string => {
    if (value >= 80) {
      return '#c9190b';
    } // Red - danger
    if (value >= 60) {
      return '#f0ab00';
    } // Yellow - warning
    return type === 'cpu' ? '#0066cc' : '#6a6e73'; // Blue for CPU, gray for memory
  };

  const podRows = pods
    .map(
      (pod) => `
    <tr>
      <td style="font-size: 12px;">
        <div style="font-weight: 500;">${pod.name}</div>
        <div style="color: ${isDarkTheme ? '#8a8d90' : '#6a6e73'}; font-size: 11px;">${pod.namespace}</div>
      </td>
      <td style="width: 120px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="flex: 1; height: 16px; background: ${borderColor}; border-radius: 3px; overflow: hidden;">
            <div style="width: ${pod.cpu}%; height: 100%; background: ${getBarColor(pod.cpu, 'cpu')};"></div>
          </div>
          <span style="font-size: 12px; min-width: 36px;">${pod.cpu}%</span>
        </div>
      </td>
      <td style="width: 120px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="flex: 1; height: 16px; background: ${borderColor}; border-radius: 3px; overflow: hidden;">
            <div style="width: ${pod.memory}%; height: 100%; background: ${getBarColor(pod.memory, 'memory')};"></div>
          </div>
          <span style="font-size: 12px; min-width: 36px;">${pod.memory}%</span>
        </div>
      </td>
    </tr>
  `,
    )
    .join('');

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
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    h2 { font-size: 16px; font-weight: 600; }
    .timestamp { font-size: 12px; color: ${isDarkTheme ? '#8a8d90' : '#6a6e73'}; }
    .summary {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }
    .summary-card {
      flex: 1;
      padding: 12px;
      background: ${cardBg};
      border-radius: 6px;
      text-align: center;
    }
    .summary-value { font-size: 24px; font-weight: 700; }
    .summary-label { font-size: 11px; color: ${isDarkTheme ? '#8a8d90' : '#6a6e73'}; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid ${borderColor}; }
    th { background: ${headerBg}; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    tr:hover { background: ${isDarkTheme ? '#21232a' : '#fafafa'}; }
    .legend {
      display: flex;
      gap: 16px;
      margin-top: 12px;
      font-size: 11px;
      color: ${isDarkTheme ? '#8a8d90' : '#6a6e73'};
    }
    .legend-item { display: flex; align-items: center; gap: 4px; }
    .legend-dot { width: 10px; height: 10px; border-radius: 2px; }
  </style>
</head>
<body>
  <div class="header">
    <h2>Pod Utilization</h2>
    <span class="timestamp">${new Date(timestamp).toLocaleString()}</span>
  </div>
  
  <div class="summary">
    <div class="summary-card">
      <div class="summary-value">${summary.totalPods || pods.length}</div>
      <div class="summary-label">Pods</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${summary.avgCpu || Math.round(pods.reduce((s, p) => s + p.cpu, 0) / pods.length)}%</div>
      <div class="summary-label">Avg CPU</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${summary.avgMemory || Math.round(pods.reduce((s, p) => s + p.memory, 0) / pods.length)}%</div>
      <div class="summary-label">Avg Memory</div>
    </div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>Pod</th>
        <th>CPU</th>
        <th>Memory</th>
      </tr>
    </thead>
    <tbody>
      ${podRows}
    </tbody>
  </table>
  
  <div class="legend">
    <div class="legend-item"><div class="legend-dot" style="background: #0066cc;"></div> Normal</div>
    <div class="legend-item"><div class="legend-dot" style="background: #f0ab00;"></div> Warning (≥60%)</div>
    <div class="legend-item"><div class="legend-dot" style="background: #c9190b;"></div> Critical (≥80%)</div>
  </div>
  
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

// Generate HTML for namespace list data
const generateNamespaceListHtml = (data: StructuredNamespaceData, isDarkTheme: boolean): string => {
  const namespaces = data.namespaces || [];
  const timestamp = data.timestamp || new Date().toISOString();

  const bgColor = isDarkTheme ? '#1b1d21' : '#ffffff';
  const textColor = isDarkTheme ? '#e0e0e0' : '#151515';
  const borderColor = isDarkTheme ? '#3c3f42' : '#d2d2d2';
  const headerBg = isDarkTheme ? '#292c30' : '#f0f0f0';
  const cardBg = isDarkTheme ? '#292c30' : '#f5f5f5';

  const getStatusColor = (status?: string): string => {
    if (status === 'Active') {
      return '#3e8635';
    }
    if (status === 'Terminating') {
      return '#c9190b';
    }
    return isDarkTheme ? '#8a8d90' : '#6a6e73';
  };

  const namespaceRows = namespaces
    .map(
      (ns) => `
    <tr>
      <td style="font-weight: 500;">${ns.name}</td>
      <td><span style="color: ${getStatusColor(ns.status)};">${ns.status || 'Unknown'}</span></td>
      <td style="font-size: 12px; color: ${isDarkTheme ? '#8a8d90' : '#6a6e73'};">${ns.createdAt ? new Date(ns.createdAt).toLocaleDateString() : '-'}</td>
    </tr>
  `,
    )
    .join('');

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
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    h2 { font-size: 16px; font-weight: 600; }
    .timestamp { font-size: 12px; color: ${isDarkTheme ? '#8a8d90' : '#6a6e73'}; }
    .summary-card {
      display: inline-block;
      padding: 12px 24px;
      background: ${cardBg};
      border-radius: 6px;
      text-align: center;
      margin-bottom: 16px;
    }
    .summary-value { font-size: 24px; font-weight: 700; }
    .summary-label { font-size: 11px; color: ${isDarkTheme ? '#8a8d90' : '#6a6e73'}; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid ${borderColor}; }
    th { background: ${headerBg}; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    tr:hover { background: ${isDarkTheme ? '#21232a' : '#fafafa'}; }
  </style>
</head>
<body>
  <div class="header">
    <h2>Namespaces</h2>
    <span class="timestamp">${new Date(timestamp).toLocaleString()}</span>
  </div>
  
  <div class="summary-card">
    <div class="summary-value">${data.total || namespaces.length}</div>
    <div class="summary-label">Namespaces</div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Status</th>
        <th>Created</th>
      </tr>
    </thead>
    <tbody>
      ${namespaceRows}
    </tbody>
  </table>
  
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

// Generate HTML for workload list data
const generateWorkloadListHtml = (data: StructuredWorkloadData, isDarkTheme: boolean): string => {
  const workloads = data.workloads || [];
  const timestamp = data.timestamp || new Date().toISOString();

  const bgColor = isDarkTheme ? '#1b1d21' : '#ffffff';
  const textColor = isDarkTheme ? '#e0e0e0' : '#151515';
  const borderColor = isDarkTheme ? '#3c3f42' : '#d2d2d2';
  const headerBg = isDarkTheme ? '#292c30' : '#f0f0f0';
  const cardBg = isDarkTheme ? '#292c30' : '#f5f5f5';

  const getStatusColor = (ready?: number, total?: number): string => {
    if (ready === undefined || total === undefined) {
      return isDarkTheme ? '#8a8d90' : '#6a6e73';
    }
    if (ready === total) {
      return '#3e8635';
    }
    if (ready === 0) {
      return '#c9190b';
    }
    return '#f0ab00';
  };

  const workloadRows = workloads
    .map(
      (wl) => `
    <tr>
      <td>
        <div style="font-weight: 500;">${wl.name}</div>
        <div style="font-size: 11px; color: ${isDarkTheme ? '#8a8d90' : '#6a6e73'};">${wl.namespace}</div>
      </td>
      <td><span style="padding: 2px 8px; background: ${isDarkTheme ? '#3c3f42' : '#e0e0e0'}; border-radius: 3px; font-size: 11px;">${wl.kind}</span></td>
      <td style="color: ${getStatusColor(wl.readyReplicas, wl.replicas)};">${wl.readyReplicas ?? '-'}/${wl.replicas ?? '-'}</td>
    </tr>
  `,
    )
    .join('');

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
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    h2 { font-size: 16px; font-weight: 600; }
    .timestamp { font-size: 12px; color: ${isDarkTheme ? '#8a8d90' : '#6a6e73'}; }
    .summary-card {
      display: inline-block;
      padding: 12px 24px;
      background: ${cardBg};
      border-radius: 6px;
      text-align: center;
      margin-bottom: 16px;
    }
    .summary-value { font-size: 24px; font-weight: 700; }
    .summary-label { font-size: 11px; color: ${isDarkTheme ? '#8a8d90' : '#6a6e73'}; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid ${borderColor}; }
    th { background: ${headerBg}; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    tr:hover { background: ${isDarkTheme ? '#21232a' : '#fafafa'}; }
  </style>
</head>
<body>
  <div class="header">
    <h2>Workloads</h2>
    <span class="timestamp">${new Date(timestamp).toLocaleString()}</span>
  </div>
  
  <div class="summary-card">
    <div class="summary-value">${data.total || workloads.length}</div>
    <div class="summary-label">Workloads</div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Kind</th>
        <th>Ready</th>
      </tr>
    </thead>
    <tbody>
      ${workloadRows}
    </tbody>
  </table>
  
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

// Generate generic HTML for unknown structured data
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

  // Generate HTML from structured content based on data type
  const generateHtmlFromStructuredContent = React.useCallback(
    (data: Record<string, unknown>): string | null => {
      // Check for pods data (pod utilization)
      if (data.pods && Array.isArray(data.pods)) {
        return generatePodUtilizationHtml(data as StructuredPodData, isDarkTheme);
      }

      // Check for namespaces data
      if (data.namespaces && Array.isArray(data.namespaces)) {
        return generateNamespaceListHtml(data as StructuredNamespaceData, isDarkTheme);
      }

      // Check for workloads data
      if (data.workloads && Array.isArray(data.workloads)) {
        return generateWorkloadListHtml(data as StructuredWorkloadData, isDarkTheme);
      }

      // Check for raw HTML
      if (data.html && typeof data.html === 'string') {
        return wrapHtmlContent(data.html, isDarkTheme);
      }

      // Fallback: render as generic JSON view
      if (Object.keys(data).length > 0) {
        return generateGenericDataHtml(data, toolName, isDarkTheme);
      }

      return null;
    },
    [isDarkTheme, toolName],
  );

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
      } else if (result.structuredContent) {
        // Fallback mode: regenerate HTML from structured content
        const html = generateHtmlFromStructuredContent(
          result.structuredContent as Record<string, unknown>,
        );
        if (html) {
          setContent(html);
        }
      }
    } catch (err) {
      setError(t('Failed to refresh data: {{error}}', { error: String(err) }));
    } finally {
      setIsRefreshing(false);
    }
  }, [handleToolCall, toolName, toolArgs, useExtApps, generateHtmlFromStructuredContent, t]);

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

        // APPROACH 2: Fall back to generated HTML (coupled - console generates UI)
        // Call the tool directly via proxy to get data with structured_content
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

        if (toolResponse.structured_content) {
          const html = generateHtmlFromStructuredContent(toolResponse.structured_content);
          if (html) {
            setContent(html);
            return;
          }
        }

        // Final fallback
        setContent(
          wrapHtmlContent(
            `<p style="padding: 20px; text-align: center;">Interactive view for <strong>${toolName}</strong>. See detailed data in the chat response above.</p>`,
            isDarkTheme,
          ),
        );
      } catch (err) {
        setError(t('Failed to load MCP App: {{error}}', { error: String(err) }));
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [
    generateHtmlFromStructuredContent,
    resourceUri,
    serverName,
    toolArgs,
    isDarkTheme,
    t,
    toolName,
  ]);

  // Toggle expand
  const handleToggleExpand = React.useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

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
            </>
          ),
        }}
      >
        <CardTitle>{t('Interactive view from {{toolName}}', { toolName })}</CardTitle>
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
