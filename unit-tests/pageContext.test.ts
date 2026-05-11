import { describe, it } from 'node:test';
import { strictEqual } from 'node:assert';

import { buildPageContext, resolveModelKey } from '../src/pageContext';

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

const models = {
  Pod: { kind: 'Pod', plural: 'pods' },
  Deployment: { kind: 'Deployment', plural: 'deployments' },
  Node: { kind: 'Node', plural: 'nodes' },
  Secret: { kind: 'Secret', plural: 'secrets' },
  'kubevirt.io~v1~VirtualMachine': { kind: 'VirtualMachine', plural: 'virtualmachines' },
};

describe('resolveModelKey', () => {
  it('resolves a direct model key', () => {
    strictEqual(resolveModelKey('Pod', models), 'Pod');
  });

  it('resolves a CRD model key with group~version~kind', () => {
    strictEqual(
      resolveModelKey('kubevirt.io~v1~VirtualMachine', models),
      'kubevirt.io~v1~VirtualMachine',
    );
  });

  it('resolves a plural name to the model key', () => {
    strictEqual(resolveModelKey('pods', models), 'Pod');
  });

  it('resolves a plural CRD name to the model key', () => {
    strictEqual(resolveModelKey('virtualmachines', models), 'kubevirt.io~v1~VirtualMachine');
  });

  it('resolves core~v1~Kind by extracting the kind portion', () => {
    strictEqual(resolveModelKey('core~v1~Pod', models), 'Pod');
  });

  it('resolves core~v1~Deployment by extracting the kind portion', () => {
    strictEqual(resolveModelKey('core~v1~Deployment', models), 'Deployment');
  });

  it('returns undefined for an unknown key', () => {
    strictEqual(resolveModelKey('UnknownResource', models), undefined);
  });

  it('returns undefined for an unknown group~version~kind', () => {
    strictEqual(resolveModelKey('fake.io~v1~Nothing', models), undefined);
  });

  it('returns undefined for an empty string', () => {
    strictEqual(resolveModelKey('', models), undefined);
  });
});
