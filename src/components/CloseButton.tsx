import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@patternfly/react-core';
import { TimesIcon } from '@patternfly/react-icons';

type Props = {
  onClose: () => void;
};

const CloseButton: React.FC<Props> = ({ onClose }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  return (
    <Button
      className="ols-plugin__popover-control"
      onClick={onClose}
      title={t('Close')}
      variant="plain"
    >
      <TimesIcon />
    </Button>
  );
};

export default CloseButton;
