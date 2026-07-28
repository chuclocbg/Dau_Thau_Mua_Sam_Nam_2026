import { describe, it, expect, beforeEach } from 'vitest';
import { addComment, getComments, countComments } from '../approval/approvalComment';
import { addAttachment, getAttachments, getTotalAttachmentSize } from '../approval/approvalAttachment';
import { createMemoryApprovalRepositories } from '../approval/approvalFactory';
import type { ApprovalRepositories } from '../approval/approvalRepositories';
import { ApprovalError } from '../approval/approvalTypes';

// APR-C-01
describe('addComment — happy path', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('creates a comment with content', async () => {
    const c = await addComment('R-1', { content: 'Good to go', authorCode: 'MGR' }, 'MGR', repos.comments);
    expect(c.content).toBe('Good to go');
  });
  it('sets isInternal to false by default', async () => {
    const c = await addComment('R-1', { content: 'Hello', authorCode: 'MGR' }, 'MGR', repos.comments);
    expect(c.isInternal).toBe(false);
  });
  it('stores authorCode', async () => {
    const c = await addComment('R-1', { content: 'ok', authorCode: 'EMP-99' }, 'EMP-99', repos.comments);
    expect(c.authorCode).toBe('EMP-99');
  });
});

// APR-C-02
describe('addComment — internal flag', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('sets isInternal to true when requested', async () => {
    const c = await addComment('R-1', { content: 'private', authorCode: 'MGR', isInternal: true }, 'MGR', repos.comments);
    expect(c.isInternal).toBe(true);
  });
  it('explicit false is stored correctly', async () => {
    const c = await addComment('R-1', { content: 'public', authorCode: 'MGR', isInternal: false }, 'MGR', repos.comments);
    expect(c.isInternal).toBe(false);
  });
  it('internal comment appears in full list', async () => {
    await addComment('R-1', { content: 'internal', authorCode: 'MGR', isInternal: true }, 'MGR', repos.comments);
    const all = await getComments('R-1', repos.comments, true);
    expect(all).toHaveLength(1);
  });
});

// APR-C-03
describe('addComment — validation', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('throws ApprovalError for empty content', async () => {
    await expect(addComment('R-1', { content: '', authorCode: 'MGR' }, 'MGR', repos.comments)).rejects.toThrow(ApprovalError);
  });
  it('throws for whitespace-only content', async () => {
    await expect(addComment('R-1', { content: '   ', authorCode: 'MGR' }, 'MGR', repos.comments)).rejects.toThrow(ApprovalError);
  });
  it('throws for content exceeding 5000 chars', async () => {
    await expect(addComment('R-1', { content: 'x'.repeat(5001), authorCode: 'MGR' }, 'MGR', repos.comments)).rejects.toThrow(ApprovalError);
  });
});

// APR-C-04
describe('getComments — filtering', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('excludes internal comments by default', async () => {
    await addComment('R-1', { content: 'public',   authorCode: 'MGR', isInternal: false }, 'MGR', repos.comments);
    await addComment('R-1', { content: 'internal', authorCode: 'MGR', isInternal: true  }, 'MGR', repos.comments);
    const comments = await getComments('R-1', repos.comments);
    expect(comments).toHaveLength(1);
  });
  it('returns all when includeInternal=true', async () => {
    await addComment('R-1', { content: 'public',   authorCode: 'MGR', isInternal: false }, 'MGR', repos.comments);
    await addComment('R-1', { content: 'internal', authorCode: 'MGR', isInternal: true  }, 'MGR', repos.comments);
    const comments = await getComments('R-1', repos.comments, true);
    expect(comments).toHaveLength(2);
  });
  it('only returns comments for matching requestId', async () => {
    await addComment('R-1', { content: 'for R-1', authorCode: 'U' }, 'U', repos.comments);
    await addComment('R-2', { content: 'for R-2', authorCode: 'U' }, 'U', repos.comments);
    expect(await getComments('R-1', repos.comments)).toHaveLength(1);
  });
});

// APR-C-05
describe('countComments', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('returns 0 when no comments', async () => {
    expect(await countComments('R-X', repos.comments)).toBe(0);
  });
  it('counts all comments including internal', async () => {
    await addComment('R-1', { content: 'a', authorCode: 'U', isInternal: false }, 'U', repos.comments);
    await addComment('R-1', { content: 'b', authorCode: 'U', isInternal: true  }, 'U', repos.comments);
    expect(await countComments('R-1', repos.comments)).toBe(2);
  });
  it('counts only for the given requestId', async () => {
    await addComment('R-1', { content: 'a', authorCode: 'U' }, 'U', repos.comments);
    await addComment('R-2', { content: 'b', authorCode: 'U' }, 'U', repos.comments);
    expect(await countComments('R-1', repos.comments)).toBe(1);
  });
});

// APR-C-06
describe('addAttachment — happy path', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('creates an attachment with fileName', async () => {
    const a = await addAttachment('R-1', attachment(), 'EMP-1', repos.attachments);
    expect(a.fileName).toBe('doc.pdf');
  });
  it('stores documentType', async () => {
    const a = await addAttachment('R-1', attachment(), 'EMP-1', repos.attachments);
    expect(a.documentType).toBe('SUPPORTING_DOCUMENT');
  });
  it('stores fileSize', async () => {
    const a = await addAttachment('R-1', attachment({ fileSize: 2048 }), 'EMP-1', repos.attachments);
    expect(a.fileSize).toBe(2048);
  });
});

// APR-C-07
describe('addAttachment — validation', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('throws for empty fileName', async () => {
    await expect(addAttachment('R-1', attachment({ fileName: '' }), 'EMP-1', repos.attachments)).rejects.toThrow(ApprovalError);
  });
  it('throws for zero fileSize', async () => {
    await expect(addAttachment('R-1', attachment({ fileSize: 0 }), 'EMP-1', repos.attachments)).rejects.toThrow(ApprovalError);
  });
  it('throws when fileSize exceeds 50MB', async () => {
    await expect(addAttachment('R-1', attachment({ fileSize: 51 * 1024 * 1024 }), 'EMP-1', repos.attachments)).rejects.toThrow(ApprovalError);
  });
});

// APR-C-08
describe('getAttachments', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('returns empty array when no attachments', async () => {
    expect(await getAttachments('R-X', repos.attachments)).toHaveLength(0);
  });
  it('returns all attachments for request', async () => {
    await addAttachment('R-1', attachment(), 'EMP-1', repos.attachments);
    await addAttachment('R-1', attachment({ fileName: 'b.pdf' }), 'EMP-1', repos.attachments);
    expect(await getAttachments('R-1', repos.attachments)).toHaveLength(2);
  });
  it('only returns attachments for matching requestId', async () => {
    await addAttachment('R-1', attachment(), 'EMP-1', repos.attachments);
    await addAttachment('R-2', attachment(), 'EMP-1', repos.attachments);
    expect(await getAttachments('R-1', repos.attachments)).toHaveLength(1);
  });
});

// APR-C-09
describe('getTotalAttachmentSize', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('returns 0 for no attachments', async () => {
    expect(await getTotalAttachmentSize('R-X', repos.attachments)).toBe(0);
  });
  it('sums file sizes correctly', async () => {
    await addAttachment('R-1', attachment({ fileSize: 1000 }), 'EMP-1', repos.attachments);
    await addAttachment('R-1', attachment({ fileSize: 2000 }), 'EMP-1', repos.attachments);
    expect(await getTotalAttachmentSize('R-1', repos.attachments)).toBe(3000);
  });
  it('only counts sizes for matching requestId', async () => {
    await addAttachment('R-1', attachment({ fileSize: 500 }), 'EMP-1', repos.attachments);
    await addAttachment('R-2', attachment({ fileSize: 10_000 }), 'EMP-1', repos.attachments);
    expect(await getTotalAttachmentSize('R-1', repos.attachments)).toBe(500);
  });
});

// APR-C-10
describe('addAttachment — stores uploadedBy', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('stores the uploadedBy field', async () => {
    const a = await addAttachment('R-1', attachment(), 'UPLOADER-99', repos.attachments);
    expect(a.uploadedBy).toBe('UPLOADER-99');
  });
  it('stores fileType', async () => {
    const a = await addAttachment('R-1', attachment({ fileType: 'image/png' }), 'EMP-1', repos.attachments);
    expect(a.fileType).toBe('image/png');
  });
  it('stores requestId on the attachment', async () => {
    const a = await addAttachment('R-99', attachment(), 'EMP-1', repos.attachments);
    expect(a.requestId).toBe('R-99');
  });
});

// APR-C-11
describe('addComment — trims content', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('trims leading and trailing whitespace', async () => {
    const c = await addComment('R-1', { content: '  hello  ', authorCode: 'MGR' }, 'MGR', repos.comments);
    expect(c.content).toBe('hello');
  });
  it('accepts content with internal spaces', async () => {
    const c = await addComment('R-1', { content: 'hello world', authorCode: 'MGR' }, 'MGR', repos.comments);
    expect(c.content).toBe('hello world');
  });
  it('accepts Vietnamese content', async () => {
    const c = await addComment('R-1', { content: 'Đồng ý phê duyệt', authorCode: 'MGR' }, 'MGR', repos.comments);
    expect(c.content).toBe('Đồng ý phê duyệt');
  });
});

// APR-C-12
describe('addAttachment — all document types accepted', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('accepts LEGAL_REFERENCE', async () => {
    const a = await addAttachment('R-1', attachment({ documentType: 'LEGAL_REFERENCE' }), 'EMP-1', repos.attachments);
    expect(a.documentType).toBe('LEGAL_REFERENCE');
  });
  it('accepts COST_ESTIMATE', async () => {
    const a = await addAttachment('R-1', attachment({ documentType: 'COST_ESTIMATE' }), 'EMP-1', repos.attachments);
    expect(a.documentType).toBe('COST_ESTIMATE');
  });
  it('accepts AUTHORITY_CONFIRMATION', async () => {
    const a = await addAttachment('R-1', attachment({ documentType: 'AUTHORITY_CONFIRMATION' }), 'EMP-1', repos.attachments);
    expect(a.documentType).toBe('AUTHORITY_CONFIRMATION');
  });
});

// APR-C-13
describe('comment + attachment combined', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('both can coexist for same request', async () => {
    await addComment('R-1', { content: 'noted', authorCode: 'U' }, 'U', repos.comments);
    await addAttachment('R-1', attachment(), 'U', repos.attachments);
    expect(await countComments('R-1', repos.comments)).toBe(1);
    expect((await getAttachments('R-1', repos.attachments))).toHaveLength(1);
  });
  it('total size of zero attachments is 0', async () => {
    await addComment('R-2', { content: 'only a comment', authorCode: 'U' }, 'U', repos.comments);
    expect(await getTotalAttachmentSize('R-2', repos.attachments)).toBe(0);
  });
  it('comment count is 0 when only attachments added', async () => {
    await addAttachment('R-3', attachment(), 'EMP-1', repos.attachments);
    expect(await countComments('R-3', repos.comments)).toBe(0);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

import type { AddAttachmentParams } from '../approval/approvalTypes';
function attachment(overrides: Partial<AddAttachmentParams> = {}): AddAttachmentParams {
  return { fileName: 'doc.pdf', fileType: 'application/pdf', fileSize: 1024, documentType: 'SUPPORTING_DOCUMENT', ...overrides };
}
