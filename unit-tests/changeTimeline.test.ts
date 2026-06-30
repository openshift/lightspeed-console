import { describe, it } from 'node:test';
import { strictEqual } from 'node:assert';

import {
  eventToTimelineEntry,
  eventsListPath,
  formatTimelineAnchorLabel,
  formatTimelineRelativeTime,
  isChangeTimelineQuery,
  isTimelineEligibleAnchor,
  mergeTimelineEntries,
  resolveTimelineAnchor,
  resourceStatusToTimelineEntries,
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
  const clusterAnchor = { kind: 'Node', name: 'worker-1' };

  it('shows for change questions when an anchor exists', () => {
    strictEqual(
      shouldShowChangeTimeline('what changed recently?', undefined, anchor, testK8sModels),
      true,
    );
  });

  it('shows for troubleshooting questions with events evidence', () => {
    strictEqual(
      shouldShowChangeTimeline(
        'why are aws cloud pods failing?',
        { t1: { args: {}, content: '', name: 'events_list', status: 'success' } },
        anchor,
        testK8sModels,
      ),
      true,
    );
  });

  it('supports cluster-scoped anchors', () => {
    strictEqual(
      shouldShowChangeTimeline('what changed on this node?', undefined, clusterAnchor, testK8sModels),
      true,
    );
  });
});

describe('isTimelineEligibleAnchor', () => {
  it('accepts namespaced watchable resources', () => {
    strictEqual(
      isTimelineEligibleAnchor(
        { kind: 'Deployment', name: 'payments-api', namespace: 'payments' },
        testK8sModels,
      ),
      true,
    );
  });

  it('accepts cluster-scoped watchable resources', () => {
    strictEqual(
      isTimelineEligibleAnchor({ kind: 'Node', name: 'worker-1' }, testK8sModels),
      true,
    );
    strictEqual(
      isTimelineEligibleAnchor(
        { kind: 'flows.netobserv.io~v1beta2~FlowCollector', name: 'cluster' },
        testK8sModels,
      ),
      true,
    );
  });

  it('rejects namespaced resources without namespace', () => {
    strictEqual(
      isTimelineEligibleAnchor({ kind: 'Pod', name: 'payments-api-abc' }, testK8sModels),
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

  it('resolves cluster-scoped refs from tool output', () => {
    const anchor = resolveTimelineAnchor(
      undefined,
      undefined,
      undefined,
      {
        t1: {
          args: { kind: 'flows.netobserv.io~v1beta2~FlowCollector', name: 'cluster' },
          content: '',
          name: 'resources_get',
          status: 'success',
        },
      },
      'FlowCollector cluster is degraded.',
      testK8sModels,
    );
    strictEqual(anchor?.kind, 'flows.netobserv.io~v1beta2~FlowCollector');
    strictEqual(anchor?.name, 'cluster');
    strictEqual(anchor?.namespace, undefined);
  });

  it('uses cluster page context without namespace', () => {
    const anchor = resolveTimelineAnchor(
      'Node',
      'worker-1',
      undefined,
      undefined,
      undefined,
      testK8sModels,
    );
    strictEqual(anchor?.kind, 'Node');
    strictEqual(anchor?.name, 'worker-1');
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

describe('resourceStatusToTimelineEntries', () => {
  it('maps OLM-style status conditions into timeline rows', () => {
    const anchor = {
      kind: 'operators.coreos.com~v1alpha1~ClusterServiceVersion',
      name: 'lightspeed-operator.v1.1.1',
      namespace: 'openshift-lightspeed',
    };
    const entries = resourceStatusToTimelineEntries(
      {
        status: {
          conditions: [
            {
              lastTransitionTime: '2026-06-30T09:06:44Z',
              message: 'deployment not available',
              phase: 'Failed',
              reason: 'ComponentUnhealthy',
            },
            {
              lastTransitionTime: '2026-06-30T09:11:07Z',
              message: 'install strategy completed with no errors',
              phase: 'Succeeded',
              reason: 'InstallSucceeded',
            },
          ],
        },
      },
      anchor,
      testK8sModels,
    );

    strictEqual(entries.length, 2);
    const titles = entries.map((entry) => entry.title).sort();
    strictEqual(titles[0], 'Failed: ComponentUnhealthy');
    strictEqual(titles[1], 'Succeeded: InstallSucceeded');
    strictEqual(entries.find((entry) => entry.title === 'Failed: ComponentUnhealthy')?.severity, 'error');
    strictEqual(entries.every((entry) => entry.type === 'status'), true);
  });
});

describe('eventsListPath', () => {
  it('builds namespaced event list paths', () => {
    strictEqual(
      eventsListPath('Pod', 'payments-api-abc', 'payments'),
      '/api/kubernetes/api/v1/namespaces/payments/events?fieldSelector=involvedObject.kind%3DPod%2CinvolvedObject.name%3Dpayments-api-abc',
    );
  });

  it('builds cluster-wide event list paths', () => {
    strictEqual(
      eventsListPath('Node', 'worker-1'),
      '/api/kubernetes/api/v1/events?fieldSelector=involvedObject.kind%3DNode%2CinvolvedObject.name%3Dworker-1',
    );
  });
});

describe('formatTimelineAnchorLabel', () => {
  it('omits namespace for cluster-scoped anchors', () => {
    strictEqual(
      formatTimelineAnchorLabel({ kind: 'Node', name: 'worker-1' }, testK8sModels),
      'Node/worker-1',
    );
  });

  it('includes namespace for namespaced anchors', () => {
    strictEqual(
      formatTimelineAnchorLabel(
        { kind: 'Deployment', name: 'payments-api', namespace: 'payments' },
        testK8sModels,
      ),
      'Deployment/payments-api (payments)',
    );
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
