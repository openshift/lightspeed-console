import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Label, Spinner } from '@patternfly/react-core';

import {
  ChangeTimelineEntry,
  formatTimelineAnchorLabel,
  formatTimelineRelativeTime,
  TimelineAnchor,
  TimelineSeverity,
} from '../changeTimeline';
import { useConsoleNavigation } from '../hooks/useConsoleNavigation';
import { useChangeTimelineData } from '../hooks/useChangeTimelineData';
import { K8sModelRef } from '../pageContext';

import './change-timeline.css';

const severityLabel = (severity: TimelineSeverity, t: (key: string) => string): string => {
  switch (severity) {
    case 'warning':
      return t('Timeline severity warning');
    case 'error':
      return t('Timeline severity error');
    case 'info':
      return t('Timeline severity info');
    default:
      return t('Timeline severity normal');
  }
};

const severityColor = (severity: TimelineSeverity): 'blue' | 'red' | 'orange' | 'grey' => {
  switch (severity) {
    case 'warning':
      return 'orange';
    case 'error':
      return 'red';
    case 'info':
      return 'blue';
    default:
      return 'grey';
  }
};

type TimelineEntryRowProps = {
  entry: ChangeTimelineEntry;
  onNavigate: (path: string) => void;
};

const TimelineEntryRow: React.FC<TimelineEntryRowProps> = ({ entry, onNavigate }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  return (
    <li className="ols-plugin__change-timeline-item" data-test="ols-plugin__change-timeline-item">
      <span className="ols-plugin__change-timeline-time">
        {formatTimelineRelativeTime(entry.timestamp)}
      </span>
      <Label color={severityColor(entry.severity)} isCompact>
        {severityLabel(entry.severity, t)}
      </Label>
      <div className="ols-plugin__change-timeline-body">
        {entry.consolePath ? (
          <Button
            className="ols-plugin__change-timeline-entry-title"
            isInline
            onClick={(event) => {
              event.preventDefault();
              onNavigate(entry.consolePath!);
            }}
            variant="link"
          >
            {entry.title}
          </Button>
        ) : (
          <span className="ols-plugin__change-timeline-entry-title">{entry.title}</span>
        )}
        {entry.detail && <p className="ols-plugin__change-timeline-detail">{entry.detail}</p>}
      </div>
    </li>
  );
};

type ChangeTimelinePanelProps = {
  anchor: TimelineAnchor;
  embedded?: boolean;
  k8sModels: Record<string, K8sModelRef>;
};

const ChangeTimelinePanel: React.FC<ChangeTimelinePanelProps> = ({
  anchor,
  embedded = false,
  k8sModels,
}) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');
  const navigate = useConsoleNavigation();
  const { entries, error, loaded } = useChangeTimelineData(anchor, k8sModels);

  return (
    <section
      className={`ols-plugin__change-timeline${embedded ? ' ols-plugin__change-timeline--embedded' : ''}`}
      data-test="ols-plugin__change-timeline"
    >
      <div className="ols-plugin__change-timeline-header">
        <h4 className="ols-plugin__change-timeline-title">{t('Change timeline')}</h4>
        <p className="ols-plugin__change-timeline-subtitle">
          {t('Timeline for {{target}} (last 2 hours)', {
            target: formatTimelineAnchorLabel(anchor, k8sModels),
          })}
        </p>
      </div>

      {!loaded && <Spinner isInline size="sm" aria-label={t('Loading change timeline')} />}
      {error && (
        <p className="ols-plugin__change-timeline-error">
          {t('Failed to load change timeline')}: {error}
        </p>
      )}
      {loaded && !error && entries.length === 0 && (
        <p className="ols-plugin__change-timeline-empty">{t('No recent changes found')}</p>
      )}
      {loaded && entries.length > 0 && (
        <ul className="ols-plugin__change-timeline-list" role="list">
          {entries.map((entry) => (
            <TimelineEntryRow entry={entry} key={entry.id} onNavigate={navigate} />
          ))}
        </ul>
      )}
    </section>
  );
};

export default ChangeTimelinePanel;
