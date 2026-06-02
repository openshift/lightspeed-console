# Single UI Container Image for All OCP Versions

## Problem

The lightspeed-console plugin must use the same PatternFly, React, and console
SDK versions as the host OpenShift web console. Different OCP version ranges
require different dependency sets:

| OCP Versions | Branch | React | PatternFly | Console SDK |
|---|---|---|---|---|
| 4.16 - 4.18 | `pattern-fly-5` | 17 | PF5 | 1.4.0 |
| 4.19 - 4.21 | `release-4.19` | 17 | PF6 | 4.19.x |
| 4.22+ | `main` | 18 | PF6 | 4.22.x |

Today this is solved with three separate container images
(`lightspeed-console-plugin`, `lightspeed-console-plugin-pf5`,
`lightspeed-console-plugin-4-19`). The operator selects the correct image at
startup based on the cluster's OCP version. This complicates the release process
— every release coordinates three image builds, three Konflux Components, and
version-selection logic in the operator.

## Solution

Ship a single container image containing all three UI builds. The operator
provides an `OCP_VERSION` environment variable, and a lightweight entrypoint
script symlinks the correct build directory so nginx serves the right assets.

## Image Layout

```
/builds/
  pf5/          # pattern-fly-5 build output (OCP 4.16-4.18)
  4-19/         # release-4.19 build output (OCP 4.19-4.21)
  main/         # main build output (OCP 4.22+)
/entrypoint.sh
/usr/share/nginx/html   # symlink target (set by entrypoint at startup)
```

## Entrypoint

`entrypoint.sh` maps `OCP_VERSION` to the correct build directory, creates the
symlink, and execs nginx:

```bash
#!/bin/sh
set -eu

case "${OCP_VERSION:-}" in
  4.16|4.17|4.18)       BUILD_DIR=/builds/pf5 ;;
  4.19|4.20|4.21)       BUILD_DIR=/builds/4-19 ;;
  4.22|4.23|4.24|4.25)  BUILD_DIR=/builds/main ;;  # extend as new OCP versions ship
  *)
    echo "ERROR: unsupported or missing OCP_VERSION: '${OCP_VERSION:-}'" >&2
    exit 1
    ;;
esac

ln -sfn "$BUILD_DIR" /usr/share/nginx/html
exec nginx -g 'daemon off;' -e stderr
```

An explicit version list is used rather than range comparison. This makes
supported versions visible and fails clearly on unknown versions. When a new OCP
version ships, the entrypoint is updated alongside the Dockerfile.

## Dockerfile

Multi-stage build with one stage per variant:

```dockerfile
# --- Build stage: PF5 (OCP 4.16-4.18) ---
FROM registry.access.redhat.com/ubi9/nodejs-22-minimal:latest AS build-pf5
USER root
WORKDIR /usr/src/app
COPY branches/pf5/package.json branches/pf5/package-lock.json ./
RUN NODE_OPTIONS=--max-old-space-size=4096 npm ci --omit=dev --omit=optional --ignore-scripts --no-fund
COPY branches/pf5/console-extensions.json branches/pf5/LICENSE branches/pf5/tsconfig.json branches/pf5/types.d.ts branches/pf5/webpack.config.ts ./
COPY branches/pf5/locales ./locales
COPY branches/pf5/src ./src
RUN npm run build

# --- Build stage: 4.19 (OCP 4.19-4.21) ---
FROM registry.access.redhat.com/ubi9/nodejs-22-minimal:latest AS build-4-19
USER root
WORKDIR /usr/src/app
COPY branches/4-19/package.json branches/4-19/package-lock.json ./
RUN NODE_OPTIONS=--max-old-space-size=4096 npm ci --omit=dev --omit=optional --ignore-scripts --no-fund
COPY branches/4-19/console-extensions.json branches/4-19/LICENSE branches/4-19/tsconfig.json branches/4-19/types.d.ts branches/4-19/webpack.config.ts ./
COPY branches/4-19/locales ./locales
COPY branches/4-19/src ./src
RUN npm run build

# --- Build stage: main (OCP 4.22+) ---
FROM registry.access.redhat.com/ubi9/nodejs-22-minimal:latest AS build-main
USER root
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN NODE_OPTIONS=--max-old-space-size=4096 npm ci --omit=dev --omit=optional --ignore-scripts --no-fund
COPY console-extensions.json LICENSE tsconfig.json types.d.ts webpack.config.ts ./
COPY locales ./locales
COPY src ./src
RUN npm run build

# --- Runtime stage ---
FROM registry.access.redhat.com/ubi9-minimal@sha256:83006d535923fcf1345067873524a3980316f51794f01d8655be55d6e9387183
USER 0

RUN microdnf install -y nginx && microdnf clean all

COPY --from=build-pf5 /usr/src/app/dist /builds/pf5
COPY --from=build-4-19 /usr/src/app/dist /builds/4-19
COPY --from=build-main /usr/src/app/dist /builds/main

RUN mkdir -p /licenses
COPY --from=build-main /usr/src/app/LICENSE /licenses/LICENSE

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN mkdir -p /tmp/nginx /usr/share/nginx/html && \
    chgrp -R 0 /var/log/nginx /var/lib/nginx /usr/share/nginx/html /tmp/nginx /builds && \
    chmod -R g=u /var/log/nginx /var/lib/nginx /usr/share/nginx/html /tmp/nginx /builds

LABEL name="openshift-lightspeed/lightspeed-console-plugin-rhel9" \
      cpe="cpe:/a:redhat:openshift_lightspeed:1::el9" \
      com.redhat.component="openshift-lightspeed" \
      io.k8s.display-name="OpenShift Lightspeed Console" \
      summary="OpenShift Lightspeed Console provides OCP console plugin for OpenShift Lightspeed Service" \
      description="OpenShift Lightspeed Console provides OCP console plugin for OpenShift Lightspeed Service" \
      io.k8s.description="OpenShift Lightspeed Console is a component of OpenShift Lightspeed" \
      io.openshift.tags="openshift-lightspeed,ols" \
      konflux.additional-tags="latest"

USER 1001

ENTRYPOINT ["/entrypoint.sh"]
```

Key points:

- The `main` build stage COPYs from the repo root; the other two COPY from their
  submodule directories under `branches/`.
- All three stages use the same `nodejs-22-minimal` base image. The PF5 branch's
  Node engine requirement must be verified during implementation.
- `/builds/` gets group-writable permissions so the symlink works as non-root
  user 1001.

## Git Submodules

The `main` branch includes two git submodules pointing to the same repo at
specific commits on the other branches. This is the Konflux-recommended approach
for including additional git content in hermetic builds.

### `.gitmodules`

```ini
[submodule "branches/pf5"]
    path = branches/pf5
    url = https://github.com/openshift/lightspeed-console.git
    branch = pattern-fly-5

[submodule "branches/4-19"]
    path = branches/4-19
    url = https://github.com/openshift/lightspeed-console.git
    branch = release-4.19
```

### Setup

```bash
git submodule add -b pattern-fly-5 https://github.com/openshift/lightspeed-console.git branches/pf5
git submodule add -b release-4.19 https://github.com/openshift/lightspeed-console.git branches/4-19
```

### Maintenance

- Development on `pattern-fly-5` and `release-4.19` continues as-is (same PRs,
  CI, review process).
- Mintmaker/Renovate auto-opens PRs to `main` to bump submodule refs when those
  branches change.
- Manual update: `cd branches/pf5 && git pull origin pattern-fly-5 && cd ../..
  && git add branches/pf5 && git commit`.

### Dropping a branch (e.g., PF5 end of life)

1. `git rm branches/pf5` and remove the entry from `.gitmodules`
2. Remove the corresponding case from `entrypoint.sh`
3. Remove the `build-pf5` stage from the Dockerfile
4. Update the operator to drop support for those OCP versions

### Adding a new variant

1. Create the new release branch
2. `git submodule add -b <branch> <url> branches/<name>`
3. Add a build stage to the Dockerfile
4. Add the version case to `entrypoint.sh`

## Operator Changes

### `related_images.json`

Reduced from three console entries to one:

```json
{
  "name": "lightspeed-console-plugin",
  "image": "registry.redhat.io/openshift-lightspeed/lightspeed-console-plugin-rhel9@sha256:..."
}
```

The `lightspeed-console-plugin-pf5` and `lightspeed-console-plugin-4-19`
entries are removed.

### `cmd/main.go`

- The version-selection `if/else` block (lines 327-336) that picks between three
  images is removed. The operator always uses the single
  `lightspeed-console-plugin` image.
- The operator still calls `GetOpenshiftVersion()` to get the cluster's OCP
  version, but now uses it only to set the `OCP_VERSION` environment variable on
  the console Deployment.

### `internal/controller/console/deployment.go`

The generated Deployment adds an `OCP_VERSION` env var to the container spec:

```go
Env: []corev1.EnvVar{
    {
        Name:  "OCP_VERSION",
        Value: fmt.Sprintf("%s.%s", major, minor),
    },
},
```

### `internal/controller/utils/constants.go`

`ConsoleUIImagePF5Default` and `ConsoleUIImage419Default` are removed. Only
`ConsoleUIImageDefault` remains.

### `OLSConfigReconcilerOptions`

The `ConsoleUIImage` field stays (single image). Any PF5 or 4-19 image fields
are removed.

### Unchanged

- `reconcileConsoleUIResources()` and `reconcileConsoleUIDeploymentAndPlugin()`
  reconciliation flow
- `ConsolePlugin` CR registration
- Service, TLS, NetworkPolicy

## Konflux Pipeline Configuration

### Cachi2 npm prefetch

Configure multiple package directories:

```yaml
packages:
  - type: npm
    path: .                # main branch
  - type: npm
    path: branches/pf5     # PF5 submodule
  - type: npm
    path: branches/4-19    # 4.19 submodule
```

### git-clone task

Enable submodule fetching:

```yaml
params:
  - name: submodules
    value: "true"
```

### RPM lockfile

Unchanged. All build stages use the same `nodejs-22-minimal` base, and the
runtime stage uses the same `ubi9-minimal` + nginx.

### Pipeline simplification

- The two separate Konflux Components for `pf5` and `4-19` images are
  decommissioned.
- Only one Konflux Component produces a console image.
- `snapshot_to_image_list.sh` picks up one console image instead of three.

## Trade-offs

| Aspect | Before (3 images) | After (1 image) |
|---|---|---|
| Image count | 3 | 1 |
| Image size | ~15 MB each | ~45 MB total |
| Build time | ~4 min per image | ~12 min single image |
| Release coordination | 3 builds + operator version logic | 1 build + env var |
| Konflux Components | 3 | 1 |
| Operator complexity | Version-based image selection | Pass-through env var |
| Branch workflow | Independent branches | Independent branches (unchanged) |
| New OCP version | May need new branch + image + operator logic | Update entrypoint + Dockerfile |
| Dropping OCP version | Remove branch + image + operator logic | Remove submodule + build stage + case |
