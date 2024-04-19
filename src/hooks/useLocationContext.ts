import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { K8sResourceKind, useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';

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
      let matches = undefined;

      matches = path.match(
        new RegExp(
          '/k8s/ns/([a-z0-9-]+)/(cronjobs|daemonsets|deployments|jobs|pods|replicasets|statefulsets)/([a-z0-9-]+)',
        ),
      );
      if (matches) {
        setKind(resourcePluralToKind(matches[2]));
        setName(matches[3]);
        setNamespace(matches[1]);
        return;
      }

      matches = path.match(
        new RegExp(
          '/k8s/all-namespaces/(cronjobs|daemonsets|deployments|jobs|pods|replicasets|statefulsets)/([a-z0-9-]+)',
        ),
      );
      if (matches) {
        setKind(resourcePluralToKind(matches[1]));
        setName(matches[2]);
        setNamespace(undefined);
        return;
      }

      setKind(undefined);
      setName(undefined);
      setNamespace(undefined);
    }
  }, [path]);

  return useK8sWatchResource<K8sResourceKind>(
    kind && name ? { isList: false, kind, name, namespace } : null,
  );
};
