// The unified operator bundle ships two controller deployments and the CSV lists them in an order
// we do not control, so everything here selects by name rather than by index
export const CLASSIC_OPERATOR_DEPLOYMENT = 'lightspeed-operator-controller-manager';

export const CONSOLE_PLUGIN_CONTAINER = 'lightspeed-console-plugin';
export const CONSOLE_PLUGIN_DEPLOYMENT = 'lightspeed-console-plugin';

const CONSOLE_IMAGE_ARG = '--console-image';

const ARG_TO_RELATED_IMAGE: Record<string, string> = {
  '--console-image-4-19': 'lightspeed-console-plugin-4-19',
  '--console-image-pf5': 'lightspeed-console-plugin-pf5',
  '--console-image=': 'lightspeed-console-plugin',
};

type Container = { args?: string[]; name: string };

type Deployment = { name: string; spec: { template: { spec: { containers: Container[] } } } };

type RelatedImage = { image: string; name: string };

export type ClusterServiceVersion = {
  spec: {
    install: { spec: { deployments: Deployment[] } };
    relatedImages?: RelatedImage[];
  };
};

export type JsonPatchOperation = { op: string; path: string; value: string | string[] };

export const buildConsoleImagePatch = (
  csv: ClusterServiceVersion,
  consoleImage: string,
): JsonPatchOperation[] => {
  const deployments = csv.spec?.install?.spec?.deployments ?? [];
  const deploymentIndex = deployments.findIndex(({ name }) => name === CLASSIC_OPERATOR_DEPLOYMENT);
  if (deploymentIndex === -1) {
    const found = deployments.map(({ name }) => name).join(', ') || 'none';
    throw new Error(`CSV has no deployment named ${CLASSIC_OPERATOR_DEPLOYMENT} (found: ${found})`);
  }

  const containers = deployments[deploymentIndex].spec?.template?.spec?.containers ?? [];
  const containerIndex = containers.findIndex(({ args }) =>
    (args ?? []).some((arg) => arg.startsWith(CONSOLE_IMAGE_ARG)),
  );
  if (containerIndex === -1) {
    throw new Error(
      `No container in ${CLASSIC_OPERATOR_DEPLOYMENT} has a ${CONSOLE_IMAGE_ARG} argument`,
    );
  }

  const args = containers[containerIndex].args;
  const relatedImages = csv.spec.relatedImages ?? [];

  const relatedImageOps = args.flatMap((arg) =>
    Object.entries(ARG_TO_RELATED_IMAGE)
      .filter(([prefix]) => arg.startsWith(prefix))
      .map(([, relatedImageName]) =>
        relatedImages.findIndex(({ name }) => name === relatedImageName),
      )
      .filter((index) => index !== -1)
      .map((index) => ({
        op: 'replace',
        path: `/spec/relatedImages/${index}/image`,
        value: consoleImage,
      })),
  );

  const updatedArgs = args.map((arg) =>
    arg.startsWith(CONSOLE_IMAGE_ARG) ? arg.replace(/=.*/, `=${consoleImage}`) : arg,
  );

  return [
    ...relatedImageOps,
    {
      op: 'replace',
      path:
        `/spec/install/spec/deployments/${deploymentIndex}` +
        `/spec/template/spec/containers/${containerIndex}/args`,
      value: updatedArgs,
    },
  ];
};
