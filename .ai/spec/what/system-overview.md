# System Overview

The OpenShift LightSpeed console plugin is a dynamic plugin for the OpenShift
web console that provides an AI chat assistant UI. It connects to the OLS
backend service (lightspeed-service) via the console's built-in plugin proxy,
enabling users to ask natural-language questions, attach Kubernetes resource
context, and receive streamed AI-generated responses. [PLANNED: OLS-2743] The
product is being rebranded to "Red Hat OpenShift Intelligent Assistant."

## Behavioral Rules

### Identity and Scope

1. The plugin is an OpenShift Console dynamic plugin that adds an AI chat
   assistant UI overlay to all console pages. It does NOT include the backend
   service (lightspeed-service), the operator (lightspeed-operator), or the RAG
   content pipeline (lightspeed-rag-content).

2. The plugin registers with the OpenShift Console via a set of console
   extensions (feature flag, context provider, Redux reducer, action provider,
   dashboard detail item). The console discovers and loads the plugin at
   runtime.

3. The plugin renders as a floating popover window that appears over any
   console page. The popover can be collapsed (default), expanded
   (fullscreen), or minimized (hidden with button visible).

4. The plugin communicates with the OLS backend service exclusively through
   the console's built-in plugin proxy. All API requests are routed through
   a proxy path that leverages the console's authentication.

### UI Lifecycle

5. The plugin displays a floating button on all console pages. Clicking the
   button opens the chat popover. Clicking it again minimizes the popover.

6. First-time users (those who have never closed the chat) see the popover
   auto-open after a short delay. Once a user closes the chat for the first
   time, the plugin records this in user settings and never auto-opens again.

7. The plugin can be hidden entirely via a user setting. When hidden, neither
   the button nor the popover renders.

8. The plugin wraps its root component in an error boundary. If the plugin
   crashes, it must not break the host console application.

### Chat Interface

9. The chat interface displays a scrollable message history with user messages
   and AI responses. Each AI response supports: markdown rendering, code
   blocks with copy and import actions, documentation references (source
   links), tool call summaries, and inline alerts for errors, cancellation,
   history truncation, and history compression.

10. The chat header provides controls for: clearing the chat (with
    confirmation), copying the entire conversation to clipboard, expanding to
    fullscreen, collapsing from fullscreen, and minimizing the window.

11. The chat footer contains the prompt input area, a disclaimer footnote,
    and a contact link.

12. A welcome section is always visible at the top of the chat, including the
    product logo, an introductory message, authentication status alerts, and
    a privacy notice.

### Query Modes

13. The plugin supports two query modes: **Ask** (default) and
    **Troubleshooting**. The mode is selected via the attachment menu and sent
    with each query request. Ask mode provides general product guidance.
    Troubleshooting mode enables deeper diagnostic and remediation analysis.

14. When Troubleshooting mode is active, a removable label is displayed in
    the message bar. Removing the label switches back to Ask mode.

### Relationship to OLS Service

15. The plugin is a pure UI client of the OLS backend service. It has no
    local AI processing, no local conversation storage, and no direct LLM
    communication. All intelligence comes from the service.

16. The plugin sends queries to the streaming endpoint and processes
    server-sent events (SSE) for incremental response rendering.

17. The plugin sends conversation IDs with requests to maintain multi-turn
    context. The service manages conversation history; the plugin maintains
    only the current session's chat entries in Redux state.

### Internationalization

18. All user-facing strings must be wrapped in translation calls using the
    `plugin__lightspeed-console-plugin` namespace.

19. Locale files must be updated when UI text changes.

### Theme Support

20. The plugin must support both light and dark console themes. Theme
    detection uses the user's console theme setting, falling back to the
    OS-level `prefers-color-scheme` media query when set to system default.

21. Theme-dependent assets (logos, avatars) must switch based on the active
    theme.

## Configuration Surface

The plugin has no configuration file. User-configurable values are stored in
OpenShift Console user settings:

| Setting key | Type | Default | Description |
|---|---|---|---|
| `lightspeed.hasClosedChat` | bool | `false` | Tracks whether user has ever closed the chat (disables auto-open) |
| `console.hideLightspeedButton` | bool | `false` | Hides the OLS button and popover entirely |
| `console.theme` | string | `null` | Console theme (`light`, `dark`, `systemDefault`, or `null`) |

Environment variables (development only):

| Variable | Description |
|---|---|
| `OLS_API_BEARER_TOKEN` | Bearer token for direct API access (bypasses console proxy auth) |

## Constraints

1. **Console-only deployment.** The plugin runs exclusively inside the
   OpenShift web console. It cannot function as a standalone application.

2. **Proxy-only API access.** All OLS API communication goes through the
   console's plugin proxy. The plugin never connects directly to the OLS
   service.

3. **No persistent client-side storage.** The plugin uses Redux for
   in-session state only. Chat history, conversation data, and feedback are
   not persisted on the client between page refreshes.

4. **Security boundary: no Secrets.** The plugin explicitly excludes
   Kubernetes Secrets from context detection and attachment. It will never
   offer to attach a Secret's YAML.

5. **PatternFly design system.** All UI components must use PatternFly
   components and design tokens. Custom CSS must be scoped to the
   `ols-plugin__` prefix to avoid conflicts with console styles.

6. **Single conversation per session.** The plugin supports one active
   conversation at a time. Starting a new chat clears the current
   conversation.

## Planned Changes

| Jira Key | Summary |
|---|---|
| OLS-2743 | Rebranding to "Red Hat OpenShift Intelligent Assistant" |
| OLS-2598 | MCP Apps support in OLS console |
| OLS-2700 | Allow users to choose agent mode (PF6 only) |
| OLS-2722 | OLS Tool UI extensibility from external plugins |
| OLS-2608 | Embed PromQL QueryBrowser in OLS responses |
| OLS-2609 | Embed PromQL scalar values in OLS responses |
| OLS-2816 | Option to immediately submit prompt when opening OLS programmatically |
| OLS-2826 | Hide the initial prompt when opening OLS programmatically |
