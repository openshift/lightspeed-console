#!/usr/bin/env bash

set -euo pipefail

# Match the plugin SDK (4.22+). origin-console:latest can lag behind and miss APIs
# such as useUserPreference, which prevents the Lightspeed button from rendering.
CONSOLE_TAG=${CONSOLE_TAG:=4.22}
CONSOLE_IMAGE=${CONSOLE_IMAGE:="quay.io/openshift/origin-console:${CONSOLE_TAG}"}
CONSOLE_PORT=${CONSOLE_PORT:=9000}
OLS_PORT=${OLS_PORT:=8080}
CONSOLE_DEV_SA_NAME=${CONSOLE_DEV_SA_NAME:=lightspeed-console-dev}
CONSOLE_DEV_SA_NAMESPACE=${CONSOLE_DEV_SA_NAMESPACE:=kube-system}

resolve_api_server() {
  if command -v oc >/dev/null 2>&1 && oc whoami >/dev/null 2>&1; then
    oc whoami --show-server
    return
  fi
  if command -v kubectl >/dev/null 2>&1; then
    kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}'
    return
  fi
  return 1
}

resolve_bearer_token() {
  local token user

  if command -v oc >/dev/null 2>&1; then
    token=$(oc whoami --show-token 2>/dev/null || true)
    if [ -n "$token" ]; then
      echo "$token"
      return
    fi
  fi

  if ! command -v kubectl >/dev/null 2>&1; then
    return 1
  fi

  user=$(kubectl config view --minify -o jsonpath='{.users[0].name}' 2>/dev/null || true)
  if [ -n "$user" ]; then
    token=$(kubectl config view --raw -o jsonpath="{.users[?(@.name==\"${user}\")].user.token}" 2>/dev/null || true)
    if [ -n "$token" ]; then
      echo "$token"
      return
    fi
  fi

  # Plain Kubernetes clusters (e.g. kind) often use client certs; mint a dev token instead.
  if ! kubectl get serviceaccount "$CONSOLE_DEV_SA_NAME" -n "$CONSOLE_DEV_SA_NAMESPACE" >/dev/null 2>&1; then
    kubectl create serviceaccount "$CONSOLE_DEV_SA_NAME" -n "$CONSOLE_DEV_SA_NAMESPACE" >/dev/null
  fi
  if ! kubectl get clusterrolebinding "$CONSOLE_DEV_SA_NAME" >/dev/null 2>&1; then
    kubectl create clusterrolebinding "$CONSOLE_DEV_SA_NAME" \
      --clusterrole=cluster-admin \
      --serviceaccount="${CONSOLE_DEV_SA_NAMESPACE}:${CONSOLE_DEV_SA_NAME}" >/dev/null
  fi
  kubectl -n "$CONSOLE_DEV_SA_NAMESPACE" create token "$CONSOLE_DEV_SA_NAME" --duration=24h
}

echo "Starting local OpenShift console..."

if ! command -v oc >/dev/null 2>&1 && ! command -v kubectl >/dev/null 2>&1; then
  echo "error: neither oc nor kubectl found in PATH." >&2
  exit 1
fi

if command -v oc >/dev/null 2>&1 && ! oc whoami >/dev/null 2>&1; then
  echo "error: not logged in to a cluster. Run 'oc login' (or point KUBECONFIG at a running cluster) and retry." >&2
  exit 1
fi

if command -v kubectl >/dev/null 2>&1 && ! kubectl cluster-info >/dev/null 2>&1; then
  echo "error: cannot reach the Kubernetes API. Is your cluster running?" >&2
  echo "  Try: kubectl cluster-info" >&2
  exit 1
fi

BRIDGE_K8S_MODE_OFF_CLUSTER_ENDPOINT=$(resolve_api_server)
BRIDGE_K8S_AUTH_BEARER_TOKEN=$(resolve_bearer_token || true)

if [ -z "$BRIDGE_K8S_MODE_OFF_CLUSTER_ENDPOINT" ] || [ -z "$BRIDGE_K8S_AUTH_BEARER_TOKEN" ]; then
  echo "error: could not read API server or bearer token." >&2
  echo "  server: ${BRIDGE_K8S_MODE_OFF_CLUSTER_ENDPOINT:-<empty>}" >&2
  echo "  OpenShift: run 'oc whoami --show-token'." >&2
  echo "  kind/k8s: ensure 'kubectl create token' works, or log in with a kubeconfig that includes a user token." >&2
  exit 1
fi

BRIDGE_USER_AUTH="disabled"
BRIDGE_K8S_MODE="off-cluster"
BRIDGE_K8S_AUTH="bearer-token"
BRIDGE_K8S_MODE_OFF_CLUSTER_SKIP_VERIFY_TLS=true

BRIDGE_USER_SETTINGS_LOCATION="localstorage"

# The monitoring operator is not always installed (e.g. for local OpenShift). Tolerate missing config maps.
set +e
BRIDGE_K8S_MODE_OFF_CLUSTER_THANOS=$(oc -n openshift-config-managed get configmap monitoring-shared-config -o jsonpath='{.data.thanosPublicURL}' 2>/dev/null)
BRIDGE_K8S_MODE_OFF_CLUSTER_ALERTMANAGER=$(oc -n openshift-config-managed get configmap monitoring-shared-config -o jsonpath='{.data.alertmanagerPublicURL}' 2>/dev/null)
GITOPS_HOSTNAME=$(oc -n openshift-gitops get route cluster -o jsonpath='{.spec.host}' 2>/dev/null)
set -e
if [ -n "$GITOPS_HOSTNAME" ]; then
    BRIDGE_K8S_MODE_OFF_CLUSTER_GITOPS="https://$GITOPS_HOSTNAME"
fi

echo "API Server: $BRIDGE_K8S_MODE_OFF_CLUSTER_ENDPOINT"
echo "Console Image: $CONSOLE_IMAGE"
echo "Console URL: http://localhost:${CONSOLE_PORT}"

# Prefer podman if installed. Otherwise, fall back to docker.
if [ -x "$(command -v podman)" ]; then
    if [ "$(uname -s)" = "Linux" ]; then
        # Use host networking on Linux since host.containers.internal is unreachable in some environments.
        BRIDGE_PLUGINS="lightspeed-console-plugin=http://localhost:9001"
        podman run --rm --network=host --env-file <(set | grep BRIDGE) \
        --env BRIDGE_PLUGIN_PROXY='{"services": [{"consoleAPIPath": "/api/proxy/plugin/lightspeed-console-plugin/ols/", "endpoint": "http://localhost:'"${OLS_PORT}"'", "authorize": true}]}' \
        $CONSOLE_IMAGE
    else
        BRIDGE_PLUGINS="lightspeed-console-plugin=http://host.containers.internal:9001"
        podman run --platform linux/amd64 --rm -p "$CONSOLE_PORT":9000 --env-file <(set | grep BRIDGE) \
        --env BRIDGE_PLUGIN_PROXY='{"services": [{"consoleAPIPath": "/api/proxy/plugin/lightspeed-console-plugin/ols/", "endpoint": "http://host.containers.internal:'"${OLS_PORT}"'", "authorize": true}]}' \
        $CONSOLE_IMAGE
    fi
else
    BRIDGE_PLUGINS="lightspeed-console-plugin=http://host.docker.internal:9001"
    docker run --platform linux/amd64 --rm -p "$CONSOLE_PORT":9000 --env-file <(set | grep BRIDGE) \
    --env BRIDGE_PLUGIN_PROXY='{"services": [{"consoleAPIPath": "/api/proxy/plugin/lightspeed-console-plugin/ols/", "endpoint": "http://host.docker.internal:'"${OLS_PORT}"'", "authorize": true}]}' \
    $CONSOLE_IMAGE
fi
