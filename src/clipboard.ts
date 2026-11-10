import DOMPurify from 'dompurify';
import { marked } from 'marked';

const canWriteHtml = (): boolean =>
  typeof ClipboardItem !== 'undefined' &&
  typeof ClipboardItem.supports === 'function' &&
  ClipboardItem.supports('text/html') &&
  typeof navigator.clipboard?.write === 'function';

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
      const html = DOMPurify.sanitize(marked.parse(markdown) as string);
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
