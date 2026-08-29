import { describe, it } from 'node:test';
import { strictEqual } from 'node:assert';

import { getGenericResourceStatus } from '../src/crStatus';

const csvStatus = {
  phase: 'Succeeded',
  reason: 'InstallSucceeded',
  message: 'install strategy completed with no errors',
  conditions: [
    {
      lastTransitionTime: '2026-06-30T08:47:39Z',
      message: 'requirements not yet checked',
      phase: 'Pending',
      reason: 'RequirementsUnknown',
    },
    {
      lastTransitionTime: '2026-06-30T09:11:07Z',
      message: 'install strategy completed with no errors',
      phase: 'Succeeded',
      reason: 'InstallSucceeded',
    },
  ],
};

describe('getGenericResourceStatus', () => {
  it('prefers top-level phase over historical conditions', () => {
    const summary = getGenericResourceStatus({ status: csvStatus });
    strictEqual(summary.label, 'Succeeded (InstallSucceeded)');
    strictEqual(summary.variant, 'success');
  });

  it('uses standard Ready conditions for kubebuilder CRDs', () => {
    const summary = getGenericResourceStatus({
      status: {
        conditions: [{ type: 'Ready', status: 'True', reason: 'Ready' }],
      },
    });
    strictEqual(summary.label, 'Ready');
    strictEqual(summary.variant, 'success');
  });

  it('uses latest phase condition when only OLM-style conditions exist', () => {
    const summary = getGenericResourceStatus({
      status: {
        conditions: [
          {
            lastTransitionTime: '2026-06-30T08:47:39Z',
            phase: 'Pending',
            reason: 'RequirementsUnknown',
          },
          {
            lastTransitionTime: '2026-06-30T09:06:44Z',
            phase: 'Failed',
            reason: 'ComponentUnhealthy',
          },
        ],
      },
    });
    strictEqual(summary.label, 'Failed (ComponentUnhealthy)');
    strictEqual(summary.variant, 'danger');
  });

  it('prefers Degraded over Available when both are True', () => {
    const summary = getGenericResourceStatus({
      status: {
        conditions: [
          { type: 'Available', status: 'True', reason: 'MinimumReplicasAvailable' },
          { type: 'Degraded', status: 'True', reason: 'RolloutStalled' },
        ],
      },
    });
    strictEqual(summary.label, 'RolloutStalled');
    strictEqual(summary.variant, 'danger');
  });
});
