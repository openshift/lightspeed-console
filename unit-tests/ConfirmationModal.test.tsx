// @vitest-environment jsdom
import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ConfirmationModal from '../src/components/ConfirmationModal';

describe('ConfirmationModal', () => {
  it('asks the user whether to leave the page', () => {
    render(<ConfirmationModal handleRedirect={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByText('Do you want to leave this page?')).toBeVisible();
    expect(screen.getByText('Changes you made may not be saved.')).toBeVisible();
  });

  it('has no close button', () => {
    render(<ConfirmationModal handleRedirect={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
  });

  ['Leave', 'Stay'].forEach((label) => {
    it(`calls handleRedirect when ${label} is clicked`, () => {
      // React clears currentTarget after the handler returns, so read the ID inside the handler
      const clickedIDs: string[] = [];
      const handleRedirect = vi.fn((e: React.MouseEvent<HTMLButtonElement>) => {
        clickedIDs.push(e.currentTarget.id);
      });
      render(<ConfirmationModal handleRedirect={handleRedirect} />);
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(clickedIDs).toEqual([label.toLowerCase()]);
    });
  });
});
