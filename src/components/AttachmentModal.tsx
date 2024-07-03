import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { BlueInfoCircleIcon } from '@openshift-console/dynamic-plugin-sdk';
import {
  ActionGroup,
  Button,
  CodeBlock,
  CodeBlockCode,
  Text,
  TextVariants,
} from '@patternfly/react-core';

import { AttachmentTypes } from '../attachments';
import { openAttachmentClear } from '../redux-actions';
import { State } from '../redux-reducers';
import { Attachment } from '../types';
import CopyAction from './CopyAction';
import Modal from './Modal';
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
      className="ols-plugin__attachment-modal"
      isOpen={!!attachment}
      onClose={onClose}
      title={
        <>
          <BlueInfoCircleIcon /> {t('Preview attachment')}
        </>
      }
    >
      <p>
        {t(
          'You can preview and optionally edit the code displayed in the modal before attaching it to your prompt.',
        )}
      </p>
      <CodeBlock
        actions={
          <div className="ols-plugin__code-block__full-width-header">
            <Text className="ols-plugin__code-block__title" component={TextVariants.h5}>
              <ResourceIcon kind={attachment?.kind} /> {attachment?.name}
            </Text>
            <CopyAction value={attachment?.value} />
          </div>
        }
        className="ols-plugin__code-block ols-plugin__code-block--attachment"
      >
        <CodeBlockCode
          style={
            attachment?.attachmentType === AttachmentTypes.Log ? { whiteSpace: 'pre' } : undefined
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
    </Modal>
  );
};

export default AttachmentModal;
