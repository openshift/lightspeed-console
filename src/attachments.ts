import { Map as ImmutableMap } from 'immutable';

import { Attachment } from './types';

export enum AttachmentTypes {
  Log = 'Log',
  YAML = 'YAML',
  YAMLStatus = 'YAML Status',
}

export const buildQuery = (
  query: string,
  attachments: ImmutableMap<string, Attachment>,
): string => {
  let fullQuery = query;

  attachments.forEach((attachment: Attachment) => {
    if (attachment.attachmentType === AttachmentTypes.YAML) {
      fullQuery += `

For reference, here is the full resource YAML for ${attachment.kind} '${attachment.name}':
\`\`\`yaml
${attachment.value}
\`\`\``;
    }

    if (attachment.attachmentType === AttachmentTypes.YAMLStatus) {
      fullQuery += `

For reference, here is the resource's 'status' section YAML for ${attachment.kind} '${attachment.name}':
\`\`\`yaml
${attachment.value}
\`\`\``;
    }

    if (attachment.attachmentType === AttachmentTypes.Log) {
      fullQuery += `

For reference, here are the most recent lines from the log for ${attachment.kind} '${attachment.name}':
\`\`\`
${attachment.value}
\`\`\``;
    }
  });

  return fullQuery;
};
