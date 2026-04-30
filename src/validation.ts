export const isValidAlertName = (value: string | null | undefined): boolean =>
  !!value && /^[a-zA-Z_:][a-zA-Z0-9_:]*$/.test(value);

export const isValidKindName = (value: string | null | undefined): boolean =>
  !!value && /^[a-zA-Z0-9~.]+$/.test(value);

export const isValidResourceName = (value: string | null | undefined): boolean =>
  !!value && /^[a-z0-9][a-z0-9-.]*$/.test(value);

export const isValidNamespaceName = (value: string | null | undefined): boolean =>
  !!value && /^[a-z0-9][a-z0-9-]*$/.test(value);
