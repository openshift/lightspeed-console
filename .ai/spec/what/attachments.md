# Attachments

Attachments allow users to include Kubernetes resource context with their
prompts. The plugin detects the user's current console page, offers relevant
attachment options, and converts attachments to the OLS API format before
sending.

## Behavioral Rules

### Context Detection

1. The plugin must automatically detect the Kubernetes resource being viewed
   based on the current URL path. Detection must support:

   | URL pattern | Extracted context |
   |---|---|
   | `/k8s/ns/{namespace}/{resourceKey}/{name}` | Namespaced resource |
   | `/k8s/cluster/{resourceKey}/{name}` | Cluster-scoped resource |
   | `/multicloud/infrastructure/clusters/details/{name}/.../overview\|nodes\|settings` | ACM ManagedCluster |
   | `/multicloud/search/resources?kind=...&name=...` | ACM search result |
   | `/multicloud/applications/details/{namespace}/{name}/overview` | ACM Application/ApplicationSet |
   | `/multicloud/governance/policies/{action}/{namespace}/{name}` | ACM Policy |
   | `/monitoring/alerts/{id}?alertname=...` | Prometheus/Thanos Alert |

2. Resource key resolution must use the console's K8s model registry. Both
   direct model keys (e.g., `Deployment`) and plural-based keys (e.g.,
   `deployments`) must resolve correctly.

3. The plugin must never offer to attach Kubernetes Secrets. If the detected
   resource kind is `Secret`, no resource context must be provided.

4. When no resource is detected from the URL, the attachment menu must still
   offer file upload and query mode switching.

### Attachment Types

5. **Full YAML**: The complete YAML representation of the detected resource,
   excluding `metadata.managedFields`. Available for any detected non-Secret
   resource.

6. **Filtered YAML**: A subset of the resource containing only `kind`,
   `metadata`, and `status` sections, excluding `metadata.managedFields`.
   Available for any detected non-Secret, non-ManagedCluster resource.

7. **Events**: Kubernetes events associated with the current workload
   resource. Only available for workload kinds (Pod, Deployment, StatefulSet,
   DaemonSet, Job, CronJob, ReplicaSet, ReplicationController,
   DeploymentConfig, HorizontalPodAutoscaler, PodDisruptionBudget, and
   KubeVirt VirtualMachine/VirtualMachineInstance). Selection is via a modal
   dialog.

8. **Logs**: Pod logs for the current workload resource. Only available for
   workload kinds. Selection is via a modal dialog with container selection,
   line count control, and live preview.

9. **Alert**: The full alert definition YAML from Prometheus/Thanos alerting
   rules, matched by alert labels from the URL query parameters. The plugin
   checks both the standard Prometheus endpoint and the Thanos proxy endpoint
   (for ACM multi-cluster alerts). Alert attachments are deduplicated by
   generating a unique ID from sorted label key-value pairs.

10. **File Upload**: User-uploaded YAML files from the local filesystem.
    Files must be valid YAML and under a maximum file size. The file content
    is parsed to extract `kind`, `metadata.name`, and `metadata.namespace`
    for display.

11. **ManagedCluster Info**: For ACM ManagedCluster resources, the plugin
    attaches both the ManagedCluster object and the associated
    ManagedClusterInfo object (fetched from the ACM internal API). Both have
    `managedFields` stripped.

### Attachment Menu

12. The attachment menu ("+" button) must show the following sections in
    order:
    a. "Currently viewing" label (when a resource is detected).
    b. "Attach" section with available attachment options.
    c. "Upload from computer" option (always available).
    d. Query mode toggle (Ask or Troubleshooting, whichever is not currently
       active).

13. The Events menu item must be disabled when no events are available for
    the current resource.

### Attachment Display

14. Each attached item must display as a label showing a resource icon and
    the resource name. Labels must be removable via a close button.

15. Attachments must be viewable and editable in a modal dialog. The modal
    must show the content in a code editor with the resource icon, kind, and
    name in the header.

16. Modified attachments (where current value differs from original value)
    must show an edit indicator icon. The original value can be restored via
    an undo action in the editor modal.

17. A warning alert must be displayed when the total size of all attachments
    exceeds a threshold.

### API Conversion

18. When sending attachments to the OLS API, the plugin must convert them
    using the following mapping:

    | Plugin attachment type | API `attachment_type` | API `content_type` |
    |---|---|---|
    | YAML, YAML filtered, YAMLUpload | `api object` | `application/yaml` |
    | Events | `event` | `application/yaml` |
    | Log | `log` | `text/plain` |

### Attachment Keying

19. Each attachment is stored in a map keyed by a composite ID:
    `{attachmentType}_{kind}_{name}_{ownerName}`. An explicit ID can
    override the default key (used for alerts to avoid duplicates).

20. Attachments persist in Redux state across popover open/close cycles
    within the same session.

21. Attachments are cleared after query submission and when starting a new
    chat.

## Constraints

1. File uploads are restricted to `.yaml` and `.yml` extensions.
2. Uploaded files must parse as valid YAML objects (not scalars or arrays).
3. File upload size is capped at a maximum per-file limit.
4. The plugin has no server-side attachment storage. Attachments exist only
   in Redux state until submitted with a query.
5. Events and logs require the resource to be watchable via the console's
   K8s API proxy.

## Planned Changes

| Jira Key | Summary |
|---|---|
| OLS-1401 | Upload local YAML files (completed) |
| OLS-1896 | ACM: Attach ApplicationSet objects from Applications page |
| OLS-2065 | ACM: Attach policy violations |
| OLS-2116 | ACM: Attach cluster info in ACM-enabled environments |
| OLS-2284 | ACM: Add "Attach cluster info" option for Nodes and Add-ons tabs |
