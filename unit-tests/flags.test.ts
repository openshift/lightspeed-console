import { describe, expect, it, vi } from 'vitest';

import { enableLightspeedPluginFlag } from '../src/flags';

describe('enableLightspeedPluginFlag', () => {
  it('sets the LIGHTSPEED_PLUGIN feature flag to true', () => {
    const setFeatureFlag = vi.fn();
    enableLightspeedPluginFlag(setFeatureFlag);
    expect(setFeatureFlag).toHaveBeenCalledWith('LIGHTSPEED_PLUGIN', true);
  });
});
