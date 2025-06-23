import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardCopyButton } from '@patternfly/react-core';

import { useBoolean } from '../hooks/useBoolean';

type Props = {
  className?: string;
  value: string;
};

const CopyAction: React.FC<Props> = ({ className, value }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const [isCopied, , setCopied, setNotCopied] = useBoolean(false);

  return (
    <ClipboardCopyButton
      aria-label={t('Copy to clipboard')}
      className={className}
      exitDelay={isCopied ? 1500 : 600}
      id="ols-plugin-copy-button"
      onClick={() => {
        try {
          navigator.clipboard.writeText(value);
          setCopied();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Failed to copy to clipboard: ', err);
        }
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
