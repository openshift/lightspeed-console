// @vitest-environment jsdom
import * as React from 'react';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import OlsToolUIs from '../src/components/OlsToolUIs';
import { chatHistoryPush, chatHistoryUpdateTool } from '../src/redux-actions';
import { renderWithStore } from './test-utils';

// The tool UI mapping depends on console extensions, which only exist inside
// the console; mock the hook and control the mapping per test.
const toolUIMapping: Record<string, unknown> = {};
vi.mock('../src/hooks/useToolUIMapping', () => ({
  useToolUIMapping: () => [toolUIMapping, true],
}));

const pushEntryWithTool = (toolID: string, tool: Record<string, unknown>) => {
  const entryID = 'entry-1';
  return [
    chatHistoryPush({
      id: entryID,
      isCancelled: false,
      isStreaming: false,
      isTruncated: false,
      who: 'ai',
    }),
    chatHistoryUpdateTool(entryID, toolID, tool),
  ];
};

const baseTool = {
  args: {},
  content: '{}',
  name: 'show_timeseries',
  status: 'success',
};

describe('OlsToolUIs', () => {
  it('renders the tool UI component when the extension resolves', () => {
    const ToolComponent = (): React.ReactElement => <div data-test="resolved-tool-ui" />;
    toolUIMapping['mcp-obs/show-timeseries'] = ToolComponent;

    renderWithStore(<OlsToolUIs entryIndex={0} />, {
      actions: pushEntryWithTool('tool-1', {
        ...baseTool,
        olsToolUiID: 'mcp-obs/show-timeseries',
      }),
    });

    expect(screen.getByTestId('resolved-tool-ui')).toBeInTheDocument();
    expect(
      screen.queryByText('Chart rendering is not supported in this version of OpenShift'),
    ).not.toBeInTheDocument();
  });

  it('renders the unsupported notice for a successful tool whose UI cannot resolve', () => {
    // No extension registered, e.g. a console whose monitoring plugin does
    // not ship the ols.tool-ui extension.
    delete toolUIMapping['mcp-obs/show-timeseries'];

    renderWithStore(<OlsToolUIs entryIndex={0} />, {
      actions: pushEntryWithTool('tool-1', {
        ...baseTool,
        olsToolUiID: 'mcp-obs/show-timeseries',
      }),
    });

    expect(
      screen.getByText('Chart rendering is not supported in this version of OpenShift'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('resolved-tool-ui')).not.toBeInTheDocument();
  });

  it('renders nothing for an errored tool even when the UI cannot resolve', () => {
    delete toolUIMapping['mcp-obs/show-timeseries'];

    renderWithStore(<OlsToolUIs entryIndex={0} />, {
      actions: pushEntryWithTool('tool-1', {
        ...baseTool,
        status: 'error',
        olsToolUiID: 'mcp-obs/show-timeseries',
      }),
    });

    expect(
      screen.queryByText('Chart rendering is not supported in this version of OpenShift'),
    ).not.toBeInTheDocument();
  });

  it('renders nothing for tools without a tool UI ID', () => {
    renderWithStore(<OlsToolUIs entryIndex={0} />, {
      actions: pushEntryWithTool('tool-1', baseTool),
    });

    expect(screen.queryByTestId('resolved-tool-ui')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Chart rendering is not supported in this version of OpenShift'),
    ).not.toBeInTheDocument();
  });

  it('renders nothing when the chat entry has no tools', () => {
    const { container } = renderWithStore(<OlsToolUIs entryIndex={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
