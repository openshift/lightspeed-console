import * as _ from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom-v5-compat';
import { useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import { Button, ButtonVariant, Tooltip } from '@patternfly/react-core';
import { PlusCircleIcon } from '@patternfly/react-icons';

import { closeOLS, importCodeBlock } from '../redux-actions';
import ConfirmationModal from './ConfirmationModal';

type Props = {
  value: string;
};

const ALL_NAMESPACES_KEY = '#ALL_NS#';

const ImportAction: React.FC<Props> = ({ value }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');
  const location = useLocation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [activeNamespace] = useActiveNamespace();

  const isImportYAMLPage = location?.pathname?.split('/').pop() === 'import';

  const [showModal, setShowModal] = React.useState(false);

  // The web console only supports the import YAML action from version 4.18
  const { releaseVersion } = window.SERVER_FLAGS;
  if (releaseVersion) {
    const [major, minor] = releaseVersion.split('.');
    if (Number(major) < 4 || (Number(major) === 4 && Number(minor) < 18)) {
      return null;
    }
  }

  const handleRedirect = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.currentTarget.id === 'leave') {
      navigate(
        activeNamespace === ALL_NAMESPACES_KEY
          ? `/k8s/all-namespaces/import?ols=true`
          : `/k8s/ns/${activeNamespace}/import?ols=true`,
      );
      dispatch(closeOLS());
    }
    setShowModal(false);
  };

  const handleClick = () => {
    if (isImportYAMLPage) {
      navigate(`${location.pathname}?ols=true`, { replace: true });
    } else {
      setShowModal(true);
    }
    dispatch(
      // Ensure the object triggers updates, even with the same value
      importCodeBlock({
        value,
        id: _.uniqueId('ImportCodeBlock_'),
        triggeredFrom: location?.pathname,
      }),
    );
  };

  return (
    <>
      {showModal && !isImportYAMLPage && <ConfirmationModal handleRedirect={handleRedirect} />}
      <Tooltip aria="none" content={t('Import to console')} trigger="mouseenter focus click">
        <Button
          aria-label={t('Import to console')}
          icon={<PlusCircleIcon />}
          onClick={handleClick}
          variant={ButtonVariant.plain}
        />
      </Tooltip>
    </>
  );
};

export default ImportAction;
