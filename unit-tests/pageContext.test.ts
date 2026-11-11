import { describe, expect, it } from 'vitest';

import { buildPageContext, resolveModelKey } from '../src/pageContext';

describe('buildPageContext', () => {
  it('returns undefined when kind is undefined', () => {
    expect(buildPageContext(undefined, undefined, undefined)).toBeUndefined();
  });

  it('returns detail page context with namespace', () => {
    expect(buildPageContext('Deployment', 'nginx', 'default')).toBe(
      'The user is viewing the details of Deployment "nginx" in namespace "default" in the OpenShift web console.',
    );
  });

  it('returns detail page context without namespace (cluster-scoped)', () => {
    expect(buildPageContext('Node', 'worker-1', undefined)).toBe(
      'The user is viewing the details of Node "worker-1" in the OpenShift web console.',
    );
  });

  it('preserves group~version~kind format in detail context', () => {
    expect(buildPageContext('kubevirt.io~v1~VirtualMachine', 'my-vm', 'default')).toBe(
      'The user is viewing the details of kubevirt.io~v1~VirtualMachine "my-vm" in namespace "default" in the OpenShift web console.',
    );
  });

  it('returns list page context with namespace', () => {
    expect(buildPageContext('Deployment', undefined, 'default')).toBe(
      'The user is viewing a list of Deployment resources in namespace "default" in the OpenShift web console.',
    );
  });

  it('returns list page context across all namespaces', () => {
    expect(buildPageContext('Pod', undefined, undefined)).toBe(
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
    expect(resolveModelKey('Pod', models)).toBe('Pod');
  });

  it('resolves a CRD model key with group~version~kind', () => {
    expect(resolveModelKey('kubevirt.io~v1~VirtualMachine', models)).toBe(
      'kubevirt.io~v1~VirtualMachine',
    );
  });

  it('resolves a plural name to the model key', () => {
    expect(resolveModelKey('pods', models)).toBe('Pod');
  });

  it('resolves a plural CRD name to the model key', () => {
    expect(resolveModelKey('virtualmachines', models)).toBe('kubevirt.io~v1~VirtualMachine');
  });

  it('resolves core~v1~Kind by extracting the kind portion', () => {
    expect(resolveModelKey('core~v1~Pod', models)).toBe('Pod');
  });

  it('resolves core~v1~Deployment by extracting the kind portion', () => {
    expect(resolveModelKey('core~v1~Deployment', models)).toBe('Deployment');
  });

  it('returns undefined for an unknown key', () => {
    expect(resolveModelKey('UnknownResource', models)).toBeUndefined();
  });

  it('returns undefined for an unknown group~version~kind', () => {
    expect(resolveModelKey('fake.io~v1~Nothing', models)).toBeUndefined();
  });

  it('returns undefined for an empty string', () => {
    expect(resolveModelKey('', models)).toBeUndefined();
  });
});
