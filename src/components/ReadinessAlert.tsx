import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';
import { Alert, Spinner } from '@patternfly/react-core';

import { getRequestInitWithAuthHeader } from '../hooks/useAuth';

const READINESS_ENDPOINT = '/api/proxy/plugin/lightspeed-console-plugin/ols/readiness';
const REQUEST_TIMEOUT = 5 * 60 * 1000;

const ReadinessAlert: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const [showAlert, setShowAlert] = React.useState(false);

  React.useEffect(() => {
    const poller = () => {
      consoleFetchJSON(READINESS_ENDPOINT, 'get', getRequestInitWithAuthHeader(), REQUEST_TIMEOUT)
        .then((response) => {
          // Keep polling until /readiness returns true
          if (response.ready === true) {
            setShowAlert(false);
          } else {
            setShowAlert(true);
            setTimeout(poller, 10000);
          }
        })
        .catch(() => {
          setShowAlert(true);
          setTimeout(poller, 10000);
        });
    };

    poller();
  }, []);

  if (!showAlert) {
    return null;
  }

  return (
    <Alert
      className="ols-plugin__alert"
      isInline
      title={t('Waiting for OpenShift Lightspeed service')}
      variant="warning"
    >
      {t('The OpenShift Lightspeed service is not yet ready to receive requests.')}{' '}
      <Spinner isInline size="md" />
    </Alert>
  );
};

export default ReadinessAlert;
