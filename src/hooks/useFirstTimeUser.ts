import { useCallback } from 'react';
import { useUserSettings } from '@openshift-console/dynamic-plugin-sdk';

/**
 * Simple hook to manage first-time user experience for OpenShift Lightspeed.
 *
 * This hook tracks whether the user has ever closed/minimized the chat window.
 * For first-time users, the chat should auto-open. Once they close it once,
 * it should stay closed on future page loads.
 *
 * @returns A tuple containing:
 *   - isFirstTimeUser: boolean indicating if this is a first-time user (chat should auto-open)
 *   - markAsExperienced: callback function to mark that user has closed chat
 *   - isLoaded: boolean indicating if the user settings have finished loading
 */
export const useFirstTimeUser = (): [boolean, () => void, boolean] => {
  // Track if user has ever closed the chat window
  const [hasClosedChatBefore, setHasClosedChatBefore, isLoaded] = useUserSettings(
    'lightspeed.hasClosedChat',
    false, // Default: user hasn't closed chat yet (first-time user)
    true, // Sync across namespaces
  );

  // Create stable callback to mark user as experienced (no longer first-time)
  const markAsExperienced = useCallback(() => {
    setHasClosedChatBefore(true);
  }, [setHasClosedChatBefore]);

  // First-time user if they haven't closed chat before and settings are loaded
  const isFirstTimeUser = isLoaded && !hasClosedChatBefore;

  return [isFirstTimeUser, markAsExperienced, isLoaded];
};
