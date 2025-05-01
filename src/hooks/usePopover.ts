import * as React from 'react';
import { useModal } from '@openshift-console/dynamic-plugin-sdk';

import { useBoolean } from './useBoolean';
import Popover from '../components/Popover';

const POPOVER_ID = 'plugin__lightspeed-console-plugin__POPOVER_ID';

const usePopover = () => {
  const [isLaunched, , setLaunched] = useBoolean(false);

  const launchModal = useModal();

  React.useEffect(() => {
    if (!isLaunched && launchModal) {
      launchModal?.(Popover, {}, POPOVER_ID);
      setLaunched();
    }
  }, [isLaunched, launchModal, setLaunched]);

  return [];
};

export default usePopover;
