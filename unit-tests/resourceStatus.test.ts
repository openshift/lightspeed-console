import { describe, it } from 'node:test';
import { strictEqual } from 'node:assert';

import { getResourceStatusSummary } from '../src/resourceStatus';

describe('getResourceStatusSummary', () => {
  it('uses Ready condition for operator CRDs', () => {
    const summary = getResourceStatusSummary('FlowCollector', {
      status: {
        conditions: [{ type: 'Ready', status: 'True', reason: 'Ready' }],
      },
    });
    strictEqual(summary.label, 'Ready');
    strictEqual(summary.variant, 'success');
  });

  it('surfaces Degraded conditions as danger', () => {
    const summary = getResourceStatusSummary('FlowCollector', {
      status: {
        conditions: [{ type: 'Degraded', status: 'True', reason: 'LokiNotReady' }],
      },
    });
    strictEqual(summary.label, 'LokiNotReady');
    strictEqual(summary.variant, 'danger');
  });
});
