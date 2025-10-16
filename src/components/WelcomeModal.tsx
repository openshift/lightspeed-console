import * as React from 'react';
import {
  Button,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';

import Modal from './Modal';

interface WelcomeModalProps {
  /** Whether the modal should be visible */
  isOpen: boolean;
  /** Callback when the modal is dismissed */
  onClose: () => void;
  /** Optional callback when the "Try it now" button is clicked */
  onTryNow?: () => void;
}

/**
 * Welcome modal that introduces new users to OpenShift Lightspeed.
 *
 * This modal provides a friendly introduction to the Lightspeed virtual assistant
 * and guides users to the icon in the bottom-right corner. It's designed to be
 * shown only to first-time users as part of the onboarding experience.
 */
const WelcomeModal: React.FC<WelcomeModalProps> = ({
  isOpen,
  onClose,
  onTryNow,
}) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const handleTryNow = () => {
    if (onTryNow) {
      onTryNow();
    }
    onClose();
  };

  const handleDismiss = () => {
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('Welcome to OpenShift Lightspeed')}
    >
      <Stack hasGutter>
        <StackItem>
          <p>
            {t('You now have access to the OpenShift Lightspeed virtual assistant. Click the icon in the bottom-right of your screen to try it.')}
          </p>
        </StackItem>
        <StackItem>
          <p>
            {t('OpenShift Lightspeed can help you with cluster management, troubleshooting, and learning about OpenShift features.')}
          </p>
        </StackItem>
        <StackItem>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <Button variant="primary" onClick={handleTryNow}>
              {t('Try it now')}
            </Button>
            <Button variant="link" onClick={handleDismiss}>
              {t('Dismiss')}
            </Button>
          </div>
        </StackItem>
      </Stack>
    </Modal>
  );
};

export default WelcomeModal;