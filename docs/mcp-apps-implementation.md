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

**6. User clicks Refresh in card header** → MCPAppFrame calls OLS endpoint directly

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

1. **Receives props**: `resourceUri`, `serverName`, `toolName`, `toolArgs`, `toolContent`, `status` (note: `structuredContent` is not a prop — it is fetched via the proxy endpoint during the ext-apps lifecycle)
2. **Loads MCP resource**: Fetches the HTML resource from the MCP server via the OLS proxy; falls back to locally generated HTML if unavailable
3. **Renders in iframe**: Uses `srcDoc` to display the HTML securely (sandbox is `allow-scripts allow-same-origin` for ext-apps mode, `allow-scripts` for fallback)
4. **Handles ext-apps protocol**: Responds to `ui/initialize`, sends `ui/notifications/host-context-changed` (theme), `ui/notifications/tool-input` (tool arguments), then `ui/notifications/tool-result` (fresh data from proxy call), proxies `tools/call` and `tools/list` requests from the iframe to OLS, and handles `ui/notifications/size-changed` for auto-sizing
5. **Supports refresh**: Card header button re-calls the tool endpoint and pushes new data into the iframe

#### MCP Apps lifecycle notifications (ext-apps compliance)

When the iframe's ext-apps SDK sends `ui/notifications/initialized`, MCPAppFrame sends three notifications in order:

**1. `ui/notifications/host-context-changed`** — sends the current theme:

- `theme`: `"dark"` or `"light"`

This ensures apps using the `onhostcontextchanged` callback can apply the correct theme immediately after initialization.

**2. `ui/notifications/tool-input`** — carries the tool's input arguments:

- `arguments`: the complete tool call arguments from the LLM (e.g., `{ query: "up{}", step: "1m", title: "Uptime" }`)

This matches the [`McpUiToolInputNotification`](https://modelcontextprotocol.github.io/ext-apps/api/interfaces/app.McpUiToolInputNotification.html) spec. MCP Apps can use this to display context about what was queried (e.g., chart title, PromQL query string, filter parameters) without needing to embed that information in the tool result.

**3. `ui/notifications/tool-result`** — carries a fresh tool execution result:

The component calls the tool **again** via `POST /mcp-apps/tools/call` (not using the already-streamed content) so the iframe receives structured data in the ext-apps format:

- `content`: `[{ type: "text", text: "..." }]` (from the proxy response)
- `structuredContent`: the structured data from the tool result (if available)
- `isError`: `true` when the tool returned an error

If the proxy call fails, MCPAppFrame falls back to the streamed text content: `content: [{ type: "text", text: toolContent }]`.

This matches the [`McpUiToolResultNotification`](https://modelcontextprotocol.github.io/ext-apps/api/interfaces/app.McpUiToolResultNotification.html) spec and ensures the iframe's `app.ontoolresult` callback receives real data on first load.

All three notifications are also re-sent on refresh (triggered by the card header button) so the app can update headers/context alongside the data.

#### Immutable.js caveat for tool arguments

Tool arguments are stored in Redux via Immutable.js `mergeIn`, which deep-converts plain objects into Immutable Maps. When extracting `toolArgs` from the store, `.toJS()` must be called to convert back to a plain JS object — `postMessage` uses the structured clone algorithm which cannot clone Immutable class instances, resulting in empty/mangled objects in the iframe.

The conversion is wrapped in `React.useMemo` (keyed on the raw Immutable Map reference) to avoid creating a new object on every render. Without memoization, every Redux state change would produce a new `toolArgs` reference, causing `MCPAppFrame`'s `useEffect` hooks to re-fire and reload iframe content.

#### Generated HTML Fallback

When the MCP server's HTML resource is unavailable, MCPAppFrame falls back to calling the tool via the proxy endpoint and rendering the result generically:

- **`generateGenericDataHtml`**: Renders `structuredContent` (or the raw response) as formatted JSON in a `<pre>` block with the tool name as a heading
- **`wrapHtmlContent`**: Wraps raw HTML text content in a minimal styled page (used when no structured data is available)
- **Auto-resize**: Both generated pages include a `ResizeObserver` that sends `mcp-app-resize` messages to auto-size the iframe
- **Theme support**: Background and text colors adapt to dark/light mode via inline styles

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
| `ui/notifications/host-context-changed` | parent → iframe | Theme and host context updates |
| `ui/notifications/tool-input` | parent → iframe | Tool input arguments (query, title, filters, etc.) |
| `ui/notifications/tool-result` | parent → iframe | Tool execution result with structured content |
| `ui/notifications/size-changed` | iframe → parent | Request iframe height change (ext-apps SDK) |
| `ui/tools/call` | iframe → parent | Iframe requests a tool call via host proxy |
| `ui/tools/list` | iframe → parent | Iframe requests available tools |
| `mcp-app-resize` | iframe → parent | Request iframe height change (generated HTML) |

### 6. Data Refresh Flow

Refresh is triggered by the **card header button** (SyncAltIcon), not by a postMessage from the iframe.

```
User clicks Refresh button in card header
    ↓
MCPAppFrame.handleRefresh() called
    ↓
POST /api/proxy/plugin/lightspeed-console-plugin/ols/v1/mcp-apps/tools/call
    ↓
Backend calls MCP server tool
    ↓
New result returned (content + structured_content)
    ↓
ext-apps mode: sends ui/notifications/tool-input + ui/notifications/tool-result to iframe
fallback mode: regenerates HTML with new data via generateGenericDataHtml
```

### 7. Card Controls

The card header includes four action buttons:

| Button | Icon | Behavior |
|--------|------|----------|
| Refresh | `SyncAltIcon` | Re-calls the tool via proxy and pushes new data |
| Expand / Collapse | `ExpandIcon` / `CompressIcon` | Toggles between inline and full-panel mode |
| Minimize | `MinusIcon` | Collapses to a compact title bar (restore via `WindowRestoreIcon`) |
| Close | `TimesIcon` | Dismisses the card entirely (not recoverable) |

CSS classes:
- `.ols-plugin__mcp-app-card` — Base styles
- `.ols-plugin__mcp-app-card--expanded` — Full-panel overlay (absolute positioning)
- `.ols-plugin__mcp-app-card--minimized` — Compact title bar with reduced opacity

## Technical Decisions

### Two rendering approaches

MCPAppFrame supports two approaches, tried in order:

1. **ext-apps SDK (preferred)**: Load the MCP server's HTML resource (e.g. `mcp-app.html`) which bundles the `@modelcontextprotocol/ext-apps` SDK. The console acts as the host, handling JSON-RPC over `postMessage` (`ui/initialize`, `ui/notifications/tool-input`, `ui/notifications/tool-result`, `tools/call`). This is spec-compliant and lets MCP server authors control the UI.
2. **Generated HTML (fallback)**: If the MCP resource is unavailable, generate HTML locally from `structuredContent`. This gives full control over the UI and consistent theming, but is coupled to the console.

### Why Use iframe with srcDoc?

- **Security**: `sandbox="allow-scripts"` (fallback) or `sandbox="allow-scripts allow-same-origin"` (ext-apps mode, needed for SDK origin checks) prevents XSS attacks
- **Isolation**: Styles don't leak between chat and visualization
- **Flexibility**: Can render any HTML content

### Why Absolute Positioning for Expanded View?

`position: fixed` doesn't work correctly inside elements with CSS transforms (which the chatbot drawer has). Using `position: absolute` with `top/left/right/bottom: 0` fills the nearest positioned ancestor (the chat panel).

## Backend Endpoints

The implementation relies on these OLS backend endpoints:

| Endpoint | Purpose |
|----------|---------|
| `POST /v1/mcp-apps/tools/call` | Call an MCP tool directly (from card refresh or ext-apps `tools/call`) |
| `POST /v1/mcp-apps/resources` | Fetch `ui://` HTML resource from an MCP server (for ext-apps iframe rendering) |

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
| `src/components/mcp-app-card.css` | MCP app card, expanded, and minimized styles |
| `src/components/general-page.css` | Tool modal metadata/section styles |
| `src/types.ts` | Tool type definition (status includes `'truncated'`) |
| `locales/en/plugin__lightspeed-console-plugin.json` | i18n strings |

## Future Improvements

1. **Caching**: Cache tool results to avoid redundant calls
2. **Error handling**: Better error states and retry mechanisms
3. **Accessibility**: Ensure ARIA labels and keyboard navigation

## Testing

To test the implementation:

1. Start the lightspeed-service with MCP servers configured
2. Start the mcp-app-example (or similar MCP server)
3. Run the console with `CONSOLE_TAG=4.19 ./start-console.sh`
4. Ask: "show me pod utilization" or similar queries
5. Verify the interactive chart appears with refresh and expand buttons
