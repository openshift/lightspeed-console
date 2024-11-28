import { useSelector } from 'react-redux';
import { K8sResourceKind, useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';

import { State } from '../redux-reducers';

// A `useUserSettings` hook is available in recent versions of the dynamic plugin SDK, but we want
// to stay with v1.0.0 of the SDK for now to maintain compatibility with 4.15. We therefore get the
// user setting value directly from the ConfigMap instead.
export const useHideLightspeed = (): [boolean] => {
  const user = useSelector((s: State) => s.sdkCore?.user);

  let userUid;
  if (user?.uid) {
    userUid = user?.uid;
  } else if (user?.username === 'kube:admin') {
    userUid = 'kubeadmin';
  } else if (user?.username) {
    userUid = user?.username;
  }

  const [configMap, isLoaded, error] = useK8sWatchResource<K8sResourceKind>(
    userUid
      ? {
          kind: 'ConfigMap',
          namespace: 'openshift-console-user-settings',
          isList: false,
          name: `user-settings-${userUid}`,
        }
      : null,
  );

  const isHidden =
    isLoaded && !error && configMap?.data?.['console.hideLightspeedButton'] === 'true';

  return [isHidden];
};
