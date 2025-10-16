import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Tooltip } from '@patternfly/react-core';
import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';

import { getApiUrl } from '../config';
import { getRequestInitWithAuthHeader } from '../hooks/useAuth';
import { useBoolean } from '../hooks/useBoolean';
import { useFirstTimeExperience } from '../hooks/useFirstTimeExperience';
import { useHideLightspeed } from '../hooks/useHideLightspeed';
import { useIsDarkTheme } from '../hooks/useIsDarkTheme';
import { closeOLS, openOLS, userFeedbackDisable } from '../redux-actions';
import { State } from '../redux-reducers';
import DebugUserSettings from './DebugUserSettings';
import ErrorBoundary from './ErrorBoundary';
import GeneralPage from './GeneralPage';
import NotificationDot from './NotificationDot';
import WelcomeModal from './WelcomeModal';

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

  // IMPORTANT: Keep this hook active even when Popover is hidden
  // The console preference system needs access to the useUserSettings hook
  // for the "Show first-time experience" checkbox to function properly
  const [shouldShowIndicators, markAsOpened] = useFirstTimeExperience();

  // Local state for welcome modal - separate from first-time experience tracking
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = React.useState(false);

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

  // Show welcome modal for first-time users after a short delay
  React.useEffect(() => {
    if (shouldShowIndicators && !isHidden) {
      const timer = setTimeout(() => {
        setIsWelcomeModalOpen(true);
      }, 1000); // 1 second delay to let the page load

      return () => clearTimeout(timer);
    }
  }, [shouldShowIndicators, isHidden]);

  const open = React.useCallback(() => {
    if (shouldShowIndicators) {
      markAsOpened();
    }
    dispatch(openOLS());
  }, [dispatch, shouldShowIndicators, markAsOpened]);

  const close = React.useCallback(() => {
    dispatch(closeOLS());
  }, [dispatch]);

  // Handle welcome modal actions
  const handleWelcomeModalClose = React.useCallback(() => {
    setIsWelcomeModalOpen(false);
    // Note: We do NOT call markAsOpened() here - modal dismissal should not affect first-time experience
  }, []);

  const handleWelcomeModalTryNow = React.useCallback(() => {
    setIsWelcomeModalOpen(false);
    // This will mark as opened AND open the chat
    open();
  }, [open]);

  const title = t('Red Hat OpenShift Lightspeed');
  const buttonAriaLabel = shouldShowIndicators ? `${title} - New feature available` : title;

  // Always render DebugUserSettings to monitor preference state
  // even when the Popover UI is hidden
  if (isHidden) {
    return <DebugUserSettings />;
  }

  return (
    <>
      <DebugUserSettings />
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
          <>
            <Tooltip content={title}>
              <Button
                aria-label={buttonAriaLabel}
                className={`ols-plugin__popover-button ${shouldShowIndicators ? 'ols-plugin__popover-button--first-time' : ''}`}
                onClick={open}
                variant="link"
              />
            </Tooltip>
            <NotificationDot
              ariaLabel="New: OpenShift Lightspeed is available"
              isVisible={shouldShowIndicators}
            />
          </>
        )}
      </div>
      <WelcomeModal
        isOpen={isWelcomeModalOpen}
        onClose={handleWelcomeModalClose}
        onTryNow={handleWelcomeModalTryNow}
      />
    </>
  );
};

const PopoverWithErrorBoundary: React.FC = () => (
  <ErrorBoundary>
    <Popover />
  </ErrorBoundary>
);

export default PopoverWithErrorBoundary;
