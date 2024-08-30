import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { BlueInfoCircleIcon } from '@openshift-console/dynamic-plugin-sdk';
import { CodeEditor, Language } from '@patternfly/react-code-editor';
import {
  Button,
  CodeBlock,
  CodeBlockAction,
  CodeBlockCode,
  Split,
  SplitItem,
  Text,
  TextVariants,
} from '@patternfly/react-core';
import { PencilAltIcon, UndoIcon } from '@patternfly/react-icons';

import { AttachmentTypes, isAttachmentChanged } from '../attachments';
import { useBoolean } from '../hooks/useBoolean';
import { attachmentSet, openAttachmentClear, openAttachmentSet } from '../redux-actions';
import { State } from '../redux-reducers';
import { Attachment } from '../types';
import CopyAction from './CopyAction';
import Modal from './Modal';
import ResourceIcon from './ResourceIcon';

const ResourceHeader: React.FC = () => {
  const attachment: Attachment = useSelector((s: State) => s.plugins?.ols?.get('openAttachment'));

  return (
    <Text className="ols-plugin__code-block__title" component={TextVariants.h5}>
      <ResourceIcon kind={attachment?.kind} /> {attachment?.name}
      {isAttachmentChanged(attachment) && (
        <span className="ols-plugin__inline-icon">
          <PencilAltIcon />
        </span>
      )}
    </Text>
  );
};

type EditorProps = {
  onChange: (v: string) => void;
};

const Editor: React.FC<EditorProps> = ({ onChange }) => {
  const attachment: Attachment = useSelector((s: State) => s.plugins?.ols?.get('openAttachment'));

  const onEditorDidMount = (_editor, monaco) => {
    // Work around crash when CodeEditor attempts to call this nonexistent function
    // TODO: Figure out why this is happening
    monaco.editor.onDidChangeMarkers = () => {};
  };

  // In more recent versions of the dynamic plugin SDK, the useUserSettings hook can be used to get
  // the current theme, but to maintain 4.15 compatibility we are not upgrading the SDK yet
  const isDarkTheme = document.documentElement.classList.contains('pf-v5-theme-dark');

  return (
    <CodeEditor
      code={attachment?.value}
      customControls={<ResourceHeader />}
      height="calc(24rem - 52px)"
      isDarkTheme={isDarkTheme}
      isLanguageLabelVisible
      isMinimapVisible
      language={
        attachment?.attachmentType === AttachmentTypes.Log ? Language.plaintext : Language.yaml
      }
      onChange={onChange}
      onEditorDidMount={onEditorDidMount}
    />
  );
};

const Viewer: React.FC = () => {
  const attachment: Attachment = useSelector((s: State) => s.plugins?.ols?.get('openAttachment'));

  return (
    <CodeBlock
      actions={
        <>
          <CodeBlockAction>
            <ResourceHeader />
          </CodeBlockAction>
          <CodeBlockAction>
            <CopyAction value={attachment?.value} />
          </CodeBlockAction>
        </>
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
  );
};

const AttachmentModal: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const dispatch = useDispatch();

  const attachment: Attachment = useSelector((s: State) => s.plugins?.ols?.get('openAttachment'));

  const [isEditing, , setEditing, setNotEditing] = useBoolean(false);
  const [editorValue, setEditorValue] = React.useState<string>();

  const onClose = React.useCallback(() => {
    dispatch(openAttachmentClear());
  }, [dispatch]);

  const onSave = React.useCallback(() => {
    const originalValue =
      attachment.originalValue === undefined ? attachment.value : attachment.originalValue;
    dispatch(
      attachmentSet(
        attachment.attachmentType,
        attachment.kind,
        attachment.name,
        attachment.ownerName,
        attachment.namespace,
        editorValue,
        originalValue,
      ),
    );
    dispatch(openAttachmentClear());
    setNotEditing();
  }, [attachment, dispatch, editorValue, setNotEditing]);

  const onRevert = React.useCallback(() => {
    const value = attachment.originalValue;
    dispatch(openAttachmentSet(Object.assign({}, attachment, { value })));
    dispatch(
      attachmentSet(
        attachment.attachmentType,
        attachment.kind,
        attachment.name,
        attachment.ownerName,
        attachment.namespace,
        value,
        undefined,
      ),
    );
    setEditorValue(value);
  }, [attachment, dispatch]);

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
      {isEditing ? <Editor onChange={setEditorValue} /> : <Viewer />}
      <div className="ols-plugin__attachment-modal-actions">
        {isEditing ? (
          <>
            <Button onClick={onSave} type="submit" variant="primary">
              {t('Save')}
            </Button>
            <Button onClick={setNotEditing} variant="link">
              {t('Cancel')}
            </Button>
          </>
        ) : (
          <Split>
            <SplitItem isFilled>
              {attachment?.isEditable && (
                <Button onClick={setEditing} type="submit" variant="primary">
                  {t('Edit')}
                </Button>
              )}
              <Button onClick={onClose} variant="link">
                {t('Dismiss')}
              </Button>
            </SplitItem>
            {attachment?.originalValue && attachment.originalValue !== attachment.value && (
              <SplitItem>
                <Button icon={<UndoIcon />} isDanger onClick={onRevert} variant="link">
                  {t('Revert to original')}
                </Button>
              </SplitItem>
            )}
          </Split>
        )}
      </div>
    </Modal>
  );
};

export default AttachmentModal;
