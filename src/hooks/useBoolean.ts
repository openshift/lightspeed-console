import * as React from 'react';

export const useBoolean = (
  initialValue: boolean,
): [boolean, () => void, () => void, () => void, () => void] => {
  const [value, setValue] = React.useState(initialValue);
  const toggle = React.useCallback(() => setValue((v) => !v), []);
  const setTrue = React.useCallback(() => setValue(true), []);
  const setFalse = React.useCallback(() => setValue(false), []);
  const set = React.useCallback(() => setValue((v) => v), []);
  return [value, toggle, setTrue, setFalse, set];
};
