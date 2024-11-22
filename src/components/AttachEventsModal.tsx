import { dump } from 'js-yaml';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import {
  ActionGroup,
  Alert,
  Button,
  CodeBlock,
  CodeBlockAction,
  CodeBlockCode,
  Form,
  FormGroup,
  HelperText,
  HelperTextItem,
  Slider,
  SliderOnChangeEvent,
  Spinner,
  Text,
} from '@patternfly/react-core';

import { AttachmentTypes } from '../attachments';
import {
  addContextEvent,
  attachmentSet,
  clearContextEvents,
  setIsContextEventsLoading,
} from '../redux-actions';
import { State } from '../redux-reducers';
import CopyAction from './CopyAction';
import Modal from './Modal';

const DEFAULT_MAX_EVENTS = 10;

type ErrorProps = {
  children: React.ReactNode;
  title: React.ReactNode;
};

const Error: React.FC<ErrorProps> = ({ children, title }) => (
  <Alert className="ols-plugin__alert" isInline title={title} variant="danger">
    {children}
  </Alert>
);

type Props = {
  isOpen: boolean;
  kind: string;
  name: string;
  namespace: string;
  onClose: () => void;
  uid: string;
};

const AttachEventsModal: React.FC<Props> = ({ isOpen, kind, name, namespace, onClose, uid }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const dispatch = useDispatch();

  const events = useSelector((s: State) => s.plugins?.ols?.get('contextEvents'));
  const isLoading = useSelector((s: State) => s.plugins?.ols?.get('isContextEventsLoading'));

  const [error, setError] = React.useState<string>();
  const [inputNumEvents, setInputNumEvents] = React.useState<number>();

  const numEvents = inputNumEvents ?? Math.min(events.length, DEFAULT_MAX_EVENTS);

  const yaml = dump(events.slice(-numEvents), { lineWidth: -1 }).trim();

  // Call onClose when the component is unmounted
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => onClose, []);

  React.useEffect(() => {
    if (kind && name && namespace) {
      dispatch(clearContextEvents());

      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const url = `${protocol}://${window.location.host}/api/kubernetes/api/v1/namespaces/${namespace}/events?fieldSelector=involvedObject.kind=${kind},involvedObject.name=${name},involvedObject.uid=${uid}&watch=true`;
      const socket = new WebSocket(url);

      socket.onopen = () => {
        dispatch(setIsContextEventsLoading(true));
        // After a while, timeout and assume that there are no events
        setTimeout(() => dispatch(setIsContextEventsLoading(false)), 10000);
      };

      socket.onmessage = (e) => {
        dispatch(setIsContextEventsLoading(false));
        const data = JSON.parse(e.data);
        if (data && data.type === 'ADDED') {
          // We ignore the managedFields section because it doesn't have much value
          delete data.object.metadata.managedFields;
          dispatch(addContextEvent(data.object));
        }
      };

      socket.onerror = () => {
        dispatch(setIsContextEventsLoading(false));
        setError(t('Error loading events from WebSocket'));
      };

      socket.onclose = () => {
        setError(undefined);
        dispatch(setIsContextEventsLoading(false));
      };

      return () => {
        dispatch(setIsContextEventsLoading(false));
        dispatch(clearContextEvents());
        socket.close();
      };
    }
  }, [dispatch, kind, name, namespace, t, uid]);

  const onInputNumEventsChange = React.useCallback(
    (_e: SliderOnChangeEvent, value: number) => setInputNumEvents(value),
    [],
  );

  const onSubmit = React.useCallback(
    (e) => {
      e.preventDefault();
      dispatch(attachmentSet(AttachmentTypes.Events, kind, name, undefined, namespace, yaml));
      onClose();
    },
    [dispatch, kind, name, namespace, onClose, yaml],
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('Configure events attachment')}>
      <Text>
        {t(
          'You can specify the most recent number of events from this resource to include as an attachment for detailed troubleshooting and analysis.',
        )}
      </Text>
      <Form>
        {isLoading && <Spinner size="md" />}
        {!isLoading &&
          (events.length === 0 ? (
            <HelperText>
              <HelperTextItem variant="indeterminate">{t('No events')}</HelperTextItem>
            </HelperText>
          ) : (
            <>
              <FormGroup label={t('Most recent {{numEvents}} events', { numEvents })}>
                <Slider
                  max={events.length}
                  min={1}
                  onChange={onInputNumEventsChange}
                  value={numEvents}
                />
              </FormGroup>
              <CodeBlock
                actions={
                  <>
                    <CodeBlockAction />
                    <CodeBlockAction>
                      <CopyAction value={yaml} />
                    </CodeBlockAction>
                  </>
                }
                className="ols-plugin__code-block ols-plugin__code-block--preview"
              >
                <CodeBlockCode
                  className="ols-plugin__code-block-code"
                  style={{ whiteSpace: 'pre' }}
                >
                  {yaml}
                </CodeBlockCode>
              </CodeBlock>
            </>
          ))}
        {error && <Error title={t('Failed to load events')}>{error}</Error>}
        <ActionGroup>
          <Button isDisabled={numEvents < 1} onClick={onSubmit} type="submit" variant="primary">
            {t('Attach')}
          </Button>
          <Button onClick={onClose} type="submit" variant="link">
            {t('Cancel')}
          </Button>
        </ActionGroup>
      </Form>
    </Modal>
  );
};

export default AttachEventsModal;
