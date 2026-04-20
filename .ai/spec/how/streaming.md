# Streaming -- Architecture

The plugin processes OLS query responses as Server-Sent Events (SSE) streams.
All stream processing logic lives in `src/components/Prompt.tsx` within the
`onSubmit` callback.

## Module Map

| Path | Purpose |
|---|---|
| `src/components/Prompt.tsx` | Stream initiation, SSE reading, event parsing, Redux dispatch for all event types |
| `src/redux-actions.ts` | Actions dispatched during streaming: `setConversationID`, `chatHistoryUpdateByID`, `chatHistoryUpdateTool` |
| `src/config.ts` | `QUERY_ENDPOINT` = `getApiUrl('/v1/streaming_query')` |
| `src/error.ts` | `getFetchErrorMessage()` for error extraction |

## Data Flow

### Request initiation

```
onSubmit()
  |-- Validate: isStreaming? empty query? -> early return
  |-- Dispatch: chatHistoryPush(user entry with text + attachments)
  |-- Dispatch: chatHistoryPush(AI placeholder with isStreaming=true, unique chatEntryID)
  |-- Dispatch: setQuery(''), attachmentsClear()
  |-- Build request JSON: { query, conversation_id, media_type, mode, attachments }
  |-- Create AbortController, store in state
  |-- Call consoleFetch(QUERY_ENDPOINT, POST, JSON body, signal)
```

### Response validation

```
consoleFetch response
  |-- response.ok === false?
  |     |-- Dispatch: chatHistoryUpdateByID(chatEntryID, { error, isStreaming: false })
  |     |-- Return
  |-- Get reader: response.body.getReader()
  |-- Create TextDecoder
```

### Stream reading loop

```
while (true):
  |-- reader.read() -> { value, done }
  |-- done? break
  |-- Decode chunk, append to buffer
  |-- Split buffer by '\n'
  |-- Keep last element as new buffer (handles incomplete lines)
  |-- Process complete lines
```

### Line processing

Only lines starting with `data: ` are processed. The `data: ` prefix (5 chars)
is stripped, and the remainder is parsed as JSON.

Each JSON object has the shape `{ event: string, data: object }`.

### Event dispatch

```
event === 'start'
  |-- Dispatch: setConversationID(data.conversation_id)

event === 'token'
  |-- Append data.token to local responseText variable
  |-- Call throttled dispatchTokens() -> chatHistoryUpdateByID(chatEntryID, { text: responseText })

event === 'end'
  |-- Flush throttled dispatchTokens
  |-- Dispatch: chatHistoryUpdateByID(chatEntryID, {
  |       isStreaming: false,
  |       isTruncated: data.truncated === true,
  |       references: data.referenced_documents
  |     })

event === 'tool_call'
  |-- Extract: name, id, args from data
  |-- Store in toolKeyToID map: makeToolKey(name, args) -> id
  |-- Dispatch: chatHistoryUpdateTool(chatEntryID, id, { name, args })

event === 'approval_required'
  |-- Extract: approval_id, tool_name, tool_args, tool_description from data
  |-- Look up toolCallID via toolKeyToID.get(makeToolKey(tool_name, tool_args))
  |-- If found: Dispatch chatHistoryUpdateTool(chatEntryID, toolCallID, {
  |       approvalID, args, description, isUserApproval: true
  |     })

event === 'tool_result'
  |-- Extract: content, id, status, server_name, structured_content, tool_meta from data
  |-- Extract UI metadata: tool_meta?.ui?.resourceUri, tool_meta?.olsUi?.id
  |-- Dispatch: chatHistoryUpdateTool(chatEntryID, id, {
  |       content, isUserApproval: false, status,
  |       ...(uiResourceUri && { uiResourceUri }),
  |       ...(serverName && { serverName }),
  |       ...(structuredContent && { structuredContent }),
  |       ...(olsToolUiID && { olsToolUiID })
  |     })

event === 'history_compression_start'
  |-- Dispatch: chatHistoryUpdateByID(chatEntryID, {
  |       historyCompression: { status: 'compressing' }
  |     })

event === 'history_compression_end'
  |-- Parse duration_ms (validate as finite number)
  |-- Dispatch: chatHistoryUpdateByID(chatEntryID, {
  |       historyCompression: { status: 'done', durationMs }
  |     })

event === 'error'
  |-- Flush throttled dispatchTokens
  |-- Dispatch: chatHistoryUpdateByID(chatEntryID, {
  |       error: getFetchErrorMessage({ json: { detail: data } }, t),
  |       isStreaming: false
  |     })

(unrecognized event)
  |-- console.warn with event JSON
```

### Error handling

```
streamResponse().catch(streamError)
  |-- AbortError (user cancelled)? -> skip
  |-- Dispatch: chatHistoryUpdateByID(chatEntryID, {
  |       error: getFetchErrorMessage(streamError, t),
  |       isStreaming: false, isTruncated: false
  |     })
  |-- scrollIntoView()
```

### Stream cancellation

```
onStreamCancel()
  |-- streamController.abort()
  |-- Dispatch: chatHistoryUpdateByID(streamingResponseID, {
  |       isCancelled: true, isStreaming: false
  |     })
```

## Key Abstractions

### Token throttling

Token updates use lodash `throttle()` with `{ leading: false, trailing: true }`
at 100ms interval. This means:

- The first token does NOT trigger an immediate dispatch.
- After each 100ms window, the latest accumulated text is dispatched.
- The final token is always dispatched (trailing: true).
- `dispatchTokens.flush()` is called on `end` and `error` events to ensure
  the final state is always committed.

The throttle targets `chatHistoryUpdateByID`, which triggers a Redux state
update and React re-render. Without throttling, each token (potentially
hundreds per second) would cause a separate re-render.

### Buffer management

The stream reader produces chunks of arbitrary size. A `buffer` variable
accumulates partial data between reads:

1. New chunk is appended to buffer.
2. Buffer is split by `\n`.
3. All lines except the last are processed (they are complete).
4. The last element becomes the new buffer (it may be incomplete or empty).

This handles the case where a long SSE data line (e.g., tool call output)
is split across multiple TCP chunks.

### Tool call correlation

The `toolKeyToID` map (local to the stream processing closure) maps
`${toolName}:${JSON.stringify(args)}` to the tool call ID from the
`tool_call` event. When `approval_required` arrives (which lacks the tool
call ID), the map is used to find the corresponding tool.

This is a workaround for the OLS service not providing a linking ID.

### AbortController lifecycle

A new `AbortController` is created for each query submission and stored
in React state via `setStreamController`. The controller's `signal` is
passed to `consoleFetch`. The stop button calls `streamController.abort()`.
The `AbortError` catch clause distinguishes user cancellation from real
errors.

## Implementation Notes

### All stream logic is in a single closure

The `streamResponse` async function is defined inside `onSubmit`, giving it
closure access to `chatEntryID`, `requestJSON`, `dispatch`, and other
values. The `responseText` accumulator and `toolKeyToID` map are also local
to this closure. This means the stream processing state is per-request and
automatically cleaned up.

### consoleFetch vs consoleFetchJSON

The streaming endpoint uses `consoleFetch` (raw fetch with console auth),
not `consoleFetchJSON` (which would parse the entire response as JSON).
The raw response body is read incrementally via `response.body.getReader()`.

### Auto-submit clicks the send button

The auto-submit mechanism does not call `onSubmit` directly. Instead, it
programmatically clicks the MessageBar's send button DOM element
(`querySelector('.pf-chatbot__button--send')?.click()`). This is necessary
because calling `onSubmit` alone would not clear the MessageBar component's
internal state (the MessageBar is a controlled component from PatternFly
that manages its own internal buffer alongside the external `value` prop).
