import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@patternfly/react-core';
import { CompressIcon, ExpandIcon, WindowMinimizeIcon } from '@patternfly/react-icons';

type WindowControlButtonsProps = {
  onExpand?: () => void;
  onCollapse?: () => void;
  onClose: () => void;
};

const WindowControlButtons: React.FC<WindowControlButtonsProps> = ({
  onExpand,
  onCollapse,
  onClose,
}) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  return (
    <>
      {onExpand && (
        <Button
          className="ols-plugin__popover-control"
          icon={<ExpandIcon />}
          onClick={onExpand}
          title={t('Expand')}
          variant="plain"
        />
      )}
      {onCollapse && (
        <Button
          className="ols-plugin__popover-control"
          icon={<CompressIcon />}
          onClick={onCollapse}
          title={t('Collapse')}
          variant="plain"
        />
      )}
      <Button
        className="ols-plugin__popover-control"
        icon={<WindowMinimizeIcon />}
        onClick={onClose}
        title={t('Minimize')}
        variant="plain"
      />
    </>
  );
};

export default WindowControlButtons;
