import { SetFeatureFlag } from '@openshift-console/dynamic-plugin-sdk';

export const FLAG_LIGHTSPEED_PLUGIN = 'LIGHTSPEED_PLUGIN';

export const enableLightspeedPluginFlag = (setFeatureFlag: SetFeatureFlag) =>
  setFeatureFlag(FLAG_LIGHTSPEED_PLUGIN, true);
