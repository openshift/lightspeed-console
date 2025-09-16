import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Alert } from '@patternfly/react-core';

import { State } from '../redux-reducers';

const MAX_CHARS = 1000000;

const AttachmentsSizeAlert: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const attachments = useSelector((s: State) => s.plugins?.ols?.get('attachments'));

  const totalChars = attachments.valueSeq().reduce((sum, a) => sum + a.value.length, 0);

  if (totalChars <= MAX_CHARS) {
    return null;
  }

  return (
    <Alert className="ols-plugin__alert" isInline title={t('Large prompt')} variant="warning">
      {t('Total size of attachments exceeds {{max}} characters.', {
        max: MAX_CHARS.toLocaleString(),
      })}
    </Alert>
  );
};

export default AttachmentsSizeAlert;
