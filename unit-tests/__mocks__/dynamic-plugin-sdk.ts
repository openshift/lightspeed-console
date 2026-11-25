import * as React from 'react';
import { vi } from 'vitest';

// Stands in for the console SDK, which is only available inside the console. Tests can override
// the return value of any vi.fn() here with vi.mocked(...).
export const useK8sModels = vi.fn().mockReturnValue([{}, false]);

export const ResourceIcon = ({ kind }: { kind: string }): React.ReactElement =>
  React.createElement('span', { 'data-test': 'resource-icon' }, kind);
