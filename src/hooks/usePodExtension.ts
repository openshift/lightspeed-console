import * as React from 'react';
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { Action, ExtensionHook } from '@openshift-console/dynamic-plugin-sdk';

import { setPromptText } from '../redux-actions';

type PodExtensionOptions = {
  pod?: any; // TODO
};

const usePodExtension: ExtensionHook<Array<Action>, PodExtensionOptions> = (options) => {
  const dispatch = useDispatch();
  const history = useHistory();

  const [actions] = React.useState<Action[]>([
    // TODO: Just a placeholder for now
    {
      id: 'core~v1~Pod',
      label: 'Ask OpenShift Lightspeed',
      cta: () => {
        var prompt = `Tell me more about this pod.\n${JSON.stringify(options, null, 2)}`;
        dispatch(setPromptText(prompt));
        history.push('/lightspeed');
      }
    },
  ]);
  return [actions, true, null];
};

export default usePodExtension;
