import * as React from 'react';
import { Button, Card, CardBody, CardTitle } from '@patternfly/react-core';

import { useFirstTimeExperience } from '../hooks/useFirstTimeExperience';
import NotificationDot from './NotificationDot';

import './popover.css';

/**
 * Test component to demonstrate the first-time experience functionality
 * This component is for development testing only
 */
const TestFirstTimeExperience: React.FC = () => {
  const [shouldShowIndicators, markAsOpened, isLoaded] = useFirstTimeExperience();

  const resetFirstTimeExperience = () => {
    // This would require accessing the user settings directly
    // For now, just refresh the page and clear localStorage
    localStorage.clear();
    window.location.reload();
  };

  return (
    <Card style={{ margin: '20px', maxWidth: '600px' }}>
      <CardTitle>First-Time Experience Test Component</CardTitle>
      <CardBody>
        <div style={{ marginBottom: '20px' }}>
          <h3>Hook State:</h3>
          <ul>
            <li>
              <strong>isLoaded:</strong> {isLoaded ? 'true' : 'false'}
            </li>
            <li>
              <strong>shouldShowIndicators:</strong> {shouldShowIndicators ? 'true' : 'false'}
            </li>
          </ul>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h3>Test Button with Notification Dot:</h3>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <Button
              className={`ols-plugin__popover-button ${shouldShowIndicators ? 'ols-plugin__popover-button--first-time' : ''}`}
              onClick={markAsOpened}
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '12px',
                position: 'relative',
              }}
              variant="primary"
            >
              🚀
            </Button>
            <NotificationDot
              ariaLabel="New: Test feature available"
              isVisible={shouldShowIndicators}
            />
          </div>
          <p>
            {shouldShowIndicators
              ? 'Click the button to mark as opened (notification will disappear)'
              : 'First-time experience completed - no indicators shown'}
          </p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h3>Actions:</h3>
          <Button
            onClick={resetFirstTimeExperience}
            style={{ marginRight: '10px' }}
            variant="secondary"
          >
            Reset First-Time Experience
          </Button>
          <Button isDisabled={!shouldShowIndicators} onClick={markAsOpened} variant="tertiary">
            Mark as Opened
          </Button>
        </div>

        <div style={{ padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <h4>Testing Instructions:</h4>
          <ol>
            <li>
              When you first load this page, you should see the notification dot and flashing
              animation
            </li>
            <li>Click the test button - the indicators should disappear immediately</li>
            <li>Refresh the page - indicators should stay hidden (state persisted)</li>
            <li>Click &quot;Reset First-Time Experience&quot; to test again</li>
            <li>
              Test with reduced motion: Set browser to prefer reduced motion and verify animation is
              disabled
            </li>
          </ol>
        </div>
      </CardBody>
    </Card>
  );
};

export default TestFirstTimeExperience;
