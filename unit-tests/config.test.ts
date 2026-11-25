import { describe, expect, it } from 'vitest';

import { getApiUrl } from '../src/config';

describe('getApiUrl', () => {
  it('prefixes the path with the console plugin proxy base URL', () => {
    expect(getApiUrl('/v1/query')).toBe('/api/proxy/plugin/lightspeed-console-plugin/ols/v1/query');
  });
});
