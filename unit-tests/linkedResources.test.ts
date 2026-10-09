import { describe, it } from 'node:test';
import { strictEqual } from 'node:assert';

import {
  extractLinkedResources,
  getInlineLinkedResources,
  getLinkedResourceOverflow,
  isLinkableResource,
  isPlausibleResourceRef,
  MAX_LINKED_RESOURCES,
  MAX_LINKED_RESOURCES_POD_LIST,
  prioritizeLinkedResources,
} from '../src/linkedResources';
import { Tool } from '../src/types';
import { testK8sModels } from './fixtures/k8sModels';

describe('isLinkableResource', () => {
  it('accepts cluster-scoped CRDs such as FlowCollector', () => {
    strictEqual(
      isLinkableResource({ kind: 'FlowCollector', name: 'cluster' }, testK8sModels),
      true,
    );
  });

  it('accepts namespaced CRDs with a namespace', () => {
    strictEqual(
      isLinkableResource(
        {
          kind: 'FlowCollectorSlice',
          name: 'tenant-a',
          namespace: 'netobserv',
        },
        testK8sModels,
      ),
      true,
    );
  });

  it('rejects list placeholders where the name equals the kind', () => {
    strictEqual(
      isPlausibleResourceRef(
        { kind: 'Deployment', name: 'Deployment', namespace: 'payments' },
        testK8sModels,
      ),
      false,
    );
  });
});

describe('prioritizeLinkedResources', () => {
  it('moves the pod named in the response text to the front', () => {
    const refs = prioritizeLinkedResources(
      [
        {
          kind: 'Pod',
          name: 'lightspeed-app-server-6975d49c5c-5rdlk',
          namespace: 'openshift-lightspeed',
        },
        {
          kind: 'Pod',
          name: 'lightspeed-console-plugin-588df96978-wcjqj',
          namespace: 'openshift-lightspeed',
        },
      ],
      'Name: lightspeed-console-plugin-588df96978-wcjqj\nStatus: Running',
    );

    strictEqual(refs[0].name, 'lightspeed-console-plugin-588df96978-wcjqj');
  });

  it('prioritizes every pod named in the response before unmentioned pods', () => {
    const refs = prioritizeLinkedResources(
      [
        { kind: 'Pod', name: 'pod-a', namespace: 'ns' },
        { kind: 'Pod', name: 'pod-b', namespace: 'ns' },
        { kind: 'Pod', name: 'pod-c', namespace: 'ns' },
        { kind: 'Pod', name: 'pod-d', namespace: 'ns' },
      ],
      'Name: pod-d\nName: pod-b',
    );

    strictEqual(refs[0].name, 'pod-d');
    strictEqual(refs[1].name, 'pod-b');
    strictEqual(refs[2].name, 'pod-a');
    strictEqual(refs[3].name, 'pod-c');
  });
});

describe('extractLinkedResources', () => {
  it('returns watchable resources from tools', () => {
    const tools: Record<string, Tool> = {
      t1: {
        args: { name: 'payments-api', namespace: 'payments' },
        content: '',
        name: 'pods_get',
        status: 'success',
      },
      t2: {
        args: {
          kind: 'Deployment',
          name: 'reporting-service',
          namespace: 'shared-services',
        },
        content: '',
        name: 'resources_get',
        status: 'success',
      },
    };

    const refs = extractLinkedResources(tools, undefined, testK8sModels);
    strictEqual(refs.length, 2);
    strictEqual(refs[0].kind, 'Pod');
    strictEqual(refs[1].kind, 'Deployment');
  });

  it('includes FlowCollector from resources_get', () => {
    const tools: Record<string, Tool> = {
      t1: {
        args: { kind: 'FlowCollector', name: 'cluster' },
        content: '',
        name: 'resources_get',
        status: 'success',
      },
    };

    const refs = extractLinkedResources(tools, undefined, testK8sModels);
    strictEqual(refs.length, 1);
    strictEqual(refs[0].kind, 'flows.netobserv.io~v1beta2~FlowCollector');
    strictEqual(refs[0].name, 'cluster');
  });

  it('caps the number of live widgets', () => {
    const tools: Record<string, Tool> = Object.fromEntries(
      Array.from({ length: MAX_LINKED_RESOURCES + 2 }, (_, index) => [
        `t${index}`,
        {
          args: { name: `pod-${index}`, namespace: 'payments' },
          content: '',
          name: 'pods_get',
          status: 'success',
        } satisfies Tool,
      ]),
    );

    strictEqual(
      extractLinkedResources(tools, undefined, testK8sModels).length,
      MAX_LINKED_RESOURCES,
    );
  });

  it('skips resources without a namespace except cluster-scoped kinds', () => {
    const tools: Record<string, Tool> = {
      t1: {
        args: { name: 'payments-api' },
        content: '',
        name: 'pods_get',
        status: 'success',
      },
      t2: {
        args: { name: 'worker-1' },
        content: '',
        name: 'nodes_top',
        status: 'success',
      },
    };

    const refs = extractLinkedResources(tools, undefined, testK8sModels);
    strictEqual(refs.length, 1);
    strictEqual(refs[0].kind, 'Node');
  });

  it('includes pods from pods_list_in_namespace table content', () => {
    const tableContent = `openshift-lightspeed v1 Pod lightspeed-app-server-abc 2/2 Running 0 1m 10.0.0.1 node <none> <none> <none>`;
    const refs = extractLinkedResources(
      {
        t1: {
          args: { namespace: 'openshift-lightspeed' },
          content: tableContent,
          name: 'pods_list_in_namespace',
          status: 'success',
        },
      },
      undefined,
      testK8sModels,
    );
    strictEqual(refs.length, 1);
    strictEqual(refs[0].name, 'lightspeed-app-server-abc');
  });

  it('includes every pod from a namespace pod list up to the pod-list cap', () => {
    const tableRows = Array.from(
      { length: 4 },
      (_, index) =>
        `openshift-lightspeed v1 Pod lightspeed-pod-${index} 1/1 Running 0 1m 10.0.0.${index} node <none> <none> <none>`,
    ).join('\n');
    const tools: Record<string, Tool> = {
      t1: {
        args: { namespace: 'openshift-lightspeed' },
        content: tableRows,
        name: 'pods_list_in_namespace',
        status: 'success',
      },
    };

    const refs = extractLinkedResources(tools, undefined, testK8sModels);
    strictEqual(refs.length, 4);
    strictEqual(refs[3].name, 'lightspeed-pod-3');
  });

  it('includes pods from events_list involved objects', () => {
    const eventsContent = `# The following events (YAML format) were found:
- InvolvedObject:
    Kind: Pod
    Name: redhat-operators-2mhcl
    Namespace: openshift-redhat-operators
  Type: Warning`;

    const refs = extractLinkedResources(
      {
        t1: { args: {}, content: '', name: 'pods_list', status: 'success' },
        t2: { args: {}, content: eventsContent, name: 'events_list', status: 'success' },
      },
      'Warning related to the redhat-operators-2mhcl pod.',
      testK8sModels,
    );

    strictEqual(refs.length, 1);
    strictEqual(refs[0].kind, 'Pod');
    strictEqual(refs[0].name, 'redhat-operators-2mhcl');
    strictEqual(refs[0].namespace, 'openshift-redhat-operators');
  });

  it('includes nodes from nodes_top table content', () => {
    const tableContent = `NAME                                           CPU(cores)   CPU(%)   MEMORY(bytes)   MEMORY(%)
ip-10-0-110-168.us-west-1.compute.internal     117m         3%       3233Mi          22%
ip-10-0-19-247.us-west-1.compute.internal      710m         20%      10120Mi         69%
ip-10-0-52-226.us-west-1.compute.internal      148m         4%       3019Mi          20%
ip-10-0-82-49.us-west-1.compute.internal       182m         5%       2968Mi          20%`;
    const tools: Record<string, Tool> = {
      t1: {
        args: {},
        content: tableContent,
        name: 'nodes_top',
        status: 'success',
      },
    };

    const refs = extractLinkedResources(tools, undefined, testK8sModels);
    strictEqual(refs.length, 4);
    strictEqual(refs[0].kind, 'Node');
    strictEqual(refs[0].name, 'ip-10-0-110-168.us-west-1.compute.internal');
  });

  it('includes nodes from resources_list table content', () => {
    const tableContent = `APIVERSION KIND NAME STATUS ROLES AGE VERSION INTERNAL-IP EXTERNAL-IP OS-IMAGE KERNEL-VERSION CONTAINER-RUNTIME
v1 Node ip-10-0-110-168.us-west-1.compute.internal Ready worker 3h17m Red Hat Enterprise Linux CoreOS 10.0.110.168
v1 Node ip-10-0-19-247.us-west-1.compute.internal Ready control-plane,master 3h35m Red Hat Enterprise Linux CoreOS 10.0.19.247
v1 Node ip-10-0-52-226.us-west-1.compute.internal Ready worker 3h16m Red Hat Enterprise Linux CoreOS 10.0.52.226
v1 Node ip-10-0-82-49.us-west-1.compute.internal Ready worker 3h17m Red Hat Enterprise Linux CoreOS 10.0.82.49`;
    const tools: Record<string, Tool> = {
      t1: {
        args: { apiVersion: 'v1', kind: 'Node' },
        content: tableContent,
        name: 'resources_list',
        status: 'success',
      },
    };

    const refs = extractLinkedResources(tools, undefined, testK8sModels);
    strictEqual(refs.length, 4);
    strictEqual(refs[0].kind, 'Node');
    strictEqual(refs[0].name, 'ip-10-0-110-168.us-west-1.compute.internal');
  });

  it('includes namespaces from namespaces_list table content', () => {
    const tableContent = `APIVERSION KIND NAME STATUS AGE LABELS
v1 Namespace default Active 3h38m kubernetes.io/metadata.name=default
v1 Namespace kube-system Active 3h38m kubernetes.io/metadata.name=kube-system
v1 Namespace openshift Active 3h33m kubernetes.io/metadata.name=openshift
v1 Namespace openshift-lightspeed Active 169m pod-security.kubernetes.io/enforce=restricted`;
    const tools: Record<string, Tool> = {
      t1: {
        args: {},
        content: tableContent,
        name: 'namespaces_list',
        status: 'success',
      },
    };

    const refs = extractLinkedResources(tools, undefined, testK8sModels);
    strictEqual(refs.length, 4);
    strictEqual(refs[0].kind, 'Namespace');
    strictEqual(refs[0].name, 'default');
  });

  it('includes namespaces from LLM vertical listing when namespaces_list ran', () => {
    const tools: Record<string, Tool> = {
      t1: {
        args: {},
        content: '',
        name: 'namespaces_list',
        status: 'success',
      },
    };
    const response = `Here are the OpenShift namespaces in the current cluster:

default
Active
3h38m
openshift-lightspeed
Active
169m`;

    const refs = extractLinkedResources(tools, response, testK8sModels);
    strictEqual(refs.length, 2);
    strictEqual(refs[0].kind, 'Namespace');
    strictEqual(refs[0].name, 'default');
    strictEqual(refs[1].name, 'openshift-lightspeed');
  });

  it('includes deployments from resources_list table content', () => {
    const tableContent = `NAMESPACE APIVERSION KIND NAME READY UP-TO-DATE AVAILABLE AGE CONTAINERS IMAGES SELECTOR
payments apps/v1 Deployment payments-api 2/2 2 2 3h10m payments-api registry/payments:latest app=payments
payments apps/v1 Deployment reporting-service 1/1 1 1 2h5m reporting-service registry/reporting:latest app=reporting`;
    const tools: Record<string, Tool> = {
      t1: {
        args: { apiVersion: 'apps/v1', kind: 'Deployment', namespace: 'payments' },
        content: tableContent,
        name: 'resources_list',
        status: 'success',
      },
    };

    const refs = extractLinkedResources(tools, undefined, testK8sModels);
    strictEqual(refs.length, 2);
    strictEqual(refs[0].kind, 'Deployment');
    strictEqual(refs[0].name, 'payments-api');
  });

  it('prioritizes pods mentioned in the response before applying the default cap', () => {
    const tableRows = [
      'openshift-lightspeed v1 Pod lightspeed-pod-0 1/1 Running 0 1m 10.0.0.0 node <none> <none> <none>',
      'openshift-lightspeed v1 Pod lightspeed-pod-1 1/1 Running 0 1m 10.0.0.1 node <none> <none> <none>',
      'openshift-lightspeed v1 Pod lightspeed-pod-2 1/1 Running 0 1m 10.0.0.2 node <none> <none> <none>',
      'openshift-lightspeed v1 Pod lightspeed-postgres-server-77dd7fb495-r6gsf 1/1 Running 1 3m 10.130.0.20 node <none> <none> <none>',
    ].join('\n');
    const tools: Record<string, Tool> = {
      t1: {
        args: { namespace: 'openshift-lightspeed' },
        content: tableRows,
        name: 'pods_list_in_namespace',
        status: 'success',
      },
    };
    const responseText = `Pods in openshift-lightspeed are healthy.

Name: lightspeed-postgres-server-77dd7fb495-r6gsf
Ready: 1/1
Restarts: 1`;

    const refs = extractLinkedResources(tools, responseText, testK8sModels);
    strictEqual(refs.length, 4);
    strictEqual(refs[0].name, 'lightspeed-postgres-server-77dd7fb495-r6gsf');
  });

  it('reports overflow when more resources exist than the live widget cap', () => {
    const tableRows = Array.from(
      { length: MAX_LINKED_RESOURCES_POD_LIST + 2 },
      (_, index) =>
        `openshift-lightspeed v1 Pod lightspeed-pod-${index} 1/1 Running 0 1m 10.0.0.${index} node <none> <none> <none>`,
    ).join('\n');
    const tools: Record<string, Tool> = {
      t1: {
        args: { namespace: 'openshift-lightspeed' },
        content: tableRows,
        name: 'pods_list_in_namespace',
        status: 'success',
      },
    };

    const overflow = getLinkedResourceOverflow(tools, undefined, testK8sModels);
    strictEqual(overflow.shown, MAX_LINKED_RESOURCES_POD_LIST);
    strictEqual(overflow.total, MAX_LINKED_RESOURCES_POD_LIST + 2);
  });
});

describe('getInlineLinkedResources', () => {
  it('returns only linkable resources whose names appear in the response text', () => {
    const tools: Record<string, Tool> = {
      t1: {
        args: { name: 'payments-api', namespace: 'payments' },
        content: '',
        name: 'pods_get',
        status: 'success',
      },
      t2: {
        args: {
          kind: 'Deployment',
          name: 'reporting-service',
          namespace: 'shared-services',
        },
        content: '',
        name: 'resources_get',
        status: 'success',
      },
    };

    const refs = getInlineLinkedResources(
      tools,
      'The payments-api pod is healthy but the deployment was not discussed.',
      testK8sModels,
    );
    strictEqual(refs.length, 1);
    strictEqual(refs[0].name, 'payments-api');
  });
});
