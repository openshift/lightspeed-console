import {
  K8sResourceKind,
  useK8sWatchResource,
  WatchK8sResult,
} from '@openshift-console/dynamic-plugin-sdk';

export const useWatchOLSConfig = (): WatchK8sResult<K8sResourceKind> =>
  useK8sWatchResource<K8sResourceKind>({
    isList: false,
    kind: 'ols.openshift.io~v1alpha1~OLSConfig',
    name: 'cluster',
  });
