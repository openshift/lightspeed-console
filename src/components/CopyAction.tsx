import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardCopyButton } from '@patternfly/react-core';

import { useBoolean } from '../hooks/useBoolean';

type Props = {
  value: string;
};

const CopyAction: React.FC<Props> = ({ value }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const [isCopied, , setCopied, setNotCopied] = useBoolean(false);

  return (
    <ClipboardCopyButton
      aria-label={t('Copy to clipboard')}
      exitDelay={isCopied ? 1500 : 600}
      id="basic-copy-button"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied();
      }}
      onTooltipHidden={setNotCopied}
      textId="code-content"
      variant="plain"
    >
      {isCopied ? t('Copied') : t('Copy to clipboard')}
    </ClipboardCopyButton>
  );
};

export default CopyAction;
