import { test as base, expect, type Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE_URL = '/api/proxy/plugin/lightspeed-console-plugin/ols';
const getApiUrl = (apiPath: string): string => `${API_BASE_URL}${apiPath}`;

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

export const MOCK_STREAMED_RESPONSE_WITH_TOOL_ERROR_BODY = `data: {"event": "start", "data": {"conversation_id": "${CONVERSATION_ID}"}}

data: {"event": "token", "data": {"id": 0, "token": "Mock"}}

data: {"event": "token", "data": {"id": 1, "token": " response"}}

data: {"event": "tool_call", "data": {"id": "tool-err-1", "name": "failing_tool", "args": {"key": "value"}}}

data: {"event": "tool_result", "data": {"id": "tool-err-1", "content": "Something went wrong", "status": "error"}}

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

const ARTIFACTS_DIR = './gui_test_screenshots/artifacts';
const OLS_NAMESPACE = 'openshift-lightspeed';

const CLUSTER_RESOURCES = [
  'pods',
  'services',
  'deployments',
  'replicasets',
  'routes',
  'rolebindings',
  'serviceaccounts',
  'olsconfig',
  'clusterserviceversion',
  'installplan',
  'configmap',
];

function safeOc(args: string[]): string | null {
  try {
    return oc(args);
  } catch (e: unknown) {
    // eslint-disable-next-line no-console
    console.error(`oc ${args.slice(0, 3).join(' ')} failed: ${e}`);
    return null;
  }
}

export function gatherClusterArtifacts(): void {
  const clusterDir = path.join(ARTIFACTS_DIR, 'cluster');
  const podLogsDir = path.join(clusterDir, 'podlogs');
  fs.mkdirSync(podLogsDir, { recursive: true });

  for (const resource of CLUSTER_RESOURCES) {
    const output = safeOc(['get', resource, '-n', OLS_NAMESPACE, '-o', 'yaml']);
    if (output) {
      fs.writeFileSync(path.join(clusterDir, `${resource}.yaml`), output);
    }
  }

  const podsJson = safeOc(['get', 'pods', '-n', OLS_NAMESPACE, '-o', 'json']);
  if (podsJson) {
    try {
      const pods = JSON.parse(podsJson);
      for (const pod of pods.items || []) {
        const podName = pod.metadata?.name;
        const getName = (c: { name: string }) => c.name;
        const containers = (pod.spec?.containers || []).map(getName);
        const initContainers = (pod.spec?.initContainers || []).map(getName);
        const ephemeralContainers = (pod.status?.ephemeralContainerStatuses || []).map(getName);

        const groups: { names: string[]; suffix: string }[] = [
          { names: containers, suffix: '' },
          { names: initContainers, suffix: '.init' },
          { names: ephemeralContainers, suffix: '.ephemeral' },
        ];

        for (const { names, suffix } of groups) {
          for (const container of names) {
            const logPrefix = `${podName}-${container}${suffix}`;
            const current = safeOc([
              'logs',
              `pod/${podName}`,
              '-c',
              container,
              '-n',
              OLS_NAMESPACE,
            ]);
            if (current) {
              fs.writeFileSync(path.join(podLogsDir, `${logPrefix}.log`), current);
            }
            const previous = safeOc([
              'logs',
              `pod/${podName}`,
              '-c',
              container,
              '--previous',
              '-n',
              OLS_NAMESPACE,
            ]);
            if (previous) {
              fs.writeFileSync(path.join(podLogsDir, `${logPrefix}.previous.log`), previous);
            }
          }
        }
      }
    } catch (e: unknown) {
      // eslint-disable-next-line no-console
      console.error(`Failed to parse pod JSON: ${e}`);
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Cluster artifacts gathered in ${clusterDir}`);
}

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
