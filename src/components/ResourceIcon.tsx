import * as React from 'react';
import { ResourceIcon as SDKResourceIcon } from '@openshift-console/dynamic-plugin-sdk';

type Props = {
  kind: string;
};

const ResourceIcon: React.FC<Props> = ({ kind }) => (
  <SDKResourceIcon kind={kind === 'Alert' ? 'AL' : kind} />
);

export default ResourceIcon;
