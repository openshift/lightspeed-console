# Chat

The chat system manages the full lifecycle of user-AI conversations: prompt
input, query submission, streamed response rendering, conversation management,
and first-time user experience.

## Behavioral Rules

### Prompt Input

1. The prompt input is a text area at the bottom of the chat window. It
   accepts free-text input and is focused automatically when the chat opens.

2. The send button is disabled when the prompt is empty or contains only
   whitespace. Submitting an empty prompt must show a validation error state
   on the input.

3. The prompt text is persisted in Redux state. If the user closes and
   reopens the popover, any previously entered text must still be present.

4. The prompt area includes an attachment menu (accessed via the "+" button)
   that provides options for attaching context and switching query modes.

### Query Submission

5. When the user submits a prompt, the plugin must:
   a. Push a user chat entry (with text and any attachments) to the history.
   b. Push a placeholder AI chat entry (with `isStreaming: true`).
   c. Send a POST request to the streaming query endpoint.
   d. Clear the prompt input, clear attachments, and return focus to the
      input.

6. The request body must include: `query` (the prompt text),
   `conversation_id` (null for the first message, the service-assigned ID
   thereafter), `mode` (`ask` or `troubleshooting`), `attachments` (converted
   to the OLS API format), and `media_type` (`application/json`).

7. Submitting a new prompt while a response is still streaming must be
   blocked. The send button must be disabled during streaming.

### Streaming Response

8. Responses are received as a Server-Sent Events (SSE) stream. The plugin
   must process the following event types:

   | Event | Payload | Behavior |
   |---|---|---|
   | `start` | `conversation_id` | Store the conversation ID for subsequent requests |
   | `token` | `token` | Append the token text to the current response |
   | `end` | `referenced_documents`, `truncated` | Mark response as complete, store references, set truncation flag |
   | `tool_call` | `name`, `id`, `args` | Record a tool invocation in the response |
   | `approval_required` | `approval_id`, `tool_name`, `tool_args`, `tool_description` | Show approval UI for a pending tool |
   | `tool_result` | `id`, `content`, `status`, `server_name`, `structured_content`, `tool_meta` | Update tool with execution result |
   | `history_compression_start` | (none) | Show compression-in-progress indicator |
   | `history_compression_end` | `duration_ms` | Show compression-complete indicator with duration |
   | `error` | error details | Display error alert, stop streaming |

9. Token updates to the UI must be throttled to prevent excessive re-renders
   during streaming. Updates must use trailing-edge throttling so the final
   token is always rendered.

10. The stream response must be buffered line-by-line. Incomplete lines
    (chunks split mid-line) must be held in a buffer until the next chunk
    completes them.

11. Only lines prefixed with `data: ` are processed. Each data line contains
    a JSON object with `event` and `data` fields.

### Stream Cancellation

12. While streaming, a stop button must replace the send button. Clicking it
    must abort the HTTP request and mark the response as cancelled.

13. When a stream is cancelled, the partial response text must be preserved
    and a "Cancelled" indicator must be displayed.

14. If the stream errors (non-abort), the error must be displayed as an
    inline alert in the AI response entry.

### Response Rendering

15. AI responses must be rendered as markdown with support for: headings,
    lists, links, bold/italic, and code blocks.

16. Code blocks must support: syntax highlighting with language labels,
    expandable content for long blocks, a copy-to-clipboard action, and an
    import action for YAML code blocks (navigates to the console's YAML
    import page).

17. When the service returns `referenced_documents` in the `end` event,
    these must be rendered as source links. Only entries with valid URLs
    are displayed.

18. A loading indicator must be shown for AI responses that have no text
    yet and are not cancelled or errored.

### History Indicators

19. When the service signals history compression, the plugin must display:
    a spinning indicator during compression and a success indicator with
    duration on completion.

20. When the service signals history truncation (via the `truncated` flag
    in the `end` event), a warning alert must be displayed.

### Conversation Management

21. Clicking the "Clear chat" button must show a confirmation modal before
    clearing. On confirmation, the plugin must: clear all chat history,
    clear the conversation ID, and clear any pending attachments.

22. The "Copy conversation" button must copy all visible (non-hidden) chat
    entries to the clipboard in a `You: ... / OpenShift Lightspeed: ...`
    text format. A brief visual indicator must confirm the copy.

23. A per-response copy button must copy that individual response's text
    to the clipboard.

### First-Time User Experience

24. The plugin must detect first-time users via the
    `lightspeed.hasClosedChat` user setting. A user is "first-time" if this
    setting is `false` (the default) and settings have finished loading.

25. For first-time users, the chat popover must auto-open after a brief
    delay once the page has loaded, provided the button is not hidden.

26. When a first-time user closes the chat, the plugin must set
    `lightspeed.hasClosedChat` to `true`, permanently disabling auto-open.

27. First-time users see a welcome notice component in the chat history.

### Auto-Submit

28. The plugin supports programmatic prompt submission via the `autoSubmit`
    Redux flag. When set to `true`, the plugin must programmatically click
    the send button to trigger both submission and internal MessageBar state
    cleanup, then reset the flag to `false`.

### Hidden Prompt

29. When `hidePrompt` is `true`, the user's message in chat history must be
    hidden (not rendered). This is used when opening OLS programmatically
    with a contextual prompt that the user should not see. The flag resets
    to `false` after submission.

## Constraints

1. The plugin does not persist chat history across page refreshes. All chat
   state is in-memory (Redux).

2. The plugin does not implement its own retry logic for failed queries.
   Users must resubmit.

3. The conversation ID is assigned by the service (via the `start` event)
   and stored in Redux. The plugin never generates its own conversation IDs.

4. The plugin does not support multiple concurrent conversations.
