// @vitest-environment jsdom
import { K8sModel, useK8sModels } from '@openshift-console/dynamic-plugin-sdk';
import { useLocation } from 'react-router-dom-v5-compat';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useLocationContext } from '../src/hooks/useLocationContext';
import { renderHook } from './test-utils';

vi.mock('react-router-dom-v5-compat', () => ({ useLocation: vi.fn() }));

// Only the fields that useLocationContext reads
const models = {
  'cluster.open-cluster-management.io~v1~ManagedCluster': {
    kind: 'ManagedCluster',
    plural: 'managedclusters',
  },
  Deployment: { kind: 'Deployment', plural: 'deployments' },
  Node: { kind: 'Node', plural: 'nodes' },
  Pod: { kind: 'Pod', plural: 'pods' },
  Secret: { kind: 'Secret', plural: 'secrets' },
} as unknown as Record<string, K8sModel>;

const silenceID = '0f3c1a2b-4d5e-6f70-8192-a3b4c5d6e7f8';

const setLocation = (url: string) => {
  const { pathname, search } = new URL(url, 'https://console.example');
  vi.mocked(useLocation).mockReturnValue({ pathname, search } as ReturnType<typeof useLocation>);
};

const renderAt = (url: string) => {
  setLocation(url);
  return renderHook(() => useLocationContext()).result.current;
};

describe('useLocationContext', () => {
  beforeEach(() => {
    vi.mocked(useK8sModels).mockReturnValue([models, false]);
  });

  [
    ['namespaced details page', '/k8s/ns/my-ns/pods/my-pod', ['Pod', 'my-pod', 'my-ns']],
    [
      'namespaced details page with a group~version~kind URL',
      '/k8s/ns/my-ns/apps~v1~Deployment/my-deploy/yaml',
      ['Deployment', 'my-deploy', 'my-ns'],
    ],
    [
      'cluster-scoped details page',
      '/k8s/cluster/nodes/node-1.example',
      ['Node', 'node-1.example'],
    ],
    [
      'ACM ManagedCluster details page',
      '/multicloud/infrastructure/clusters/details/my-cluster/my-cluster/overview',
      ['cluster.open-cluster-management.io~v1~ManagedCluster', 'my-cluster'],
    ],
    [
      'ACM search page for a known kind',
      '/multicloud/search/resources?kind=Pod&name=my-pod&namespace=my-ns',
      ['Pod', 'my-pod', 'my-ns'],
    ],
    [
      'ACM search page for a VirtualMachine',
      '/multicloud/search/resources?kind=VirtualMachine&name=my-vm&namespace=my-ns',
      ['kubevirt.io~v1~VirtualMachine', 'my-vm', 'my-ns'],
    ],
    [
      'ACM search page without a namespace',
      '/multicloud/search/resources?kind=Node&name=node-1',
      ['Node', 'node-1'],
    ],
    [
      'ACM ApplicationSet details page',
      '/multicloud/applications/details/my-ns/my-app/overview?apiVersion=applicationset.argoproj.io',
      ['argoproj.io~v1alpha1~ApplicationSet', 'my-app', 'my-ns'],
    ],
    [
      'ACM Application details page',
      '/multicloud/applications/details/my-ns/my-app/overview?apiVersion=application.app.k8s.io',
      ['app.k8s.io~v1beta1~Application', 'my-app', 'my-ns'],
    ],
    [
      'ACM Policy details page',
      '/multicloud/governance/policies/details/my-ns/my-policy',
      ['policy.open-cluster-management.io~v1~Policy', 'my-policy', 'my-ns'],
    ],
    [
      'ACM Policy edit page',
      '/multicloud/governance/policies/edit/my-ns/my-policy',
      ['policy.open-cluster-management.io~v1~Policy', 'my-policy', 'my-ns'],
    ],
    ['namespaced list page', '/k8s/ns/my-ns/pods', ['Pod', undefined, 'my-ns']],
    [
      'namespaced list page with a trailing slash',
      '/k8s/ns/my-ns/pods/',
      ['Pod', undefined, 'my-ns'],
    ],
    ['all-namespaces list page', '/k8s/all-namespaces/deployments', ['Deployment']],
    ['cluster-scoped list page', '/k8s/cluster/nodes', ['Node']],
    [
      'alert details page',
      '/monitoring/alerts/123?alertname=KubePodCrashLooping&namespace=my-ns',
      ['Alert', 'KubePodCrashLooping', 'my-ns'],
    ],
    [
      'alert details page without a namespace',
      '/monitoring/alerts/123?alertname=Watchdog',
      ['Alert', 'Watchdog'],
    ],
    ['silence details page', `/monitoring/silences/${silenceID}`, ['Silence', silenceID]],
    ['alerting rule details page', '/monitoring/alertrules/456', ['AlertingRule', '456']],
  ].forEach(([page, url, expected]) => {
    it(`returns the context for the ${page}`, () => {
      const [kind, name, namespace] = expected as string[];
      expect(renderAt(url as string)).toEqual([kind, name, namespace]);
    });
  });

  [
    ['Secret details page', '/k8s/ns/my-ns/secrets/my-secret'],
    ['details page for an unknown resource', '/k8s/ns/my-ns/unknowns/my-thing'],
    ['list page for an unknown resource', '/k8s/ns/my-ns/unknowns'],
    ['ACM search page for an unknown kind', '/multicloud/search/resources?kind=Unknown&name=x'],
    ['ACM search page with an invalid name', '/multicloud/search/resources?kind=Pod&name=-bad'],
    [
      'ACM search page with an invalid namespace',
      '/multicloud/search/resources?kind=Pod&name=my-pod&namespace=Bad_NS',
    ],
    [
      'ACM application page with an unknown apiVersion',
      '/multicloud/applications/details/my-ns/my-app/overview?apiVersion=unknown',
    ],
    ['alert details page without an alert name', '/monitoring/alerts/123'],
    ['alert details page with an invalid alert name', '/monitoring/alerts/123?alertname=bad-name'],
    [
      'alert details page with an invalid namespace',
      '/monitoring/alerts/123?alertname=Watchdog&namespace=Bad_NS',
    ],
    ['silence details page with an invalid ID', '/monitoring/silences/abc-123'],
    ['unrelated page', '/dashboards'],
  ].forEach(([page, url]) => {
    it(`returns no context for the ${page}`, () => {
      expect(renderAt(url)).toEqual([undefined, undefined, undefined]);
    });
  });

  it('returns no context for the ManagedCluster page when ACM is not installed', () => {
    vi.mocked(useK8sModels).mockReturnValue([{ Pod: models.Pod }, false]);
    expect(
      renderAt('/multicloud/infrastructure/clusters/details/my-cluster/my-cluster/overview'),
    ).toEqual([undefined, undefined, undefined]);
  });

  it('ignores resource pages while the models are loading', () => {
    vi.mocked(useK8sModels).mockReturnValue([models, true]);
    expect(renderAt('/k8s/ns/my-ns/pods/my-pod')).toEqual([undefined, undefined, undefined]);
  });

  it('still returns monitoring pages while the models are loading', () => {
    vi.mocked(useK8sModels).mockReturnValue([models, true]);
    expect(renderAt('/monitoring/alertrules/456')).toEqual(['AlertingRule', '456', undefined]);
  });

  it('updates the context when the location changes', () => {
    setLocation('/k8s/ns/my-ns/pods/my-pod');
    const { rerender, result } = renderHook(() => useLocationContext());
    expect(result.current).toEqual(['Pod', 'my-pod', 'my-ns']);

    setLocation('/dashboards');
    rerender();
    expect(result.current).toEqual([undefined, undefined, undefined]);
  });
});
