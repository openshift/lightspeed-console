import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { Tooltip } from '@patternfly/react-core';
import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';

import { getRequestInitWithAuthHeader } from '../hooks/useAuth';
import { useBoolean } from '../hooks/useBoolean';
import { closeOLS, openOLS, userFeedbackDisable } from '../redux-actions';
import { State } from '../redux-reducers';
import ErrorBoundary from './ErrorBoundary';
import GeneralPage from './GeneralPage';

import './popover.css';

// TODO: Include this for now to work around bug where CSS is not pulled in by console plugin SDK
import './pf-styles.css';

const FEEDBACK_STATUS_ENDPOINT =
  '/api/proxy/plugin/lightspeed-console-plugin/ols/v1/feedback/status';
const REQUEST_TIMEOUT = 5 * 60 * 1000;

const Popover: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const dispatch = useDispatch();

  const isOpen = useSelector((s: State) => s.plugins?.ols?.get('isOpen'));

  const [isExpanded, , expand, collapse] = useBoolean(false);

  React.useEffect(() => {
    consoleFetchJSON(
      FEEDBACK_STATUS_ENDPOINT,
      'get',
      getRequestInitWithAuthHeader(),
      REQUEST_TIMEOUT,
    )
      .then((response) => {
        if (response.status?.enabled === false) {
          dispatch(userFeedbackDisable());
        }
      })
      .catch((error) => {
        console.error('Error fetching user feedback status: {{error}}', { error });
      });
  }, [dispatch]);

  const open = React.useCallback(() => {
    dispatch(openOLS());
  }, [dispatch]);

  const close = React.useCallback(() => {
    dispatch(closeOLS());
  }, [dispatch]);

  return (
    <div aria-label={t('Red Hat OpenShift Lightspeed')} className="ols-plugin__popover-container">
      {isOpen ? (
        <>
          <div
            className={`ols-plugin__popover ols-plugin__popover--${
              isExpanded ? 'expanded' : 'collapsed'
            }`}
          >
            {isExpanded ? (
              <GeneralPage onClose={close} onCollapse={collapse} />
            ) : (
              <GeneralPage onClose={close} onExpand={expand} />
            )}
          </div>
          <div className="ols-plugin__popover-button" onClick={close}></div>
        </>
      ) : (
        <Tooltip content={t('Red Hat OpenShift Lightspeed')}>
          <div className="ols-plugin__popover-button" onClick={open}></div>
        </Tooltip>
      )}
    </div>
  );
};

const PopoverWithErrorBoundary: React.FC = () => (
  <ErrorBoundary>
    <Popover />
  </ErrorBoundary>
);

export default PopoverWithErrorBoundary;
