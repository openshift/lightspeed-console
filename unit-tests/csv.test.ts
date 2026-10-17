import { deepStrictEqual, strictEqual, throws } from 'node:assert';
import { describe, it } from 'node:test';

import { buildConsoleImagePatch, ClusterServiceVersion } from '../tests/support/csv';

const CONSOLE_IMAGE = 'quay.io/example/lightspeed-console-plugin:pr-1234';

const classicDeployment = () => ({
  name: 'lightspeed-operator-controller-manager',
  spec: {
    template: {
      spec: {
        containers: [
          {
            name: 'manager',
            args: [
              '--leader-elect',
              '--console-image=registry.redhat.io/openshift-lightspeed/plugin@sha256:aaa',
              '--console-image-pf5=registry.redhat.io/openshift-lightspeed/plugin-pf5@sha256:bbb',
              '--console-image-4-19=registry.redhat.io/openshift-lightspeed/plugin-419@sha256:ccc',
            ],
          },
        ],
      },
    },
  },
});

const agenticDeployment = () => ({
  name: 'lightspeed-agentic-operator-controller-manager',
  spec: {
    template: {
      spec: {
        containers: [{ name: 'manager', args: ['--leader-elect', '--sandbox-mode=bare-pod'] }],
      },
    },
  },
});

const relatedImages = () => [
  {
    name: 'lightspeed-service-api',
    image: 'registry.redhat.io/openshift-lightspeed/service@sha256:ddd',
  },
  {
    name: 'lightspeed-console-plugin',
    image: 'registry.redhat.io/openshift-lightspeed/plugin@sha256:aaa',
  },
  {
    name: 'lightspeed-console-plugin-pf5',
    image: 'registry.redhat.io/openshift-lightspeed/plugin-pf5@sha256:bbb',
  },
  {
    name: 'lightspeed-console-plugin-4-19',
    image: 'registry.redhat.io/openshift-lightspeed/plugin-419@sha256:ccc',
  },
];

const csvWith = (deployments: unknown[]): ClusterServiceVersion =>
  ({
    spec: { install: { spec: { deployments } }, relatedImages: relatedImages() },
  }) as ClusterServiceVersion;

describe('buildConsoleImagePatch', () => {
  it('targets the classic operator when the agentic operator is listed first', () => {
    const patch = buildConsoleImagePatch(
      csvWith([agenticDeployment(), classicDeployment()]),
      CONSOLE_IMAGE,
    );
    const argsOp = patch.find((op) => op.path.includes('/deployments/'));
    strictEqual(
      argsOp.path,
      '/spec/install/spec/deployments/1/spec/template/spec/containers/0/args',
    );
  });

  it('targets index 0 when the classic operator is the only deployment', () => {
    const patch = buildConsoleImagePatch(csvWith([classicDeployment()]), CONSOLE_IMAGE);
    const argsOp = patch.find((op) => op.path.includes('/deployments/'));
    strictEqual(
      argsOp.path,
      '/spec/install/spec/deployments/0/spec/template/spec/containers/0/args',
    );
  });

  it('rewrites every console image argument and leaves other arguments alone', () => {
    const patch = buildConsoleImagePatch(
      csvWith([agenticDeployment(), classicDeployment()]),
      CONSOLE_IMAGE,
    );
    const argsOp = patch.find((op) => op.path.includes('/deployments/'));
    deepStrictEqual(argsOp.value, [
      '--leader-elect',
      `--console-image=${CONSOLE_IMAGE}`,
      `--console-image-pf5=${CONSOLE_IMAGE}`,
      `--console-image-4-19=${CONSOLE_IMAGE}`,
    ]);
  });

  it('replaces the related images that match the console image arguments', () => {
    const patch = buildConsoleImagePatch(
      csvWith([agenticDeployment(), classicDeployment()]),
      CONSOLE_IMAGE,
    );
    const relatedImageOps = patch.filter((op) => op.path.startsWith('/spec/relatedImages/'));
    deepStrictEqual(relatedImageOps.map((op) => op.path).sort(), [
      '/spec/relatedImages/1/image',
      '/spec/relatedImages/2/image',
      '/spec/relatedImages/3/image',
    ]);
    strictEqual(
      relatedImageOps.every((op) => op.value === CONSOLE_IMAGE),
      true,
    );
  });

  it('selects the container that carries the console image arguments', () => {
    const deployment = classicDeployment();
    deployment.spec.template.spec.containers.unshift({
      name: 'kube-rbac-proxy',
      args: ['--secure-listen-address=0.0.0.0:8443'],
    });
    const patch = buildConsoleImagePatch(csvWith([deployment]), CONSOLE_IMAGE);
    const argsOp = patch.find((op) => op.path.includes('/deployments/'));
    strictEqual(
      argsOp.path,
      '/spec/install/spec/deployments/0/spec/template/spec/containers/1/args',
    );
  });

  it('throws when the classic operator deployment is missing', () => {
    throws(
      () => buildConsoleImagePatch(csvWith([agenticDeployment()]), CONSOLE_IMAGE),
      /no deployment named lightspeed-operator-controller-manager/,
    );
  });

  it('throws when the classic operator has no console image argument', () => {
    const deployment = classicDeployment();
    deployment.spec.template.spec.containers[0].args = ['--leader-elect'];
    throws(
      () => buildConsoleImagePatch(csvWith([deployment]), CONSOLE_IMAGE),
      /has a --console-image argument/,
    );
  });
});
