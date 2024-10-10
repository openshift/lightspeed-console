import * as React from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation } from 'react-router-dom';
import { Button, ButtonVariant, Tooltip } from '@patternfly/react-core';
import { PlusCircleIcon } from '@patternfly/react-icons';
import { useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import { closeOLS, importCodeblock } from '../redux-actions';
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

  const triggerRef = React.createRef<HTMLButtonElement>();
  const [showModal, setShowModal] = React.useState(false);

  const generateRandomNumericString = (length = 4): string => {
    const digits = '0123456789';
    return Array.from({ length }, () => digits[Math.floor(Math.random() * digits.length)]).join('');
  };

  const handleRedirect = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.currentTarget.id === 'leave') {
      history.push(`/k8s/ns/${activeNamespace}/import?ols=true`);
    }
    setShowModal(false);
    dispatch(closeOLS());
  };

  const handleClick = () => {
    if (isImportYAMLPage) {
      history.replace(`${location.pathname}?ols=true`);
    } else {
      setShowModal(true);
    }
    dispatch(
      importCodeblock({
        value,
        id: generateRandomNumericString(),
      }),
    );
  };

  return (
    <>
      {showModal && !isImportYAMLPage && <ConfirmationModal handleRedirect={handleRedirect} />}
      <Tooltip
        aria="none"
        aria-live="polite"
        content={<div>{t('Import to console')}</div>}
        trigger="mouseenter focus click"
        triggerRef={triggerRef}
      >
        <Button
          aria-label={t('Import to console')}
          onClick={handleClick}
          ref={triggerRef}
          type="button"
          variant={ButtonVariant.plain}
        >
          <PlusCircleIcon />
        </Button>
      </Tooltip>
    </>
  );
};

export default ImportAction;
