import { describe, it } from 'node:test';
import { deepStrictEqual } from 'node:assert';

import { FetchError, getFetchErrorMessage } from '../src/error';

// Stub for the i18next t() function that performs interpolation like the real one
const t = ((s: string, opts?: Record<string, unknown>) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  opts ? s.replace(/\{\{(\w+)\}\}/g, (_, key) => String(opts[key] ?? '')) : s) as any;

describe('getFetchErrorMessage', () => {
  it('returns the detail string when detail is a string', () => {
    const error: FetchError = { json: { detail: 'Something went wrong' } };
    deepStrictEqual(getFetchErrorMessage(error, t), { message: 'Something went wrong' });
  });

  it('returns response and cause when detail is an object', () => {
    const error: FetchError = {
      json: { detail: { response: 'Model not available', cause: 'Provider timeout' } },
    };
    deepStrictEqual(getFetchErrorMessage(error, t), {
      message: 'Model not available',
      moreInfo: 'Provider timeout',
    });
  });

  it('falls back to json.message when detail is missing', () => {
    const error: FetchError = { json: { message: 'Bad request' } };
    const result = getFetchErrorMessage(error, t);
    deepStrictEqual(result, {
      message:
        'If this error persists, please contact an administrator. Error details: Bad request',
    });
  });

  it('falls back to error.message when json.message is missing', () => {
    const error: FetchError = { message: 'Network error' };
    const result = getFetchErrorMessage(error, t);
    deepStrictEqual(result, {
      message:
        'If this error persists, please contact an administrator. Error details: Network error',
    });
  });

  it('falls back to response.statusText as last resort', () => {
    const error: FetchError = { response: { statusText: 'Internal Server Error' } as Response };
    const result = getFetchErrorMessage(error, t);
    deepStrictEqual(result, {
      message:
        'If this error persists, please contact an administrator. Error details: Internal Server Error',
    });
  });

  it('ignores detail object when cause is missing', () => {
    const error: FetchError = { json: { detail: { response: 'partial' } as never } };
    const result = getFetchErrorMessage(error, t);
    deepStrictEqual(result, {
      message: 'If this error persists, please contact an administrator. Error details: ',
    });
  });

  it('ignores detail object when response is missing', () => {
    const error: FetchError = { json: { detail: { cause: 'partial' } as never } };
    const result = getFetchErrorMessage(error, t);
    deepStrictEqual(result, {
      message: 'If this error persists, please contact an administrator. Error details: ',
    });
  });
});
