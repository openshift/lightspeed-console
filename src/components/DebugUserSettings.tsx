import * as React from 'react';
import { useFirstTimeExperience } from '../hooks/useFirstTimeExperience';

/**
 * Debug component to inspect first-time experience state
 * This helps us understand what's happening with the preference system
 */
const DebugUserSettings: React.FC = () => {
  const [shouldShowIndicators, , isLoaded] = useFirstTimeExperience();

  // Add to browser console for debugging with more detail
  React.useEffect(() => {
    console.log('DebugUserSettings CHANGE:', {
      shouldShowIndicators,
      isLoaded,
      timestamp: new Date().toISOString(),
      location: window.location.pathname,
    });
  }, [shouldShowIndicators, isLoaded]);

  // Also log the raw preference values from the hook
  React.useEffect(() => {
    const timer = setTimeout(() => {
      // Get the raw localStorage to see both preference values
      const userSettings = JSON.parse(localStorage.getItem('bridge/user-settings') || '{}');
      console.log('Raw user preferences:', {
        showFirstTimeExperience: userSettings['lightspeed.showFirstTimeExperience'],
        hasInteracted: userSettings['lightspeed.hasInteracted'],
        timestamp: new Date().toISOString()
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [shouldShowIndicators, isLoaded]);

  // Log when the component mounts
  React.useEffect(() => {
    console.log('DebugUserSettings MOUNTED at:', window.location.pathname);
  }, []);

  // This component is now invisible but still monitors the setting
  return null;
};

export default DebugUserSettings;