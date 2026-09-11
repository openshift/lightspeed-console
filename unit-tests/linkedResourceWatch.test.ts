import { describe, it } from 'node:test';
import { strictEqual } from 'node:assert';

import {
  buildResourceWatchProps,
  matchesResourceRef,
  shouldShowLinkedResourceStatus,
} from '../src/linkedResourceWatch';
import { testK8sModels } from './fixtures/k8sModels';

describe('buildResourceWatchProps', () => {
  it('watches Namespace for project refs', () => {
    const watchProps = buildResourceWatchProps(
      { kind: 'Namespace', name: 'payments', useProjectRoute: true },
      testK8sModels,
    );
    strictEqual(watchProps?.kind, 'Namespace');
    strictEqual(watchProps?.name, 'payments');
    strictEqual(watchProps?.namespace, undefined);
  });

  it('watches namespaced resources in their namespace', () => {
    const watchProps = buildResourceWatchProps(
      { kind: 'Pod', name: 'api-1', namespace: 'payments' },
      testK8sModels,
    );
    strictEqual(watchProps?.kind, 'Pod');
    strictEqual(watchProps?.name, 'api-1');
    strictEqual(watchProps?.namespace, 'payments');
  });
});

describe('matchesResourceRef', () => {
  it('rejects stale watch data for a different resource name', () => {
    strictEqual(
      matchesResourceRef(
        { metadata: { name: 'default' } },
        { kind: 'Namespace', name: 'kube-system' },
        testK8sModels,
      ),
      false,
    );
  });

  it('rejects stale watch data for a different kind', () => {
    strictEqual(
      matchesResourceRef(
        { kind: 'Pod', metadata: { name: 'api-1', namespace: 'payments' } },
        { kind: 'Deployment', name: 'api-1', namespace: 'payments' },
        testK8sModels,
      ),
      false,
    );
  });

  it('accepts matching namespace resources', () => {
    strictEqual(
      matchesResourceRef(
        { metadata: { name: 'payments' } },
        { kind: 'Namespace', name: 'payments', useProjectRoute: true },
        testK8sModels,
      ),
      true,
    );
  });
});

describe('shouldShowLinkedResourceStatus', () => {
  it('skips namespace, project, and data-only refs', () => {
    strictEqual(
      shouldShowLinkedResourceStatus(
        { kind: 'Namespace', name: 'default', useProjectRoute: true },
        testK8sModels,
      ),
      false,
    );
    strictEqual(
      shouldShowLinkedResourceStatus({ kind: 'Project', name: 'payments' }, testK8sModels),
      false,
    );
    strictEqual(
      shouldShowLinkedResourceStatus(
        { kind: 'ConfigMap', name: 'app-config', namespace: 'default' },
        testK8sModels,
      ),
      false,
    );
    strictEqual(
      shouldShowLinkedResourceStatus(
        { kind: 'Secret', name: 'tls', namespace: 'default' },
        testK8sModels,
      ),
      false,
    );
  });

  it('shows status for other resource kinds', () => {
    strictEqual(
      shouldShowLinkedResourceStatus(
        { kind: 'Pod', name: 'api-1', namespace: 'payments' },
        testK8sModels,
      ),
      true,
    );
  });
});
