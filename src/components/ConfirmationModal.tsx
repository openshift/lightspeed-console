import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal, ModalVariant } from '@patternfly/react-core';

type Props = {
  handleRedirect: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

const ConfirmationModal: React.FC<Props> = ({ handleRedirect }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  return (
    <Modal
      actions={[
        <Button id="leave" key="leave" onClick={handleRedirect} variant="primary">
          {t('Leave')}
        </Button>,
        <Button id="stay" key="stay" onClick={handleRedirect} variant="link">
          {t('Stay')}
        </Button>,
      ]}
      aria-describedby="modal-title-icon-description"
      className="redirect-modal"
      isOpen={true}
      showClose={false}
      title={t('Do you want to leave this page?')}
      titleIconVariant="warning"
      variant={ModalVariant.small}
    >
      {t('Changes you made may not be saved.')}
    </Modal>
  );
};

export default ConfirmationModal;
