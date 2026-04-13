import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionGroup,
  Button,
  Content,
  Form,
  Modal,
  ModalBody,
  ModalHeader,
} from '@patternfly/react-core';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const NewChatModal: React.FC<Props> = ({ isOpen, onClose, onConfirm }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  return (
    <Modal isOpen={isOpen} onClose={onClose} variant="small">
      <ModalHeader title={t('Confirm chat deletion')} titleIconVariant="warning" />
      <ModalBody>
        <Content component="p">
          {t(
            'Are you sure you want to erase the current chat conversation and start a new chat? This action cannot be undone.',
          )}
        </Content>
        <Form>
          <ActionGroup>
            <Button key="confirm" onClick={onConfirm} variant="danger">
              {t('Erase and start new chat')}
            </Button>
            <Button key="cancel" onClick={onClose} variant="link">
              {t('Cancel')}
            </Button>
          </ActionGroup>
        </Form>
      </ModalBody>
    </Modal>
  );
};

export default NewChatModal;
