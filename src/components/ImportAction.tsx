import * as _ from 'lodash';
import * as React from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation } from 'react-router-dom';
import { Button, ButtonVariant, Tooltip } from '@patternfly/react-core';
import { PlusCircleIcon } from '@patternfly/react-icons';
import { useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import { closeOLS, importCodeBlock } from '../redux-actions';
import ConfirmationModal from './ConfirmationModal';

type Props = {
  value: string;
};

const ImportAction: React.FC<Props> = ({ value }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');
  const location = useLocation();
  const dispatch = useDispatch();
  const history = useHistory();
  const [activeNamespace] = useActiveNamespace();

  const isImportYAMLPage = location?.pathname?.split('/').pop() === 'import';

  const [showModal, setShowModal] = React.useState(false);

  const handleRedirect = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.currentTarget.id === 'leave') {
      history.push(`/k8s/ns/${activeNamespace}/import?ols=true`);
      dispatch(closeOLS());
    }
    setShowModal(false);
  };

  const handleClick = () => {
    if (isImportYAMLPage) {
      history.replace(`${location.pathname}?ols=true`);
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
          onClick={handleClick}
          variant={ButtonVariant.plain}
        >
          <PlusCircleIcon />
        </Button>
      </Tooltip>
    </>
  );
};

export default ImportAction;
