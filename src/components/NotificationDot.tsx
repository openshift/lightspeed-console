import * as React from 'react';

import './notification-dot.css';

interface NotificationDotProps {
  /** Whether the dot should be visible */
  isVisible: boolean;
  /** Optional class name for styling */
  className?: string;
  /** ARIA label for accessibility */
  ariaLabel?: string;
}

/**
 * NotificationDot component displays a small notification indicator
 * positioned absolutely relative to its parent container.
 *
 * This component is designed to be used as an overlay indicator
 * for the OpenShift Lightspeed button to signal first-time experience.
 *
 * @param props - The component props
 * @returns JSX.Element | null - The notification dot or null if not visible
 */
const NotificationDot: React.FC<NotificationDotProps> = ({
  isVisible,
  className = '',
  ariaLabel = 'New feature available',
}) => {
  if (!isVisible) {
    return null;
  }

  return (
    <span
      aria-label={ariaLabel}
      className={`ols-plugin__notification-dot ${className}`.trim()}
      role="status"
    />
  );
};

export default NotificationDot;
