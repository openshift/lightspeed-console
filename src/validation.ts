export const isValidAlertName = (value: string | null | undefined): boolean =>
  !!value && /^[a-zA-Z_:][a-zA-Z0-9_:]*$/.test(value);

// Validates the format group~version~kind (e.g. "policy.open-cluster-management.io~v1~Policy")
export const isValidKindName = (value: string | null | undefined): boolean =>
  !!value && /^[a-zA-Z0-9~.-]+$/.test(value);

export const isValidResourceName = (value: string | null | undefined): boolean =>
  !!value && /^[a-z0-9][a-z0-9-.]*$/.test(value);

export const isValidNamespaceName = (value: string | null | undefined): boolean =>
  !!value && /^[a-z0-9][a-z0-9-]*$/.test(value);
