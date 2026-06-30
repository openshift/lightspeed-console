import { describe, it } from 'node:test';
import { strictEqual } from 'node:assert';

import { buildResourceNarration, extractEvidenceSteps, hasEvidenceTour } from '../src/evidenceTour';
import { Tool } from '../src/types';
import { testK8sModels } from './fixtures/k8sModels';

describe('extractEvidenceSteps', () => {
  it('extracts steps from pods_get tool args', () => {
    const tools: Record<string, Tool> = {
      t1: {
        args: { name: 'payments-api', namespace: 'payments' },
        content: '',
        name: 'pods_get',
        status: 'success',
      },
    };

    const steps = extractEvidenceSteps(tools, undefined, testK8sModels);
    strictEqual(steps.length, 1);
    strictEqual(steps[0].path, '/k8s/ns/payments/pods/payments-api');
    strictEqual(steps[0].source, 'tool');
  });

  it('extracts steps from resources_get tool args', () => {
    const tools: Record<string, Tool> = {
      t1: {
        args: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          name: 'reporting-service',
          namespace: 'shared-services',
        },
        content: '',
        name: 'resources_get',
        status: 'success',
      },
    };

    const steps = extractEvidenceSteps(tools, undefined, testK8sModels);
    strictEqual(steps.length, 1);
    strictEqual(steps[0].path, '/k8s/ns/shared-services/deployments/reporting-service');
  });

  it('extracts resource from tool JSON content', () => {
    const tools: Record<string, Tool> = {
      t1: {
        args: {},
        content: JSON.stringify({
          kind: 'Service',
          metadata: { name: 'payments-api', namespace: 'payments' },
        }),
        name: 'resources_list',
        status: 'success',
      },
    };

    const steps = extractEvidenceSteps(tools, undefined, testK8sModels);
    strictEqual(steps.length, 1);
    strictEqual(steps[0].path, '/k8s/ns/payments/services/payments-api');
  });

  it('deduplicates steps by console path', () => {
    const tools: Record<string, Tool> = {
      t1: {
        args: { name: 'payments-api', namespace: 'payments' },
        content: '',
        name: 'pods_get',
        status: 'success',
      },
      t2: {
        args: { name: 'payments-api', namespace: 'payments' },
        content: '',
        name: 'pods_log',
        status: 'success',
      },
    };

    strictEqual(extractEvidenceSteps(tools, undefined, testK8sModels).length, 1);
  });

  it('skips denied and errored tools', () => {
    const tools: Record<string, Tool> = {
      t1: {
        args: { name: 'payments-api', namespace: 'payments' },
        content: '',
        isDenied: true,
        name: 'pods_get',
        status: 'success',
      },
      t2: {
        args: { name: 'other', namespace: 'payments' },
        content: '',
        name: 'pods_get',
        status: 'error',
      },
    };

    strictEqual(extractEvidenceSteps(tools, undefined, testK8sModels).length, 0);
  });

  it('extracts resources mentioned in response text', () => {
    const text =
      'The Pod payments-api in namespace payments is failing while Deployment reporting-service leaks connections.';
    const steps = extractEvidenceSteps(undefined, text, testK8sModels);
    strictEqual(steps.length, 2);
    strictEqual(steps[0].source, 'tool');
    strictEqual(steps[1].path, '/k8s/ns/payments/deployments/reporting-service');
  });

  it('builds FlowCollector path from the model key', () => {
    const tools: Record<string, Tool> = {
      t1: {
        args: { kind: 'FlowCollector', name: 'cluster' },
        content: '',
        name: 'resources_get',
        status: 'success',
      },
    };

    const steps = extractEvidenceSteps(tools, undefined, testK8sModels);
    strictEqual(steps.length, 1);
    strictEqual(steps[0].path, '/k8s/cluster/flows.netobserv.io~v1beta2~FlowCollector/cluster');
  });

  it('hasEvidenceTour reflects step count', () => {
    strictEqual(hasEvidenceTour(undefined, undefined, testK8sModels), false);
    strictEqual(
      hasEvidenceTour(
        {
          t1: {
            args: { name: 'api', namespace: 'payments' },
            content: '',
            name: 'pods_get',
            status: 'success',
          },
        },
        undefined,
        testK8sModels,
      ),
      true,
    );
  });

  it('uses response details for the named pod in tour narration', () => {
    const responseText = `The lightspeed-console-plugin pod is running successfully.

Name: lightspeed-console-plugin-588df96978-wcjqj
Status: Running
Ready: 1/1
Restarts: 0`;

    const steps = extractEvidenceSteps(
      {
        t1: {
          args: { namespace: 'openshift-lightspeed' },
          content: `openshift-lightspeed v1 Pod lightspeed-app-server-6975d49c5c-5rdlk 2/2 Running 0 2m29s
openshift-lightspeed v1 Pod lightspeed-console-plugin-588df96978-wcjqj 1/1 Running 0 2m29s`,
          name: 'pods_list_in_namespace',
          status: 'success',
        },
      },
      responseText,
      testK8sModels,
    );

    const pluginStep = steps.find((step) => step.label.includes('lightspeed-console-plugin-588df96978-wcjqj'));
    strictEqual(pluginStep !== undefined, true);
    strictEqual(pluginStep?.narration.includes('Status: Running'), true);
    strictEqual(pluginStep?.narration.includes('Ready: 1/1'), true);
  });

  it('falls back to tool table output when response has no details', () => {
    const narration = buildResourceNarration(
      { kind: 'Pod', name: 'payments-api', namespace: 'payments' },
      testK8sModels,
      undefined,
      {
        t1: {
          args: { namespace: 'payments' },
          content: 'payments v1 Pod payments-api 1/1 Running 0 10m 10.0.0.1 node',
          name: 'pods_list_in_namespace',
          status: 'success',
        },
      },
    );

    strictEqual(narration.includes('Ready: 1/1'), true);
    strictEqual(narration.includes('Status: Running'), true);
  });
});
