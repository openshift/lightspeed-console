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

[Node.js](https://nodejs.org/en/) and [npm](https://www.npmjs.com) are required
to build and run the example. To run OpenShift console in a container, either
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

#### Using a localhost backend

If your Lightspeed service is running on your local machine, you can test
locally by running Chrome with CORS disabled.

1. Set the `OLS_API_BASE_URL` environment variable when starting the development
   server.

   ```bash
   OLS_API_BASE_URL='http://127.0.0.1:8080' npm run start
   ```

2. Start Chrome with web security disabled so localhost requests don't fail due
   to CORS. ⚠️ WARNING: This disables Chrome security, so only use these flags
   for local development!
   - macOS:
     ```bash
     open -na "Google Chrome" --args --disable-web-security --user-data-dir="$HOME/chrome-dev-data-dir/"
     ```
   - Linux:
     ```bash
     google-chrome --disable-web-security --user-data-dir="$HOME/chrome-dev-data-dir/"
     ```

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

This project adds prettier, eslint, and stylelint. Linting can be run with
`npm run lint`.

The stylelint config disallows hex colors since these cause problems with dark
mode. You should use the
[PatternFly global CSS variables](https://patternfly-react-main.surge.sh/developer-resources/global-css-variables#global-css-variables)
for colors instead.

The stylelint config also disallows naked element selectors like `table` and
`.pf-` or `.co-` prefixed classes. This prevents plugins from accidentally
overwriting default console styles, breaking the layout of existing pages. The
best practice is to prefix your CSS classnames with your plugin name to avoid
conflicts. Please don't disable these rules without understanding how they can
break console styles!

## References

- [Console Plugin SDK README](https://github.com/openshift/console/tree/main/frontend/packages/console-dynamic-plugin-sdk)
- [Customization Plugin Example](https://github.com/spadgett/console-customization-plugin)
- [Dynamic Plugin Enhancement Proposal](https://github.com/openshift/enhancements/blob/master/enhancements/console/dynamic-plugins.md)
