# Tools

The plugin renders tool call information from the OLS service's agentic
pipeline, provides a human-in-the-loop (HITL) approval workflow, and hosts
interactive MCP App UIs and OLS-native tool visualizations.

## Behavioral Rules

### Tool Call Display

1. When the AI response includes tool calls, the plugin must render a label
   group summarizing all completed tools. Labels are clickable and open a
   detail modal.

2. Tool labels must be color-coded by status:

   | Condition | Color | Icon |
   |---|---|---|
   | Denied by user | grey | ban icon |
   | Error status | red | info icon |
   | Truncated status | yellow | info icon |
   | Has interactive UI | blue | external link icon |
   | Normal (success) | default | code icon |

3. The tool label group must show a configurable maximum number of labels
   before collapsing behind a "+N more" indicator.

4. Only completed tools (those that are not pending user approval) must
   appear in the label group. Tools awaiting approval are rendered
   separately as approval cards.

### Tool Detail Modal

5. Clicking a tool label must open a modal showing:
   - Tool name and status indicator.
   - Tool arguments formatted as `key=value` pairs.
   - MCP server name (if available).
   - UI resource URI (if available).
   - Tool output content in a scrollable code block with copy action.
   - Structured content (JSON-formatted) in a separate code block with
     copy action (if available).

6. For denied tools, the modal must show a rejection message with the tool
   name and arguments, and must not display output content.

7. For tools with error status, the modal must display an error alert.

### Tool Approval (HITL)

8. When the service sends an `approval_required` event, the plugin must
   render a warning card in the chat for the user to review.

9. The approval card must display:
   - A warning icon and "Review required" heading.
   - The tool description (if provided by the service).
   - An expandable section showing the tool name and arguments.
   - "Approve" (warning variant) and "Reject" (secondary variant) buttons.

10. On approval, the plugin must POST to the tool approvals endpoint with
    `approval_id` and `approved: true`. On success, the tool must be marked
    as approved in Redux state.

11. On denial, the plugin must POST to the tool approvals endpoint with
    `approval_id` and `approved: false`. On success, the tool must be marked
    as denied in Redux state.

12. If the approval or denial API call fails, the plugin must update the
    tool with an error status and display the error message as tool content.

13. The approval request has a timeout matching the service-side approval
    timeout.

### Linking Tool Calls to Approval Requests

14. The service does not provide a direct ID linking `approval_required`
    events to prior `tool_call` events. The plugin must use a composite key
    of tool name + JSON-serialized arguments to correlate them.

### MCP App Interactive UI

15. When a tool result includes a `uiResourceUri` and `serverName` in its
    `tool_meta`, the plugin must render an interactive MCP App card for that
    tool.

16. The MCP App must load its HTML content from the OLS service's MCP
    resources endpoint, passing the `resource_uri` and `server_name`.

17. The loaded HTML must be rendered in a sandboxed iframe with only
    `allow-scripts` permission. No other sandbox permissions are granted.

18. The MCP App card must provide controls for: expand/collapse to
    fullscreen, minimize to a compact header-only card, restore from
    minimized, and refresh (re-send tool data).

19. The plugin and MCP App iframe must communicate via bidirectional
    JSON-RPC 2.0 messages using `postMessage`. The plugin must only process
    messages from its own iframe's content window.

20. The plugin must handle the following JSON-RPC methods from the iframe:

    | Method | Behavior |
    |---|---|
    | `initialize` | Respond with protocol version, host info, capabilities, and context (theme, tool name, server name) |
    | `notifications/initialized` | Send host context and initial tool data; on failure, send cached tool content |
    | `tools/call` | Execute the requested tool via the MCP apps tools endpoint and return the result |
    | `notifications/size-changed` | Resize the iframe height within min/max bounds |

21. Unrecognized methods with a request ID must receive a JSON-RPC error
    response (`-32601 Method not found`). Notifications (no ID) for
    unrecognized methods must be silently ignored.

22. On initial load, the plugin must send the tool input arguments and then
    execute a fresh tool call and send the result. If the fresh call fails,
    the plugin must fall back to sending the cached tool content from the
    stream.

23. When the console theme changes, the plugin must notify the iframe via
    `ui/notifications/host-context-changed` with the new theme. The HTML
    content must also include a `data-theme` attribute on the `<html>` tag.

### OLS Tool UI Extensions

24. Other console plugins can register tool UI components via the
    `ols.tool-ui` extension type. When a tool result includes an
    `olsToolUiID` in its `tool_meta`, the plugin must look up the
    registered component by ID and render it.

25. Each OLS tool UI component receives the full `Tool` object as a prop.

26. OLS tool UI components must be wrapped in an error boundary. A component
    crash must not affect other tool UIs or the chat interface.

27. Tools with error status must not render their OLS tool UI component.

## Constraints

1. The MCP App iframe is sandboxed to `allow-scripts` only. It cannot
   navigate the parent page, access the parent's DOM, submit forms, or open
   popups.

2. MCP App iframe height is bounded between a minimum and maximum value.

3. The tool approval timeout on the plugin side must match the service-side
   timeout to avoid orphaned approval UI.

4. The tool name + arguments composite key for approval correlation assumes
   uniqueness within a single response. If the service invokes the same tool
   with identical arguments twice in one response, correlation may be
   incorrect.

## Planned Changes

| Jira Key | Summary |
|---|---|
| OLS-2683 | MVP for HITL approve/deny (completed) |
| OLS-2722 | OLS Tool UI extensibility from external plugins |
| OLS-2598 | MCP Apps support in OLS console |
| OLS-1556 | Display info about tools called while generating OLS response |
