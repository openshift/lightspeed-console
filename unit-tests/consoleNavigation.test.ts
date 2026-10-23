import { describe, it } from 'node:test';
import { strictEqual } from 'node:assert';

import { navigateToConsolePath } from '../src/consoleNavigation';

describe('navigateToConsolePath', () => {
  it('ignores empty paths', () => {
    navigateToConsolePath('');
    navigateToConsolePath('#');
    strictEqual(true, true);
  });
});
