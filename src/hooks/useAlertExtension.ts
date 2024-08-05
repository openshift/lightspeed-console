import * as React from 'react';
import { Action, Alert, ExtensionHook } from '@openshift-console/dynamic-plugin-sdk';

type AlertExtensionOptions = {
  alert?: Alert;
};

const useAlertExtension: ExtensionHook<Array<Action>, AlertExtensionOptions> = (options) => {
  const [actions] = React.useState<Action[]>([
    // TODO: Just a placeholder for now
    {
      id: 'monitoring-alert-list-item',
      label: 'Ask OpenShift Lightspeed',
      cta: () => {
        const ruleName = options.alert?.rule?.name;
        // eslint-disable-next-line no-console
        console.warn(`OpenShift Lightspeed callback called for alert ${ruleName}`);
      },
    },
  ]);
  return [actions, true, null];
};

export default useAlertExtension;
