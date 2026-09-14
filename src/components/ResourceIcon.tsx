import * as React from 'react';
import { ResourceIcon as SDKResourceIcon } from '@openshift-console/dynamic-plugin-sdk';

type Props = {
  className?: string;
  kind: string;
};

const ResourceIcon: React.FC<Props> = ({ className, kind }) => (
  <SDKResourceIcon className={className} kind={kind === 'Alert' ? 'AL' : kind} />
);

export default ResourceIcon;
