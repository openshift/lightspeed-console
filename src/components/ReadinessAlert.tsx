import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';
import { Alert, Spinner } from '@patternfly/react-core';

import { getRequestInitWithAuthHeader } from '../hooks/useAuth';

const READINESS_ENDPOINT = '/api/proxy/plugin/lightspeed-console-plugin/ols/readiness';
const REQUEST_TIMEOUT = 5 * 60 * 1000;

const ReadinessAlert: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  // Default to true and only show the Alert if the call to /readiness returns `false`
  const [isReady, setIsReady] = React.useState(true);

  React.useEffect(() => {
    const poller = () => {
      consoleFetchJSON(READINESS_ENDPOINT, 'get', getRequestInitWithAuthHeader(), REQUEST_TIMEOUT)
        .then((response) => {
          // Keep polling until /readiness returns true
          if (response.ready === false) {
            setIsReady(false);
            setTimeout(poller, 10000);
          } else if (response.ready === true) {
            setIsReady(true);
          }
        })
        .catch((error) => {
          console.error('Error fetching OpenShift Lightspeed readiness:', error);
        });
    };

    poller();
  }, []);

  return isReady ? null : (
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
