#!/usr/bin/env bash
# Configure credentials for the OpenShift Console browser login.
set -euo pipefail

: "${KUBECONFIG_PATH:?KUBECONFIG_PATH must point to the cluster kubeconfig}"

# A supplied password (for a reused cluster) takes precedence. Otherwise use
# the kubeadmin password from the provisioned-cluster credential secret.
if [[ -n "${LOGIN_PASSWORD:-}" ]]; then
  export LOGIN_IDP="${LOGIN_IDP:-kube:admin}"
  export LOGIN_USERNAME="${LOGIN_USERNAME:-kubeadmin}"
  echo "Using the supplied Console login credentials."
elif [[ -s /credentials/kubeAdminPassword ]]; then
  export LOGIN_IDP="${LOGIN_IDP:-kube:admin}"
  export LOGIN_USERNAME="${LOGIN_USERNAME:-kubeadmin}"
  export LOGIN_PASSWORD=$(< /credentials/kubeAdminPassword)
  echo "Using the kubeadmin credentials supplied by the cluster."
else
  # HyperShift ephemeral clusters provide client-certificate kubeconfigs but no
  # kubeadmin password. Configure a disposable HTPasswd OAuth identity for the
  # browser, while the kubeconfig remains the administrative credential.
  export LOGIN_IDP=htpasswd
  export LOGIN_USERNAME=ols-e2e-admin
  export LOGIN_PASSWORD=$(openssl rand -base64 36 | tr -d '\n')

  apt-get update
  apt-get install -y --no-install-recommends apache2-utils

  umask 077
  htpasswd_file=$(mktemp)
  trap 'rm -f "$htpasswd_file"' EXIT
  htpasswd -c -B -b "$htpasswd_file" "$LOGIN_USERNAME" "$LOGIN_PASSWORD"

  oc --kubeconfig "$KUBECONFIG_PATH" -n openshift-config create secret generic ols-e2e-htpasswd \
    --from-file=htpasswd="$htpasswd_file" \
    --dry-run=client -o yaml | oc --kubeconfig "$KUBECONFIG_PATH" apply -f -

  # This replaces identityProviders, which is safe because this pipeline only
  # provisions disposable clusters. Do not use this branch on shared clusters.
  oc --kubeconfig "$KUBECONFIG_PATH" apply -f - <<'EOF'
apiVersion: config.openshift.io/v1
kind: OAuth
metadata:
  name: cluster
spec:
  identityProviders:
    - name: htpasswd
      mappingMethod: claim
      type: HTPasswd
      htpasswd:
        fileData:
          name: ols-e2e-htpasswd
EOF

  oc --kubeconfig "$KUBECONFIG_PATH" rollout status deployment/oauth-openshift \
    --namespace openshift-authentication --timeout=5m
fi
