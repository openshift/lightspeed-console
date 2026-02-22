# OpenShift Lightspeed Console Plugin

This project is a console plugin for the
[OpenShift Lightspeed AI assistant](https://github.com/openshift/lightspeed-service)
project.

[Dynamic plugins](https://github.com/openshift/console/tree/main/frontend/packages/console-dynamic-plugin-sdk)
allow you to extend the [OpenShift UI](https://github.com/openshift/console) at
runtime, adding custom pages and other extensions. They are based on
[webpack module federation](https://webpack.js.org/concepts/module-federation/).
Plugins are registered with console using the `ConsolePlugin` custom resource
and enabled in the console operator config by a cluster administrator.

Requires OpenShift 4.16 or higher.

- `main` branch supports OpenShift 4.19+
- `pattern-fly-5` branch supports OpenShift 4.16 – 4.18

[Node.js](https://nodejs.org/en/) >= 22 and [npm](https://www.npmjs.com) are
required to build and run. To run OpenShift console in a container, either
[Docker](https://www.docker.com) or [podman 3.2.0+](https://podman.io) and
[oc](https://console.redhat.com/openshift/downloads) are required.

## Development

### Option 1: Local

In one terminal window, run:

1. `npm install`
2. `npm run start`

In another terminal window, run:

1. `oc login` (requires [oc](https://console.redhat.com/openshift/downloads) and
   an [OpenShift cluster](https://console.redhat.com/openshift/create))
2. `npm run start-console` (requires [Docker](https://www.docker.com) or
   [podman 3.2.0+](https://podman.io))

This will run the OpenShift console in a container connected to the cluster
you've logged into. The plugin HTTP server runs on port 9001 with CORS enabled.
Navigate to <http://localhost:9000> to see the running plugin.

For the OLS API calls to succeed, you need to set the `OLS_API_BEARER_TOKEN`
environment variable to a valid bearer token.

If your Lightspeed service is running locally on `http://localhost:8080`, the
`start-console.sh` script includes a proxy configuration that routes requests
through the console, avoiding CORS issues.

#### Running start-console with Apple silicon and podman

If you are using podman on a Mac with Apple silicon, `npm run start-console`
might fail since it runs an amd64 image. You can work around the problem with
[qemu-user-static](https://github.com/multiarch/qemu-user-static) by running
these commands:

```bash
podman machine ssh
sudo -i
rpm-ostree install qemu-user-static
systemctl reboot
```

### Option 2: Docker + VSCode Remote Container

Make sure the
[Remote Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
extension is installed. This method uses Docker Compose where one container is
the OpenShift console and the second container is the plugin. It requires that
you have access to an existing OpenShift cluster. After the initial build, the
cached containers will help you start developing in seconds.

1. Create a `dev.env` file inside the `.devcontainer` folder with the correct
   values for your cluster:

```bash
OC_PLUGIN_NAME=openshift-console-plugin
OC_URL=https://api.example.com:6443
OC_USER=kubeadmin
OC_PASS=<password>
```

2. `(Ctrl+Shift+P) => Remote Containers: Open Folder in Container...`
3. `npm run start`
4. Navigate to <http://localhost:9000>

## Docker image

Before you can deploy your plugin on a cluster, you must build an image and push
it to an image registry.

1. Build the image:

   ```sh
   docker build -t quay.io/my-repository/my-plugin:latest .
   ```

2. Run the image:

   ```sh
   docker run -it --rm -d -p 9001:80 quay.io/my-repository/my-plugin:latest
   ```

3. Push the image:

   ```sh
   docker push quay.io/my-repository/my-plugin:latest
   ```

NOTE: If you have a Mac with Apple silicon, you will need to add the flag
`--platform=linux/amd64` when building the image to target the correct platform
to run in-cluster.

## i18n

To avoid naming conflicts, the `plugin__lightspeed-console-plugin` i18n
namespace is used for all translations. You can use the `useTranslation` hook
with this namespace as follows:

```tsx
const Header: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');
  return <h1>{t('Hello, World!')}</h1>;
};
```

For labels in `console-extensions.json`, you can use the format
`%plugin__lightspeed-console-plugin~My Label%`. Console will replace the value
with the message for the current language from the
`plugin__lightspeed-console-plugin` namespace. For example:

```json
{
  "type": "console.navigation/section",
  "properties": {
    "id": "admin-demo-section",
    "perspective": "admin",
    "name": "%plugin__lightspeed-console-plugin~My Label%"
  }
}
```

Running `npm run i18n` updates the JSON files in the `locales` folder when
adding or changing messages.

## Linting

This project uses Prettier, ESLint, and Stylelint for code linting.

Run `npm run lint-fix` to lint and to automatically fix issues where possible.

The Stylelint config disallows hex colors since these cause problems with dark
mode. You should use the
[PatternFly design tokens](https://www.patternfly.org/tokens/all-patternfly-tokens/)
for colors instead.

The Stylelint config also disallows naked element selectors like `table` and
`.pf-` or `.co-` prefixed classes. This prevents plugins from accidentally
overwriting default console styles, breaking the layout of existing pages. The
best practice is to prefix your CSS classnames with your plugin name to avoid
conflicts. Please don't disable these rules without understanding how they can
break console styles!

## Opening the OpenShift Lightspeed UI from other console pages and plugins

Other OpenShift console pages and plugins can open the OpenShift Lightspeed UI
with an optional initial query using the extension discovery pattern.

### Example

```typescript
import { Button, Spinner } from '@patternfly/react-core';
import { useResolvedExtensions } from '@openshift-console/dynamic-plugin-sdk';
import {
  Extension,
  ExtensionDeclaration,
} from '@openshift-console/dynamic-plugin-sdk/lib/types';

import { Attachment } from '../types';

type OpenOLSHandlerProps = {
  contextId: string;
  provider: () => (prompt?: string, attachments?: Attachment[]) => void;
};

type OpenOLSHandlerExtension = ExtensionDeclaration<
  'console.action/provider',
  OpenOLSHandlerProps
>;

// Type guard for OpenShift Lightspeed open handler extensions
const isOpenOLSHandlerExtension = (
  e: Extension,
): e is OpenOLSHandlerExtension =>
  e.type === 'console.action/provider' &&
  e.properties?.contextId === 'ols-open-handler';

const DemoContent: React.FC<{ useOpenOLS: () => (prompt?: string, attachments?: Attachment[]) => void }> = ({
  useOpenOLS,
}) => {
  const openOLS = useOpenOLS();

  const attachment: Attachment = {
    attachmentType: 'YAML',
    kind: 'Deployment',
    name: 'test-name',
    namespace: 'test-namespace',
    value: `kind: Deployment
metadata:
  name: test-name
  namespace: test-namespace`,
  };

  return (
    <>
      <Button onClick={() => openOLS()}>Open OLS</Button>
      <Button onClick={() => openOLS('How do I scale my deployment?')}>Open OLS with prompt</Button>
      <Button onClick={() => openOLS(undefined, [attachment])}>Open OLS with attachment</Button>
      <Button onClick={() => openOLS('How do I scale my deployment?', [attachment])}>
        Open OLS with prompt and attachment
      </Button>
    </>
  );
};

const Demo: React.FC = () => {
  const [extensions, resolved] = useResolvedExtensions(isOpenOLSHandlerExtension);

  // Get the hook from the extension (should only be one)
  const useOpenOLS = (resolved ? extensions[0]?.properties?.provider : undefined) as
    | (() => (prompt?: string, attachments?: Attachment[]) => void)
    | undefined;

  if (!useOpenOLS) {
    return <Spinner />;
  }

  return <DemoContent useOpenOLS={useOpenOLS} />;
};
```

## Detecting whether OpenShift Lightspeed is running (PatternFly 6 version only)

This plugin sets a `LIGHTSPEED_CONSOLE` feature flag via the `console.flag`
extension. This allows other OpenShift console plugins to check if the OpenShift
Lightspeed plugin is running:

```typescript
import { useFlag } from '@openshift-console/dynamic-plugin-sdk';

const isLightspeedRunning = useFlag('LIGHTSPEED_CONSOLE');
```

## References

- [Console Plugin SDK README](https://github.com/openshift/console/tree/main/frontend/packages/console-dynamic-plugin-sdk)
- [Customization Plugin Example](https://github.com/spadgett/console-customization-plugin)
- [Dynamic Plugin Enhancement Proposal](https://github.com/openshift/enhancements/blob/master/enhancements/console/dynamic-plugins.md)
