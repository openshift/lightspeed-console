# MCP Apps Interactive Views - Implementation Guide

This document captures the implementation of interactive UI views for MCP (Model Context Protocol) tool responses in the OpenShift Lightspeed Console plugin.

## How It Works

### End-to-End Flow

**1. User asks a question** (e.g., "show me pod utilization")

**2. LLM triggers MCP tool call** → Backend calls the MCP server

**3. Streamed response includes `tool_result` event with metadata:**
```json
{
  "event": "tool_result",
  "data": {
    "id": "call_abc123",
    "name": "get-pod-utilization",
    "status": "success",
    "content": "Pod utilization as of 2024-...: ...",
    "structured_content": { "pods": [...] },
    "server_name": "pod-utilization",
    "tool_meta": {
      "ui": {
        "resourceUri": "ui://pod-utilization/mcp-app.html",
        "visibility": ["model", "app"]
      }
    }
  }
}
```

**`tool_result` event fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Tool call ID (links to the preceding `tool_call` event) |
| `name` | string | Tool name |
| `status` | string | `success`, `error`, or `truncated` |
| `content` | string | Text output from the tool (for LLM context / fallback display) |
| `structured_content` | object? | Optional app-defined JSON for rich UI rendering |
| `server_name` | string? | Name of the MCP server that owns this tool |
| `tool_meta` | object? | Full `_meta` dict from the MCP tool definition (contains UI resource URI, visibility, etc.) |

The `tool_meta.ui.resourceUri` field indicates this tool has an associated MCP App UI.

**4. UI detects `tool_meta.ui.resourceUri`** → Renders `MCPAppFrame` component with an iframe

**5. Iframe persists in conversation** → It's part of that message's response and stays visible as the user continues chatting

**6. User interacts with iframe** (e.g., clicks Refresh button) → Iframe sends `postMessage` to parent window

**7. UI independently calls OLS endpoint:**
```
POST /ols/v1/mcp-apps/tools/call
{ "server_name": "pod-utilization", "tool_name": "get-pod-utilization", "arguments": {} }
```

**8. UI updates iframe** with new data (regenerates HTML with fresh `structured_content`)

### Key Design Principles

- **Independent of LLM conversation**: Refreshing data doesn't require a new chat message
- **Multiple iframes supported**: Different questions can create different MCP app iframes in the same conversation
- **Self-contained state**: Each iframe manages its own data and refresh cycle
- **Separate endpoints**: The `/mcp-apps/tools/call` endpoint is independent from the chat streaming endpoint

This design decouples the interactive visualization from the conversational flow, allowing real-time data updates without cluttering the chat history.

## Overview

MCP Apps allow MCP servers to provide interactive UI components alongside their tool responses. When a user asks OpenShift Lightspeed a question that triggers an MCP tool (e.g., "show me pod utilization"), the response can include both textual data and an interactive visualization.

### Goals

1. Display interactive visualizations for MCP tool results within the chat interface
2. Allow users to refresh data without re-asking the question
3. Support expand/collapse functionality for better viewing
4. Maintain compatibility with the existing chat UI

## Architecture

### Component Flow

```
User Query
    ↓
OpenShift Lightspeed (LLM)
    ↓
MCP Tool Call (e.g., get-pod-utilization)
    ↓
Tool Response with structured_content + UI metadata
    ↓
Frontend receives tool_result event
    ↓
MCPAppFrame renders interactive view
```

### Key Components

| Component | Purpose |
|-----------|---------|
| `MCPAppFrame.tsx` | Renders the interactive iframe with tool data |
| `ResponseTools.tsx` | Displays tool calls and results, including MCP app views |
| `ResponseToolModal.tsx` | Modal showing full tool details (content, structured content, metadata) |
| `Prompt.tsx` | Handles streaming responses and extracts tool results |
| `types.ts` | Defines `ToolResult` type with UI metadata |

## Implementation Details

### 1. Tool Type (`src/types.ts`)

```typescript
export type Tool = {
  args: { [key: string]: Array<string> };
  content: string;
  name: string;
  status: 'error' | 'success' | 'truncated';
  // MCP app fields (optional - present when tool provides UI)
  uiResourceUri?: string;
  serverName?: string;
  structuredContent?: Record<string, unknown>;
};
```

- `name`: Name of the MCP tool that was called
- `content`: Text result from the tool (string)
- `status`: `success`, `error`, or `truncated` (set by the backend when tool output was truncated to fit within the token budget)
- `structuredContent`: Structured data for app UI (e.g., pod metrics array)
- `uiResourceUri`: URI pointing to the tool's UI resource (e.g., `ui://pod-utilization/mcp-app.html`)
- `serverName`: Name of the MCP server that owns the tool

### 2. Tool Label Color-Coding (`src/components/ResponseTools.tsx`)

Tool labels in the chat are color-coded by status and type:

| Status / Type | Label Color | Icon | Description |
|---------------|-------------|------|-------------|
| `error` | Red | `InfoCircleIcon` | Tool execution failed |
| `truncated` | Yellow | `InfoCircleIcon` | Tool output was truncated to fit token budget |
| Has `uiResourceUri` | Blue | `ExternalLinkAltIcon` | Tool has an associated MCP App UI |
| Default | Grey | `CodeIcon` | Normal tool call |

Priority order: error (red) > truncated (yellow) > UI tool (blue) > default (grey).

### 3. Streaming Response Handling (`src/components/Prompt.tsx`)

The streaming endpoint returns `tool_result` events (see field table above). On each event, `Prompt.tsx` extracts `uiResourceUri` from `tool_meta.ui.resourceUri` and dispatches `chatHistoryUpdateTool` to store the tool's `content`, `status`, `uiResourceUri`, `serverName`, and `structuredContent` in Redux. `ResponseTools` reads these from the store.

### 4. Tool Detail Modal (`src/components/ResponseToolModal.tsx`)

Clicking a tool label opens a modal that shows all available tool data:

- **Metadata**: Status (color-coded label), MCP server name, UI resource URI
- **Content**: The text output from the tool (copyable code block)
- **Structured content**: The full `structuredContent` JSON rendered as formatted, copyable JSON

Each section is conditionally rendered — for non-MCP tools only `status` and `content` appear; for MCP tools the server name, resource URI, and structured content are also shown.

### 5. MCPAppFrame Component (`src/components/MCPAppFrame.tsx`)

This is the main component that renders interactive views. It:

1. **Receives props**: `resourceUri`, `serverName`, `toolName`, `toolContent`, `status`, `structuredContent`
2. **Loads MCP resource**: Fetches the HTML resource from the MCP server via the OLS proxy; falls back to locally generated HTML if unavailable
3. **Renders in iframe**: Uses `srcDoc` to display the HTML securely
4. **Handles ext-apps protocol**: Responds to `ui/initialize`, sends `ui/notifications/tool-input` (tool arguments) followed by `ui/notifications/tool-result` (tool output), proxies `tools/call` requests from the iframe to OLS, and handles `ui/notifications/size-changed` for auto-sizing
5. **Supports refresh**: Re-calls the tool endpoint when refresh is requested

#### MCP Apps lifecycle notifications (ext-apps compliance)

When the iframe's ext-apps SDK sends `ui/notifications/initialized`, MCPAppFrame sends two notifications in order:

**1. `ui/notifications/tool-input`** — carries the tool's input arguments:

- `arguments`: the complete tool call arguments from the LLM (e.g., `{ query: "up{}", step: "1m", title: "Uptime" }`)

This matches the [`McpUiToolInputNotification`](https://modelcontextprotocol.github.io/ext-apps/api/interfaces/app.McpUiToolInputNotification.html) spec. MCP Apps can use this to display context about what was queried (e.g., chart title, PromQL query string, filter parameters) without needing to embed that information in the tool result.

**2. `ui/notifications/tool-result`** — carries the tool execution result:

- `content`: `[{ type: "text", text: toolContent }]` (real tool output, not a placeholder)
- `structuredContent`: the structured data from the tool result (if available)
- `isError`: `true` when `status === "error"`

This matches the [`McpUiToolResultNotification`](https://modelcontextprotocol.github.io/ext-apps/api/interfaces/app.McpUiToolResultNotification.html) spec and ensures the iframe's `app.ontoolresult` callback receives real data on first load.

Both notifications are also re-sent on refresh so the app can update headers/context alongside the data.

#### Immutable.js caveat for tool arguments

Tool arguments are stored in Redux via Immutable.js `mergeIn`, which deep-converts plain objects into Immutable Maps. When extracting `toolArgs` from the store, `.toJS()` must be called to convert back to a plain JS object — `postMessage` uses the structured clone algorithm which cannot clone Immutable class instances, resulting in empty/mangled objects in the iframe.

The conversion is wrapped in `React.useMemo` (keyed on the raw Immutable Map reference) to avoid creating a new object on every render. Without memoization, every Redux state change would produce a new `toolArgs` reference, causing `MCPAppFrame`'s `useEffect` hooks to re-fire and reload iframe content.

#### Generated HTML Features

- **Summary cards**: Total pods, average CPU, average memory
- **Data table**: Pod names with CPU/memory bars (color-coded by severity)
- **Refresh button**: Triggers data reload via `postMessage`
- **Auto-resize**: Iframe height adjusts to content (starts small, grows/shrinks via resize messages, clamped to 60–960px)
- **Theme support**: Adapts to dark/light mode

#### Iframe Auto-Sizing

The iframe starts at a small minimum height and automatically adjusts to fit its content. Two resize protocols are supported:

| Protocol | Direction | Purpose |
|----------|-----------|---------|
| `mcp-app-resize` (custom postMessage) | iframe → parent | Used by generated HTML; sends `{ type: 'mcp-app-resize', height: <px> }` |
| `ui/notifications/size-changed` (JSON-RPC) | iframe → parent | Used by ext-apps SDK (`useAutoResize`); sends `{ width?, height? }` params |

Both are clamped between `IFRAME_HEIGHT_MIN` (60px) and `IFRAME_HEIGHT_MAX` (960px) to prevent the iframe from collapsing to zero or growing unboundedly. The expand button bypasses the max limit by switching to full-panel mode.

#### Message Protocol

The iframe communicates with the parent via `postMessage`:

| Message Type | Direction | Purpose |
|--------------|-----------|---------|
| `ui/initialize` | iframe → parent | Ext-apps SDK initialization request |
| `ui/notifications/initialized` | iframe → parent | Ext-apps SDK ready for data |
| `ui/notifications/tool-input` | parent → iframe | Tool input arguments (query, title, filters, etc.) |
| `ui/notifications/tool-result` | parent → iframe | Tool execution result with structured content |
| `ui/notifications/size-changed` | iframe → parent | Request iframe height change (ext-apps SDK) |
| `ui/tools/call` | iframe → parent | Iframe requests a tool call via host proxy |
| `ui/tools/list` | iframe → parent | Iframe requests available tools |
| `mcp-app-resize` | iframe → parent | Request iframe height change (generated HTML) |
| `mcp-app-refresh` | iframe → parent | Request data refresh (generated HTML) |

### 6. Data Refresh Flow

```
User clicks Refresh button in iframe
    ↓
iframe sends postMessage({ type: 'mcp-app-refresh' })
    ↓
MCPAppFrame.handleRefreshData() called
    ↓
POST /api/proxy/plugin/lightspeed-console-plugin/ols/v1/mcp-apps/tools/call
    ↓
Backend calls MCP server tool
    ↓
New structured_content returned
    ↓
MCPAppFrame regenerates HTML with new data
```

### 7. Expand/Collapse Functionality

The card header includes an expand button that toggles between:
- **Normal**: Card inline within chat messages
- **Expanded**: Card fills the entire chat panel (absolute positioning)

CSS classes:
- `.ols-plugin__mcp-app-card` - Base styles
- `.ols-plugin__mcp-app-card--expanded` - Full-panel overlay

## Technical Decisions

### Two rendering approaches

MCPAppFrame supports two approaches, tried in order:

1. **ext-apps SDK (preferred)**: Load the MCP server's HTML resource (e.g. `mcp-app.html`) which bundles the `@modelcontextprotocol/ext-apps` SDK. The console acts as the host, handling JSON-RPC over `postMessage` (`ui/initialize`, `ui/notifications/tool-input`, `ui/notifications/tool-result`, `tools/call`). This is spec-compliant and lets MCP server authors control the UI.
2. **Generated HTML (fallback)**: If the MCP resource is unavailable, generate HTML locally from `structuredContent`. This gives full control over the UI and consistent theming, but is coupled to the console.

### Why Use iframe with srcDoc?

- **Security**: `sandbox="allow-scripts"` prevents XSS attacks
- **Isolation**: Styles don't leak between chat and visualization
- **Flexibility**: Can render any HTML content

### Why Absolute Positioning for Expanded View?

`position: fixed` doesn't work correctly inside elements with CSS transforms (which the chatbot drawer has). Using `position: absolute` with `top/left/right/bottom: 0` fills the nearest positioned ancestor (the chat panel).

## Backend Endpoints

The implementation relies on these OLS backend endpoints:

| Endpoint | Purpose |
|----------|---------|
| `POST /v1/mcp-apps/tools/call` | Call an MCP tool directly |
| `POST /v1/mcp-apps/resources` | Fetch UI resource HTML (for future ext-apps support) |

### Tool Call Request

```json
{
  "server_name": "pod-utilization",
  "tool_name": "get-pod-utilization",
  "arguments": {}
}
```

### Tool Call Response

```json
{
  "content": [{ "type": "text", "text": "..." }],
  "structured_content": {
    "timestamp": "2024-...",
    "pods": [
      { "name": "...", "namespace": "...", "cpu": 45, "memory": 62 }
    ],
    "summary": { "totalPods": 10, "avgCpu": 28, "avgMemory": 37 }
  }
}
```

## File Changes Summary

| File | Changes |
|------|---------|
| `src/components/MCPAppFrame.tsx` | New component — renders interactive iframe views |
| `src/components/ResponseTools.tsx` | Render MCPAppFrame for tool results with UI; color-coded tool labels (red/yellow/blue/grey) |
| `src/components/ResponseToolModal.tsx` | Updated to show all tool fields (metadata, content, structured content) |
| `src/components/Prompt.tsx` | Extract tool results from streaming |
| `src/components/general-page.css` | MCP app card styles, tool modal metadata/section styles |
| `src/types.ts` | Tool type definition (status includes `'truncated'`) |
| `locales/en/plugin__lightspeed-console-plugin.json` | i18n strings |

## Future Improvements

1. **Caching**: Cache tool results to avoid redundant calls
2. **Error handling**: Better error states and retry mechanisms
3. **Accessibility**: Ensure ARIA labels and keyboard navigation
4. **Host context updates**: Send `ui/notifications/host-context-changed` on theme changes

## Testing

To test the implementation:

1. Start the lightspeed-service with MCP servers configured
2. Start the mcp-app-example (or similar MCP server)
3. Run the console with `CONSOLE_TAG=4.19 ./start-console.sh`
4. Ask: "show me pod utilization" or similar queries
5. Verify the interactive chart appears with refresh and expand buttons
