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
} from '@patternfly/react-icons';

import { toOLSAttachment } from '../attachments';
import { ErrorType, getFetchErrorMessage } from '../error';
import { getRequestInitWithAuthHeader } from '../hooks/useAuth';
import {
  userFeedbackClose,
  userFeedbackOpen,
  userFeedbackSetSentiment,
  userFeedbackSetText,
} from '../redux-actions';
import { State } from '../redux-reducers';
import { Attachment } from '../types';
import CloseButton from './CloseButton';
import ErrorBoundary from './ErrorBoundary';

const USER_FEEDBACK_ENDPOINT = '/api/proxy/plugin/lightspeed-console-plugin/ols/v1/feedback';

const REQUEST_TIMEOUT = 5 * 60 * 1000;

const THUMBS_DOWN = -1;
const THUMBS_UP = 1;

type Props = {
  conversationID: string;
  entryIndex: number;
};

const Feedback: React.FC<Props> = ({ conversationID, entryIndex }) => {
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

  const [error, setError] = React.useState<ErrorType>();
  const [submitted, setSubmitted] = React.useState(false);

  const onClose = React.useCallback(() => {
    dispatch(userFeedbackClose(entryIndex));
  }, [dispatch, entryIndex]);

  const onThumbsDown = React.useCallback(() => {
    dispatch(userFeedbackOpen(entryIndex));
    dispatch(
      userFeedbackSetSentiment(entryIndex, sentiment === THUMBS_DOWN ? undefined : THUMBS_DOWN),
    );
  }, [dispatch, entryIndex, sentiment]);

  const onThumbsUp = React.useCallback(() => {
    dispatch(userFeedbackOpen(entryIndex));
    dispatch(userFeedbackSetSentiment(entryIndex, sentiment === THUMBS_UP ? undefined : THUMBS_UP));
  }, [dispatch, entryIndex, sentiment]);

  const onTextChange = React.useCallback(
    (_e, newText) => {
      dispatch(userFeedbackSetText(entryIndex, newText));
    },
    [dispatch, entryIndex],
  );

  const onSubmit = React.useCallback(() => {
    const userQuestion = attachments
      ? `${query}\n---\nThe attachments that were sent with the prompt are shown below.\n${JSON.stringify(attachments.valueSeq().map(toOLSAttachment), null, 2)}`
      : query;

    /* eslint-disable camelcase */
    const requestJSON = {
      conversation_id: conversationID,
      llm_response: response,
      sentiment,
      user_feedback: text,
      user_question: userQuestion,
    };
    /* eslint-enable camelcase */

    consoleFetchJSON
      .post(USER_FEEDBACK_ENDPOINT, requestJSON, getRequestInitWithAuthHeader(), REQUEST_TIMEOUT)
      .then(() => {
        dispatch(userFeedbackClose(entryIndex));
        setSubmitted(true);
      })
      .catch((err) => {
        setError(getFetchErrorMessage(err, t));
        setSubmitted(false);
      });
  }, [conversationID, dispatch, entryIndex, query, attachments, response, sentiment, t, text]);

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
              <CloseButton onClose={onClose} />
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
                  "Do not include personal information or other sensitive information in your feedback. Feedback may be used to improve Red Hat's products or services.",
                )}
              </HelperTextItem>
            </HelperText>
            {error && (
              <Alert
                className="ols-plugin__alert"
                isExpandable={!!error.moreInfo}
                isInline
                title={error.moreInfo ? error.message : t('Error submitting feedback')}
                variant="danger"
              >
                {error.moreInfo ? error.moreInfo : error.message}
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

const FeedbackWithErrorBoundary: React.FC<Props> = ({ conversationID, entryIndex }) => (
  <ErrorBoundary>
    <Feedback conversationID={conversationID} entryIndex={entryIndex} />
  </ErrorBoundary>
);

export default FeedbackWithErrorBoundary;
