import { useCallback } from 'react';
import { useUserSettings } from '@openshift-console/dynamic-plugin-sdk';

/**
 * Custom hook to manage the first-time experience state for OpenShift Lightspeed.
 *
 * This hook uses TWO separate user settings to avoid conflicts:
 * 1. 'lightspeed.showFirstTimeExperience' - User preference checkbox (UI controlled)
 * 2. 'lightspeed.hasInteracted' - Programmatic tracking of user interaction
 *
 * The first-time experience indicators are shown when BOTH conditions are true:
 * - User wants to see FTUX (preference checkbox is checked)
 * - User hasn't interacted with Lightspeed yet (no programmatic interaction)
 *
 * Behavior:
 * - The checkbox controls whether FTUX should be shown on page load
 * - Once the user interacts with Lightspeed, FTUX is disabled until they manually
 *   re-enable it via the checkbox and reload/navigate
 * - This prevents preferences page visits from resetting the interaction state
 *
 * @returns A tuple containing:
 *   - shouldShowIndicators: boolean indicating if visual indicators (notification dot
 *     and flashing animation) should be displayed on the Lightspeed icon
 *   - markAsOpened: callback function to mark the chat as opened, which will hide
 *     the indicators and persist this state
 *   - isLoaded: boolean indicating if the user settings have finished loading
 *
 * @example
 * const [shouldShow, markOpened, loaded] = useFirstTimeExperience();
 *
 * if (shouldShow) {
 *   // Show notification indicators
 * }
 *
 * const handleClick = () => {
 *   markOpened(); // Mark as opened
 *   // Open chat
 * };
 */
export const useFirstTimeExperience = (): [boolean, () => void, boolean] => {
  // User preference checkbox (controlled via preferences UI)
  // IMPORTANT: We must expose the setter function so the console preference system can use it
  // @ts-ignore TS6133: Variable is declared but never read - but needed for console preference system
  const [userWantsFirstTimeExperience, setUserWantsFirstTimeExperience, userPrefLoaded] = useUserSettings(
    'lightspeed.showFirstTimeExperience',
    true, // Default: new users should see FTUX
    true, // SyncAcrossNamespaces
  );

  // Programmatic tracking of user interaction (separate from UI preference)
  const [hasUserInteracted, setHasUserInteracted, interactionLoaded] = useUserSettings(
    'lightspeed.hasInteracted',
    false, // Default: user hasn't interacted yet
    true, // SyncAcrossNamespaces
  );

  // Create stable callback to mark chat as opened (disable FTUX)
  const markAsOpened = useCallback(() => {
    setHasUserInteracted(true);
  }, [setHasUserInteracted]);

  // Calculate if indicators should show: user wants FTUX AND hasn't interacted yet
  // The checkbox only controls the initial state - once user interacts, FTUX is disabled
  // until they manually check the preference again on a new page load
  const shouldShowIndicators = userPrefLoaded && interactionLoaded && (userWantsFirstTimeExperience !== false) && !hasUserInteracted;
  const isLoaded = userPrefLoaded && interactionLoaded;

  return [shouldShowIndicators, markAsOpened, isLoaded];
};
