# Authentication & Authorization

The plugin verifies that the current user is authorized to use OLS before
enabling the chat interface. Authentication itself is handled by the
OpenShift Console and the OLS backend service; the plugin only checks
the result.

## Behavioral Rules

### Authorization Check

1. When the chat interface mounts, the plugin must POST to the
   authorization endpoint to verify the user's access.

2. The authorization check uses the console's built-in authentication
   (cookies/token). In development mode, a bearer token from the
   `OLS_API_BEARER_TOKEN` environment variable is included in the
   `Authorization` header.

3. The authorization endpoint returns the user's `user_id` and `username`
   on success.

### Auth Status Handling

4. The plugin must track one of five authorization states:

   | Status | Condition | UI behavior |
   |---|---|---|
   | `AuthorizedLoading` | Check in progress | No alerts, chat loading |
   | `Authorized` | 200 response | Full chat functionality enabled |
   | `NotAuthenticated` | 401 response | Error alert, prompt input hidden |
   | `NotAuthorized` | 403 response | Error alert, prompt input hidden |
   | `AuthorizedError` | Any other error | No alert, chat loading state remains |

5. When the user is not authenticated (401) or not authorized (403), the
   plugin must display an inline error alert in the chat area and must hide
   the prompt input area (footer). The user cannot submit queries.

6. The `AuthorizedError` state (non-401/403 failures) does not display an
   error alert. This handles transient network errors gracefully by keeping
   the loading state.

### Bearer Token Forwarding

7. For development without the console proxy, the plugin supports injecting
   a bearer token via the `OLS_API_BEARER_TOKEN` environment variable. When
   set, this token is included as a `Bearer` token in the `Authorization`
   header of all API requests.

8. In production (running inside the console), no explicit `Authorization`
   header is set. The console's proxy handles authentication transparently.

## Constraints

1. The authorization check runs once when the chat component mounts. It is
   not repeated during the session.

2. The plugin does not handle token refresh or re-authentication. If the
   user's session expires, the console itself handles re-authentication.

3. The plugin does not extract or store the user's identity. The user_id
   and username from the auth response are not used by the plugin (they are
   used by the service for conversation scoping).
