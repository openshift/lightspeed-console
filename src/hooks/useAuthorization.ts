import * as React from 'react';
import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';

export enum AuthorizationStatus {
  Authorized = 'authorized',
  AuthorizedError = 'authorizedError',
  AuthorizedLoading = 'authorizedLoading',
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

export const useAuthorization = (): [AuthorizationStatus] => {
  const [authorizationStatus, setAuthorizationStatus] = React.useState<AuthorizationStatus>(
    AuthorizationStatus.AuthorizedLoading,
  );

  React.useEffect(() => {
    consoleFetchJSON
      .post(AUTHORIZATION_ENDPOINT, {}, getRequestInitwithAuthHeader())
      .then((response: AuthorizationResponse) => {
        if (response) {
          setAuthorizationStatus(AuthorizationStatus.Authorized);
        }
      })
      .catch(() => {
        setAuthorizationStatus(AuthorizationStatus.AuthorizedError);
      });
  }, []);
  return [authorizationStatus];
};
