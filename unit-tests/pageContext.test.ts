import { describe, it } from 'node:test';
import { strictEqual } from 'node:assert';

import {
  buildPageContext,
  buildResourceConsolePath,
  isClusterScopedRef,
  isNamespacedRef,
  resolveKindToModelKey,
  resolveModelKey,
} from '../src/pageContext';
import { testK8sModels } from './fixtures/k8sModels';

describe('buildPageContext', () => {
  it('returns undefined when kind is undefined', () => {
    strictEqual(buildPageContext(undefined, undefined, undefined), undefined);
  });

  it('returns detail page context with namespace', () => {
    strictEqual(
      buildPageContext('Deployment', 'nginx', 'default'),
      'The user is viewing the details of Deployment "nginx" in namespace "default" in the OpenShift web console.',
    );
  });

  it('returns detail page context without namespace (cluster-scoped)', () => {
    strictEqual(
      buildPageContext('Node', 'worker-1', undefined),
      'The user is viewing the details of Node "worker-1" in the OpenShift web console.',
    );
  });

  it('preserves group~version~kind format in detail context', () => {
    strictEqual(
      buildPageContext('kubevirt.io~v1~VirtualMachine', 'my-vm', 'default'),
      'The user is viewing the details of kubevirt.io~v1~VirtualMachine "my-vm" in namespace "default" in the OpenShift web console.',
    );
  });

  it('returns list page context with namespace', () => {
    strictEqual(
      buildPageContext('Deployment', undefined, 'default'),
      'The user is viewing a list of Deployment resources in namespace "default" in the OpenShift web console.',
    );
  });

  it('returns list page context across all namespaces', () => {
    strictEqual(
      buildPageContext('Pod', undefined, undefined),
      'The user is viewing a list of Pod resources across all namespaces in the OpenShift web console.',
    );
  });
});

describe('resolveModelKey', () => {
  it('resolves a direct model key', () => {
    strictEqual(resolveModelKey('Pod', testK8sModels), 'Pod');
  });

  it('resolves a CRD model key with group~version~kind', () => {
    strictEqual(
      resolveModelKey('kubevirt.io~v1~VirtualMachine', testK8sModels),
      'kubevirt.io~v1~VirtualMachine',
    );
  });

  it('resolves a plural name to the model key', () => {
    strictEqual(resolveModelKey('pods', testK8sModels), 'Pod');
  });

  it('resolves a plural CRD name to the model key', () => {
    strictEqual(resolveModelKey('virtualmachines', testK8sModels), 'kubevirt.io~v1~VirtualMachine');
  });

  it('resolves core~v1~Kind by extracting the kind portion', () => {
    strictEqual(resolveModelKey('core~v1~Pod', testK8sModels), 'Pod');
  });

  it('resolves core~v1~Deployment by extracting the kind portion', () => {
    strictEqual(resolveModelKey('core~v1~Deployment', testK8sModels), 'Deployment');
  });

  it('returns undefined for an unknown key', () => {
    strictEqual(resolveModelKey('UnknownResource', testK8sModels), undefined);
  });

  it('returns undefined for an unknown group~version~kind', () => {
    strictEqual(resolveModelKey('fake.io~v1~Nothing', testK8sModels), undefined);
  });

  it('returns undefined for an empty string', () => {
    strictEqual(resolveModelKey('', testK8sModels), undefined);
  });
});

describe('resolveKindToModelKey', () => {
  it('resolves a direct model key', () => {
    strictEqual(resolveKindToModelKey('Pod', testK8sModels), 'Pod');
  });

  it('resolves a Kubernetes kind name to the model key', () => {
    strictEqual(
      resolveKindToModelKey('VirtualMachine', testK8sModels),
      'kubevirt.io~v1~VirtualMachine',
    );
  });

  it('resolves a group~version~kind reference', () => {
    strictEqual(
      resolveKindToModelKey('kubevirt.io~v1~VirtualMachine', testK8sModels),
      'kubevirt.io~v1~VirtualMachine',
    );
  });

  it('returns undefined for unknown kinds', () => {
    strictEqual(resolveKindToModelKey('NotARealKind', testK8sModels), undefined);
  });
});

describe('resource scope helpers', () => {
  it('detects cluster-scoped refs', () => {
    strictEqual(isClusterScopedRef({ kind: 'Node', name: 'worker-1' }, testK8sModels), true);
    strictEqual(
      isClusterScopedRef(
        { kind: 'flows.netobserv.io~v1beta2~FlowCollector', name: 'cluster' },
        testK8sModels,
      ),
      true,
    );
    strictEqual(
      isClusterScopedRef(
        { kind: 'Deployment', name: 'payments-api', namespace: 'payments' },
        testK8sModels,
      ),
      false,
    );
  });

  it('detects namespaced refs', () => {
    strictEqual(
      isNamespacedRef(
        { kind: 'Deployment', name: 'payments-api', namespace: 'payments' },
        testK8sModels,
      ),
      true,
    );
    strictEqual(isNamespacedRef({ kind: 'Node', name: 'worker-1' }, testK8sModels), false);
  });
});

describe('buildResourceConsolePath', () => {
  it('builds namespaced pod path', () => {
    strictEqual(
      buildResourceConsolePath(
        { kind: 'Pod', name: 'payments-api', namespace: 'payments' },
        testK8sModels,
      ),
      '/k8s/ns/payments/pods/payments-api',
    );
  });

  it('builds cluster node path', () => {
    strictEqual(
      buildResourceConsolePath({ kind: 'Node', name: 'worker-1' }, testK8sModels),
      '/k8s/cluster/nodes/worker-1',
    );
  });

  it('builds deployment path', () => {
    strictEqual(
      buildResourceConsolePath(
        {
          kind: 'Deployment',
          name: 'reporting-service',
          namespace: 'shared-services',
        },
        testK8sModels,
      ),
      '/k8s/ns/shared-services/deployments/reporting-service',
    );
  });

  it('builds CRD detail path using the model key', () => {
    strictEqual(
      buildResourceConsolePath(
        {
          kind: 'VirtualMachine',
          name: 'my-vm',
          namespace: 'default',
        },
        testK8sModels,
      ),
      '/k8s/ns/default/kubevirt.io~v1~VirtualMachine/my-vm',
    );
  });

  it('returns null without namespace for namespaced kinds', () => {
    strictEqual(buildResourceConsolePath({ kind: 'Pod', name: 'test' }, testK8sModels), null);
  });
});
