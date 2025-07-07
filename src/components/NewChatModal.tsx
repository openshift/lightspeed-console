import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { YellowExclamationTriangleIcon } from '@openshift-console/dynamic-plugin-sdk';
import { ActionGroup, Button, Form, Text } from '@patternfly/react-core';

import Modal from './Modal';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const NewChatModal: React.FC<Props> = ({ isOpen, onClose, onConfirm }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <>
          <YellowExclamationTriangleIcon /> {t('Confirm chat deletion')}
        </>
      }
    >
      <Text>
        {t(
          'Are you sure you want to erase the current chat conversation and start a new chat? This action cannot be undone.',
        )}
      </Text>
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
    </Modal>
  );
};

export default NewChatModal;
