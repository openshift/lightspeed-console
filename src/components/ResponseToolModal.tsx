import { Map as ImmutableMap } from 'immutable';
import * as React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  CodeBlock,
  CodeBlockAction,
  CodeBlockCode,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Label,
  Modal,
  ModalBody,
  ModalHeader,
  Title,
} from '@patternfly/react-core';
import { BanIcon } from '@patternfly/react-icons';

import { openToolClear } from '../redux-actions';
import { State } from '../redux-reducers';
import CopyAction from './CopyAction';

const ToolModal: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const dispatch = useDispatch();

  const tool: ImmutableMap<string, unknown> = useSelector((s: State) => {
    const openTool = s.plugins?.ols?.get('openTool');
    return s.plugins?.ols?.getIn([
      'chatHistory',
      openTool.get('chatEntryIndex'),
      'tools',
      openTool.get('id'),
    ]);
  });

  const onClose = React.useCallback(() => {
    dispatch(openToolClear());
  }, [dispatch]);

  if (!tool) {
    return null;
  }

  const { args, content, isDenied, name, serverName, status, structuredContent, uiResourceUri } =
    tool.toJS() as {
      args: Record<string, unknown>;
      content: string;
      isDenied?: boolean;
      name: string;
      serverName?: string;
      status: string;
      structuredContent?: Record<string, unknown>;
      uiResourceUri?: string;
    };

  const argsFormatted = Object.entries(args ?? {})
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');

  const structuredContentFormatted = structuredContent
    ? JSON.stringify(structuredContent, null, 2)
    : undefined;

  return (
    <Modal
      className="ols-plugin__attachment-modal"
      isOpen={true}
      onClose={onClose}
      variant="medium"
    >
      <ModalHeader
        title={isDenied ? t('Tool call rejected') : t('Tool output')}
        titleIconVariant={isDenied ? BanIcon : status === 'error' ? 'danger' : 'info'}
      />
      <ModalBody>
        {!isDenied && status === 'error' && (
          <Alert
            className="ols-plugin__alert"
            isInline
            title={t('An unexpected error occurred')}
            variant="danger"
          >
            {t('Please retry or contact support if the issue persists.')}
          </Alert>
        )}
        <Content component="p">
          {isDenied ? (
            argsFormatted ? (
              <Trans values={{ name, argsFormatted }}>
                The tool <span className="ols-plugin__code-inline">{'{{name}}'}</span> was requested
                with arguments{' '}
                <span className="ols-plugin__code-inline">{'{{argsFormatted}}'}</span> but was
                rejected.
              </Trans>
            ) : (
              <Trans values={{ name }}>
                The tool <span className="ols-plugin__code-inline">{'{{name}}'}</span> was requested
                with no arguments but was rejected.
              </Trans>
            )
          ) : argsFormatted ? (
            <Trans values={{ name, argsFormatted }}>
              The following output was generated when running{' '}
              <span className="ols-plugin__code-inline">{'{{name}}'}</span> with arguments{' '}
              <span className="ols-plugin__code-inline">{'{{argsFormatted}}'}</span>.
            </Trans>
          ) : (
            <Trans values={{ name }}>
              The following output was generated when running{' '}
              <span className="ols-plugin__code-inline">{'{{name}}'}</span> with no arguments.
            </Trans>
          )}
        </Content>

        <DescriptionList className="ols-plugin__tool-metadata" isCompact isHorizontal>
          {!isDenied && (
            <DescriptionListGroup>
              <DescriptionListTerm>{t('Status')}</DescriptionListTerm>
              <DescriptionListDescription>
                <Label
                  color={status === 'error' ? 'red' : status === 'success' ? 'green' : 'yellow'}
                >
                  {status ?? t('pending')}
                </Label>
              </DescriptionListDescription>
            </DescriptionListGroup>
          )}
          {serverName && (
            <DescriptionListGroup>
              <DescriptionListTerm>{t('MCP server')}</DescriptionListTerm>
              <DescriptionListDescription>{serverName}</DescriptionListDescription>
            </DescriptionListGroup>
          )}
          {uiResourceUri && (
            <DescriptionListGroup>
              <DescriptionListTerm>{t('UI resource')}</DescriptionListTerm>
              <DescriptionListDescription>
                <span className="ols-plugin__code-inline">{uiResourceUri}</span>
              </DescriptionListDescription>
            </DescriptionListGroup>
          )}
        </DescriptionList>

        {isDenied ? null : content ? (
          <>
            <Title className="ols-plugin__tool-section-title" headingLevel="h4">
              {t('Content')}
            </Title>
            <CodeBlock
              actions={
                <>
                  <CodeBlockAction />
                  <CodeBlockAction>
                    <CopyAction value={content} />
                  </CodeBlockAction>
                </>
              }
              className="ols-plugin__code-block ols-plugin__code-block--attachment"
            >
              <CodeBlockCode className="ols-plugin__code-block-code">{content}</CodeBlockCode>
            </CodeBlock>
          </>
        ) : (
          status && (
            <Alert
              className="ols-plugin__alert"
              isInline
              title={t('No output returned')}
              variant="info"
            />
          )
        )}

        {!isDenied && structuredContentFormatted && (
          <>
            <Title className="ols-plugin__tool-section-title" headingLevel="h4">
              {t('Structured content')}
            </Title>
            <CodeBlock
              actions={
                <>
                  <CodeBlockAction />
                  <CodeBlockAction>
                    <CopyAction value={structuredContentFormatted} />
                  </CodeBlockAction>
                </>
              }
              className="ols-plugin__code-block ols-plugin__code-block--attachment"
            >
              <CodeBlockCode className="ols-plugin__code-block-code">
                {structuredContentFormatted}
              </CodeBlockCode>
            </CodeBlock>
          </>
        )}
      </ModalBody>
    </Modal>
  );
};

export default ToolModal;
