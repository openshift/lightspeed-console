import * as React from 'react';
import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';

export enum AuthStatus {
  Authorized = 'Authorized',
  AuthorizedError = 'AuthorizedError',
  AuthorizedLoading = 'AuthorizedLoading',
  NotAuthenticated = 'NotAuthenticated',
  NotAuthorized = 'NotAuthorized',
}

const AUTHORIZATION_ENDPOINT = '/api/proxy/plugin/lightspeed-console-plugin/ols/authorized';

type AuthorizationResponse = {
  user_id: string;
  username: string;
};

export const getRequestInitwithAuthHeader = (): RequestInit => {
  const init: RequestInit = {};
  const bearerToken = process.env.REACT_BEARER_TOKEN;
  if (bearerToken) {
    init.headers = { Authorization: `Bearer ${bearerToken}` };
  }
  return init;
};

export const useAuth = (): [AuthStatus] => {
  const [authStatus, setAuthorizationStatus] = React.useState<AuthStatus>(
    AuthStatus.AuthorizedLoading,
  );

  React.useEffect(() => {
    consoleFetchJSON
      .post(AUTHORIZATION_ENDPOINT, {}, getRequestInitwithAuthHeader())
      .then((response: AuthorizationResponse) => {
        if (response) {
          setAuthorizationStatus(AuthStatus.Authorized);
        }
      })
      .catch((error) => {
        console.warn(error.response);
        if (error.response?.status === 401) {
          setAuthorizationStatus(AuthStatus.NotAuthenticated);
        } else if (error.response?.status === 403) {
          setAuthorizationStatus(AuthStatus.NotAuthorized);
        } else {
          setAuthorizationStatus(AuthStatus.AuthorizedError);
        }
      });
  }, []);

  return [authStatus];
};
