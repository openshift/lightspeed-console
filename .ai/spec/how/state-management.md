# State Management -- Architecture

All plugin state is managed in a single Redux reducer registered under the
`ols` scope. State values are stored as Immutable.js data structures
(`ImmutableMap` and `ImmutableList`).

## Module Map

| Path | Purpose |
|---|---|
| `src/redux-actions.ts` | Action type enum, action creators, union action type |
| `src/redux-reducers.ts` | Reducer function, initial state, `OLSState` and `State` type exports |

## Data Flow

### State shape

```
state.plugins.ols = ImmutableMap({
  // UI state
  isOpen: boolean,                    // false -- chat popover visibility
  hidePrompt: boolean,                // false -- hide user's message from history
  isTroubleshooting: boolean,         // false -- query mode (false=Ask, true=Troubleshooting)
  isUserFeedbackEnabled: boolean,     // true  -- feedback UI enabled
  isContextEventsLoading: boolean,    // false -- events fetch in progress
  autoSubmit: boolean,                // false -- programmatic submit trigger

  // Chat content
  chatHistory: ImmutableList<ImmutableMap>,  // [] -- ordered list of chat entries
  query: string,                             // '' -- current prompt input text
  conversationID: string | null,             // null -- service-assigned conversation ID

  // Attachments
  attachments: ImmutableMap<string, Attachment>,  // {} -- keyed by composite ID
  openAttachment: Attachment | null,               // null -- attachment in edit modal
  contextEvents: object[],                         // [] -- K8s events for current resource
  codeBlock: CodeBlock | null,                     // null -- imported code block

  // Tool interaction
  openTool: ImmutableMap({
    chatEntryIndex: number | null,    // null -- index of chat entry with open tool
    id: string | null,                // null -- tool ID within that entry
  }),
})
```

### Chat entry structure (within chatHistory)

**User entry:**
```
ImmutableMap({
  who: 'user',
  text: string,
  attachments: { [id]: Attachment },
  hidden?: boolean,
})
```

**AI entry:**
```
ImmutableMap({
  who: 'ai',
  id: string,                      // unique ID (e.g., 'ChatEntry_1')
  text: string,                    // accumulated response text
  tools: ImmutableMap<string, Tool>,  // tool calls keyed by tool ID
  references: ReferencedDoc[],     // documentation links
  isStreaming: boolean,            // true while SSE stream is active
  isCancelled: boolean,            // true if user cancelled
  isTruncated: boolean,            // true if history was truncated
  error?: ErrorType,               // error info if request failed
  historyCompression?: { status: 'compressing' | 'done', durationMs?: number },
  userFeedback?: ImmutableMap({
    isOpen: boolean,
    sentiment: number,             // 1 (thumbs up) or -1 (thumbs down)
    text: string,
  }),
})
```

### Actions

| Action | Payload | Reducer behavior |
|---|---|---|
| `OpenOLS` | (none) | `isOpen = true` |
| `CloseOLS` | (none) | `isOpen = false`, `hidePrompt = false` |
| `SetQuery` | `query: string` | `query = payload` |
| `SetAutoSubmit` | `autoSubmit: boolean` | `autoSubmit = payload` |
| `SetHidePrompt` | `hidePrompt: boolean` | `hidePrompt = payload` |
| `SetIsTroubleshooting` | `isTroubleshooting: boolean` | `isTroubleshooting = payload` |
| `SetConversationID` | `id: string` | `conversationID = payload` |
| `SetIsContextEventsLoading` | `isLoading: boolean` | `isContextEventsLoading = payload` |
| `ChatHistoryPush` | `entry: ChatEntry` | Appends `ImmutableMap(entry)` to `chatHistory` |
| `ChatHistoryUpdateByID` | `id: string, entry: Partial<ChatEntry>` | Finds entry by `id`, merges `entry` fields |
| `ChatHistoryUpdateTool` | `id: string, toolID: string, tool: Partial<Tool>` | Finds entry by `id`, merges `tool` into `tools[toolID]` |
| `ChatHistoryClear` | (none) | `chatHistory = ImmutableList()` |
| `AttachmentSet` | `attachmentType, kind, name, ownerName, namespace, value, originalValue?, id?` | Sets attachment at computed or explicit key |
| `AttachmentDelete` | `id: string` | Removes attachment at key |
| `AttachmentsClear` | (none) | `attachments = ImmutableMap()` |
| `OpenAttachmentSet` | `attachment: Attachment` | `openAttachment = payload` |
| `OpenAttachmentClear` | (none) | `openAttachment = null` |
| `OpenToolSet` | `chatEntryIndex: number, id: string` | Sets `openTool.chatEntryIndex` and `openTool.id` |
| `OpenToolClear` | (none) | Resets `openTool` to null/null |
| `AddContextEvent` | `event: object` | Appends event to `contextEvents` array |
| `ClearContextEvents` | (none) | `contextEvents = []` |
| `ImportCodeBlock` | `code: CodeBlock` | `codeBlock = payload` |
| `UserFeedbackOpen` | `entryIndex: number` | Sets `chatHistory[entryIndex].userFeedback.isOpen = true` |
| `UserFeedbackClose` | `entryIndex: number` | Sets `chatHistory[entryIndex].userFeedback.isOpen = false` |
| `UserFeedbackSetSentiment` | `entryIndex: number, sentiment: number` | Sets `chatHistory[entryIndex].userFeedback.sentiment` |
| `UserFeedbackSetText` | `entryIndex: number, text: string` | Sets `chatHistory[entryIndex].userFeedback.text` |
| `UserFeedbackDisable` | (none) | `isUserFeedbackEnabled = false` |

### Attachment key generation

When `AttachmentSet` is dispatched without an explicit `id`, the key is
computed as: `{attachmentType}_{kind}_{name}_{ownerName ?? 'NO-OWNER'}`.
This means attaching the same resource type and name for the same owner
replaces the previous attachment (idempotent).

### State access patterns

Components access state via `useSelector` with Immutable.js accessors:

```typescript
// Single value
const isOpen = useSelector((s: State) => s.plugins?.ols?.get('isOpen'));

// Nested value
const tool = useSelector((s: State) =>
  s.plugins?.ols?.getIn(['chatHistory', entryIndex, 'tools', toolID]),
);

// Convert to plain JS when needed
const entry = entryMap.toJS() as ChatEntry;
```

## Key Abstractions

### typesafe-actions

Action creators use the `action()` function from `typesafe-actions`, which
provides type-safe action creation with automatic type discrimination. The
`OLSAction` union type enables exhaustive switch matching in the reducer.

### ImmutableMap as OLSState

The state type is `ImmutableMap<string, any>`, providing structural sharing
for efficient updates but no compile-time key validation. Runtime errors
from typos in `.get()` / `.getIn()` keys return `undefined` silently.

### State scoping

The plugin's reducer is registered under `state.plugins.ols` via the
`console.redux-reducer` extension with `scope: "ols"`. The console SDK
handles the scoping -- the reducer receives and returns only the `ols`
subtree, not the full store.

## Implementation Notes

### Initial state is created on first reducer call

The reducer checks `if (!state)` and returns the initial `ImmutableMap`
with all default values. This is the standard pattern for console plugin
reducers where the initial state cannot be passed via `createStore`.

### CloseOLS resets hidePrompt

Closing the chat always resets `hidePrompt` to `false`. This ensures
that if OLS was opened programmatically with a hidden prompt, the next
manual open shows prompts normally.

### ChatHistoryUpdateByID uses linear scan

Finding a chat entry by ID uses `ImmutableList.findIndex()`, which is a
linear scan through the list. This is acceptable because chat histories
are small (typically under 100 entries per session).

### Feedback state is per-entry, not global

User feedback (open/close, sentiment, text) is stored within each AI
chat history entry, not in a separate global state slice. This allows
independent feedback on multiple responses.

### Tool state uses nested ImmutableMap merging

Tool updates use `state.mergeIn(['chatHistory', index, 'tools', toolID], tool)`,
which deeply merges the tool properties. This means partial updates
(e.g., adding `isApproved: true` to an existing tool) preserve all
other tool properties.
