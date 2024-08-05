import { TFunction } from 'react-i18next';

// Extracts the error message from a Fetch error
export const getFetchErrorMessage = (error, t: TFunction) => {
  // For OpenShift Lightspeed API errors, the `detail` field will either be a single string or
  // an object containing `response` and `cause` strings
  const detail = error.json?.detail;
  if (detail && typeof detail === 'string') {
    return detail;
  }
  if (detail && typeof detail.response === 'string' && typeof detail.cause === 'string') {
    return `${detail.response}: ${detail.cause}`;
  }
  return t('If this error persists, please contact an administrator. Error details: {{e}}', {
    e: error.json?.message || error.message || error.response?.statusText,
  });
};
