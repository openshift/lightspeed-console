import { TFunction } from 'react-i18next';

export type ErrorType = {
  message?: string;
  moreInfo?: string;
  response?: Response;
};

// Extracts the error message from a Fetch error
export const getFetchErrorMessage = (error, t: TFunction): ErrorType => {
  // For OpenShift Lightspeed API errors, the `detail` field will either be a single string or
  // an object containing `response` and `cause` strings
  const detail = error.json?.detail;
  if (detail && typeof detail === 'string') {
    return { message: detail };
  }
  if (detail && typeof detail.response === 'string' && typeof detail.cause === 'string') {
    return { message: detail.response, moreInfo: detail.cause };
  }
  return {
    message: t('If this error persists, please contact an administrator. Error details: {{e}}', {
      e: error.json?.message || error.message || error.response?.statusText,
    }),
  };
};
