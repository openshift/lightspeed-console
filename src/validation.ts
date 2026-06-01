import { map as _map } from 'lodash';
import { murmur3 } from 'murmurhash-js';

// Matches the monitoring-console-plugin's alerting rule ID generation (murmur3 hash of rule key)
export const alertingRuleID = (
  group: { file: string; name: string },
  rule: { name: string; duration?: number; query: string; labels?: Record<string, string> },
): string => {
  const key = [
    group.file,
    group.name,
    rule.name,
    rule.duration,
    rule.query,
    ..._map(rule.labels, (v, k) => `${v}=${k}`),
  ].join(',');
  return String(murmur3(key));
};

export const isValidAlertName = (value: string | null | undefined): boolean =>
  !!value && /^[a-zA-Z_:][a-zA-Z0-9_:]*$/.test(value);

export const isValidSilenceID = (value: string | null | undefined): boolean =>
  !!value && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);

// Validates the format group~version~kind (e.g. "policy.open-cluster-management.io~v1~Policy")
export const isValidKindName = (value: string | null | undefined): boolean =>
  !!value && /^[a-zA-Z0-9~.-]+$/.test(value);

export const isValidResourceName = (value: string | null | undefined): boolean =>
  !!value && /^[a-z0-9][a-z0-9-.]*$/.test(value);

export const isValidNamespaceName = (value: string | null | undefined): boolean =>
  !!value && /^[a-z0-9][a-z0-9-]*$/.test(value);
