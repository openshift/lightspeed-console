import { Map as ImmutableMap } from 'immutable';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  Button,
  Chip,
  HelperText,
  HelperTextItem,
  Label,
  TextArea,
  Title,
  Tooltip,
} from '@patternfly/react-core';
import {
  OutlinedThumbsDownIcon,
  OutlinedThumbsUpIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  TimesIcon,
} from '@patternfly/react-icons';

import { toOLSAttachment } from '../attachments';
import { getRequestInitWithAuthHeader } from '../hooks/useAuth';
import {
  userFeedbackClose,
  userFeedbackOpen,
  userFeedbackSetSentiment,
  userFeedbackSetText,
} from '../redux-actions';
import { State } from '../redux-reducers';
import { Attachment } from '../types';
import ErrorBoundary from './ErrorBoundary';

const USER_FEEDBACK_ENDPOINT = '/api/proxy/plugin/lightspeed-console-plugin/ols/v1/feedback';

const REQUEST_TIMEOUT = 10 * 60 * 1000; // 10 minutes

const THUMBS_DOWN = -1;
const THUMBS_UP = 1;

type Props = {
  conversationID: string;
  entryIndex: number;
  scrollIntoView: () => void;
};

const Feedback: React.FC<Props> = ({ conversationID, entryIndex, scrollIntoView }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const dispatch = useDispatch();

  const isOpen: string = useSelector((s: State) =>
    s.plugins?.ols?.getIn(['chatHistory', entryIndex, 'userFeedback', 'isOpen']),
  );
  const query: string = useSelector((s: State) =>
    s.plugins?.ols?.getIn(['chatHistory', entryIndex - 1, 'text']),
  );
  const attachments: ImmutableMap<string, Attachment> = useSelector((s: State) =>
    s.plugins?.ols?.getIn(['chatHistory', entryIndex - 1, 'attachments']),
  );
  const response: string = useSelector((s: State) =>
    s.plugins?.ols?.getIn(['chatHistory', entryIndex, 'text']),
  );
  const sentiment: number = useSelector((s: State) =>
    s.plugins?.ols?.getIn(['chatHistory', entryIndex, 'userFeedback', 'sentiment']),
  );
  const text: string = useSelector((s: State) =>
    s.plugins?.ols?.getIn(['chatHistory', entryIndex, 'userFeedback', 'text']),
  );

  const [error, setError] = React.useState<string>();
  const [submitted, setSubmitted] = React.useState(false);

  const onClose = React.useCallback(() => {
    dispatch(userFeedbackClose(entryIndex));
  }, [dispatch, entryIndex]);

  const onThumbsDown = React.useCallback(() => {
    dispatch(userFeedbackOpen(entryIndex));
    dispatch(
      userFeedbackSetSentiment(entryIndex, sentiment === THUMBS_DOWN ? undefined : THUMBS_DOWN),
    );
    scrollIntoView();
  }, [dispatch, entryIndex, scrollIntoView, sentiment]);

  const onThumbsUp = React.useCallback(() => {
    dispatch(userFeedbackOpen(entryIndex));
    dispatch(userFeedbackSetSentiment(entryIndex, sentiment === THUMBS_UP ? undefined : THUMBS_UP));
    scrollIntoView();
  }, [dispatch, entryIndex, scrollIntoView, sentiment]);

  const onTextChange = React.useCallback(
    (_e, text) => {
      dispatch(userFeedbackSetText(entryIndex, text));
    },
    [dispatch, entryIndex],
  );

  const onSubmit = React.useCallback(() => {
    const user_question = attachments
      ? `${query}\n---\nThe attachments that were sent with the prompt are shown below.\n${JSON.stringify(attachments.valueSeq().map(toOLSAttachment), null, 2)}`
      : query;

    const requestJSON = {
      conversation_id: conversationID,
      llm_response: response,
      sentiment,
      user_feedback: text,
      user_question,
    };

    consoleFetchJSON
      .post(USER_FEEDBACK_ENDPOINT, requestJSON, getRequestInitWithAuthHeader(), REQUEST_TIMEOUT)
      .then(() => {
        dispatch(userFeedbackClose(entryIndex));
        setSubmitted(true);
      })
      .catch((error) => {
        setError(error.json?.detail || error.message || 'Feedback POST failed');
        setSubmitted(false);
      });
  }, [conversationID, dispatch, entryIndex, query, attachments, response, sentiment, text]);

  return (
    <>
      <div className="ols-plugin__feedback">
        <Tooltip content={t('Good response')}>
          <div
            className={`ols-plugin__feedback-icon${
              sentiment === THUMBS_UP ? ' ols-plugin__feedback-icon--selected' : ''
            }`}
            onClick={onThumbsUp}
          >
            {sentiment === THUMBS_UP ? <ThumbsUpIcon /> : <OutlinedThumbsUpIcon />}
          </div>
        </Tooltip>
        <Tooltip content={t('Bad response')}>
          <div
            className={`ols-plugin__feedback-icon${
              sentiment === THUMBS_DOWN ? ' ols-plugin__feedback-icon--selected' : ''
            }`}
            onClick={onThumbsDown}
          >
            {sentiment === THUMBS_DOWN ? <ThumbsDownIcon /> : <OutlinedThumbsDownIcon />}
          </div>
        </Tooltip>
        {isOpen && sentiment !== undefined && (
          <div className="ols-plugin__feedback-comment">
            <Title headingLevel="h3">
              <TimesIcon className="ols-plugin__popover-close" onClick={onClose} />
              {t('Why did you choose this rating?')} <Chip isReadOnly>{t('Optional')}</Chip>
            </Title>
            <TextArea
              aria-label={t('Provide additional feedback')}
              className="ols-plugin__feedback-input"
              onChange={onTextChange}
              placeholder={t('Provide additional feedback')}
              resizeOrientation="vertical"
              rows={1}
              value={text}
            />
            <HelperText>
              <HelperTextItem className="ols-plugin__feedback-footer" variant="indeterminate">
                {t(
                  'Do not share any personal or business sensitive information. The information you provide may be used to improve our products and services.',
                )}
              </HelperTextItem>
            </HelperText>
            {error && (
              <Alert
                className="ols-plugin__alert"
                isInline
                title={t('Error submitting feedback')}
                variant="danger"
              >
                {error}
              </Alert>
            )}
            <Button onClick={onSubmit} variant="primary">
              {t('Submit')}
            </Button>
          </div>
        )}
      </div>
      {submitted && (
        <Label className="ols-plugin__feedback-submitted" color="blue">
          {t('Thank you for your feedback!')}
        </Label>
      )}
    </>
  );
};

const FeedbackWithErrorBoundary: React.FC<Props> = ({
  conversationID,
  entryIndex,
  scrollIntoView,
}) => (
  <ErrorBoundary>
    <Feedback
      conversationID={conversationID}
      entryIndex={entryIndex}
      scrollIntoView={scrollIntoView}
    />
  </ErrorBoundary>
);

export default FeedbackWithErrorBoundary;
