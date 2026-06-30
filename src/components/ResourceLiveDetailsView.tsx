import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@patternfly/react-core';

import { LiveDetailField } from '../resourceLiveDetails';
import { StatusSummary } from '../resourceStatus';
import LiveFieldGrid, { LiveFieldItem } from './LiveFieldGrid';

const statusLabelColor = (
  variant: StatusSummary['variant'],
): 'blue' | 'green' | 'red' | 'yellow' => {
  switch (variant) {
    case 'success':
      return 'green';
    case 'warning':
      return 'yellow';
    case 'danger':
      return 'red';
    default:
      return 'blue';
  }
};

type ResourceLiveDetailsViewProps = {
  fields: LiveDetailField[];
  status: StatusSummary;
};

const ResourceLiveDetailsView: React.FC<ResourceLiveDetailsViewProps> = ({ fields, status }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const items: LiveFieldItem[] = [];

  if (status.label) {
    items.push({
      id: 'status',
      label: t('Living detail status'),
      value: (
        <Label color={statusLabelColor(status.variant)} variant="outline">
          {status.label}
        </Label>
      ),
    });
  }

  for (const field of fields) {
    items.push({
      id: field.labelKey,
      label: t(field.labelKey),
      value: field.value,
    });
  }

  return <LiveFieldGrid className="ols-plugin__living-resource-details" items={items} />;
};

export default ResourceLiveDetailsView;
