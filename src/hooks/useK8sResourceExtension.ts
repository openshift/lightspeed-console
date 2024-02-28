import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { Action, ExtensionHook, K8sResourceKind } from '@openshift-console/dynamic-plugin-sdk';

import { openOLS, setContext } from '../redux-actions';

const useK8sResourceExtension: ExtensionHook<Array<Action>, K8sResourceKind> = (k8sResource) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const dispatch = useDispatch();

  const [actions] = React.useState<Action[]>([
    {
      id: 'ols',
      label: t('Ask OpenShift Lightspeed'),
      cta: () => {
        dispatch(setContext(k8sResource));
        dispatch(openOLS());
      },
    },
  ]);
  return [actions, true, null];
};

export default useK8sResourceExtension;
