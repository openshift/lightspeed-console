import * as React from 'react';
import { useLocation } from 'react-router-dom';

const resourcePluralToKind = (plural: string) => {
  switch (plural) {
    case 'cronjobs':
      return 'CronJob';
    case 'daemonsets':
      return 'DaemonSet';
    case 'deployments':
      return 'Deployment';
    case 'jobs':
      return 'Job';
    case 'pods':
      return 'Pod';
    case 'replicasets':
      return 'ReplicaSet';
    case 'statefulsets':
      return 'StatefulSet';
    default:
      return undefined;
  }
};

export const useLocationContext = () => {
  const [kind, setKind] = React.useState<string>();
  const [name, setName] = React.useState<string>();
  const [namespace, setNamespace] = React.useState<string>();

  const location = useLocation();
  const path = location?.pathname;

  React.useEffect(() => {
    if (path) {
      const namespace = `[a-z0-9-]+`;
      const resourceType = 'cronjobs|daemonsets|deployments|jobs|pods|replicasets|statefulsets';
      const resourceName = '[a-z0-9-.]+';

      let matches = undefined;
      matches = path.match(
        new RegExp(`/k8s/ns/(${namespace})/(${resourceType})/(${resourceName})`),
      );
      if (matches) {
        setKind(resourcePluralToKind(matches[2]));
        setName(matches[3]);
        setNamespace(matches[1]);
        return;
      }

      matches = path.match(new RegExp(`/k8s/all-namespaces/(${resourceType})/(${resourceName})`));
      if (matches) {
        setKind(resourcePluralToKind(matches[1]));
        setName(matches[2]);
        setNamespace(undefined);
        return;
      }

      if (new RegExp('^/monitoring/alerts/[0-9]+').test(path)) {
        const params = new URLSearchParams(location.search);
        if (params.has('alertname') && params.has('namespace')) {
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
  }, [location.search, path]);

  return [kind, name, namespace];
};
