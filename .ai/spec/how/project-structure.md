# Project Structure -- Architecture

The OpenShift LightSpeed console plugin is a TypeScript/React dynamic plugin
built with Webpack Module Federation. It runs inside the OpenShift web console
and communicates with the OLS backend service via the console's plugin proxy.

## Module Map

### `src/` -- Source root

| Path | Purpose |
|---|---|
| `src/types.ts` | Core TypeScript type definitions: `Attachment`, `Tool`, `ChatEntry` (union of `ChatEntryUser` and `ChatEntryAI`), `ReferencedDoc`, `CodeBlock`, `HistoryCompression`, `OlsToolUIComponent`. Global declaration extends `Window` with `SERVER_FLAGS`. |
| `src/redux-actions.ts` | All Redux action creators (27 actions) and `ActionType` enum. Uses `typesafe-actions` for type-safe action creation. Exports the union type `OLSAction`. |
| `src/redux-reducers.ts` | Single reducer function handling all `ActionType` cases. Initializes default state on first call. Exports `OLSState` (ImmutableMap) and `State` interface (global store shape with `plugins.ols` and `sdkCore.user`). |
| `src/config.ts` | API base URL constant (`/api/proxy/plugin/lightspeed-console-plugin/ols`) and `getApiUrl(path)` helper. |
| `src/attachments.ts` | `AttachmentTypes` enum (Events, Log, YAML, YAML filtered, YAMLUpload), `toOLSAttachment()` conversion function, `isAttachmentChanged()` comparison helper. |
| `src/error.ts` | `ErrorType` and `FetchError` types. `getFetchErrorMessage()` extracts structured error messages from fetch responses, handling both string and object `detail` fields. |
| `src/flags.ts` | `FLAG_LIGHTSPEED_PLUGIN` constant and `enableLightspeedPluginFlag()` handler for the `console.flag` extension. |
| `src/clipboard.ts` | `copyToClipboard(value)` utility wrapping `navigator.clipboard.writeText()`. |

### `src/hooks/` -- Custom React hooks

| Path | Purpose |
|---|---|
| `src/hooks/useBoolean.ts` | Generic boolean state hook. Returns `[value, toggle, setTrue, setFalse, set]`. Used extensively for modal/toggle state. |
| `src/hooks/useAuth.ts` | Authorization check hook. POSTs to `/authorized` on mount. Returns `[AuthStatus]` enum (AuthorizedLoading, Authorized, NotAuthenticated, NotAuthorized, AuthorizedError). Also exports `getRequestInitWithAuthHeader()` for adding bearer token to requests. |
| `src/hooks/useOpenOLS.ts` | Public API hook exposed as a console extension. Returns a callback `(prompt?, attachments?, submitImmediately?, hidePrompt?) => void` that dispatches Redux actions to open OLS with optional context. |
| `src/hooks/usePopover.ts` | Side-effect hook that launches the Popover component as a console modal exactly once. Uses `useModal()` from the console SDK with a stable modal ID. |
| `src/hooks/useLocationContext.ts` | URL parser that extracts the Kubernetes resource (kind, name, namespace) from the current page path. Handles standard K8s URLs, ACM ManagedCluster, ACM search, ACM Applications, ACM Policies, and Alert pages. Returns `[kind, name, namespace]`. |
| `src/hooks/useFirstTimeUser.ts` | Tracks first-time user state via `lightspeed.hasClosedChat` user setting. Returns `[isFirstTimeUser, markAsExperienced, isLoaded]`. |
| `src/hooks/useIsDarkTheme.ts` | Theme detection via `console.theme` user setting. Falls back to `prefers-color-scheme` media query for system default. Returns `[isDarkTheme]`. |
| `src/hooks/useHideLightspeed.ts` | Reads `console.hideLightspeedButton` user setting. Returns `[isHidden]`. |
| `src/hooks/useToolUIMapping.ts` | Resolves `ols.tool-ui` console extensions into a `Record<string, OlsToolUIComponent>` mapping. Returns `[mapping, resolved]`. |

### `src/components/` -- React components

| Path | Purpose |
|---|---|
| `src/components/Popover.tsx` | Root component wrapped in `ErrorBoundary`. Manages open/close/expand state, first-time user auto-open, feedback status fetch, and renders `GeneralPage` with appropriate mode props. Conditionally renders based on `isHidden` and `isOpen` state. |
| `src/components/GeneralPage.tsx` | Main chat interface. Renders `Chatbot` (PF6) with header (title, actions), content (message history with `ChatHistoryEntry` per entry), and footer (Prompt, footnote, contact link). Handles auth alerts, privacy notice, welcome notice, new chat modal, and conversation copy. |
| `src/components/Prompt.tsx` | Message input and stream processing. Contains: `MessageBar` (PF6 chatbot), attachment menu construction, file upload handler, YAML/events/logs/alert attachment logic, SSE stream reader with event parsing, abort controller, and auto-submit logic. This is the largest component -- handles query submission and all stream event processing. |
| `src/components/ResponseTools.tsx` | Renders tool label group for completed tools. Filters tools by completion state, renders `MCPApp` for tools with UI, renders `OlsToolUIs` for OLS-native tool UIs, and renders `ToolLabel` components for the summary. |
| `src/components/ResponseToolModal.tsx` | Modal for viewing tool details. Shows tool name, args, status, server name, UI resource URI, content (code block), and structured content (JSON code block). Handles denied tool display separately. |
| `src/components/ToolApproval.tsx` | HITL approval card. Renders a warning card with tool description, expandable arguments, and Approve/Reject buttons. POSTs decisions to the tool approvals endpoint. |
| `src/components/MCPApp.tsx` | MCP App interactive UI host. Loads HTML from MCP resources endpoint, renders in sandboxed iframe, handles JSON-RPC 2.0 bidirectional messaging (initialize, tools/call, notifications/initialized, notifications/size-changed). Supports expand/minimize/refresh controls. |
| `src/components/OlsToolUIs.tsx` | Renders OLS-native tool UI components registered via `ols.tool-ui` extensions. Filters tools by `olsToolUiID` match, wraps each in `ErrorBoundary`. |
| `src/components/AttachmentModal.tsx` | Modal for viewing/editing attachment content in a code editor. Supports undo to original value. |
| `src/components/AttachmentLabel.tsx` | Inline label showing resource icon, name, and optional edit indicator. Click opens `AttachmentModal`. |
| `src/components/AttachmentsSizeAlert.tsx` | Warning alert when total attachment size exceeds threshold. |
| `src/components/AttachEventsModal.tsx` | Modal for selecting Kubernetes events to attach. |
| `src/components/AttachLogModal.tsx` | Modal for selecting pod logs. Container selection, line count slider, live preview. |
| `src/components/ErrorBoundary.tsx` | React error boundary. Catches component crashes and renders fallback. |
| `src/components/Modal.tsx` | Reusable modal wrapper component. |
| `src/components/ResourceIcon.tsx` | Renders Kubernetes resource kind icons. |
| `src/components/CopyAction.tsx` | Copy-to-clipboard button with visual confirmation. |
| `src/components/ImportAction.tsx` | "Import YAML" action button. Opens confirmation modal, then navigates to console's YAML import page with content. |
| `src/components/NewChatModal.tsx` | Confirmation modal for clearing chat. |
| `src/components/ReadinessAlert.tsx` | Alert shown when OLS service is not ready. |
| `src/components/WelcomeNotice.tsx` | Welcome message for first-time users. |
| `src/components/ConfirmationModal.tsx` | Generic confirmation dialog. |
| `src/components/CloseButton.tsx` | Close icon button. |
| `src/components/NullContextProvider.tsx` | No-op React context provider returning `null`. Used as the component for the `console.context-provider` extension. |
| `src/components/OverviewDetail.tsx` | Dashboard detail item showing plugin version (1.0.12). |

### `src/assets/` -- Static assets

| Path | Purpose |
|---|---|
| `src/assets/logo.svg` | OLS logo for light theme |
| `src/assets/logo-dark.svg` | OLS logo for dark theme |
| `src/assets/user.png` | User avatar image |

### Root configuration files

| Path | Purpose |
|---|---|
| `console-extensions.json` | Declares 5 console extensions: flag, context-provider, dashboard detail, redux-reducer, action/provider |
| `package.json` | Project metadata, dependencies, scripts. Name: `lightspeed-console-plugin`, version: 1.0.12 |
| `webpack.config.ts` | Webpack 5 config using `ConsoleRemotePlugin` for Module Federation. Production: hashed bundle names, minimization, deterministic chunk IDs. Dev: source maps, HMR on port 9001. |
| `tsconfig.json` | TypeScript config targeting ES2020, React JSX. Strict mode enabled. |
| `.eslintrc.yml` | ESLint config: recommended + react + react-hooks + typescript + i18next + prettier |
| `.prettierrc.yml` | Prettier config: 100 char width, single quotes, trailing commas |
| `.stylelintrc.yaml` | Stylelint config: no hex colors (use PF design tokens), selector must match `ols-plugin__*` |
| `start-console.sh` | Dev script: runs console in Docker/Podman on port 9000, proxies plugin from port 9001, proxies OLS API from localhost:8080 |

### Test directories

| Path | Purpose |
|---|---|
| `tests/` | Cypress e2e test specs |
| `cypress/` | Cypress support files and fixtures |
| `cypress.config.ts` | Cypress configuration |
| `unit-tests/` | Unit tests using Node's built-in test runner. Tests for: redux-reducers, error handling, attachments |

## Data Flow

### Plugin initialization

1. **Console discovers plugin**: Console loads `console-extensions.json` and resolves module references via Webpack Module Federation.

2. **Feature flag**: `enableLightspeedPluginFlag` sets `LIGHTSPEED_PLUGIN = true`.

3. **Redux reducer**: Registered under `ols` scope. First invocation with `undefined` state creates initial state.

4. **Context provider mounts**: `NullContextProvider` renders `null`. `usePopover` hook fires, calling `useModal()` to launch `Popover` component as a console modal.

5. **Popover initializes**: Fetches feedback status from `/v1/feedback/status`. Checks first-time user state. If first-time and not hidden, auto-opens after 500ms delay.

6. **Auth check**: `GeneralPage` mounts and `useAuth` POSTs to `/authorized`. Auth status determines whether the prompt footer is shown.

### Query submission and streaming

See `how/streaming.md` for the detailed streaming data flow.

## Key Abstractions

### Immutable.js state

All Redux state is stored as `ImmutableMap` and `ImmutableList` from the `immutable` package. Components access state via `.get()`, `.getIn()`, and `.toJS()`. This means:

- State updates use `.set()`, `.setIn()`, `.mergeIn()`, `.push()` (all return new instances).
- Selectors use `useSelector` with `.get()` / `.getIn()` paths, not property access.
- When a component needs a plain JS object, it calls `.toJS()` (typically memoized).

### Console SDK integration

The plugin uses `@openshift-console/dynamic-plugin-sdk` for:

- `useModal()`: Launching the popover as a console modal
- `useK8sWatchResource()`: Watching the currently-viewed K8s resource
- `useK8sModels()`: Resolving resource keys to K8s model definitions
- `useUserSettings()`: Reading/writing user preferences
- `useResolvedExtensions()`: Discovering `ols.tool-ui` extensions from other plugins
- `consoleFetch()` / `consoleFetchJSON()`: Making API requests through the console proxy
- `SetFeatureFlag`: Setting the plugin feature flag

### PatternFly Chatbot

The chat UI uses `@patternfly/chatbot` components:

- `Chatbot`: Root container with display mode (default/fullscreen)
- `ChatbotHeader` / `ChatbotContent` / `ChatbotFooter`: Layout sections
- `MessageBox`: Scrollable message container
- `Message`: Individual chat message (supports markdown, code blocks, actions, feedback, sources)
- `MessageBar`: Input area with attach menu, send/stop buttons

### API proxy pattern

All OLS API calls go through `/api/proxy/plugin/lightspeed-console-plugin/ols/...`. The console proxy:

- Adds the user's authentication credentials
- Handles TLS termination
- Routes to the OLS service backend

In development, `start-console.sh` configures an additional proxy from the console container to `localhost:8080` where the OLS service runs.

## Integration Points

### Plugin -> Console

- Console extensions in `console-extensions.json`
- Redux reducer registration under `ols` scope
- Feature flag `LIGHTSPEED_PLUGIN`
- User settings (read/write): `lightspeed.hasClosedChat`, `console.hideLightspeedButton`, `console.theme`
- Modal system via `useModal()`
- K8s resource watching via `useK8sWatchResource()`
- Navigation via React Router (code import redirect)

### Plugin -> OLS Service (via proxy)

| Method | Path | Purpose |
|---|---|---|
| POST | `/authorized` | Authorization check |
| POST | `/v1/streaming_query` | Submit query, receive SSE stream |
| GET | `/v1/feedback/status` | Check if feedback is enabled |
| POST | `/v1/feedback` | Submit user feedback |
| POST | `/v1/tool-approvals/decision` | Approve/deny tool execution |
| POST | `/v1/mcp-apps/tools/call` | Direct MCP tool call (from MCP App iframe) |
| POST | `/v1/mcp-apps/resources` | Load MCP App UI resource (HTML) |

### Plugin -> Kubernetes API (via console proxy)

- `/api/kubernetes/apis/internal.open-cluster-management.io/...` for ManagedClusterInfo
- `/api/prometheus/api/v1/rules?type=alert` for Prometheus alerts
- `/api/proxy/plugin/monitoring-console-plugin/thanos-proxy/...` for Thanos alerts
- K8s resource watch API (via `useK8sWatchResource`)
- Events API (via `AttachEventsModal`)
- Pod logs API (via `AttachLogModal`)

### Other plugins -> This plugin

- Feature flag check: `LIGHTSPEED_PLUGIN`
- Action provider: `ols-open-handler` context ID resolves `useOpenOLS` hook
- Tool UI extensions: `ols.tool-ui` extension type

## Implementation Notes

### Prompt.tsx is the stream processing hub

`Prompt.tsx` handles both the input UI and all streaming logic. The `onSubmit` callback creates an `AbortController`, reads the SSE stream, and dispatches Redux actions for every event type. This co-location means any change to streaming behavior or input handling requires modifying this single large component.

### Immutable.js adds access ceremony

All Redux state access uses `.get('key')` and `.getIn(['path', 'to', 'value'])` instead of property access. This applies to both selectors in components and within the reducer. The `ImmutableMap` type is `ImmutableMap<string, any>`, so there is no compile-time key safety.

### TypeScript type suppression for PatternFly Chatbot

Multiple PatternFly Chatbot components use `@ts-expect-error: TS2786` comments because the chatbot library's type definitions are not fully compatible with the project's TypeScript version. This is a known issue and does not indicate a runtime problem.

### Module Federation entry points

`console-extensions.json` references these exposed modules (defined in `webpack.config.ts` via `ConsoleRemotePlugin`):

- `OLSFlags` -> `src/flags.ts`
- `NullContextProvider` -> `src/components/NullContextProvider.tsx`
- `usePopover` -> `src/hooks/usePopover.ts`
- `OverviewDetail` -> `src/components/OverviewDetail.tsx`
- `OLSReducer` -> `src/redux-reducers.ts`
- `useOpenOLS` -> `src/hooks/useOpenOLS.ts`

### Tool call correlation uses name+args workaround

The OLS service does not include a linking ID between `tool_call` and `approval_required` stream events. The plugin builds a `Map<string, string>` keyed by `${toolName}:${JSON.stringify(args)}` to correlate them. This is a known limitation documented in a code comment.
