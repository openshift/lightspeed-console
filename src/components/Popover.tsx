import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Tooltip } from '@patternfly/react-core';
import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';

import { getApiUrl } from '../config';
import { getRequestInitWithAuthHeader } from '../hooks/useAuth';
import { useBoolean } from '../hooks/useBoolean';
import { useHideLightspeed } from '../hooks/useHideLightspeed';
import { useIsDarkTheme } from '../hooks/useIsDarkTheme';
import { closeOLS, openOLS, userFeedbackDisable } from '../redux-actions';
import { State } from '../redux-reducers';
import ErrorBoundary from './ErrorBoundary';
import GeneralPage from './GeneralPage';

import './popover.css';

const FEEDBACK_STATUS_ENDPOINT = getApiUrl('/v1/feedback/status');
const REQUEST_TIMEOUT = 5 * 60 * 1000;

const Popover: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const dispatch = useDispatch();

  const isOpen = useSelector((s: State) => s.plugins?.ols?.get('isOpen'));

  const [isExpanded, , expand, collapse] = useBoolean(false);
  const [isHidden] = useHideLightspeed();
  const [isDarkTheme] = useIsDarkTheme();

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
        // eslint-disable-next-line no-console
        console.error('Error fetching user feedback status:', error);
      });
  }, [dispatch]);

  const open = React.useCallback(() => {
    dispatch(openOLS());
  }, [dispatch]);

  const close = React.useCallback(() => {
    dispatch(closeOLS());
  }, [dispatch]);

  if (isHidden) {
    return null;
  }

  const title = t('Red Hat OpenShift Lightspeed');

  return (
    <div
      aria-label={title}
      className={`ols-plugin__popover-container ${isDarkTheme ? 'ols-plugin__popover-container--dark' : ''}`}
    >
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
          <Button
            aria-label={title}
            className="ols-plugin__popover-button"
            onClick={close}
            variant="link"
          />
        </>
      ) : (
        <Tooltip content={title}>
          <Button
            aria-label={title}
            className="ols-plugin__popover-button"
            onClick={open}
            variant="link"
          />
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
