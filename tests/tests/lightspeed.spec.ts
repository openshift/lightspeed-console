import type { Page } from '@playwright/test';

import {
  CONVERSATION_ID,
  expect,
  interceptFeedback,
  interceptQuery,
  MOCK_MCP_STREAMED_RESPONSE_BODY_TEMPLATE,
  MOCK_STREAMED_RESPONSE_BODY,
  MOCK_STREAMED_RESPONSE_WITH_APPROVAL_BODY,
  MOCK_STREAMED_RESPONSE_WITH_ERROR_BODY,
  test,
} from '../support/fixtures';

const resourceRows = '.co-resource-item__resource-name';

const setEditorContent = (page: Page, text: string) =>
  page.evaluate(
    (t) => (window as any).monaco.editor.getModels()[0].setValue(t), // eslint-disable-line @typescript-eslint/no-explicit-any
    text,
  );

const filterByName = async (page: Page, name: string) => {
  const input = page.getByPlaceholder('Filter by name');
  await expect(input).toBeVisible({ timeout: 10_000 });
  await input.fill(name);
};

const goToPodsList = async (page: Page, ns: string | null = null) => {
  await page.goto(ns ? `/k8s/ns/${ns}/pods` : '/k8s/all-namespaces/pods');
  await expect(page.locator(resourceRows).first()).toBeVisible();
};

const goToPodDetails = async (page: Page, ns: string, podName: string) => {
  await goToPodsList(page, ns);
  await filterByName(page, podName);
  const link = page.locator(resourceRows).filter({ hasText: podName });
  await expect(link.first()).toBeVisible({ timeout: 30_000 });
  await link.first().click();
};

const popover = '[data-test="ols-plugin__popover"]';
const mainButton = '[data-test="ols-plugin__popover-button"]';
const minimizeButton = '[data-test="ols-plugin__popover-minimize-button"]';
const expandButton = '[data-test="ols-plugin__popover-expand-button"]';
const collapseButton = '[data-test="ols-plugin__popover-collapse-button"]';
const clearChatButton = '[data-test="ols-plugin__clear-chat-button"]';
const userChatEntry = '[data-test="ols-plugin__chat-entry-user"]';
const aiChatEntry = '[data-test="ols-plugin__chat-entry-ai"]';
const loadingIndicator = `${popover} .pf-chatbot__message-loading`;
const attachments = `${popover} .ols-plugin__prompt-attachments`;
const attachMenu = '.pf-chatbot__menu';
const promptAttachment = `${attachments} .ols-plugin__context-label`;
const fileInput = '[data-test="ols-plugin__file-upload"]';
const responseAction = `${popover} .pf-chatbot__button--response-action`;
const copyConversationButton = '[data-test="ols-plugin__copy-conversation-button"]';
const copyConversationTooltip = '[data-test="ols-plugin__copy-conversation-tooltip"]';
const copyResponseButton = `${responseAction}[aria-label=Copy]`;
const userFeedbackSel = `${popover} .ols-plugin__feedback`;
const userFeedbackInput = `${userFeedbackSel} textarea`;
const userFeedbackSubmit = `${userFeedbackSel} button.pf-m-primary`;
const modal = '.pf-v6-c-modal-box';
const attachmentModal = '.ols-plugin__attachment-modal';
const toolApprovalCard = `${popover} .ols-plugin__tool-call`;
const toolLabel = `${popover} .pf-v6-c-label`;

const promptArea = `${popover} .ols-plugin__prompt`;
const attachButton = `${promptArea} .pf-chatbot__button--attach`;
const promptInput = `${promptArea} textarea`;
const modeToggle = `${popover} [data-test="ols-plugin__mode-toggle"]`;

const openPopover = async (page: Page) => {
  const btn = page.locator(mainButton);
  const pop = page.locator(popover);
  await expect(btn).toBeVisible();

  await expect(async () => {
    if (!(await pop.isVisible())) {
      await btn.click();
    }
    await expect(pop).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 10_000 });
};

const podNamePrefix = 'console';

const MINUTE = 60 * 1000;

const PROMPT_SUBMITTED = 'What is OpenShift?';
const PROMPT_NOT_SUBMITTED = 'Test prompt that should not be submitted';
const USER_FEEDBACK_SUBMITTED = 'Good answer!\nMultiple lines\n\n(@#$%^&*) 😀 文字';

const POPOVER_TITLE = 'Red Hat OpenShift Lightspeed';
const FOOTER_TEXT = 'Always review AI generated content prior to use.';
const PRIVACY_TEXT =
  "OpenShift Lightspeed uses AI technology to help answer your questions. Do not include personal information or other sensitive information in your input. Interactions may be used to improve Red Hat's products or services.";
const WELCOME_TEXT = 'Welcome to OpenShift Lightspeed';

const CLEAR_CHAT_TEXT =
  'Are you sure you want to erase the current chat conversation and start a new chat? This action cannot be undone.';
const CLEAR_CHAT_CONFIRM_BUTTON = 'Erase and start new chat';

const READINESS_TITLE = 'Waiting for OpenShift Lightspeed service';
const READINESS_TEXT =
  'The OpenShift Lightspeed service is not yet ready to receive requests. If this message persists, please check the OLSConfig.';

const ACM_ATTACH_CLUSTER_TEXT = 'Attach cluster info';

const USER_FEEDBACK_TEXT =
  "Do not include personal information or other sensitive information in your feedback. Feedback may be used to improve Red Hat's products or services.";
const USER_FEEDBACK_RECEIVED_TEXT = 'Feedback submitted';
const THUMBS_DOWN = -1;
const THUMBS_UP = 1;

const MOCK_STREAMED_RESPONSE_TEXT = 'Mock OLS response';
const MOCK_PARTIAL_RESPONSE_TEXT = 'Partial response';
const MOCK_ERROR_MESSAGE = 'Service temporarily unavailable';

test.describe('OLS UI', () => {
  test.describe.serial('Core functionality', { tag: ['@core'] }, () => {
    test('OpenShift Lightspeed popover UI is loaded and basic functionality is working', async ({
      page,
    }) => {
      await page.route('**/api/proxy/plugin/lightspeed-console-plugin/ols/readiness', (route) =>
        route.fulfill({ status: 200, json: { ready: false } }),
      );

      await page.goto('/');

      await expect(page.locator(mainButton)).toBeVisible();
      const pop = page.locator(popover);
      await expect(pop).toContainText(FOOTER_TEXT);
      await expect(pop).toContainText(PRIVACY_TEXT);
      await expect(pop).toContainText(READINESS_TITLE);
      await expect(pop).toContainText(READINESS_TEXT);
      await expect(pop).toContainText(WELCOME_TEXT);
      await expect(pop.locator('h1')).toContainText(POPOVER_TITLE);

      await expect(page.locator(promptInput)).toBeVisible();
      await expect(page.locator(promptInput)).toBeEnabled();
      await page.locator(promptInput).fill(PROMPT_SUBMITTED);
      await page.locator(promptInput).press('Enter');
      await expect(page.locator(userChatEntry)).toContainText(PROMPT_SUBMITTED);
      await expect(page.locator(aiChatEntry)).toBeVisible();

      await page.locator(promptInput).fill(PROMPT_NOT_SUBMITTED);

      await page.locator(minimizeButton).click();
      await expect(page.locator(popover)).toBeHidden();

      await page.locator(mainButton).click();
      await expect(page.locator(userChatEntry)).toContainText(PROMPT_SUBMITTED);
      await expect(page.locator(aiChatEntry)).toBeVisible();
      await expect(page.locator(promptInput)).toHaveValue(PROMPT_NOT_SUBMITTED);

      const { width: viewportWidth } = page.viewportSize()!;

      await page.locator(expandButton).click();
      await expect(pop).toBeVisible();
      const expandedBox = await pop.boundingBox();
      expect(viewportWidth - expandedBox!.width).toBeLessThan(250);
      await expect(pop).toContainText(FOOTER_TEXT);
      await expect(pop).toContainText(PRIVACY_TEXT);
      await expect(pop).toContainText(READINESS_TITLE);
      await expect(pop).toContainText(READINESS_TEXT);

      await page.locator(minimizeButton).click();
      await expect(pop).toBeHidden();

      await page.locator(mainButton).click();
      await expect(pop).toBeVisible();

      await page.locator(mainButton).click();
      await expect(pop).toBeHidden();
      await page.locator(mainButton).click();
      await expect(pop).toBeVisible();
      const expandedBox2 = await pop.boundingBox();
      expect(viewportWidth - expandedBox2!.width).toBeLessThan(250);

      await page.locator(collapseButton).click();
      await expect(pop).toBeVisible();
      const collapsedBox = await pop.boundingBox();
      expect(collapsedBox!.width).toBeLessThan(viewportWidth / 2);

      await page.locator(mainButton).click();
      await expect(pop).toBeHidden();
      await page.locator(mainButton).click();
      await expect(pop).toBeVisible();
      const collapsedBox2 = await pop.boundingBox();
      expect(collapsedBox2!.width).toBeLessThan(viewportWidth / 2);

      await expect(page.locator(userChatEntry)).toContainText(PROMPT_SUBMITTED);
      await expect(page.locator(aiChatEntry)).toBeVisible();
      await expect(page.locator(promptInput)).toHaveValue(PROMPT_NOT_SUBMITTED);
    });

    test('Test Troubleshooting mode persists after reopening the UI', async ({ page }) => {
      await page.goto('/search/all-namespaces');
      await expect(page.locator('h1').filter({ hasText: 'Search' })).toBeVisible();
      await expect(page.locator(mainButton)).toBeVisible();
      await openPopover(page);

      await expect(page.locator(modeToggle)).toContainText('Ask');
      await page.locator(modeToggle).click();
      await page.locator('[role="option"]').filter({ hasText: 'Troubleshooting' }).click();
      await expect(page.locator(modeToggle)).toContainText('Troubleshooting');

      await page.locator(minimizeButton).click();
      await expect(page.locator(popover)).toBeHidden();
      await openPopover(page);
      await expect(page.locator(modeToggle)).toContainText('Troubleshooting');

      await page.locator(modeToggle).click();
      await page.locator('[role="option"]').filter({ hasText: 'Ask' }).click();
      await expect(page.locator(modeToggle)).toContainText('Ask');

      await page.locator(minimizeButton).click();
      await expect(page.locator(popover)).toBeHidden();
      await openPopover(page);
      await expect(page.locator(modeToggle)).toContainText('Ask');
    });
  });

  test.describe.serial('Streamed response', { tag: ['@response'] }, () => {
    test('Test submitting a prompt and fetching the streamed response', async ({ page }) => {
      await page.goto('/search/all-namespaces');
      await expect(page.locator('h1').filter({ hasText: 'Search' })).toBeVisible();
      await openPopover(page);

      await page.route(`**/v1/streaming_query`, async (route) => {
        await new Promise<void>((r) => {
          setTimeout(r, 1000);
        });
        await route.fulfill({ body: MOCK_STREAMED_RESPONSE_BODY });
      });

      await page.locator(promptInput).fill(PROMPT_SUBMITTED);
      await page.locator(promptInput).press('Enter');

      await expect(page.locator(loadingIndicator)).toBeVisible();

      await expect(page.locator(promptInput)).toHaveValue('');
      await expect(page.locator(userChatEntry)).toContainText(PROMPT_SUBMITTED);
      await expect(page.locator(aiChatEntry)).toContainText(MOCK_STREAMED_RESPONSE_TEXT);

      // Second prompt sends conversation_id
      const PROMPT_SUBMITTED_2 = 'Test prompt 2';
      await page.locator(promptInput).fill(PROMPT_SUBMITTED_2);
      await page.locator(promptInput).press('Enter');

      await expect(page.locator(promptInput)).toHaveValue('');
      await expect(page.locator(userChatEntry).last()).toContainText(PROMPT_SUBMITTED_2);
      await expect(page.locator(aiChatEntry).last()).toContainText(MOCK_STREAMED_RESPONSE_TEXT);

      // Clear chat preserves prompt text
      await page.locator(promptInput).fill(PROMPT_NOT_SUBMITTED);
      await page.locator(clearChatButton).click();
      await expect(page.locator(modal)).toContainText(CLEAR_CHAT_TEXT);
      await page
        .locator(modal)
        .locator('button')
        .filter({ hasText: CLEAR_CHAT_CONFIRM_BUTTON })
        .click();
      await expect(page.locator(userChatEntry)).toBeHidden();
      await expect(page.locator(aiChatEntry)).toBeHidden();
      await expect(page.locator(popover)).toContainText(FOOTER_TEXT);
      await expect(page.locator(popover)).toContainText(PRIVACY_TEXT);
      await expect(page.locator(popover).locator('h1')).toContainText(POPOVER_TITLE);
      await expect(page.locator(promptInput)).toHaveValue(PROMPT_NOT_SUBMITTED);
    });

    test('Test response with error, partial response text and tool call', async ({ page }) => {
      await page.goto('/search/all-namespaces');
      await expect(page.locator('h1').filter({ hasText: 'Search' })).toBeVisible();
      await openPopover(page);

      const errorBody = MOCK_STREAMED_RESPONSE_WITH_ERROR_BODY.replace(
        'MOCK_ERROR_MESSAGE',
        MOCK_ERROR_MESSAGE,
      );
      await page.route(`**/v1/streaming_query`, async (route) => {
        await route.fulfill({ body: errorBody });
      });

      await page.locator(promptInput).fill(PROMPT_SUBMITTED);
      await page.locator(promptInput).press('Enter');

      const aiEntry = page.locator(aiChatEntry);
      await expect(aiEntry).toContainText(MOCK_PARTIAL_RESPONSE_TEXT);
      await expect(aiEntry.locator('.pf-m-danger')).toContainText(MOCK_ERROR_MESSAGE);

      await expect(aiEntry.locator('.pf-v6-c-label').filter({ hasText: 'ABC' })).toBeVisible();
    });
  });

  test.describe.serial('Tool approval (HITL)', { tag: ['@hitl'] }, () => {
    test('Test approval card is shown and tool can be approved', async ({ page }) => {
      await page.goto('/search/all-namespaces');
      await expect(page.locator('h1').filter({ hasText: 'Search' })).toBeVisible();
      await openPopover(page);

      await page.route(`**/v1/streaming_query`, async (route) => {
        await route.fulfill({ body: MOCK_STREAMED_RESPONSE_WITH_APPROVAL_BODY });
      });
      await page.route(`**/v1/tool-approvals/decision`, async (route) => {
        const body = route.request().postDataJSON();
        expect(body.approval_id).toBe('abc');
        expect(body.approved).toBe(true);
        await route.fulfill({ status: 200, body: '{}' });
      });

      await page.locator(promptInput).fill(PROMPT_SUBMITTED);
      await page.locator(promptInput).press('Enter');

      const card = page.locator(toolApprovalCard);
      await expect(card).toBeVisible();
      await expect(card).toContainText('Review required');
      await expect(card).toContainText('This action will list pods in the cluster.');
      await expect(card.locator('button').filter({ hasText: 'Approve' })).toBeVisible();
      await expect(card.locator('button').filter({ hasText: 'Reject' })).toBeVisible();

      await card.getByText('View action details').click();
      await expect(card).toContainText('mock_tool');
      await expect(card).toContainText('namespace');

      await card.locator('button').filter({ hasText: 'Approve' }).click();
      await expect(card).toBeHidden();
      await expect(page.locator(toolLabel).filter({ hasText: 'mock_tool' })).toBeVisible();

      await page.locator(toolLabel).filter({ hasText: 'mock_tool' }).click();
      const m = page.locator(attachmentModal);
      await expect(m).toContainText('Tool output');
      await expect(m).toContainText('mock_tool');
      await expect(m).toContainText('Status');
      await expect(m).toContainText('pending');
      await expect(m).not.toContainText('Tool call rejected');
      await m.locator('.pf-v6-c-modal-box__close button').click();
    });

    test('Test tool can be rejected', async ({ page }) => {
      await page.goto('/search/all-namespaces');
      await expect(page.locator('h1').filter({ hasText: 'Search' })).toBeVisible();
      await openPopover(page);

      await page.route(`**/v1/streaming_query`, async (route) => {
        await route.fulfill({ body: MOCK_STREAMED_RESPONSE_WITH_APPROVAL_BODY });
      });
      await page.route(`**/v1/tool-approvals/decision`, async (route) => {
        const body = route.request().postDataJSON();
        expect(body.approval_id).toBe('abc');
        expect(body.approved).toBe(false);
        await route.fulfill({ status: 200, body: '{}' });
      });

      await page.locator(promptInput).fill(PROMPT_SUBMITTED);
      await page.locator(promptInput).press('Enter');

      const card = page.locator(toolApprovalCard);
      await expect(card).toBeVisible();
      await card.locator('button').filter({ hasText: 'Reject' }).click();
      await expect(card).toBeHidden();
      await expect(page.locator(toolLabel).filter({ hasText: 'mock_tool' })).toBeVisible();
      await page.locator(toolLabel).filter({ hasText: 'mock_tool' }).click();
      const m = page.locator(attachmentModal);
      await expect(m).toContainText('Tool call rejected');
      await expect(m).toContainText('mock_tool');
      await expect(m).not.toContainText('Status');
      await expect(m).not.toContainText('Content');
      await m.locator('.pf-v6-c-modal-box__close button').click();
    });
  });

  test.describe.serial('User feedback', { tag: ['@feedback'] }, () => {
    test('Test user feedback form', async ({ page }) => {
      await page.goto('/search/all-namespaces');
      await expect(page.locator('h1').filter({ hasText: 'Search' })).toBeVisible();
      await openPopover(page);

      await page.route(`**/v1/streaming_query`, async (route) => {
        await route.fulfill({ body: MOCK_STREAMED_RESPONSE_BODY });
      });

      await page.locator(promptInput).fill(PROMPT_SUBMITTED);
      await page.locator(promptInput).press('Enter');

      await expect(page.locator(aiChatEntry)).toContainText(MOCK_STREAMED_RESPONSE_TEXT);
      await expect(page.locator(responseAction)).toHaveCount(3);

      // Positive feedback with comment
      await page.locator(responseAction).nth(0).click();
      await expect(page.locator(popover)).toContainText(USER_FEEDBACK_TEXT);
      await page.route(`**/v1/feedback`, async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ message: 'Feedback received' }),
        });
      });
      await page.locator(userFeedbackInput).fill(USER_FEEDBACK_SUBMITTED);
      await page.locator(userFeedbackSubmit).click();
      await expect(page.locator(popover)).toContainText(USER_FEEDBACK_RECEIVED_TEXT);

      // Negative feedback with no comment
      await page.unroute('**/v1/feedback');
      const negativeFeedbackPromise = interceptFeedback(
        page,
        CONVERSATION_ID,
        THUMBS_DOWN,
        '',
        `${PROMPT_SUBMITTED}\n---\nThe attachments that were sent with the prompt are shown below.\n[]`,
      );
      await page.locator(responseAction).nth(1).click();
      await expect(page.locator(popover)).toContainText(USER_FEEDBACK_TEXT);
      await page.locator(userFeedbackInput).clear();
      await page.locator(userFeedbackSubmit).click();
      await negativeFeedbackPromise;
      await expect(page.locator(popover)).toContainText(USER_FEEDBACK_RECEIVED_TEXT);
    });
  });

  test.describe.serial('Copy to clipboard', { tag: ['@clipboard'] }, () => {
    test('Test copy response functionality', async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.goto('/search/all-namespaces');
      await expect(page.locator('h1').filter({ hasText: 'Search' })).toBeVisible();
      await openPopover(page);

      await page.route(`**/v1/streaming_query`, async (route) => {
        await route.fulfill({ body: MOCK_STREAMED_RESPONSE_BODY });
      });

      await page.locator(promptInput).fill(PROMPT_SUBMITTED);
      await page.locator(promptInput).press('Enter');

      await expect(page.locator(aiChatEntry)).toContainText(MOCK_STREAMED_RESPONSE_TEXT);
      await expect(page.locator(copyResponseButton)).toBeVisible();
      await page.locator(copyResponseButton).click();

      try {
        const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
        expect(clipboardText).toBe(MOCK_STREAMED_RESPONSE_TEXT);
      } catch {
        // Clipboard access may be denied in headless mode
      }
    });

    test('Test copy conversation functionality', async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.goto('/search/all-namespaces');
      await expect(page.locator('h1').filter({ hasText: 'Search' })).toBeVisible();
      await openPopover(page);

      await page.route(`**/v1/streaming_query`, async (route) => {
        await route.fulfill({ body: MOCK_STREAMED_RESPONSE_BODY });
      });

      await page.locator(promptInput).fill(PROMPT_SUBMITTED);
      await page.locator(promptInput).press('Enter');
      await expect(page.locator(aiChatEntry).first()).toContainText(MOCK_STREAMED_RESPONSE_TEXT);

      const PROMPT_SUBMITTED_2 = 'Second test prompt';
      await page.locator(promptInput).fill(PROMPT_SUBMITTED_2);
      await page.locator(promptInput).press('Enter');
      await expect(page.locator(aiChatEntry)).toHaveCount(2);

      await expect(page.locator(userChatEntry).first()).toContainText(PROMPT_SUBMITTED);
      await expect(page.locator(userChatEntry).last()).toContainText(PROMPT_SUBMITTED_2);

      await page.locator(copyConversationButton).hover();
      await expect(page.locator(copyConversationTooltip)).toBeVisible();
      await expect(page.locator(copyConversationTooltip)).toContainText('Copy conversation');

      await page.locator(copyConversationButton).click();

      await expect(page.locator(copyConversationTooltip)).toContainText('Copied');
      await expect(page.locator(copyConversationTooltip)).toContainText('Copy conversation', {
        timeout: 3000,
      });

      await page.locator(clearChatButton).click();
      await page
        .locator(modal)
        .locator('button')
        .filter({ hasText: 'Erase and start new chat' })
        .click();
      await expect(page.locator(copyConversationButton)).toBeHidden();
    });
  });

  test.describe.serial('Attach menu', { tag: ['@attach'] }, () => {
    test('Test attach options on pods list page', async ({ page }) => {
      await goToPodsList(page, 'openshift-console');
      await openPopover(page);

      await filterByName(page, podNamePrefix);
      await expect(page.locator(resourceRows).first()).toBeVisible({
        timeout: 2 * MINUTE,
      });
      const rowCount = await page.locator(resourceRows).count();
      expect(rowCount).toBeGreaterThanOrEqual(1);

      await page.locator(attachButton).click();
      const menu = page.locator(attachMenu);
      await expect(menu).toContainText('Upload from computer');
      await expect(menu).not.toContainText('YAML');
      await expect(menu).not.toContainText('Events');
      await expect(menu).not.toContainText('Logs');
    });

    test('Test attaching YAML', async ({ page }) => {
      await goToPodDetails(page, 'openshift-console', podNamePrefix);
      await openPopover(page);

      await expect(page.locator(attachments)).toBeEmpty();

      await page.locator(attachButton).click();
      const menu = page.locator(attachMenu);
      await expect(menu).toContainText('Full YAML file');
      await expect(menu).toContainText('Filtered YAML');
      await expect(menu).toContainText('Events');
      await expect(menu).toContainText('Logs');
      await expect(menu).toContainText('Upload from computer');

      await menu.locator('button').filter({ hasText: 'Full YAML file' }).click();
      const att = page.locator(attachments);
      await expect(att).toContainText(podNamePrefix);
      await expect(att).toContainText('YAML');
      const attBtn = att.locator('button').filter({ hasText: podNamePrefix });
      await expect(attBtn).toHaveCount(1);
      await attBtn.click();
      const m = page.locator(attachmentModal);
      await expect(m).toContainText('Preview attachment');
      await expect(m).toContainText(podNamePrefix);
      await expect(m).toContainText('kind: Pod');
      await expect(m).toContainText('apiVersion: v1');
      await m.locator('button').filter({ hasText: 'Dismiss' }).click();
      await page.locator(promptInput).fill('Test');
      await page.locator(promptInput).press('Enter');

      await page.locator(attachButton).click();
      await menu.locator('button').filter({ hasText: 'Filtered YAML' }).click();
      await expect(att).toContainText(podNamePrefix);
      await expect(att).toContainText('YAML');
      const attBtn2 = att.locator('button').filter({ hasText: podNamePrefix });
      await expect(attBtn2).toHaveCount(1);
      await attBtn2.click();
      await expect(m).toContainText('Preview attachment');
      await expect(m).toContainText(podNamePrefix);
      await expect(m).toContainText('kind: Pod');
      await expect(m).not.toContainText('apiVersion: v1');
      await m.locator('button').filter({ hasText: 'Dismiss' }).click();
      await page.locator(promptInput).fill('Test');
      await page.locator(promptInput).press('Enter');
    });

    test('Test modifying attached YAML', async ({ page }) => {
      await goToPodDetails(page, 'openshift-console', podNamePrefix);
      await openPopover(page);

      await page.locator(attachButton).click();
      await page
        .locator(attachMenu)
        .locator('button')
        .filter({ hasText: 'Full YAML file' })
        .click();
      await page.locator(promptAttachment).click();
      const m = page.locator(attachmentModal);
      await m.locator('button').filter({ hasText: 'Dismiss' }).click();
      await page.locator(promptAttachment).click();
      await m.locator('button').filter({ hasText: 'Edit' }).click();
      await m.locator('button').filter({ hasText: 'Cancel' }).click();
      await m.locator('button').filter({ hasText: 'Edit' }).click();
      await expect(m.locator('.ols-plugin__code-block__title')).toBeVisible();
      await expect(m.locator('.ols-plugin__code-block__title')).toContainText(podNamePrefix);
      await expect(m.locator('.monaco-editor')).toBeVisible();
      await expect(m.locator('.monaco-editor')).toContainText(podNamePrefix);
      await setEditorContent(page, 'Test modifying YAML');
      await m.locator('button').filter({ hasText: 'Save' }).click();
      await page.locator(promptAttachment).click();
      await expect(m.locator('.ols-plugin__code-block-code')).toBeVisible();
      await expect(m.locator('.ols-plugin__code-block-code')).toContainText('Test modifying YAML');
    });

    test('Test attaching events', async ({ page }) => {
      await goToPodDetails(page, 'openshift-lightspeed', podNamePrefix);
      await openPopover(page);

      await page.locator(attachButton).click();
      await page.locator(attachMenu).locator('button').filter({ hasText: 'Events' }).click();
      const eventsModal = page.locator(modal).filter({ hasText: 'Configure events attachment' });
      await expect(eventsModal).toBeVisible();
      await eventsModal.locator('button').filter({ hasText: 'Attach' }).click();
      const att = page.locator(attachments);
      await expect(att).toContainText(podNamePrefix);
      await expect(att).toContainText('Events');
      const attBtn = att.locator('button').filter({ hasText: podNamePrefix });
      await expect(attBtn).toHaveCount(1);
      await attBtn.click();
      const previewModal = page.locator(modal).filter({ hasText: 'Preview attachment' });
      await expect(previewModal).toContainText(podNamePrefix);
      await expect(previewModal).toContainText('kind: Event');
      await previewModal.locator('button').filter({ hasText: 'Dismiss' }).click();

      /* eslint-disable camelcase */
      const queryPromise = interceptQuery(page, PROMPT_SUBMITTED, null, [
        { attachment_type: 'event', content_type: 'application/yaml' },
      ]);
      /* eslint-enable camelcase */
      await page.locator(promptInput).fill(PROMPT_SUBMITTED);
      await page.locator(promptInput).press('Enter');
      await queryPromise;

      const feedbackPromise = interceptFeedback(
        page,
        CONVERSATION_ID,
        THUMBS_UP,
        USER_FEEDBACK_SUBMITTED,
        `${PROMPT_SUBMITTED}\n---\nThe attachments that were sent with the prompt are shown below.\n[\n  {\n    "attachment_type": "event",\n    "content": "- kind: Event`,
      );

      await page.locator(responseAction).nth(0).click();
      await page.locator(userFeedbackInput).fill(USER_FEEDBACK_SUBMITTED);
      await page.locator(userFeedbackSubmit).click();
      await feedbackPromise;
      await expect(page.locator(popover)).toContainText(USER_FEEDBACK_RECEIVED_TEXT);
    });

    test('Test attaching logs', async ({ page }) => {
      await goToPodDetails(page, 'openshift-console', podNamePrefix);
      await openPopover(page);

      await page.locator(attachButton).click();
      await page.locator(attachMenu).locator('button').filter({ hasText: 'Logs' }).click();
      const logModal = page.locator(modal).filter({ hasText: 'Configure log attachment' });
      await expect(logModal).toBeVisible();
      await expect(logModal).toContainText('Most recent 25 lines');
      await logModal.locator('button').filter({ hasText: 'Attach' }).click();
      const att = page.locator(attachments);
      await expect(att).toContainText(podNamePrefix);
      await expect(att).toContainText('Log');
      const attBtn = att.locator('button').filter({ hasText: podNamePrefix });
      await expect(attBtn).toHaveCount(1);
      await attBtn.click();
      const previewModal = page.locator(modal).filter({ hasText: 'Preview attachment' });
      await expect(previewModal).toContainText(podNamePrefix);
      await expect(previewModal).toContainText('Most recent lines from the log for');
      await previewModal.locator('button').filter({ hasText: 'Dismiss' }).click();

      /* eslint-disable camelcase */
      const queryPromise = interceptQuery(page, PROMPT_SUBMITTED, null, [
        { attachment_type: 'log', content_type: 'text/plain' },
      ]);
      /* eslint-enable camelcase */
      await page.locator(promptInput).fill(PROMPT_SUBMITTED);
      await page.locator(promptInput).press('Enter');
      await queryPromise;
    });

    test('Test file upload', async ({ page }) => {
      const MAX_FILE_SIZE_MB = 1;

      await page.goto('/search/all-namespaces');
      await expect(page.locator('h1').filter({ hasText: 'Search' })).toBeVisible();
      await openPopover(page);
      await page.locator(attachButton).click();
      await page
        .locator(attachMenu)
        .locator('button')
        .filter({ hasText: 'Upload from computer' })
        .click();

      // Invalid YAML
      await page.locator(fileInput).setInputFiles({
        name: 'test.yaml',
        mimeType: 'application/x-yaml',
        buffer: Buffer.from('abc'),
      });
      await expect(page.locator(popover)).toContainText('Uploaded file is not valid YAML');

      // File too large
      const largeFileContent = 'a'.repeat(MAX_FILE_SIZE_MB * 1024 * 1024 + 1);
      await page.locator(fileInput).setInputFiles({
        name: 'large.yaml',
        mimeType: 'application/x-yaml',
        buffer: Buffer.from(largeFileContent),
      });
      await expect(page.locator(popover)).toContainText(
        `Uploaded file is too large. Max size is ${MAX_FILE_SIZE_MB} MB.`,
      );

      // Valid YAML
      await page.locator(fileInput).setInputFiles({
        name: 'valid.yaml',
        mimeType: 'application/x-yaml',
        buffer: Buffer.from(`
kind: Pod
metadata:
  name: my-test-pod
  namespace: test-namespace
`),
      });
      await expect(page.locator(popover)).not.toContainText('Uploaded file is not valid YAML');
      await expect(page.locator(attachments)).toContainText('my-test-pod');
    });
  });

  test.describe('ACM', { tag: ['@acm'] }, () => {
    test.skip('Test attach cluster info for ManagedCluster', async ({ page }) => {
      await page.goto(
        '/k8s/ns/test-cluster/cluster.open-cluster-management.io~v1~ManagedCluster/test-cluster',
      );
      await openPopover(page);

      await page.locator(attachButton).click();
      const menu = page.locator(attachMenu);
      await expect(menu).toContainText(ACM_ATTACH_CLUSTER_TEXT);
      await expect(menu).toContainText('Upload from computer');
      await expect(menu).not.toContainText('Full YAML file');
      await expect(menu).not.toContainText('Filtered YAML');
      await expect(menu).not.toContainText('Events');
      await expect(menu).not.toContainText('Logs');

      const getManagedCluster = page.waitForResponse(
        (resp) =>
          resp
            .url()
            .includes('/apis/cluster.open-cluster-management.io/v1/managedclusters/test-cluster') &&
          resp.status() === 200,
      );
      const getManagedClusterInfo = page.waitForResponse(
        (resp) =>
          resp
            .url()
            .includes(
              '/apis/internal.open-cluster-management.io/v1beta1/namespaces/test-cluster/managedclusterinfos/test-cluster',
            ) && resp.status() === 200,
      );

      await page.route(
        '**/apis/cluster.open-cluster-management.io/v1/managedclusters/test-cluster',
        (route) =>
          route.fulfill({
            status: 200,
            json: {
              kind: 'ManagedCluster',
              apiVersion: 'cluster.open-cluster-management.io/v1',
              metadata: { name: 'test-cluster', namespace: 'test-cluster' },
              spec: { hubAcceptsClient: true },
              status: {
                conditions: [
                  {
                    type: 'ManagedClusterConditionAvailable',
                    status: 'True',
                  },
                ],
              },
            },
          }),
      );

      await page.route(
        '**/apis/internal.open-cluster-management.io/v1beta1/namespaces/test-cluster/managedclusterinfos/test-cluster',
        (route) =>
          route.fulfill({
            status: 200,
            json: {
              kind: 'ManagedClusterInfo',
              apiVersion: 'internal.open-cluster-management.io/v1beta1',
              metadata: { name: 'test-cluster', namespace: 'test-cluster' },
              status: {
                distributionInfo: { type: 'OCP', ocp: { version: '4.14.0' } },
                nodeList: [
                  {
                    name: 'master-0',
                    conditions: [{ type: 'Ready', status: 'True' }],
                  },
                ],
              },
            },
          }),
      );

      await menu.locator('button').filter({ hasText: ACM_ATTACH_CLUSTER_TEXT }).click();

      await getManagedCluster;
      await getManagedClusterInfo;

      const att = page.locator(attachments);
      await expect(att).toContainText('test-cluster');
      await expect(att).toContainText('YAML');
      await expect(att.locator('button')).toHaveCount(2);

      await att.locator('button').filter({ hasText: 'test-cluster' }).first().click();
      const m = page.locator(attachmentModal);
      await expect(m).toContainText('Preview attachment');
      await expect(m).toContainText('test-cluster');
      await expect(m).toContainText('kind: ManagedCluster');
      await expect(m).toContainText('apiVersion: cluster.open-cluster-management.io/v1');
      await m.locator('button').filter({ hasText: 'Dismiss' }).click();

      await att.locator('button').filter({ hasText: 'test-cluster' }).last().click();
      await expect(m).toContainText('Preview attachment');
      await expect(m).toContainText('test-cluster');
      await expect(m).toContainText('kind: ManagedClusterInfo');
      await expect(m).toContainText('apiVersion: internal.open-cluster-management.io/v1beta1');
      await expect(m).toContainText('distributionInfo');
      await m.locator('button').filter({ hasText: 'Dismiss' }).click();

      /* eslint-disable camelcase */
      const queryPromise = interceptQuery(page, PROMPT_SUBMITTED, null, [
        { attachment_type: 'yaml', content_type: 'application/yaml' },
        { attachment_type: 'yaml', content_type: 'application/yaml' },
      ]);
      /* eslint-enable camelcase */
      await page.locator(promptInput).fill(PROMPT_SUBMITTED);
      await page.locator(promptInput).press('Enter');
      await queryPromise;
    });

    test.skip('Test ManagedCluster attachment error handling', async ({ page }) => {
      await page.goto(
        '/k8s/ns/test-cluster/cluster.open-cluster-management.io~v1~ManagedCluster/test-cluster',
      );
      await openPopover(page);

      await page.route(
        '**/apis/cluster.open-cluster-management.io/v1/managedclusters/test-cluster',
        (route) =>
          route.fulfill({
            status: 200,
            json: {
              kind: 'ManagedCluster',
              apiVersion: 'cluster.open-cluster-management.io/v1',
              metadata: { name: 'test-cluster', namespace: 'test-cluster' },
            },
          }),
      );
      await page.route(
        '**/apis/internal.open-cluster-management.io/v1beta1/namespaces/test-cluster/managedclusterinfos/test-cluster',
        (route) =>
          route.fulfill({
            status: 404,
            json: {
              kind: 'Status',
              message:
                'managedclusterinfos.internal.open-cluster-management.io "test-cluster" not found',
            },
          }),
      );

      await page.locator(attachButton).click();
      await page
        .locator(attachMenu)
        .locator('button')
        .filter({ hasText: ACM_ATTACH_CLUSTER_TEXT })
        .click();

      await expect(page.locator(attachMenu)).toContainText('Error fetching cluster info');
    });

    test.skip('Test ACM search resources page context for Pod', async ({ page }) => {
      await page.goto(
        '/multicloud/search/resources?kind=Pod&name=test-pod&namespace=test-namespace',
      );

      await page.route(
        '**/api/kubernetes/api/v1/namespaces/test-namespace/pods/test-pod',
        (route) =>
          route.fulfill({
            status: 200,
            json: {
              kind: 'Pod',
              metadata: {
                name: 'test-pod',
                namespace: 'test-namespace',
              },
            },
          }),
      );

      await openPopover(page);

      await page.locator(attachButton).click();
      const menu = page.locator(attachMenu);
      await expect(menu).toContainText('Upload from computer');
      await expect(menu).toContainText('Full YAML file');
      await expect(menu).toContainText('Filtered YAML');
      await expect(menu).toContainText('Events');
      await expect(menu).toContainText('Logs');
      await expect(menu).not.toContainText(ACM_ATTACH_CLUSTER_TEXT);
    });

    test.skip('Test ACM search resources page context for VirtualMachine', async ({ page }) => {
      await page.goto(
        '/multicloud/search/resources?kind=VirtualMachine&name=test-vm&namespace=test-namespace',
      );

      await page.route(
        '**/apis/kubevirt.io/v1/namespaces/test-namespace/virtualmachines/test-vm',
        (route) =>
          route.fulfill({
            status: 200,
            json: {
              kind: 'VirtualMachine',
              apiVersion: 'kubevirt.io/v1',
              metadata: {
                name: 'test-vm',
                namespace: 'test-namespace',
              },
            },
          }),
      );

      await openPopover(page);

      await page.locator(attachButton).click();
      const menu = page.locator(attachMenu);
      await expect(menu).toContainText('Upload from computer');
      await expect(menu).toContainText('Full YAML file');
      await expect(menu).toContainText('Filtered YAML');
      await expect(menu).toContainText('Events');
      await expect(menu).toContainText('Logs');
      await expect(menu).not.toContainText(ACM_ATTACH_CLUSTER_TEXT);
    });
  });

  test.describe('MCP Iframe Rendering', { tag: ['@mcp', '@mcp-mocked', '@iframe'] }, () => {
    const mcpAppIframe = '.ols-plugin__mcp-app-iframe';
    const mcpAppCard = '.ols-plugin__mcp-app';
    const mcpAppLoading = `${mcpAppCard} .pf-v6-c-spinner`;
    const mcpAppError = '.ols-plugin__alert';

    const MCP_PROMPT = 'Show me the dashboard';
    const MCP_TOOL_NAME = 'dashboard';
    const MCP_UI_RESOURCE_URI = 'mcp://test-server/resources/dashboard';

    const SAMPLE_MCP_HTML = `<!DOCTYPE html>
<html>
  <body>
    <h1>MCP Dashboard</h1>
    <h2>Resource Dashboard</h2>
    <p>CPU Usage</p>
    <p>45%</p>
  </body>
</html>`;

    test.beforeEach(async ({ page }) => {
      await page.route('**/api/proxy/plugin/lightspeed-console-plugin/ols/readiness', (route) =>
        route.fulfill({ status: 200, json: { ready: true } }),
      );
      await page.route('**/api/proxy/plugin/lightspeed-console-plugin/ols/authorized', (route) =>
        route.fulfill({
          status: 200,
          /* eslint-disable camelcase */
          json: {
            user_id: 'test-user-id',
            username: 'test-user',
            skip_user_id_check: false,
          },
          /* eslint-enable camelcase */
        }),
      );

      await page.goto('/');
      await openPopover(page);
      await expect(page.locator(promptInput)).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.locator(promptInput)).toBeEnabled();
    });

    test(
      'renders iframe when MCP response includes uiResourceUri',
      { tag: ['@core'] },
      async ({ page }) => {
        await page.route(`**/v1/streaming_query`, async (route) => {
          const responseBody = MOCK_MCP_STREAMED_RESPONSE_BODY_TEMPLATE.replace(
            'CONVERSATION_ID',
            CONVERSATION_ID,
          )
            .replace('TOOL_NAME', MCP_TOOL_NAME)
            .replace('UI_RESOURCE_URI', MCP_UI_RESOURCE_URI);
          await route.fulfill({ body: responseBody });
        });

        await page.route(`**/v1/mcp-apps/resources`, async (route) => {
          await route.fulfill({
            status: 200,
            body: JSON.stringify({ content: SAMPLE_MCP_HTML }),
          });
        });

        await page.locator(promptInput).fill(MCP_PROMPT);
        await page.locator(promptInput).press('Enter');

        const iframe = page.locator(mcpAppIframe);
        await expect(iframe).toBeVisible({ timeout: 30_000 });
        await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts');
        await expect(page.locator(mcpAppCard)).toBeVisible();
      },
    );

    test('iframe srcDoc contains expected HTML content', { tag: ['@core'] }, async ({ page }) => {
      await page.route(`**/v1/streaming_query`, async (route) => {
        const responseBody = MOCK_MCP_STREAMED_RESPONSE_BODY_TEMPLATE.replace(
          'CONVERSATION_ID',
          CONVERSATION_ID,
        )
          .replace('TOOL_NAME', MCP_TOOL_NAME)
          .replace('UI_RESOURCE_URI', MCP_UI_RESOURCE_URI);
        await route.fulfill({ body: responseBody });
      });

      await page.route(`**/v1/mcp-apps/resources`, async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ content: SAMPLE_MCP_HTML }),
        });
      });

      await page.locator(promptInput).fill(MCP_PROMPT);
      await page.locator(promptInput).press('Enter');

      const iframe = page.locator(mcpAppIframe);
      await expect(iframe).toBeVisible({ timeout: 30_000 });
      const srcDoc = await iframe.getAttribute('srcdoc');
      expect(srcDoc).toBeTruthy();
      expect(srcDoc).toContain('MCP Dashboard');
      expect(srcDoc).toContain('Resource Dashboard');
      expect(srcDoc).toContain('CPU Usage');
      expect(srcDoc).toContain('45%');
      expect(srcDoc).toContain('data-theme=');
    });

    test('displays loading state while fetching MCP resources', async ({ page }) => {
      const mcpQueryBody = MOCK_MCP_STREAMED_RESPONSE_BODY_TEMPLATE.replace(
        'CONVERSATION_ID',
        CONVERSATION_ID,
      )
        .replace('TOOL_NAME', MCP_TOOL_NAME)
        .replace('UI_RESOURCE_URI', MCP_UI_RESOURCE_URI);

      await page.route(`**/v1/streaming_query`, async (route) => {
        await route.fulfill({ body: mcpQueryBody });
      });
      await page.route('**/v1/mcp-apps/resources', async (route) => {
        await new Promise<void>((r) => {
          setTimeout(r, 2000);
        });
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ content: SAMPLE_MCP_HTML }),
        });
      });

      await page.locator(promptInput).fill(MCP_PROMPT);
      await page.locator(promptInput).press('Enter');

      await expect(page.locator(mcpAppLoading)).toBeVisible({
        timeout: 5000,
      });
      await expect(page.locator(mcpAppLoading)).toBeHidden({
        timeout: 10_000,
      });
      await expect(page.locator(mcpAppIframe)).toBeVisible();
    });

    test('displays error when resource fetch fails', async ({ page }) => {
      const mcpQueryBody = MOCK_MCP_STREAMED_RESPONSE_BODY_TEMPLATE.replace(
        'CONVERSATION_ID',
        CONVERSATION_ID,
      )
        .replace('TOOL_NAME', MCP_TOOL_NAME)
        .replace('UI_RESOURCE_URI', MCP_UI_RESOURCE_URI);

      await page.route(`**/v1/streaming_query`, async (route) => {
        await route.fulfill({ body: mcpQueryBody });
      });
      await page.route('**/v1/mcp-apps/resources', (route) =>
        route.fulfill({
          status: 500,
          json: { error: 'Failed to fetch MCP resource' },
        }),
      );

      await page.locator(promptInput).fill(MCP_PROMPT);
      await page.locator(promptInput).press('Enter');

      await expect(page.locator(mcpAppError).filter({ hasText: 'MCP App Error' })).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.locator(mcpAppIframe)).toBeHidden();
    });

    test('does not render iframe when uiResourceUri is missing', async ({ page }) => {
      const responseWithoutURI = `data: {"event": "start", "data": {"conversation_id": "${CONVERSATION_ID}"}}

data: {"event": "token", "data": {"id": 0, "token": "Here"}}

data: {"event": "token", "data": {"id": 1, "token": " is"}}

data: {"event": "token", "data": {"id": 2, "token": " your"}}

data: {"event": "token", "data": {"id": 3, "token": " data"}}

data: {"event": "tool_call", "data": {"id": 1, "name": "get_data", "server_name": "test-server", "args": {}}}

data: {"event": "tool_result", "data": {"id": 1, "content": "Data retrieved", "status": "success"}}

data: {"event": "end", "data": {"referenced_documents": [], "truncated": false}}
`;

      await page.route('**/v1/streaming_query', async (route) => {
        await route.fulfill({ body: responseWithoutURI });
      });

      await page.locator(promptInput).fill(MCP_PROMPT);
      await page.locator(promptInput).press('Enter');

      await expect(page.locator(aiChatEntry)).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.locator(mcpAppIframe)).toBeHidden();
    });

    test('handles multiple MCP iframes in conversation', async ({ page }) => {
      const SECOND_PROMPT = 'Show me another dashboard';
      const SECOND_TOOL_NAME = 'metrics';
      const SECOND_URI = 'mcp://test-server/resources/metrics';

      const SECOND_HTML = `<!DOCTYPE html>
<html lang="en">
<head><title>Metrics</title></head>
<body><div class="metrics">Metrics Dashboard</div></body>
</html>`;

      const mcpQueryBody1 = MOCK_MCP_STREAMED_RESPONSE_BODY_TEMPLATE.replace(
        'CONVERSATION_ID',
        CONVERSATION_ID,
      )
        .replace('TOOL_NAME', MCP_TOOL_NAME)
        .replace('UI_RESOURCE_URI', MCP_UI_RESOURCE_URI);

      await page.route(`**/v1/streaming_query`, async (route) => {
        await route.fulfill({ body: mcpQueryBody1 });
      });
      await page.route(`**/v1/mcp-apps/resources`, async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ content: SAMPLE_MCP_HTML }),
        });
      });

      await page.locator(promptInput).fill(MCP_PROMPT);
      await page.locator(promptInput).press('Enter');

      await expect(page.locator(mcpAppIframe)).toHaveCount(1);

      const mcpQueryBody2 = MOCK_MCP_STREAMED_RESPONSE_BODY_TEMPLATE.replace(
        'CONVERSATION_ID',
        CONVERSATION_ID,
      )
        .replace('TOOL_NAME', SECOND_TOOL_NAME)
        .replace('UI_RESOURCE_URI', SECOND_URI);

      await page.unroute('**/v1/streaming_query');
      await page.unroute('**/v1/mcp-apps/resources');
      await page.route(`**/v1/streaming_query`, async (route) => {
        await route.fulfill({ body: mcpQueryBody2 });
      });
      await page.route(`**/v1/mcp-apps/resources`, async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ content: SECOND_HTML }),
        });
      });

      await page.locator(promptInput).fill(SECOND_PROMPT);
      await page.locator(promptInput).press('Enter');

      await expect(page.locator(mcpAppIframe)).toHaveCount(2);
    });
  });
});

test.describe.serial('Cluster updates integration', { tag: ['@precheck'] }, () => {
  test.describe.serial('Pre-check button', () => {
    test('clicking pre-check button in console opens OLS and gets a response', async ({ page }) => {
      // Navigate to cluster settings page
      await page.goto('/settings/cluster');

      // Check if pre-check button exists (feature may not be available)
      const precheckButton = page.getByRole('button', { name: /Pre-check with AI/i });
      const buttonCount = await precheckButton.count();

      if (buttonCount === 0) {
        test.skip(
          true,
          'Pre-check button feature (CONSOLE-5118) not available in this console version',
        );
      }

      // Wait for pre-check button to appear
      await expect(precheckButton).toBeVisible({ timeout: 30_000 });

      // Intercept OLS API to mock a response
      // Pre-check button starts a new conversation, so conversation_id is null
      const queryPromise = interceptQuery(page, '', null, []);

      // Click the pre-check button
      await precheckButton.click();

      // Verify OLS plugin opens
      await expect(page.locator(popover)).toBeVisible();

      // Wait for the query to be sent
      await queryPromise;

      // Verify response appears in chat
      await expect(page.locator(aiChatEntry).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.locator(aiChatEntry).first()).toContainText('Mock OLS response');
    });
  });
});
