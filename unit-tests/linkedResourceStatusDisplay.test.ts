import { describe, it } from 'node:test';
import { deepStrictEqual, strictEqual } from 'node:assert';

import {
  getLinkedResourceStatusDisplay,
  toConsoleStatusKey,
  usesConsoleStatusIcon,
} from '../src/linkedResourceStatusDisplay';

describe('usesConsoleStatusIcon', () => {
  it('returns true for built-in Pod', () => {
    strictEqual(usesConsoleStatusIcon('Pod', 'Pod'), true);
  });

  it('returns false for CRD model keys', () => {
    strictEqual(
      usesConsoleStatusIcon('FlowCollector', 'flows.netobserv.io~v1beta2~FlowCollector'),
      false,
    );
  });

  it('returns false for HPA', () => {
    strictEqual(usesConsoleStatusIcon('HorizontalPodAutoscaler', 'HorizontalPodAutoscaler'), false);
  });
});

describe('toConsoleStatusKey', () => {
  it('maps pod phases with icons', () => {
    deepStrictEqual(toConsoleStatusKey({ label: 'Running', variant: 'success' }, 'Pod'), {
      status: 'Running',
      useIcon: true,
    });
    deepStrictEqual(toConsoleStatusKey({ label: 'Failed', variant: 'danger' }, 'Pod'), {
      status: 'Failed',
      useIcon: true,
    });
  });

  it('maps container reasons with icons', () => {
    deepStrictEqual(toConsoleStatusKey({ label: 'CrashLoopBackOff', variant: 'danger' }, 'Pod'), {
      status: 'CrashLoopBackOff',
      useIcon: true,
    });
  });

  it('maps replica counts to console workload icons', () => {
    deepStrictEqual(toConsoleStatusKey({ label: '1/1 ready', variant: 'success' }, 'Deployment'), {
      status: 'Running',
      useIcon: true,
    });
    deepStrictEqual(toConsoleStatusKey({ label: '1/2 ready', variant: 'warning' }, 'Deployment'), {
      status: 'Warning',
      useIcon: true,
    });
    deepStrictEqual(toConsoleStatusKey({ label: '0/2 ready', variant: 'danger' }, 'Deployment'), {
      status: 'Failed',
      useIcon: true,
    });
  });

  it('maps node readiness', () => {
    deepStrictEqual(toConsoleStatusKey({ label: 'NotReady', variant: 'danger' }, 'Node'), {
      status: 'Not Ready',
      useIcon: true,
    });
  });

  it('falls back to text for unmapped operator reasons', () => {
    deepStrictEqual(
      toConsoleStatusKey(
        { label: 'ScalingLimited', variant: 'warning' },
        'HorizontalPodAutoscaler',
      ),
      { status: 'ScalingLimited', useIcon: false },
    );
  });
});

describe('getLinkedResourceStatusDisplay', () => {
  it('returns icon mode for pods', () => {
    deepStrictEqual(
      getLinkedResourceStatusDisplay({ label: 'Running', variant: 'success' }, 'Pod', 'Pod'),
      { mode: 'icon', status: 'Running', title: 'Running' },
    );
  });

  it('returns text mode for operator CRDs', () => {
    strictEqual(
      getLinkedResourceStatusDisplay(
        { label: 'Ready', variant: 'success' },
        'FlowCollector',
        'flows.netobserv.io~v1beta2~FlowCollector',
      ).mode,
      'text',
    );
  });

  it('returns text mode for unmapped custom labels on built-in kinds', () => {
    strictEqual(
      getLinkedResourceStatusDisplay(
        { label: 'ScalingLimited', variant: 'warning' },
        'HorizontalPodAutoscaler',
        'HorizontalPodAutoscaler',
      ).mode,
      'text',
    );
  });
});
