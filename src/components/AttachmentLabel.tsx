import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { Label, Tooltip } from '@patternfly/react-core';
import { PencilAltIcon } from '@patternfly/react-icons';

import { isAttachmentChanged } from '../attachments';
import { openAttachmentSet } from '../redux-actions';
import { Attachment } from '../types';
import ResourceIcon from './ResourceIcon';

type AttachmentLabelProps = {
  attachment: Attachment;
  isEditable?: boolean;
  onClose?: () => void;
};

const AttachmentLabel: React.FC<AttachmentLabelProps> = ({ attachment, isEditable, onClose }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const dispatch = useDispatch();

  const onClick = React.useCallback(() => {
    dispatch(openAttachmentSet(Object.assign({}, attachment, { isEditable })));
  }, [attachment, isEditable, dispatch]);

  if (!attachment) {
    return null;
  }

  const { attachmentType, kind, name, value } = attachment;
  const isChanged = isAttachmentChanged(attachment);

  return (
    <Tooltip
      content={
        <>
          {isChanged ? t('Preview attachment - modified') : t('Preview attachment')}{' '}
          {t('({{num}} characters)', { num: value?.length?.toLocaleString() ?? '0' })}
        </>
      }
    >
      <Label className="ols-plugin__context-label" onClick={onClick} onClose={onClose}>
        <ResourceIcon kind={kind} />
        <span className="ols-plugin__context-label-text">{name}</span>
        {isChanged && (
          <span className="ols-plugin__inline-icon">
            <PencilAltIcon />
          </span>
        )}
        {kind !== 'Alert' && (
          <Label className="ols-plugin__inline-icon" variant="outline">
            {attachmentType}
          </Label>
        )}
      </Label>
    </Tooltip>
  );
};

export default AttachmentLabel;
