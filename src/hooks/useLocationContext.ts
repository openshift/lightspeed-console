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
