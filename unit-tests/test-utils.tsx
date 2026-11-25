import * as React from 'react';
import { Provider } from 'react-redux';
import { render, RenderOptions } from '@testing-library/react';

import { OLSAction } from '../src/redux-actions';
import reducer, { OLSState, State } from '../src/redux-reducers';

// Minimal Redux store that uses the real OLS reducer, so components see the same state shape the
// console provides
const createStore = (actions: OLSAction[]) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initialOLSState = reducer(undefined as OLSState, { type: '' } as any);
  let state: State = {
    plugins: { ols: actions.reduce(reducer, initialOLSState) },
    sdkCore: { user: { username: 'test-user' } },
  };
  const listeners = new Set<() => void>();

  return {
    dispatch: (action: OLSAction) => {
      state = { ...state, plugins: { ols: reducer(state.plugins.ols, action) } };
      listeners.forEach((listener) => {
        listener();
      });
      return action;
    },
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

type RenderWithStoreOptions = Omit<RenderOptions, 'wrapper'> & {
  // Actions to dispatch before rendering to set up the initial state
  actions?: OLSAction[];
};

export const renderWithStore = (
  ui: React.ReactElement,
  { actions = [], ...options }: RenderWithStoreOptions = {},
) => {
  const store = createStore(actions);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return { ...render(ui, { ...options, wrapper }), store };
};
