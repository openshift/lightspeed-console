const DEFAULT_API_BASE_URL = '/api/proxy/plugin/lightspeed-console-plugin/ols';

export const getApiUrl = (path: string): string => {
  const base = (process.env.OLS_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
  return `${base}${path}`;
};
