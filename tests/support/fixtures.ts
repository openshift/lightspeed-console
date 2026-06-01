import { test as base, expect, type Page } from '@playwright/test';
import { execFileSync } from 'child_process';

const API_BASE_URL = '/api/proxy/plugin/lightspeed-console-plugin/ols';
const getApiUrl = (path: string): string => `${API_BASE_URL}${path}`;

export const CONVERSATION_ID = '5f424596-a4f9-4a3a-932b-46a768de3e7c';

export const MOCK_STREAMED_RESPONSE_BODY = `data: {"event": "start", "data": {"conversation_id": "${CONVERSATION_ID}"}}

data: {"event": "token", "data": {"id": 0, "token": "Mock"}}

data: {"event": "token", "data": {"id": 1, "token": " OLS"}}

data: {"event": "token", "data": {"id": 2, "token": " response"}}

data: {"event": "end", "data": {"referenced_documents": [], "truncated": false}}
`;

export const MOCK_STREAMED_RESPONSE_WITH_ERROR_BODY = `data: {"event": "start", "data": {"conversation_id": "${CONVERSATION_ID}"}}

data: {"event": "token", "data": {"id": 0, "token": "Partial"}}

data: {"event": "token", "data": {"id": 1, "token": " response"}}

data: {"event": "tool_call", "data": {"id": 123, "name": "ABC", "args": {"some_key": "some_value"}}}

data: {"event": "tool_result", "data": {"id": 123,  "content": "Tool response", "status": "success"}}

data: {"event": "error", "data": "MOCK_ERROR_MESSAGE"}
`;

export const MOCK_STREAMED_RESPONSE_WITH_APPROVAL_BODY = `data: {"event": "start", "data": {"conversation_id": "5f424596-a4f9-4a3a-932b-46a768de3e7c"}}

data: {"event": "token", "data": {"id": 0, "token": "Mock"}}

data: {"event": "token", "data": {"id": 1, "token": " response"}}

data: {"event": "tool_call", "data": {"id": "tool-123", "name": "mock_tool", "args": {"namespace": "default"}}}

data: {"event": "approval_required", "data": {"approval_id": "abc", "tool_name": "mock_tool", "tool_description": "This action will list pods in the cluster.", "tool_args": {"namespace": "default"}}}

data: {"event": "end", "data": {"referenced_documents": [], "truncated": false}}
`;

export const MOCK_MCP_STREAMED_RESPONSE_BODY_TEMPLATE = `data: {"event": "start", "data": {"conversation_id": "CONVERSATION_ID"}}

data: {"event": "token", "data": {"id": 0, "token": "Here"}}

data: {"event": "token", "data": {"id": 1, "token": " is"}}

data: {"event": "token", "data": {"id": 2, "token": " your"}}

data: {"event": "token", "data": {"id": 3, "token": " MCP"}}

data: {"event": "token", "data": {"id": 4, "token": " dashboard"}}

data: {"event": "tool_call", "data": {"id": 1, "name": "TOOL_NAME", "server_name": "test-server", "args": {}}}

data: {"event": "tool_result", "data": {"id": 1, "content": "Dashboard loaded", "status": "success", "server_name": "test-server", "tool_meta": {"ui": {"resourceUri": "UI_RESOURCE_URI"}}}}

data: {"event": "end", "data": {"referenced_documents": [], "truncated": false}}
`;

type Attachment = { attachment_type: string; content_type: string };

export const oc = (args: string[]): string =>
  execFileSync('oc', [...args, '--kubeconfig', process.env.KUBECONFIG_PATH!], {
    encoding: 'utf-8',
    timeout: 180_000,
  });

export const interceptQuery = async (
  page: Page,
  query: string,
  conversationId: string | null = null,
  attachments: Attachment[] = [],
): Promise<void> => {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  const pattern = `**${getApiUrl('/v1/streaming_query')}`;

  await page.unroute(pattern);
  await page.route(
    pattern,
    async (route) => {
      try {
        const body = route.request().postDataJSON();
        expect(body.media_type).toBe('application/json');
        expect(body.conversation_id).toBe(conversationId);
        expect(body.query).toContain(query);
        expect(body.attachments).toHaveLength(attachments.length);
        attachments.forEach((a, i) => {
          expect(body.attachments[i].attachment_type).toBe(a.attachment_type);
          expect(body.attachments[i].content_type).toBe(a.content_type);
        });

        await route.fulfill({ body: MOCK_STREAMED_RESPONSE_BODY });
        resolve();
      } catch (err) {
        await route.fulfill({ body: MOCK_STREAMED_RESPONSE_BODY });
        reject(err);
      }
    },
    { times: 1 },
  );

  return promise;
};

export const interceptFeedback = async (
  page: Page,
  conversationId: string,
  sentiment: number,
  userFeedback: string,
  userQuestionStartsWith: string,
): Promise<void> => {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  const pattern = `**${getApiUrl('/v1/feedback')}`;

  await page.unroute(pattern);
  await page.route(
    pattern,
    async (route) => {
      try {
        const body = route.request().postDataJSON();
        expect(body.conversation_id).toBe(conversationId);
        expect(body.sentiment).toBe(sentiment);
        expect(body.user_feedback).toBe(userFeedback);
        expect(body.llm_response).toBe('Mock OLS response');
        expect(body.user_question.startsWith(userQuestionStartsWith)).toBe(true);
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ message: 'Feedback received' }),
        });
        resolve();
      } catch (err) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ message: 'Feedback received' }),
        });
        reject(err);
      }
    },
    { times: 1 },
  );

  return promise;
};

// Custom test fixture that captures browser console errors/warnings and prints
// them only when the test fails, keeping passing test output clean.
export const test = base.extend<{ captureConsoleLogs: void }>({
  captureConsoleLogs: [
    async ({ page }, use, testInfo) => {
      const logs: { method: string; msg: string }[] = [];

      page.on('console', (msg) => {
        const type = msg.type();
        if (type === 'error' || type === 'warning') {
          logs.push({ method: type, msg: msg.text() });
        }
      });

      await use();

      if (testInfo.status !== testInfo.expectedStatus && logs.length > 0) {
        logs.forEach(({ method, msg }) => {
          // eslint-disable-next-line no-console
          console.log(`[console.${method}] ${msg}`);
        });
      }
    },
    { auto: true },
  ],
});

export { expect };
