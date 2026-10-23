import { describe, it } from 'node:test';
import { strictEqual } from 'node:assert';

import { injectResourceLinksInMarkdown } from '../src/linkedResourceText';
import { testK8sModels } from './fixtures/k8sModels';

describe('injectResourceLinksInMarkdown', () => {
  it('links pod names on Name: lines without touching age values', () => {
    const response = `Here are pods in namespace default:

Name: mock-pod-a
Ready: 1/1
Status: Running
Restarts: 0
Age: 5m

Name: mock-pod-b
Ready: 1/1
Status: Running
Restarts: 0
Age: 5m`;

    const linked = injectResourceLinksInMarkdown(
      response,
      [
        { kind: 'Pod', name: 'mock-pod-a', namespace: 'default' },
        { kind: 'Pod', name: 'mock-pod-b', namespace: 'default' },
      ],
      testK8sModels,
    );

    strictEqual(
      linked,
      `Here are pods in namespace default:

Name: [mock-pod-a](/k8s/ns/default/pods/mock-pod-a)
Ready: 1/1
Status: Running
Restarts: 0
Age: 5m

Name: [mock-pod-b](/k8s/ns/default/pods/mock-pod-b)
Ready: 1/1
Status: Running
Restarts: 0
Age: 5m`,
    );
  });

  it('wraps bold resource mentions in prose', () => {
    const response =
      'The lightspeed-postgres-server pod is healthy. Check **lightspeed-postgres-server** again.';
    const linked = injectResourceLinksInMarkdown(
      response,
      [
        {
          kind: 'Pod',
          name: 'lightspeed-postgres-server',
          namespace: 'openshift-lightspeed',
        },
      ],
      testK8sModels,
    );

    strictEqual(
      linked,
      'The lightspeed-postgres-server pod is healthy. Check [lightspeed-postgres-server](/k8s/ns/openshift-lightspeed/pods/lightspeed-postgres-server) again.',
    );
  });

  it('links a standalone resource name line in legacy listings', () => {
    const response = `Here are the pods in the "openshift-lightspeed" namespace:

lightspeed-app-server-abc
2/2
Running
0
72m`;

    const linked = injectResourceLinksInMarkdown(
      response,
      [
        {
          kind: 'Pod',
          name: 'lightspeed-app-server-abc',
          namespace: 'openshift-lightspeed',
        },
      ],
      testK8sModels,
    );

    strictEqual(
      linked,
      `Here are the pods in the "openshift-lightspeed" namespace:

[lightspeed-app-server-abc](/k8s/ns/openshift-lightspeed/pods/lightspeed-app-server-abc)
2/2
Running
0
72m`,
    );
  });

  it('does not link resource names inside inline code', () => {
    const response = 'Use `lightspeed-app-server-abc` as the pod name.';
    const linked = injectResourceLinksInMarkdown(
      response,
      [
        {
          kind: 'Pod',
          name: 'lightspeed-app-server-abc',
          namespace: 'openshift-lightspeed',
        },
      ],
      testK8sModels,
    );

    strictEqual(linked, response);
  });

  it('does not replace shorter names inside longer resource names', () => {
    const response = 'Name: lightspeed-app-server-abc-extra';
    const linked = injectResourceLinksInMarkdown(
      response,
      [
        {
          kind: 'Pod',
          name: 'lightspeed-app-server-abc',
          namespace: 'openshift-lightspeed',
        },
      ],
      testK8sModels,
    );

    strictEqual(linked, response);
  });
});
