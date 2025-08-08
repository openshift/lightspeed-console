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

        urlMatches = path.match(
          // This is what ACM cluster URLs look like:
          // http://something.tld/multicloud/infrastructure/clusters/details/aks-central/aks-central/overview
          // they are not namespaced and the resource name is repeated
          new RegExp(
            `/multicloud/infrastructure/clusters/details/(${resourceName})/${resourceName}/overview`,
          ),
        );
        if (urlMatches) {
          // The k8s object for the cluster is not in the URL path, so we have to directly check if we are looking
          // at a cluster object here
          const key = 'cluster.open-cluster-management.io~v1~ManagedCluster';

          if (models[key]) {
            setKind(key);
            setName(urlMatches[1]);
            setNamespace(undefined);
            return;
          }
        }
      }

      if (new RegExp('^/monitoring/alerts/[0-9]+').test(path)) {
        const params = new URLSearchParams(location.search);
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
