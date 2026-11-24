import DOMPurify from 'dompurify';
import { Marked } from 'marked';

// Render task list checkboxes as text so form controls can stay off the allow list
const marked = new Marked({
  renderer: { checkbox: ({ checked }) => (checked ? '☑ ' : '☐ ') },
});

// The HTML is rendered wherever the user pastes it, so only keep tags and attributes that can't
// load external resources or otherwise act on their own. An explicit allow list means attributes
// DOMPurify adds to its defaults in future releases aren't picked up on upgrade.
const purifyConfig = {
  ALLOW_ARIA_ATTR: false,
  ALLOW_DATA_ATTR: false,
  ALLOWED_ATTR: ['align', 'href', 'open', 'start', 'title'],
  ALLOWED_TAGS: [
    'a',
    'b',
    'blockquote',
    'br',
    'caption',
    'code',
    'dd',
    'del',
    'details',
    'div',
    'dl',
    'dt',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'i',
    'ins',
    'kbd',
    'li',
    'mark',
    'ol',
    'p',
    'pre',
    's',
    'samp',
    'small',
    'strong',
    'sub',
    'summary',
    'sup',
    'table',
    'tbody',
    'td',
    'tfoot',
    'th',
    'thead',
    'tr',
    'u',
    'ul',
    'var',
  ],
};

const canWriteHtml = (): boolean =>
  typeof ClipboardItem !== 'undefined' &&
  typeof ClipboardItem.supports === 'function' &&
  ClipboardItem.supports('text/html') &&
  typeof navigator.clipboard?.write === 'function';

export const markdownToClipboardHtml = (markdown: string): string =>
  DOMPurify.sanitize(marked.parse(markdown, { async: false }), purifyConfig);

export const copyToClipboard = async (text: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to copy to clipboard: ', err);
  }
};

export const copyMarkdownToClipboard = async (markdown: string): Promise<void> => {
  if (canWriteHtml()) {
    try {
      const html = markdownToClipboardHtml(markdown);
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([markdown], { type: 'text/plain' }),
        }),
      ]);
      return;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Rich clipboard write failed, falling back to plain text: ', err);
    }
  }
  await copyToClipboard(markdown);
};
