// @vitest-environment jsdom
import * as React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AttachmentTypes } from '../src/attachments';
import AttachmentLabel from '../src/components/AttachmentLabel';
import { Attachment } from '../src/types';
import { renderWithStore } from './test-utils';

const attachment: Attachment = {
  attachmentType: AttachmentTypes.YAML,
  kind: 'Pod',
  name: 'my-pod',
  namespace: 'my-namespace',
  value: 'kind: Pod',
};

// The tooltip listens for mouseenter, which doesn't bubble, on the outer label element
const hoverLabel = () =>
  fireEvent.mouseEnter(screen.getByText('my-pod').closest('.ols-plugin__context-label'));

describe('AttachmentLabel', () => {
  it('renders nothing when there is no attachment', () => {
    const { container } = renderWithStore(<AttachmentLabel attachment={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the resource name, icon and attachment type', () => {
    renderWithStore(<AttachmentLabel attachment={attachment} />);
    expect(screen.getByText('my-pod')).toBeVisible();
    expect(screen.getByTestId('resource-icon')).toHaveTextContent('Pod');
    expect(screen.getByText(AttachmentTypes.YAML)).toBeVisible();
  });

  it('uses the AL icon and hides the attachment type for alerts', () => {
    renderWithStore(
      <AttachmentLabel attachment={{ ...attachment, kind: 'Alert', name: 'MyAlert' }} />,
    );
    expect(screen.getByTestId('resource-icon')).toHaveTextContent('AL');
    expect(screen.queryByText(AttachmentTypes.YAML)).not.toBeInTheDocument();
  });

  it('shows the attachment size in the tooltip', async () => {
    renderWithStore(<AttachmentLabel attachment={{ ...attachment, value: 'x'.repeat(1234) }} />);
    hoverLabel();
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      `Preview attachment (${(1234).toLocaleString()} characters)`,
    );
  });

  it('indicates in the tooltip when the attachment has been modified', async () => {
    renderWithStore(
      <AttachmentLabel attachment={{ ...attachment, originalValue: 'kind: Deployment' }} />,
    );
    hoverLabel();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Preview attachment - modified');
  });

  [true, false].forEach((isEditable) => {
    it(`opens the attachment with isEditable=${isEditable} when clicked`, () => {
      const { store } = renderWithStore(
        <AttachmentLabel attachment={attachment} isEditable={isEditable} />,
      );
      fireEvent.click(screen.getByRole('button', { name: /my-pod/ }));
      expect(store.getState().plugins.ols.get('openAttachment')).toEqual({
        ...attachment,
        isEditable,
      });
    });
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    renderWithStore(<AttachmentLabel attachment={attachment} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has no close button when onClose is not provided', () => {
    renderWithStore(<AttachmentLabel attachment={attachment} />);
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
  });
});
