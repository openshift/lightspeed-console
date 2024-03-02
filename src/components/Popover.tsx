import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { Tooltip } from '@patternfly/react-core';

import { useBoolean } from '../hooks/useBoolean';
import { closeOLS, openOLS } from '../redux-actions';
import { State } from '../redux-reducers';
import GeneralPage from './GeneralPage';

import './popover.css';
import { AuthorizationStatus, useAuthorization } from '../hooks/useAuthorization';

const Popover: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const dispatch = useDispatch();

  const isOpen = useSelector((s: State) => s.plugins?.ols?.get('isOpen'));

  const [isExpanded, , expand, collapse] = useBoolean(false);
  const [authorizationStatus] = useAuthorization();

  const open = React.useCallback(() => {
    dispatch(openOLS());
  }, [dispatch]);

  const close = React.useCallback(() => {
    dispatch(closeOLS());
  }, [dispatch]);

  if (isExpanded) {
    return null;
  }

  if (authorizationStatus !== AuthorizationStatus.Authorized) {
    return null;
  }

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

export default Popover;
