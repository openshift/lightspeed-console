import * as React from 'react';
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { Action, ExtensionHook, K8sResourceCommon } from '@openshift-console/dynamic-plugin-sdk';

import { setContext } from '../redux-actions';

const usePodExtension: ExtensionHook<Array<Action>, K8sResourceCommon> = (k8sResource) => {
  const dispatch = useDispatch();
  const history = useHistory();

  const [actions] = React.useState<Action[]>([
    {
      id: 'core~v1~Pod',
      label: 'Ask OpenShift Lightspeed',
      cta: () => {
        dispatch(setContext(k8sResource));
        history.push('/lightspeed');
      },
    },
  ]);
  return [actions, true, null];
};

export default usePodExtension;
