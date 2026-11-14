# COO Integration (show_timeseries)

The OLS plugin integrates with the Cluster Observability Operator (COO) so that
metrics tool calls in the chat render interactive Perses charts. This spec
defines the integration's behavior and the cluster prerequisites it depends on.

Related: `decisions/0001-coo-periodic-pipeline.md` (the periodic e2e pipeline),
`tools.md` (tool call rendering).

## Behavior

### Chart rendering

1. In troubleshooting mode, OLS may answer a metrics question with a
   `show_timeseries` tool call (served by the openshift-mcp-server, an MCP
   server deployed by the lightspeed-operator when
   `OLSConfig.spec.ols.introspectionEnabled: true`).

2. The tool call result carries `tool_meta.ui.resourceUri`
   (`ui://mcp-obs/show-timeseries`). The console plugin fetches the referenced
   resource via the OLS backend (`POST /v1/mcp-apps/resources`), which proxies
   `read_resource` to the MCP server named by the tool's `mcp_server`.

3. The chart itself is rendered **inline in the chat entry** by the
   monitoring-console-plugin's federated Perses components (module federation),
   registered via the `ols.tool-ui` console extension. The `show_timeseries`
   tool result carries `tool_meta.olsUi.id` (`mcp-obs/show-timeseries`);
   `OlsToolUIs` resolves that ID against `ols.tool-ui` extensions and renders
   the matching component. (This is distinct from the MCP App iframe path,
   which renders tools carrying `tool_meta.ui.resourceUri`.)

4. The chart's "Add to dashboard" action inserts the chart as a panel into a
   Perses dashboard (Observe → Dashboards (Perses), route
   `/monitoring/v2/dashboards`). The action button renders in a hidden state
   inside the tool UI and must be activated via a dispatched click event
   (`dispatchEvent('click')`) — it is not visible for normal clicks.

## Cluster prerequisites

All of these must hold for the integration to work end-to-end. Each was
discovered by a failing e2e run; none are optional:

| # | Requirement | How |
|---|---|---|
| 1 | COO installed via OLM | `OperatorGroup` + `Subscription` (channel `stable`, source `redhat-operators`) in `openshift-cluster-observability-operator`. Without an OperatorGroup the subscription is never resolved — no CSV, no error. |
| 2 | Monitoring UIPlugin with Perses | `UIPlugin` `monitoring` with `spec.monitoring.perses.enabled: true` (create or patch). This makes COO deploy its `monitoring-console-plugin` and the Perses stack. Without it the console falls back to the CMO built-in monitoring plugin, which lacks the OLS chart integration. |
| 3 | Global Thanos datasource | A `PersesGlobalDatasource` (e.g. `thanos-querier-datasource`, `default: true`, proxy URL `https://thanos-querier.openshift-monitoring.svc.cluster.local:9091`, **`secret: <datasource-name>-secret` in the proxy spec**) in the COO namespace, with `client.tls.caCert` pointing at the mounted service CA (`/ca/service-ca.crt`). The chart's federated Perses components resolve their datasource against global datasources; without one, rendering fails with `No datasource found for kind 'PrometheusDatasource' and name 'undefined'`. The proxy's secret reference is **required** for TLS: the perses-operator syncs the client TLS config into a perses Secret named `<datasource>-secret`, and the server only applies it to proxy connections when referenced by name — without it, every query fails with `x509: certificate signed by unknown authority` for the datasource's lifetime. |
| 4 | OLS introspection enabled | `OLSConfig.spec.ols.introspectionEnabled: true`. This deploys the openshift-mcp-server (which serves `show_timeseries` and the `ui://` chart resources) and registers it with OLS automatically. With it `false` the model has no metrics tool and answers with text. |
| 5 | RAG not required for metrics tests | `OLSConfig.spec.ols.byokRAGOnly: true` skips the RHOKP/Solr stack, whose startup is slow/flaky on ephemeral clusters and gates app-server readiness. Only for test clusters that don't exercise RAG. |
| 6 | A capable LLM | The model must reliably choose to call `show_timeseries` for metrics questions. Small models may answer with text instead. gpt-6-luna works reliably; gpt-5.4-mini was inconsistent (and is being phased out). The prow reference uses claude-opus via Bedrock. |

## Testing notes

- The e2e is `tests/tests/coo-show-timeseries.spec.ts` (Playwright). It is
  non-deterministic (live LLM), never gates PRs, and runs via the periodic
  pipeline (`.tekton/integration-tests/coo-periodic/`). Tests configure
  `retries: 1` to absorb single-shot LLM variance.
- Playwright login works on Konflux HyperShift ephemeral clusters;
  Cypress's `cy.origin()`-based login does not (the OAuth server lives on the
  management-cluster domain with an explicit `:443` port and the browser never
  reaches the expected origin under Cypress). This is why the test was ported
  from monitoring-plugin's Cypress suite.
- The chat popover auto-opens for first-time users, so a blind button click
  can close it; use a retry-loop open pattern (see the spec's `openChat`).
- The app-server deployment becomes `Available` several minutes after its
  (5.2 GB) image pull; tests must wait for it inside a test body (hooks are
  capped at the config timeout) rather than assuming the pipeline's install
  step sufficed.
- The Perses dashboards page is reached via URL
  (`/monitoring/v2/dashboards`); the nav item's i18n key is missing in the
  GA monitoring-console-plugin, so its label is not reliably clickable.
- The "Add to dashboard" button inside the tool UI renders hidden;
  `dispatchEvent('click')` activates it (Cypress used `force: true`).
- On fresh clusters the service CA configmap and the perses serving-cert
  secret in the COO namespace are issued asynchronously. If the perses pod
  mounts the configmap before it is populated, the server reads an empty CA
  when loading the datasource and every Thanos query fails with
  `x509: certificate signed by unknown authority` **for the pod's
  lifetime**. The pipeline therefore waits for the material in the API and
  then **restarts the perses statefulset**, forcing a fresh mount and CA
  read; the test's `retries: 1` absorbs any residual variance.
- The tool label group in the chat renders at most four labels
  (PatternFly `LabelGroup numLabels={4}`) and collapses the rest behind a
  "N more" toggle. Tests asserting on a specific tool label must expand the
  group first; otherwise the label is not in the DOM when the model made
  four or more earlier tool calls.
- Artifacts are pushed to a per-run OCI tag (`coo-tests-<commit>-<run>`).
  A shared per-commit tag is a trap twice over: the push stepaction untars
  the previous artifact into the workdir first (same-named files from older
  runs overwrite fresh ones), and it accumulates every run's cluster logs
  and media until the download-and-remerge OOM-kills the push step.
