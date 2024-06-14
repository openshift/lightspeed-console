import * as React from 'react';
import { useTranslation } from 'react-i18next';
import * as Modal from 'react-modal';
import { useDispatch, useSelector } from 'react-redux';
import { BlueInfoCircleIcon } from '@openshift-console/dynamic-plugin-sdk';
import {
  ActionGroup,
  Button,
  CodeBlock,
  CodeBlockCode,
  Text,
  TextVariants,
  Title,
} from '@patternfly/react-core';
import { TimesIcon } from '@patternfly/react-icons';

import { AttachmentTypes } from '../attachments';
import { openAttachmentClear } from '../redux-actions';
import { State } from '../redux-reducers';
import { Attachment } from '../types';
import CopyAction from './CopyAction';
import ResourceIcon from './ResourceIcon';

const AttachmentModal: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const dispatch = useDispatch();

  const attachment: Attachment = useSelector((s: State) => s.plugins?.ols?.get('openAttachment'));

  const onClose = React.useCallback(() => {
    dispatch(openAttachmentClear());
  }, [dispatch]);

  return (
    <Modal
      ariaHideApp={false}
      className="modal-dialog ols-plugin__attachment-modal"
      isOpen={!!attachment}
      onRequestClose={onClose}
      overlayClassName="co-overlay"
    >
      <div className="modal-header">
        <TimesIcon className="ols-plugin__popover-close" onClick={onClose} />
        <Title headingLevel="h2">
          <BlueInfoCircleIcon /> {t('Preview attachment')}
        </Title>
        <p>
          {t(
            'You can preview and optionally edit the code displayed in the modal before attaching it to your prompt.',
          )}
        </p>
      </div>
      <div className="modal-body">
        <div className="modal-body-content">
          <Text component={TextVariants.h5}>
            <ResourceIcon kind={attachment?.kind} /> {attachment?.name}
          </Text>
          <CodeBlock
            actions={<CopyAction value={attachment?.value} />}
            className="ols-plugin__code-block ols-plugin__code-block--attachment"
          >
            <CodeBlockCode
              style={
                attachment?.attachmentType === AttachmentTypes.Log
                  ? { whiteSpace: 'pre' }
                  : undefined
              }
            >
              {attachment?.value}
            </CodeBlockCode>
          </CodeBlock>
          <ActionGroup>
            <Button onClick={onClose} type="submit" variant="link">
              {t('Dismiss')}
            </Button>
          </ActionGroup>
        </div>
      </div>
    </Modal>
  );
};

export default AttachmentModal;
