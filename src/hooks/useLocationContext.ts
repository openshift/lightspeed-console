import * as React from 'react';
import { useLocation } from 'react-router-dom-v5-compat';
import { useK8sModels } from '@openshift-console/dynamic-plugin-sdk';

export const useLocationContext = () => {
  const [kind, setKind] = React.useState<string>();
  const [name, setName] = React.useState<string>();
  const [namespace, setNamespace] = React.useState<string>();

  const location = useLocation();
  const path = location?.pathname;

  const [models, inFlight] = useK8sModels();

  React.useEffect(() => {
    if (path) {
      const ns = `[a-z0-9-]+`;
      const resourceName = '[a-z0-9-.]+';

      const params = new URLSearchParams(decodeURIComponent(location.search));

      if (models && inFlight === false) {
        const resourceKey = '[a-zA-Z0-9~.]+';
        let urlMatches = undefined;

        urlMatches = path.match(new RegExp(`/k8s/ns/(${ns})/(${resourceKey})/(${resourceName})`));
        if (urlMatches) {
          const key = urlMatches[2];

          if (models[key]) {
            setKind(key);
            setName(urlMatches[3]);
            setNamespace(urlMatches[1]);
            return;
          }

          const modelKey = Object.keys(models).find((k) => models[k].plural === key);
          if (modelKey) {
            const model = models[modelKey];
            if (model && model.kind !== 'Secret') {
              setKind(model.kind);
              setName(urlMatches[3]);
              setNamespace(urlMatches[1]);
              return;
            }
          }
        }

        urlMatches = path.match(new RegExp(`/k8s/cluster/(${resourceKey})/(${resourceName})`));
        if (urlMatches) {
          const key = urlMatches[1];

          if (models[key]) {
            setKind(key);
            setName(urlMatches[2]);
            setNamespace(undefined);
            return;
          }

          const modelKey = Object.keys(models).find((k) => models[k].plural === key);
          if (modelKey) {
            const model = models[modelKey];
            if (model && model.kind !== 'Secret') {
              setKind(model.kind);
              setName(urlMatches[2]);
              setNamespace(undefined);
              return;
            }
          }
        }

        // ACM ManagedCluster details page
        urlMatches = path.match(
          // The URL path is not namespaced and the ManagedCluster name is repeated
          new RegExp(
            `/multicloud/infrastructure/clusters/details/(${resourceName})/${resourceName}/overview`,
          ),
        );
        if (urlMatches) {
          const key = 'cluster.open-cluster-management.io~v1~ManagedCluster';
          if (models[key]) {
            setKind(key);
            setName(urlMatches[1]);
            setNamespace(undefined);
            return;
          }
        }

        // ACM search resources page
        if (path.startsWith('/multicloud/search/resources')) {
          const key = params.get('kind');
          if (key && params.get('name')) {
            if (key === 'VirtualMachine') {
              // ACM VirtualMachine details page
              setKind('kubevirt.io~v1~VirtualMachine');
              setName(params.get('name'));
              setNamespace(params.get('namespace') || undefined);
              return;
            } else if (models[key]) {
              setKind(key);
              setName(params.get('name'));
              setNamespace(params.get('namespace') || undefined);
              return;
            }
          }
        }

        // ACM Application or ApplicationSet details page
        urlMatches = path.match(
          new RegExp(`/multicloud/applications/details/(${ns})/(${resourceName})/overview`),
        );
        if (urlMatches) {
          // Map the apiVersion GET param in the URL to the model kind
          const applicationKind = {
            'applicationset.argoproj.io': 'argoproj.io~v1alpha1~ApplicationSet',
            'application.argoproj.io': 'argoproj.io~v1alpha1~Application',
            'application.app.k8s.io': 'app.k8s.io~v1beta1~Application',
          }[params.get('apiVersion')];
          if (applicationKind) {
            setKind(applicationKind);
            setName(urlMatches[2]);
            setNamespace(urlMatches[1]);
            return;
          }
        }
      }

      // Alert details page
      if (new RegExp('^/monitoring/alerts/[0-9]+').test(path)) {
        if (params.has('alertname')) {
          setKind('Alert');
          setName(params.get('alertname'));
          setNamespace(params.get('namespace'));
          return;
        }
      }

      setKind(undefined);
      setName(undefined);
      setNamespace(undefined);
    }
  }, [inFlight, location.search, models, path]);

  return [kind, name, namespace];
};
