import * as React from 'react';
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { Action, ExtensionHook } from '@openshift-console/dynamic-plugin-sdk';

import { setContext } from '../redux-actions';

type PodExtensionOptions = {
  pod?: any; // TODO
};

const usePodExtension: ExtensionHook<Array<Action>, PodExtensionOptions> = (options) => {
  const dispatch = useDispatch();
  const history = useHistory();

  const [actions] = React.useState<Action[]>([
    {
      id: 'core~v1~Pod',
      label: 'Ask OpenShift Lightspeed',
      cta: () => {
        dispatch(setContext(options));
        history.push('/lightspeed');
      }
    },
  ]);
  return [actions, true, null];
};

export default usePodExtension;
