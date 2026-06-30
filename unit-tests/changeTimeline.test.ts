import { describe, it } from 'node:test';
import { strictEqual } from 'node:assert';

import {
  eventToTimelineEntry,
  formatTimelineRelativeTime,
  isChangeTimelineQuery,
  isTimelineEligibleAnchor,
  mergeTimelineEntries,
  resolveTimelineAnchor,
  shouldShowChangeTimeline,
} from '../src/changeTimeline';
import { testK8sModels } from './fixtures/k8sModels';

describe('isChangeTimelineQuery', () => {
  it('matches explicit change questions', () => {
    strictEqual(isChangeTimelineQuery('what changed with payments-api recently?'), true);
    strictEqual(isChangeTimelineQuery('can you check why pods are failing?'), false);
  });
});

describe('shouldShowChangeTimeline', () => {
  const anchor = { kind: 'Deployment', name: 'payments-api', namespace: 'payments' };

  it('shows for change questions when an anchor exists', () => {
    strictEqual(shouldShowChangeTimeline('what changed recently?', undefined, anchor), true);
  });

  it('shows for troubleshooting questions with events evidence', () => {
    strictEqual(
      shouldShowChangeTimeline(
        'why are aws cloud pods failing?',
        { t1: { args: {}, content: '', name: 'events_list', status: 'success' } },
        anchor,
      ),
      true,
    );
  });
});

describe('isTimelineEligibleAnchor', () => {
  it('requires a namespaced watchable resource', () => {
    strictEqual(
      isTimelineEligibleAnchor(
        { kind: 'Deployment', name: 'payments-api', namespace: 'payments' },
        testK8sModels,
      ),
      true,
    );
    strictEqual(
      isTimelineEligibleAnchor({ kind: 'Node', name: 'worker-1' }, testK8sModels),
      false,
    );
  });
});

describe('resolveTimelineAnchor', () => {
  it('prefers the page context workload when available', () => {
    const anchor = resolveTimelineAnchor(
      'Deployment',
      'payments-api',
      'payments',
      undefined,
      undefined,
      testK8sModels,
    );
    strictEqual(anchor?.kind, 'Deployment');
    strictEqual(anchor?.name, 'payments-api');
  });

  it('falls back to deployment refs from tool output', () => {
    const anchor = resolveTimelineAnchor(
      undefined,
      undefined,
      undefined,
      {
        t1: {
          args: { namespace: 'payments' },
          content:
            'payments apps/v1 Deployment payments-api 2/2 2 2 3h payments-api registry/payments:latest app=payments',
          name: 'resources_list',
          status: 'success',
        },
      },
      undefined,
      testK8sModels,
    );
    strictEqual(anchor?.kind, 'Deployment');
    strictEqual(anchor?.name, 'payments-api');
    strictEqual(anchor?.namespace, 'payments');
  });
});

describe('eventToTimelineEntry', () => {
  it('maps warning events to timeline rows', () => {
    const entry = eventToTimelineEntry(
      {
        involvedObject: { kind: 'Pod', name: 'payments-api-abc', namespace: 'payments' },
        lastTimestamp: '2026-06-30T12:00:00Z',
        message: 'Back-off restarting failed container',
        metadata: { uid: 'event-1' },
        reason: 'BackOff',
        type: 'Warning',
      },
      testK8sModels,
    );

    strictEqual(entry?.severity, 'warning');
    strictEqual(entry?.title, 'BackOff — Pod/payments-api-abc');
    strictEqual(entry?.detail, 'Back-off restarting failed container');
    strictEqual(entry?.consolePath, '/k8s/ns/payments/pods/payments-api-abc');
  });
});

describe('mergeTimelineEntries', () => {
  it('sorts newest first and filters outside the window', () => {
    const now = new Date('2026-06-30T12:00:00Z');
    const entries = mergeTimelineEntries(
      [
        {
          id: 'old',
          severity: 'normal',
          timestamp: new Date('2026-06-30T08:00:00Z'),
          title: 'Old',
          type: 'event',
        },
        {
          id: 'new',
          severity: 'warning',
          timestamp: new Date('2026-06-30T11:30:00Z'),
          title: 'New',
          type: 'event',
        },
      ],
      2 * 60 * 60 * 1000,
      now.getTime(),
    );

    strictEqual(entries.length, 1);
    strictEqual(entries[0].id, 'new');
  });
});

describe('formatTimelineRelativeTime', () => {
  it('formats minutes ago', () => {
    const now = Date.parse('2026-06-30T12:00:00Z');
    strictEqual(
      formatTimelineRelativeTime(new Date('2026-06-30T11:45:00Z'), now),
      '15m ago',
    );
  });
});
