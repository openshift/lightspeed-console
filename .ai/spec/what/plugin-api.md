# Plugin API

The plugin registers with the OpenShift Console via console extensions and
exposes hooks and extension points for other plugins to interact with OLS.

## Behavioral Rules

### Console Extensions

1. The plugin must register the following console extensions:

   | Extension type | Purpose |
   |---|---|
   | `console.flag` | Sets the `LIGHTSPEED_PLUGIN` feature flag to `true`, allowing other plugins to detect OLS availability |
   | `console.context-provider` | Mounts a context provider that invokes the `usePopover` hook, which launches the chat modal on first render |
   | `console.dashboards/custom/overview/detail/item` | Displays the plugin version on the cluster overview dashboard |
   | `console.redux-reducer` | Registers the OLS Redux reducer under the `ols` scope |
   | `console.action/provider` | Exposes the `useOpenOLS` hook under the `ols-open-handler` context ID |

2. The context provider uses a no-op React component that returns `null`.
   Its sole purpose is to run the `usePopover` side-effect hook, which
   calls `useModal` to launch the Popover component exactly once.

3. The popover is launched using a stable modal ID to prevent duplicate
   instances.

### useOpenOLS Public API

4. The `useOpenOLS` hook must be exposed as a console action provider so
   other plugins and console pages can programmatically open the OLS chat.

5. The hook returns a callback function with the following signature:

   ```
   (prompt?: string, attachments?: Attachment[], submitImmediately?: boolean, hidePrompt?: boolean) => void
   ```

6. The callback must:
   a. Set the prompt text in Redux state (if provided).
   b. Add all provided attachments to Redux state (if any).
   c. Set the `autoSubmit` flag (if `submitImmediately` is true).
   d. Set the `hidePrompt` flag (if `hidePrompt` is true).
   e. Dispatch `openOLS` to show the chat window.

7. When called with no arguments, the callback must simply open the chat
   window without modifying the prompt or attachments.

### ols.tool-ui Extension Type

8. The plugin defines a custom extension type `ols.tool-ui` that allows
   other console plugins to register tool visualization components.

9. Each `ols.tool-ui` extension must declare:
   - `id`: A string identifier matching the `olsToolUiID` value in tool
     metadata from the service.
   - `component`: A code reference to a React component.

10. The plugin discovers registered `ols.tool-ui` extensions using the
    console's `useResolvedExtensions` API, building a lookup map from ID
    to component.

11. When a tool result's `tool_meta.olsUi.id` matches a registered
    extension ID, the corresponding component is rendered with the full
    `Tool` object as a prop.

### Feature Flag

12. The `LIGHTSPEED_PLUGIN` feature flag is set to `true` when the plugin
    loads. Other plugins can use this flag to conditionally enable
    OLS-dependent features (e.g., "Ask Lightspeed" actions).

### User Settings

13. The plugin reads but does not write the `console.theme` user setting
    for theme detection.

14. The plugin reads and writes the `lightspeed.hasClosedChat` user
    setting for first-time user tracking.

15. The plugin reads the `console.hideLightspeedButton` user setting to
    determine if the OLS button should be hidden.

### Redux State Scope

16. All plugin Redux state is scoped under `state.plugins.ols`. The plugin
    must not read or write state outside this scope, except for
    `state.sdkCore.user.username` (read-only, for display purposes).

## Constraints

1. The `useOpenOLS` hook is only usable within the OpenShift Console React
   tree. It requires access to the Redux store via `useDispatch`.

2. The `ols.tool-ui` extension type is resolved asynchronously. Components
   may not be available immediately on first render.

3. The popover modal is launched once per page load. The `usePopover` hook
   uses a boolean guard to prevent re-launching.

4. The plugin version displayed on the dashboard is a static string from
   the build, not fetched from the service.
