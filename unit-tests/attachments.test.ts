import { describe, it } from 'node:test';
import { deepStrictEqual, strictEqual } from 'node:assert';

import { AttachmentTypes, isAttachmentChanged, toOLSAttachment } from '../src/attachments';
import { Attachment } from '../src/types';

const makeAttachment = (overrides: Partial<Attachment> = {}): Attachment => ({
  attachmentType: AttachmentTypes.YAML,
  kind: 'Pod',
  name: 'my-pod',
  namespace: 'default',
  value: 'apiVersion: v1',
  ...overrides,
});

describe('isAttachmentChanged', () => {
  it('returns false when originalValue is undefined', () => {
    strictEqual(isAttachmentChanged(makeAttachment()), false);
  });

  it('returns false when originalValue equals value', () => {
    const attachment = makeAttachment({ originalValue: 'apiVersion: v1' });
    strictEqual(isAttachmentChanged(attachment), false);
  });

  it('returns true when originalValue differs from value', () => {
    const attachment = makeAttachment({ originalValue: 'apiVersion: v2' });
    strictEqual(isAttachmentChanged(attachment), true);
  });
});

/* eslint-disable camelcase */
describe('toOLSAttachment', () => {
  it('maps YAML to api object with application/yaml', () => {
    deepStrictEqual(toOLSAttachment(makeAttachment()), {
      attachment_type: 'api object',
      content: 'apiVersion: v1',
      content_type: 'application/yaml',
    });
  });

  it('maps YAMLFiltered to api object with application/yaml', () => {
    const attachment = makeAttachment({ attachmentType: AttachmentTypes.YAMLFiltered });
    deepStrictEqual(toOLSAttachment(attachment), {
      attachment_type: 'api object',
      content: 'apiVersion: v1',
      content_type: 'application/yaml',
    });
  });

  it('maps YAMLUpload to api object with application/yaml', () => {
    const attachment = makeAttachment({ attachmentType: AttachmentTypes.YAMLUpload });
    deepStrictEqual(toOLSAttachment(attachment), {
      attachment_type: 'api object',
      content: 'apiVersion: v1',
      content_type: 'application/yaml',
    });
  });

  it('maps Events to event with application/yaml', () => {
    const attachment = makeAttachment({ attachmentType: AttachmentTypes.Events });
    deepStrictEqual(toOLSAttachment(attachment), {
      attachment_type: 'event',
      content: 'apiVersion: v1',
      content_type: 'application/yaml',
    });
  });

  it('maps Log to log with text/plain', () => {
    const attachment = makeAttachment({
      attachmentType: AttachmentTypes.Log,
      value: 'ERROR: something went wrong',
    });
    deepStrictEqual(toOLSAttachment(attachment), {
      attachment_type: 'log',
      content: 'ERROR: something went wrong',
      content_type: 'text/plain',
    });
  });

  it('passes through the attachment value as content', () => {
    const attachment = makeAttachment({ value: 'kind: Deployment\nmetadata:\n  name: test' });
    strictEqual(toOLSAttachment(attachment).content, 'kind: Deployment\nmetadata:\n  name: test');
  });
});
/* eslint-enable camelcase */
