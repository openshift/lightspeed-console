const API_BASE_URL = '/api/proxy/plugin/lightspeed-console-plugin/ols';

export const getApiUrl = (path: string): string => `${API_BASE_URL}${path}`;
