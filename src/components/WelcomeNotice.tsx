import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@patternfly/react-core';

/**
 * Welcome notice component for first-time users.
 * Displayed inside the chat window to welcome new users and encourage them to try Lightspeed.
 */
const WelcomeNotice: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  return (
    <Alert
      className="ols-plugin__alert"
      isInline
      title={t('Welcome to OpenShift Lightspeed!')}
      variant="info"
    >
      {t(
        'OpenShift Lightspeed is now available to help you with your OpenShift questions and tasks. Try asking about deployments, troubleshooting, best practices, or any other OpenShift-related topics. This notice will disappear once you minimize the chat.',
      )}
    </Alert>
  );
};

export default WelcomeNotice;
