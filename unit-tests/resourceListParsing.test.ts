import { describe, it } from 'node:test';
import { strictEqual } from 'node:assert';

import {
  extractResourcesFromMcpTableContent,
  extractResourcesFromVerticalListing,
  getResourceListToolContexts,
  hasBulkResourceListTool,
  isVerticalListNoiseLine,
} from '../src/resourceListParsing';
import { isPlausibleResourceName } from '../src/resourceRefs';

describe('extractResourcesFromMcpTableContent', () => {
  it('parses namespaced core and OpenShift table rows', () => {
    const content = `NAMESPACE APIVERSION KIND NAME DATA AGE LABELS
payments v1 ConfigMap api-config 2 5m app=payments
payments apps/v1 Deployment payments-api 3 10m app=payments
payments route.openshift.io/v1 Route payments-route 15m host=payments`;

    const refs = extractResourcesFromMcpTableContent(content);
    strictEqual(refs.length, 3);
    strictEqual(refs[0].kind, 'ConfigMap');
    strictEqual(refs[0].name, 'api-config');
    strictEqual(refs[0].namespace, 'payments');
    strictEqual(refs[1].kind, 'Deployment');
    strictEqual(refs[2].kind, 'Route');
    strictEqual(refs[2].name, 'payments-route');
  });

  it('parses cluster-scoped table rows', () => {
    const content = `APIVERSION KIND NAME STATUS AGE LABELS
v1 Namespace default Active 3h38m kubernetes.io/metadata.name=default
v1 Node worker-1.example.internal Ready worker 3h17m`;

    const refs = extractResourcesFromMcpTableContent(content);
    strictEqual(refs.length, 2);
    strictEqual(refs[0].kind, 'Namespace');
    strictEqual(refs[1].kind, 'Node');
    strictEqual(refs[1].name, 'worker-1.example.internal');
  });
});

describe('extractResourcesFromVerticalListing', () => {
  it('skips status, age, and replica noise lines', () => {
    const refs = extractResourcesFromVerticalListing(
      `payments-api
2/2
Running
3h10m`,
      [{ kind: 'Deployment', namespace: 'payments' }],
      isPlausibleResourceName,
    );

    strictEqual(refs.length, 1);
    strictEqual(refs[0].kind, 'Deployment');
    strictEqual(refs[0].name, 'payments-api');
    strictEqual(refs[0].namespace, 'payments');
  });
});

describe('getResourceListToolContexts', () => {
  it('collects contexts for default and OpenShift list tools', () => {
    const contexts = getResourceListToolContexts({
      t1: {
        args: { apiVersion: 'apps/v1', kind: 'Deployment', namespace: 'payments' },
        content: '',
        name: 'resources_list',
        status: 'success',
      },
      t2: {
        args: { apiVersion: 'route.openshift.io/v1', kind: 'Route' },
        content: '',
        name: 'resources_list',
        status: 'success',
      },
      t3: {
        args: {},
        content: '',
        name: 'namespaces_list',
        status: 'success',
      },
    });

    strictEqual(contexts.length, 3);
    strictEqual(hasBulkResourceListTool({ t1: { args: {}, content: '', name: 'pods_list', status: 'success' } }), true);
  });
});

describe('isVerticalListNoiseLine', () => {
  it('treats common kubectl column values as noise', () => {
    strictEqual(isVerticalListNoiseLine('3h38m'), true);
    strictEqual(isVerticalListNoiseLine('2/2'), true);
    strictEqual(isVerticalListNoiseLine('Running'), true);
    strictEqual(isVerticalListNoiseLine('payments-api'), false);
  });
});
