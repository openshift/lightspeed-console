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
  // React-redux 7 types require a full Redux store, but the components only use these methods
  const providerStore = store as unknown as React.ComponentProps<typeof Provider>['store'];
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={providerStore}>{children}</Provider>
  );
  return { ...render(ui, { ...options, wrapper }), store };
};

// @testing-library/react only includes renderHook from v13, which requires React 18
export const renderHook = <Result,>(hook: () => Result) => {
  const result = { current: undefined as Result };
  const TestComponent: React.FC = () => {
    result.current = hook();
    return null;
  };
  const { rerender, unmount } = render(<TestComponent />);
  return { rerender: () => rerender(<TestComponent />), result, unmount };
};
