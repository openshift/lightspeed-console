# Components -- Architecture

The plugin's UI is built from a component tree rooted in the `Popover`
component, which is launched as a console modal. All components use
PatternFly 6 and the PatternFly AI Chatbot library.

## Module Map

| Path | Layer | Purpose |
|---|---|---|
| `Popover.tsx` | Root | Modal container, open/close/expand, first-time UX, feedback status fetch |
| `GeneralPage.tsx` | Layout | Chat interface with header, content, and footer sections |
| `Prompt.tsx` | Input | Message input, attachment menu, stream processing |
| `ResponseTools.tsx` | Response | Tool label group, MCP App and OLS Tool UI rendering |
| `ResponseToolModal.tsx` | Modal | Tool detail viewer |
| `ToolApproval.tsx` | Response | HITL approval card |
| `MCPApp.tsx` | Response | MCP App iframe host with JSON-RPC |
| `OlsToolUIs.tsx` | Response | OLS-native tool UI extension renderer |
| `AttachmentModal.tsx` | Modal | Attachment editor (code editor) |
| `AttachmentLabel.tsx` | Inline | Attachment display label |
| `AttachEventsModal.tsx` | Modal | Event selection for attachment |
| `AttachLogModal.tsx` | Modal | Log selection for attachment |
| `AttachmentsSizeAlert.tsx` | Alert | Warning for large attachments |
| `ErrorBoundary.tsx` | Utility | React error boundary |
| `Modal.tsx` | Utility | Reusable modal wrapper |

## Data Flow

### Component tree

```
ErrorBoundary
  └── Popover
        ├── [isOpen && !isExpanded] GeneralPage (collapsed mode)
        │     ├── ChatbotHeader (title, clear/copy/expand/minimize actions)
        │     ├── ChatbotContent
        │     │     └── MessageBox
        │     │           ├── Welcome logo + intro text
        │     │           ├── AuthAlert (if not authorized)
        │     │           ├── PrivacyAlert
        │     │           ├── WelcomeNotice (if first-time user)
        │     │           ├── ChatHistoryEntry[] (memoized, one per entry)
        │     │           │     ├── [user entry] Message (role=user, text, expandable context)
        │     │           │     └── [ai entry] Message (role=bot, markdown, code blocks, actions)
        │     │           │           ├── [error] Alert (danger)
        │     │           │           ├── [historyCompression] Alert (info/success)
        │     │           │           ├── [isTruncated] Alert (warning)
        │     │           │           ├── [isCancelled] Alert (info)
        │     │           │           ├── [pendingApproval] ToolApproval[]
        │     │           │           ├── ResponseTools
        │     │           │           │     ├── MCPApp[] (for tools with uiResourceUri)
        │     │           │           │     ├── OlsToolUIs (for tools with olsToolUiID)
        │     │           │           │     └── LabelGroup (tool summary labels)
        │     │           │           └── [feedback] UserFeedbackForm
        │     │           ├── AttachmentsSizeAlert
        │     │           └── ReadinessAlert
        │     └── ChatbotFooter (if authorized)
        │           ├── Prompt
        │           │     ├── MessageBar (textarea + attach menu + send/stop button)
        │           │     ├── AttachmentLabel[] (current attachments)
        │           │     ├── <input type="file"> (hidden, for YAML upload)
        │           │     ├── AttachmentModal (edit modal)
        │           │     ├── ToolModal (tool detail modal)
        │           │     ├── AttachEventsModal (event selection)
        │           │     └── AttachLogModal (log selection)
        │           ├── ChatbotFootnote ("Always review AI generated content")
        │           ├── Contact link
        │           └── NewChatModal (clear confirmation)
        ├── [isOpen && isExpanded] GeneralPage (fullscreen mode, same tree)
        └── Button (floating OLS button, always rendered)
```

### Popover lifecycle

1. `useHideLightspeed()` -> if hidden, render nothing.
2. `useFirstTimeUser()` -> if first-time and not hidden, auto-open after 500ms.
3. Fetch `/v1/feedback/status` on mount -> if disabled, dispatch `userFeedbackDisable()`.
4. Render: `isOpen` ? `GeneralPage` + close button : tooltip + open button.
5. Close handler: if first-time user, call `markAsExperienced()`.

### GeneralPage rendering

1. `useAuth()` -> determines if footer (prompt) is shown.
2. `useFirstTimeUser()` -> determines if welcome notice is shown.
3. Chat history entries are rendered via `ChatHistoryEntry` (memoized with `React.memo`).
4. Each `ChatHistoryEntry` handles its own feedback state and tool rendering.
5. Header actions: trash (clear chat), copy, expand/collapse, minimize.

### Prompt rendering

1. `useLocationContext()` -> extracts K8s resource from URL.
2. `useK8sWatchResource()` -> watches the detected resource (unless Alert).
3. Builds attachment menu items based on detected context and resource type.
4. `MessageBar` renders textarea with attach menu and send/stop toggle.
5. `onSubmit` -> validates input, dispatches history entries, starts stream.
6. `autoSubmit` effect -> programmatically clicks send button.

## Key Abstractions

### ChatHistoryEntry memoization

`ChatHistoryEntry` uses `React.memo` to prevent re-renders when other
entries change. Each entry reads its own slice of state via `useSelector`
with index-based paths (`getIn(['chatHistory', entryIndex, ...])`).

### Popover display modes

The `GeneralPage` component receives `onExpand` OR `onCollapse` prop
(never both) to determine its display mode:

- `onExpand` present -> collapsed mode (`ChatbotDisplayMode.default`)
- `onCollapse` present -> fullscreen mode (`ChatbotDisplayMode.fullscreen`)

The Popover parent tracks `isExpanded` state and passes the appropriate
callback.

### MCPApp card states

The MCP App card has three visual states managed by local `cardState`:

- `normal`: Full card with iframe at dynamic height
- `expanded`: Full card with `ols-plugin__mcp-app--expanded` CSS class
- `minimized`: Header-only card with restore button

### Message component integration

The PatternFly `Message` component is used for both user and AI entries
with different configurations:

**User messages**: `role="user"`, user avatar, text in `extraContent.afterMainContent`
with optional expandable attachment context section.

**AI messages**: `role="bot"`, OLS logo avatar (theme-dependent), markdown
`content` prop, `actions` (copy, thumbs up/down), `sources` (reference
links), `codeBlockProps` (import action, expandable), `extraContent`
(error alerts, tool approval cards, tool summaries, compression indicators),
`userFeedbackForm`/`userFeedbackComplete` for inline feedback.

### Attachment menu construction

The attachment menu items are built in `Prompt.tsx` using a `useMemo`
that depends on: detected resource context, events availability, loading
state, troubleshooting mode, and resource kind. The menu structure is:

1. "Currently viewing" section with resource label (if resource detected)
2. "Attach" section with resource-specific options
3. File upload option (always)
4. Divider
5. Query mode toggle (Ask or Troubleshooting)

Special cases:
- `ManagedCluster` kind -> "Attach cluster info" instead of YAML options
- `Alert` kind -> "Alert" option fetching from Prometheus/Thanos
- Non-workload kinds -> no Events or Logs options

## Implementation Notes

### GeneralPage.tsx ChatHistoryEntry reads adjacent entries

`ChatHistoryEntry` at index `i` (an AI response) reads `chatHistory[i-1]`
(the preceding user entry) to access the user's query text and attachments
for the feedback submission payload. This coupling means user entries must
always precede their corresponding AI entries in the history list.

### Prompt.tsx modal co-location

`AttachmentModal`, `ToolModal`, `AttachEventsModal`, and `AttachLogModal`
are rendered inside `Prompt.tsx`. They read their open/close state from
Redux (`openAttachment`, `openTool`) or local boolean state
(`isEventsModalOpen`, `isLogModalOpen`). This means the modals are always
mounted but conditionally visible.

### Theme propagation to MCPApp iframe

Theme changes are propagated to MCP App iframes via two mechanisms:
1. On initial HTML load, a `data-theme` attribute is injected into the
   `<html>` tag via string replacement.
2. On subsequent theme changes, a `ui/notifications/host-context-changed`
   JSON-RPC notification is sent via `postMessage`.

The theme `useEffect` in `MCPApp.tsx` intentionally excludes
`uiResourceUri` and `serverName` from its dependency array to avoid
re-fetching the HTML content on theme change -- only the notification
is sent.

### ErrorBoundary wrapping strategy

The `ErrorBoundary` is used at two levels:
1. Root level: wraps `Popover` to prevent plugin crashes from breaking
   the console.
2. Tool UI level: wraps each `OlsToolUI` component to isolate crashes
   in third-party tool visualizations.

The `MCPApp` iframe is inherently isolated and does not need an error
boundary.
