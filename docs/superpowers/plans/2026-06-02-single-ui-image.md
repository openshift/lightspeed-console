# Single UI Container Image — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a single OLS UI container image that contains builds for all supported OCP versions (4.16–4.25), replacing the current three-image approach.

**Architecture:** Git submodules bring `pattern-fly-5` and `release-4.19` branch code into `main`. A multi-stage Dockerfile builds all three variants. An entrypoint script symlinks the correct build based on the `OCP_VERSION` env var set by the operator. The operator is simplified to deploy a single image and pass the version through.

**Tech Stack:** Shell (entrypoint), Docker multi-stage builds, git submodules, Go (operator changes), Tekton/Konflux (pipeline config)

**Repos:**
- `lightspeed-console` (this repo) — Tasks 1–4
- `lightspeed-operator` — Tasks 5–7

---

### Task 1: Add git submodules for PF5 and 4.19 branches

**Files:**
- Create: `.gitmodules`
- Create: `branches/pf5` (gitlink)
- Create: `branches/4-19` (gitlink)

- [ ] **Step 1: Add the PF5 submodule**

```bash
git submodule add -b pattern-fly-5 https://github.com/openshift/lightspeed-console.git branches/pf5
```

- [ ] **Step 2: Add the 4.19 submodule**

```bash
git submodule add -b release-4.19 https://github.com/openshift/lightspeed-console.git branches/4-19
```

- [ ] **Step 3: Verify `.gitmodules` content**

```bash
cat .gitmodules
```

Expected output:
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

- [ ] **Step 4: Verify submodule checkout**

```bash
ls branches/pf5/package.json branches/4-19/package.json
```

Both files should exist.

- [ ] **Step 5: Verify PF5 branch uses compatible Node version**

```bash
node -e "const p = require('./branches/pf5/package.json'); console.log('engines:', JSON.stringify(p.engines))"
```

If the PF5 branch requires a Node version older than 22, the Dockerfile build stage for PF5 will need a different base image. Note the result for Task 3.

- [ ] **Step 6: Commit**

```bash
git add .gitmodules branches/pf5 branches/4-19
git commit -m "Add git submodules for PF5 and 4.19 branches"
```

---

### Task 2: Create entrypoint.sh

**Files:**
- Create: `entrypoint.sh`

- [ ] **Step 1: Write entrypoint.sh**

Create `entrypoint.sh` in the repo root:

```bash
#!/bin/sh
set -eu

case "${OCP_VERSION:-}" in
  4.16|4.17|4.18)       BUILD_DIR=/builds/pf5 ;;
  4.19|4.20|4.21)       BUILD_DIR=/builds/4-19 ;;
  4.22|4.23|4.24|4.25)  BUILD_DIR=/builds/main ;;
  *)
    echo "ERROR: unsupported or missing OCP_VERSION: '${OCP_VERSION:-}'" >&2
    exit 1
    ;;
esac

ln -sfn "$BUILD_DIR" /usr/share/nginx/html
exec nginx -g 'daemon off;' -e stderr
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x entrypoint.sh
```

- [ ] **Step 3: Test the script locally (syntax check)**

```bash
sh -n entrypoint.sh
```

Expected: no output (no syntax errors).

- [ ] **Step 4: Commit**

```bash
git add entrypoint.sh
git commit -m "Add entrypoint.sh for OCP version-based build selection"
```

---

### Task 3: Rewrite Dockerfile for multi-stage builds

**Files:**
- Modify: `Dockerfile`

The current Dockerfile has a single build stage from the repo root. Replace it with three build stages (one per variant) plus a runtime stage.

- [ ] **Step 1: Replace Dockerfile contents**

Replace the entire `Dockerfile` with:

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

Note: If Task 1 Step 5 revealed that the PF5 branch requires Node < 22, change the `build-pf5` stage base image accordingly (e.g., `ubi9/nodejs-20-minimal:latest`).

- [ ] **Step 2: Build the image locally to verify**

```bash
podman build -t lightspeed-console-unified .
```

Expected: all three build stages complete, image builds successfully. This will take ~10-12 minutes.

- [ ] **Step 3: Test the entrypoint with each OCP version**

```bash
# Test OCP 4.17 (PF5)
podman run --rm -e OCP_VERSION=4.17 -d --name ols-test lightspeed-console-unified
podman exec ols-test ls -la /usr/share/nginx/html
podman stop ols-test

# Test OCP 4.20 (4.19)
podman run --rm -e OCP_VERSION=4.20 -d --name ols-test lightspeed-console-unified
podman exec ols-test ls -la /usr/share/nginx/html
podman stop ols-test

# Test OCP 4.22 (main)
podman run --rm -e OCP_VERSION=4.22 -d --name ols-test lightspeed-console-unified
podman exec ols-test ls -la /usr/share/nginx/html
podman stop ols-test

# Test missing OCP_VERSION (should fail)
podman run --rm -e OCP_VERSION= lightspeed-console-unified
```

Expected for each version test: `/usr/share/nginx/html` is a symlink to the correct `/builds/` directory. The missing-version test should print the error and exit with code 1.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile
git commit -m "Rewrite Dockerfile for multi-stage builds covering all OCP versions"
```

---

### Task 4: Update Konflux pipeline configuration

**Files:**
- Modify: `.tekton/lightspeed-console-push.yaml`
- Modify: `.tekton/lightspeed-console-pull-request.yaml`

Two changes needed in each pipeline file:
1. Enable submodule fetching in the git-clone task
2. Add the submodule npm directories to the Cachi2 prefetch input

- [ ] **Step 1: Update prefetch-input in push pipeline**

In `.tekton/lightspeed-console-push.yaml`, find the `prefetch-input` parameter (at the top-level `params` section) and update its value:

```yaml
  - name: prefetch-input
    value: '[{"type": "npm", "path": "."}, {"type": "npm", "path": "branches/pf5"}, {"type": "npm", "path": "branches/4-19"}, {"type": "rpm", "path": "."}]'
```

- [ ] **Step 2: Add submodules parameter to git-clone task in push pipeline**

In `.tekton/lightspeed-console-push.yaml`, find the `clone-repository` task and add a `SUBMODULES` parameter to its `params` list:

```yaml
    - name: clone-repository
      params:
      ...existing params...
      - name: SUBMODULES
        value: "true"
```

Check the git-clone-oci-ta task documentation for the exact parameter name — it may be `SUBMODULES`, `submodules`, or `depth`. Verify by inspecting the task definition:

```bash
# If the task accepts SUBMODULES param:
- name: SUBMODULES
  value: "true"
```

- [ ] **Step 3: Update prefetch-input in pull-request pipeline**

Apply the same `prefetch-input` change to `.tekton/lightspeed-console-pull-request.yaml`:

```yaml
  - name: prefetch-input
    value: '[{"type": "npm", "path": "."}, {"type": "npm", "path": "branches/pf5"}, {"type": "npm", "path": "branches/4-19"}, {"type": "rpm", "path": "."}]'
```

- [ ] **Step 4: Add submodules parameter to git-clone task in pull-request pipeline**

Same change as Step 2 but in `.tekton/lightspeed-console-pull-request.yaml`.

- [ ] **Step 5: Commit**

```bash
git add .tekton/lightspeed-console-push.yaml .tekton/lightspeed-console-pull-request.yaml
git commit -m "Update Konflux pipelines for submodule fetch and multi-directory npm prefetch"
```

---

### Task 5: Remove multi-image selection from operator (`cmd/main.go`)

**Repo:** `lightspeed-operator` (`/Users/xavi/street/github.com/ols/lightspeed/lightspeed-operator`)

**Files:**
- Modify: `cmd/main.go`

The operator currently declares three console image variables, three flag bindings, a three-way `overrideImages` function, and an `if/else` block that selects the image at startup. All of this collapses to a single image.

- [ ] **Step 1: Remove PF5 and 4.19 variables and flags**

In `cmd/main.go`, remove the variables `consoleImage_pf5` and `consoleImage_419` (lines 175-176) and their `flag.StringVar` bindings (lines 194-195).

Keep `consoleImage` (line 174) and its flag (line 193).

- [ ] **Step 2: Simplify `overrideImages` function**

Remove the `consoleImage_pf5` and `consoleImage_419` parameters and their `if` blocks from the `overrideImages` function (lines 122-135). The function signature becomes:

```go
func overrideImages(serviceImage string, consoleImage string, postgresImage string, openshiftMCPServerImage string, dataverseExporterImage string, ocpRagImage string) map[string]string {
```

Remove the map entries for `"console-plugin-pf5"` and `"console-plugin-4-19"` from the `defaultImages` map (lines 100-101).

- [ ] **Step 3: Remove version-based image selection**

Remove the `if/else` block at lines 327-336 that selects between three console images based on `mVersion`. The `consoleImage` variable is now always `imagesMap["console-plugin"]` (which is the only console image).

The `strconv.Atoi(minor)` call and `mVersion` variable (lines 322-326) can also be removed since they were only used for console image selection. The `major` and `minor` strings from `GetOpenshiftVersion()` are still needed — they're passed into `OLSConfigReconcilerOptions`.

- [ ] **Step 4: Update the call to `overrideImages`**

Update the call at line 213 to match the new signature (remove `consoleImage_pf5` and `consoleImage_419` arguments).

- [ ] **Step 5: Update comments**

Remove or update the comments referencing PF5 image selection (lines 26, 36-37).

- [ ] **Step 6: Verify it compiles**

```bash
cd /Users/xavi/street/github.com/ols/lightspeed/lightspeed-operator
go build ./cmd/...
```

Expected: compiles without errors.

- [ ] **Step 7: Commit**

```bash
git add cmd/main.go
git commit -m "Remove multi-image console selection from operator startup"
```

---

### Task 6: Add OCP_VERSION env var to console deployment

**Repo:** `lightspeed-operator`

**Files:**
- Modify: `internal/controller/console/deployment.go`

The deployment generator needs to set `OCP_VERSION` on the console container using the cluster's OpenShift version, which is available via `r.GetOpenShiftMajor()` and `r.GetOpenshiftMinor()`.

- [ ] **Step 1: Add the `fmt` import**

In `deployment.go`, add `"fmt"` to the import block if not already present.

- [ ] **Step 2: Add OCP_VERSION env var to the container spec**

In `GenerateConsoleUIDeployment`, find the container spec (the `Env` field is currently set to `utils.GetProxyEnvVars()`). Change it to append the `OCP_VERSION` env var:

```go
Env: append(utils.GetProxyEnvVars(), corev1.EnvVar{
    Name:  "OCP_VERSION",
    Value: fmt.Sprintf("%s.%s", r.GetOpenShiftMajor(), r.GetOpenshiftMinor()),
}),
```

- [ ] **Step 3: Verify it compiles**

```bash
go build ./cmd/...
```

- [ ] **Step 4: Run existing tests**

```bash
make test
```

Expected: existing console deployment tests pass. If any test asserts the exact `Env` field contents, it will need updating to include `OCP_VERSION`.

- [ ] **Step 5: Update test assertions if needed**

If `internal/controller/console/assets_test.go` or `internal/controller/console/reconciler_test.go` assert on the deployment's env vars, add the `OCP_VERSION` env var to the expected values. Check:

```bash
grep -n 'Env\|GetProxyEnvVars\|OCP_VERSION' internal/controller/console/assets_test.go internal/controller/console/reconciler_test.go
```

- [ ] **Step 6: Run tests again**

```bash
make test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add internal/controller/console/deployment.go
# include test files if modified
git commit -m "Add OCP_VERSION env var to console UI deployment"
```

---

### Task 7: Clean up operator constants and related_images.json

**Repo:** `lightspeed-operator`

**Files:**
- Modify: `internal/controller/utils/constants.go`
- Modify: `related_images.json`

- [ ] **Step 1: Remove PF5 and 4.19 image constants**

In `internal/controller/utils/constants.go`, remove these two lines from the `var` block (lines 371-372):

```go
ConsoleUIImagePF5Default       = relatedimages.GetDefaultImage("lightspeed-console-plugin-pf5")
ConsoleUIImage419Default       = relatedimages.GetDefaultImage("lightspeed-console-plugin-4-19")
```

- [ ] **Step 2: Remove PF5 and 4.19 entries from related_images.json**

In `related_images.json`, remove the two objects with names `"lightspeed-console-plugin-pf5"` and `"lightspeed-console-plugin-4-19"`.

- [ ] **Step 3: Verify it compiles**

```bash
go build ./cmd/...
```

If any test files reference `ConsoleUIImagePF5Default` or `ConsoleUIImage419Default`, those references need to be removed too. Check:

```bash
grep -rn 'ConsoleUIImagePF5\|ConsoleUIImage419\|console-plugin-pf5\|console-plugin-4-19' internal/ cmd/ test/
```

- [ ] **Step 4: Fix any remaining references**

Remove or update any test fixtures, assertions, or E2E test code that references the removed constants or image names.

- [ ] **Step 5: Run full test suite**

```bash
make test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add internal/controller/utils/constants.go related_images.json
# include any test files modified
git commit -m "Remove PF5 and 4.19 console image constants and related_images entries"
```

---

### Task 8: Update spec files

**Repo:** `lightspeed-console`

**Files:**
- Modify: `.ai/spec/how/project-structure.md`

- [ ] **Step 1: Add submodule and entrypoint documentation to project-structure.md**

In `.ai/spec/how/project-structure.md`, add a section under "Root configuration files" for the new files:

```markdown
| `entrypoint.sh` | Container entrypoint. Maps `OCP_VERSION` env var to the correct build directory via symlink, then execs nginx. |
| `.gitmodules` | Git submodule definitions for `branches/pf5` (pattern-fly-5) and `branches/4-19` (release-4.19). |
| `branches/pf5/` | Submodule: PF5 branch source (OCP 4.16-4.18). |
| `branches/4-19/` | Submodule: 4.19 branch source (OCP 4.19-4.21). |
```

- [ ] **Step 2: Update the Dockerfile description if present**

If the project structure spec mentions the Dockerfile, update the description to reflect the multi-stage build approach.

- [ ] **Step 3: Commit**

```bash
git add .ai/spec/how/project-structure.md
git commit -m "Update spec to document submodules and entrypoint"
```
