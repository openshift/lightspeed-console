import { describe, it } from 'node:test';
import { strictEqual } from 'node:assert';

import {
  extractNodesFromTopContent,
  extractResourceRefs,
  extractResourcesFromText,
  extractResourcesFromToolContent,
} from '../src/resourceRefs';
import { testK8sModels } from './fixtures/k8sModels';

describe('extractResourcesFromText', () => {
  it('matches known kinds and ignores unknown PascalCase words', () => {
    const refs = extractResourcesFromText(
      'Pod payments-api in namespace payments while OpenShift Lightspeed investigates.',
      testK8sModels,
    );
    strictEqual(refs.length, 1);
    strictEqual(refs[0].kind, 'Pod');
    strictEqual(refs[0].name, 'payments-api');
    strictEqual(refs[0].namespace, 'payments');
  });

  it('resolves CRD kind names from models', () => {
    const refs = extractResourcesFromText(
      'VirtualMachine my-vm in namespace default failed to start.',
      testK8sModels,
    );
    strictEqual(refs.length, 1);
    strictEqual(refs[0].kind, 'kubevirt.io~v1~VirtualMachine');
  });

  it('ignores alert prose false positives', () => {
    const text = `Check the ClusterVersion object and consider clearing spec.channel.
Alertmanager is not configured. MachineConfigPool will never finish updating.`;
    const refs = extractResourcesFromText(text, testK8sModels);
    strictEqual(refs.length, 0);
  });

  it('parses Name: pod from LLM summary when pods tool ran', () => {
    const refs = extractResourceRefs(
      {
        t1: {
          args: { namespace: 'openshift-lightspeed' },
          content: '',
          name: 'pods_list_in_namespace',
          status: 'success',
        },
      },
      'Name: lightspeed-console-plugin-588df96978-7ngf7\nStatus: Running',
      testK8sModels,
    );
    strictEqual(refs.length, 1);
    strictEqual(refs[0].kind, 'Pod');
    strictEqual(refs[0].name, 'lightspeed-console-plugin-588df96978-7ngf7');
    strictEqual(refs[0].namespace, 'openshift-lightspeed');
  });
});

describe('extractResourceRefs', () => {
  it('normalizes refs to model keys', () => {
    const refs = extractResourceRefs(
      undefined,
      'Deployment reporting-service in namespace shared-services is unhealthy.',
      testK8sModels,
    );
    strictEqual(refs.length, 1);
    strictEqual(refs[0].kind, 'Deployment');
  });

  it('extracts pods from pods_list_in_namespace table content', () => {
    const tableContent = `NAMESPACE APIVERSION KIND NAME READY STATUS RESTARTS AGE IP NODE NOMINATED NODE READINESS GATES LABELS
openshift-lightspeed v1 Pod lightspeed-app-server-6975d49c5c-5rdlk 2/2 Running 0 2m29s 10.130.0.23 crc IP <none> <none>
openshift-lightspeed v1 Pod lightspeed-console-plugin-588df96978-7ngf7 1/1 Running 0 2m29s 10.129.0.20 crc IP <none> <none>`;

    const refs = extractResourceRefs(
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

    strictEqual(refs.length, 2);
    strictEqual(refs[0].kind, 'Pod');
    strictEqual(refs[0].name, 'lightspeed-app-server-6975d49c5c-5rdlk');
    strictEqual(refs[0].namespace, 'openshift-lightspeed');
  });

  it('extracts nodes from nodes_top table content', () => {
    const tableContent = `NAME                                           CPU(cores)   CPU(%)   MEMORY(bytes)   MEMORY(%)
ip-10-0-110-168.us-west-1.compute.internal     117m         3%       3233Mi          22%
ip-10-0-19-247.us-west-1.compute.internal      710m         20%      10120Mi         69%`;

    const refs = extractResourceRefs(
      {
        t1: {
          args: {},
          content: tableContent,
          name: 'nodes_top',
          status: 'success',
        },
      },
      undefined,
      testK8sModels,
    );

    strictEqual(refs.length, 2);
    strictEqual(refs[0].kind, 'Node');
    strictEqual(refs[0].name, 'ip-10-0-110-168.us-west-1.compute.internal');
    strictEqual(refs[1].name, 'ip-10-0-19-247.us-west-1.compute.internal');
  });

  it('extracts nodes from resources_list table content', () => {
    const tableContent = `APIVERSION KIND NAME STATUS ROLES AGE VERSION INTERNAL-IP EXTERNAL-IP OS-IMAGE KERNEL-VERSION CONTAINER-RUNTIME
v1 Node ip-10-0-110-168.us-west-1.compute.internal Ready worker 3h17m Red Hat Enterprise Linux CoreOS 10.0.110.168
v1 Node ip-10-0-19-247.us-west-1.compute.internal Ready control-plane,master 3h35m Red Hat Enterprise Linux CoreOS 10.0.19.247`;

    const refs = extractResourceRefs(
      {
        t1: {
          args: { apiVersion: 'v1', kind: 'Node' },
          content: tableContent,
          name: 'resources_list',
          status: 'success',
        },
      },
      undefined,
      testK8sModels,
    );

    strictEqual(refs.length, 2);
    strictEqual(refs[0].kind, 'Node');
    strictEqual(refs[0].name, 'ip-10-0-110-168.us-west-1.compute.internal');
  });

  it('extracts nodes from resources_list structured content', () => {
    const refs = extractResourceRefs(
      {
        t1: {
          args: { apiVersion: 'v1', kind: 'Node' },
          content: '',
          name: 'resources_list',
          status: 'success',
          structuredContent: {
            items: [
              { Name: 'ip-10-0-52-226.us-west-1.compute.internal', Status: 'Ready' },
              { Name: 'ip-10-0-82-49.us-west-1.compute.internal', Status: 'Ready' },
            ],
          },
        },
      },
      undefined,
      testK8sModels,
    );

    strictEqual(refs.length, 2);
    strictEqual(refs[0].kind, 'Node');
    strictEqual(refs[1].name, 'ip-10-0-82-49.us-west-1.compute.internal');
  });

  it('extracts namespaces from namespaces_list table content', () => {
    const tableContent = `APIVERSION KIND NAME STATUS AGE LABELS
v1 Namespace default Active 3h38m kubernetes.io/metadata.name=default
v1 Namespace openshift-lightspeed Active 169m pod-security.kubernetes.io/enforce=restricted`;

    const refs = extractResourceRefs(
      {
        t1: {
          args: {},
          content: tableContent,
          name: 'namespaces_list',
          status: 'success',
        },
      },
      undefined,
      testK8sModels,
    );

    strictEqual(refs.length, 2);
    strictEqual(refs[0].kind, 'Namespace');
    strictEqual(refs[0].name, 'default');
    strictEqual(refs[1].name, 'openshift-lightspeed');
  });

  it('extracts involved objects from events_list YAML content', () => {
    const eventsContent = `# The following events (YAML format) were found:
- InvolvedObject:
    APIVersion: v1
    Kind: Pod
    Name: redhat-operators-2mhcl
    Namespace: openshift-redhat-operators
  Message: Startup probe failed
  Type: Warning`;

    const refs = extractResourceRefs(
      {
        t1: {
          args: {},
          content: eventsContent,
          name: 'events_list',
          status: 'success',
        },
      },
      undefined,
      testK8sModels,
    );

    strictEqual(refs.length, 1);
    strictEqual(refs[0].kind, 'Pod');
    strictEqual(refs[0].name, 'redhat-operators-2mhcl');
    strictEqual(refs[0].namespace, 'openshift-redhat-operators');
  });

  it('extracts pod names from prose when pods or events tools ran', () => {
    const refs = extractResourceRefs(
      {
        t1: { args: {}, content: '', name: 'pods_list', status: 'success' },
        t2: { args: {}, content: '', name: 'events_list', status: 'success' },
      },
      'Events indicate a warning related to the redhat-operators-2mhcl pod.',
      testK8sModels,
    );

    strictEqual(refs.length, 1);
    strictEqual(refs[0].kind, 'Pod');
    strictEqual(refs[0].name, 'redhat-operators-2mhcl');
  });

  it('extracts namespaces from LLM vertical listing when namespaces_list ran', () => {
    const refs = extractResourceRefs(
      {
        t1: {
          args: {},
          content: '',
          name: 'namespaces_list',
          status: 'success',
        },
      },
      `Here are the OpenShift namespaces in the current cluster:

default
Active
3h38m
openshift-lightspeed
Active
169m`,
      testK8sModels,
    );

    strictEqual(refs.length, 2);
    strictEqual(refs[0].kind, 'Namespace');
    strictEqual(refs[0].name, 'default');
    strictEqual(refs[1].name, 'openshift-lightspeed');
  });

  it('extracts namespaces from namespaces_list YAML array', () => {
    const refs = extractResourcesFromToolContent(
      `- apiVersion: v1
  kind: Namespace
  metadata:
    name: default
- apiVersion: v1
  kind: Namespace
  metadata:
    name: kube-system`,
      'namespaces_list',
    );
    strictEqual(refs.length, 2);
    strictEqual(refs[0].kind, 'Namespace');
    strictEqual(refs[0].name, 'default');
    strictEqual(refs[1].name, 'kube-system');
  });

  it('extracts deployments from resources_list table content', () => {
    const tableContent = `NAMESPACE APIVERSION KIND NAME READY UP-TO-DATE AVAILABLE AGE CONTAINERS IMAGES SELECTOR
payments apps/v1 Deployment payments-api 2/2 2 2 3h10m payments-api registry/payments:latest app=payments
payments apps/v1 Deployment reporting-service 1/1 1 1 2h5m reporting-service registry/reporting:latest app=reporting`;

    const refs = extractResourceRefs(
      {
        t1: {
          args: { apiVersion: 'apps/v1', kind: 'Deployment', namespace: 'payments' },
          content: tableContent,
          name: 'resources_list',
          status: 'success',
        },
      },
      undefined,
      testK8sModels,
    );

    strictEqual(refs.length, 2);
    strictEqual(refs[0].kind, 'Deployment');
    strictEqual(refs[0].name, 'payments-api');
    strictEqual(refs[0].namespace, 'payments');
  });

  it('extracts routes from resources_list table content', () => {
    const tableContent = `NAMESPACE APIVERSION KIND NAME HOST/PORT PATH SERVICES PORT TERMINATION WILDCARD AGE LABELS
payments route.openshift.io/v1 Route payments-route payments.example.com / payments-api 8080 edge 15m app=payments`;

    const refs = extractResourceRefs(
      {
        t1: {
          args: { apiVersion: 'route.openshift.io/v1', kind: 'Route' },
          content: tableContent,
          name: 'resources_list',
          status: 'success',
        },
      },
      undefined,
      testK8sModels,
    );

    strictEqual(refs.length, 1);
    strictEqual(refs[0].kind, 'route.openshift.io~v1~Route');
    strictEqual(refs[0].name, 'payments-route');
    strictEqual(refs[0].namespace, 'payments');
  });

  it('extracts deployments from LLM vertical listing when resources_list ran', () => {
    const refs = extractResourceRefs(
      {
        t1: {
          args: { apiVersion: 'apps/v1', kind: 'Deployment', namespace: 'payments' },
          content: '',
          name: 'resources_list',
          status: 'success',
        },
      },
      `Here are the deployments in the payments namespace:

payments-api
2/2
3h10m
reporting-service
1/1
2h5m`,
      testK8sModels,
    );

    strictEqual(refs.length, 2);
    strictEqual(refs[0].kind, 'Deployment');
    strictEqual(refs[0].name, 'payments-api');
    strictEqual(refs[1].name, 'reporting-service');
  });

  it('extracts namespaces from namespaces_list structured content', () => {
    const refs = extractResourceRefs(
      {
        t1: {
          args: {},
          content: '',
          name: 'namespaces_list',
          status: 'success',
          structuredContent: {
            items: [
              { Name: 'default', Status: 'Active' },
              { Name: 'openshift-lightspeed', Status: 'Active' },
            ],
          },
        },
      },
      undefined,
      testK8sModels,
    );

    strictEqual(refs.length, 2);
    strictEqual(refs[0].kind, 'Namespace');
    strictEqual(refs[1].name, 'openshift-lightspeed');
  });
});

describe('extractResourcesFromToolContent', () => {
  it('parses PodList JSON items', () => {
    const refs = extractResourcesFromToolContent(
      JSON.stringify({
        kind: 'PodList',
        items: [
          {
            kind: 'Pod',
            metadata: { name: 'api', namespace: 'payments' },
          },
        ],
      }),
    );
    strictEqual(refs.length, 1);
    strictEqual(refs[0].name, 'api');
  });

  it('parses nodes_top metrics table rows', () => {
    const refs = extractResourcesFromToolContent(
      `NAME       CPU(cores)   CPU(%)   MEMORY(bytes)   MEMORY(%)
worker-1     117m         3%       3233Mi          22%`,
      'nodes_top',
    );
    strictEqual(refs.length, 1);
    strictEqual(refs[0].kind, 'Node');
    strictEqual(refs[0].name, 'worker-1');
  });
});

describe('extractNodesFromTopContent', () => {
  it('skips the header row and deduplicates node names', () => {
    const refs = extractNodesFromTopContent(
      `NAME       CPU(cores)   CPU(%)   MEMORY(bytes)   MEMORY(%)
node-a     100m         1%       1000Mi          10%
node-a     100m         1%       1000Mi          10%
node-b     200m         2%       2000Mi          20%`,
    );
    strictEqual(refs.length, 2);
    strictEqual(refs[0].name, 'node-a');
    strictEqual(refs[1].name, 'node-b');
  });
});
