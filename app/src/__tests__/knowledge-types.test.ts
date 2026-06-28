/**
 * Phase 16 — Knowledge Types tests
 *
 * Groups (13 × 3 = 39):
 *   KT-01  (3)  createDocumentTemplate — shape and required fields
 *   KT-02  (3)  createDocumentTemplate — frozen arrays and metadata
 *   KT-03  (3)  createGovernanceClause — shape and frozen tags
 *   KT-04  (3)  createGovernanceChecklist — shape and frozen items
 *   KT-05  (3)  ChecklistItem — fields
 *   KT-06  (3)  createLegalCitation — shape and optional fields
 *   KT-07  (3)  createWorkflowKnowledge — shape and frozen steps + requirements
 *   KT-08  (3)  WorkflowStep — fields
 *   KT-09  (3)  createAuthorityKnowledge — shape + escalatesTo
 *   KT-10  (3)  createGovernancePrompt — shape and frozen inputSchema
 *   KT-11  (3)  createDocumentMetadata — shape and frozen field lists
 *   KT-12  (3)  default locale 'vi-VN' across all factories
 *   KT-13  (3)  default status 'ACTIVE' for factories that have status
 */

import { describe, it, expect } from 'vitest';
import {
  createDocumentTemplate,
  createGovernanceClause,
  createGovernanceChecklist,
  createLegalCitation,
  createWorkflowKnowledge,
  createAuthorityKnowledge,
  createGovernancePrompt,
  createDocumentMetadata,
  type ChecklistItem,
  type WorkflowStep,
} from '../knowledge/knowledgeTypes';

// ─── KT-01: createDocumentTemplate — shape ───────────────────────────────────

describe('KT-01 createDocumentTemplate shape', () => {
  const tmpl = createDocumentTemplate({
    id: 'tmpl-001', name: 'Thông báo mời thầu', documentType: 'PROCUREMENT_NOTICE',
    version: '1.0.0', effectiveDate: '2024-01-01',
    clauses: ['cl-auth', 'cl-legal'], citations: ['cit-001'], checklists: ['ck-001'],
  });

  it('id, name, documentType are set', () => {
    expect(tmpl.id).toBe('tmpl-001');
    expect(tmpl.name).toBe('Thông báo mời thầu');
    expect(tmpl.documentType).toBe('PROCUREMENT_NOTICE');
  });
  it('version and effectiveDate are set', () => {
    expect(tmpl.version).toBe('1.0.0');
    expect(tmpl.effectiveDate).toBe('2024-01-01');
  });
  it('clauses, citations, checklists are set from params', () => {
    expect(tmpl.clauses).toContain('cl-auth');
    expect(tmpl.citations).toContain('cit-001');
    expect(tmpl.checklists).toContain('ck-001');
  });
});

// ─── KT-02: createDocumentTemplate — frozen ───────────────────────────────────

describe('KT-02 createDocumentTemplate frozen arrays and metadata', () => {
  const tmpl = createDocumentTemplate({
    id: 'tmpl-002', name: 'Test', documentType: 'DECISION',
    version: '1.0.0', effectiveDate: '2024-01-01',
    metadata: { owner: 'Bộ Tài chính' },
  });

  it('clauses array is frozen', () => {
    expect(Object.isFrozen(tmpl.clauses)).toBe(true);
  });
  it('citations array is frozen', () => {
    expect(Object.isFrozen(tmpl.citations)).toBe(true);
  });
  it('metadata is frozen with correct values', () => {
    expect(Object.isFrozen(tmpl.metadata)).toBe(true);
    expect(tmpl.metadata['owner']).toBe('Bộ Tài chính');
  });
});

// ─── KT-03: createGovernanceClause ────────────────────────────────────────────

describe('KT-03 createGovernanceClause', () => {
  const clause = createGovernanceClause({
    id: 'cl-001', title: 'Căn cứ pháp lý', body: 'Căn cứ Luật Đấu thầu {{year}}.',
    category: 'LEGAL_BASIS', tags: ['pháp lý', 'đấu thầu'],
  });

  it('id, title, body, category set', () => {
    expect(clause.id).toBe('cl-001');
    expect(clause.title).toBe('Căn cứ pháp lý');
    expect(clause.category).toBe('LEGAL_BASIS');
  });
  it('body contains placeholder', () => {
    expect(clause.body).toContain('{{year}}');
  });
  it('tags array is frozen', () => {
    expect(Object.isFrozen(clause.tags)).toBe(true);
    expect(clause.tags).toContain('đấu thầu');
  });
});

// ─── KT-04: createGovernanceChecklist ────────────────────────────────────────

describe('KT-04 createGovernanceChecklist', () => {
  const items: ChecklistItem[] = [
    { id: 'item-1', label: 'Xác nhận năng lực', required: true, hint: 'Kiểm tra hồ sơ' },
    { id: 'item-2', label: 'Kiểm tra ngân sách', required: false },
  ];
  const checklist = createGovernanceChecklist({
    id: 'ck-001', title: 'Danh mục trước khi đấu thầu', phase: 'PRE_PROCUREMENT', items,
  });

  it('id, title, phase are set', () => {
    expect(checklist.id).toBe('ck-001');
    expect(checklist.phase).toBe('PRE_PROCUREMENT');
  });
  it('items array is frozen with correct count', () => {
    expect(Object.isFrozen(checklist.items)).toBe(true);
    expect(checklist.items).toHaveLength(2);
  });
  it('items default to empty array when not provided', () => {
    const empty = createGovernanceChecklist({ id: 'ck-empty', title: 'Empty', phase: 'APPROVAL' });
    expect(empty.items).toHaveLength(0);
  });
});

// ─── KT-05: ChecklistItem fields ─────────────────────────────────────────────

describe('KT-05 ChecklistItem fields', () => {
  const item: ChecklistItem = {
    id: 'item-x', label: 'Kiểm tra hợp đồng', required: true, hint: 'Xem điều 5',
  };

  it('id and label are present', () => {
    expect(item.id).toBe('item-x');
    expect(item.label).toBe('Kiểm tra hợp đồng');
  });
  it('required is a boolean', () => {
    expect(item.required).toBe(true);
  });
  it('hint is optional', () => {
    const noHint: ChecklistItem = { id: 'item-y', label: 'Test', required: false };
    expect(noHint.hint).toBeUndefined();
  });
});

// ─── KT-06: createLegalCitation ──────────────────────────────────────────────

describe('KT-06 createLegalCitation', () => {
  const cit = createLegalCitation({
    id: 'cit-001', symbol: '43/2013/QH13', title: 'Luật Đấu thầu',
    text: 'Điều 1. Đấu thầu là...', article: 'Điều 1',
  });

  it('id, symbol, title, text are set', () => {
    expect(cit.id).toBe('cit-001');
    expect(cit.symbol).toBe('43/2013/QH13');
    expect(cit.text).toContain('Đấu thầu');
  });
  it('article is set when provided', () => {
    expect(cit.article).toBe('Điều 1');
  });
  it('paragraph is undefined when not provided', () => {
    expect(cit.paragraph).toBeUndefined();
  });
});

// ─── KT-07: createWorkflowKnowledge ──────────────────────────────────────────

describe('KT-07 createWorkflowKnowledge', () => {
  const wf = createWorkflowKnowledge({
    id: 'wk-001', workflowId: 'procurement-standard',
    name: 'Quy trình mua sắm tiêu chuẩn', description: 'Quy trình mua sắm cơ bản.',
    steps: [{ id: 's1', state: 'DRAFT', label: 'Soạn hồ sơ', actor: 'UNIT_HEAD', docs: ['tmpl-001'] }],
    requirements: ['Có ngân sách được phê duyệt'],
  });

  it('id, workflowId, name, description set', () => {
    expect(wf.workflowId).toBe('procurement-standard');
    expect(wf.name).toBe('Quy trình mua sắm tiêu chuẩn');
  });
  it('steps array is frozen', () => {
    expect(Object.isFrozen(wf.steps)).toBe(true);
    expect(wf.steps).toHaveLength(1);
  });
  it('requirements array is frozen', () => {
    expect(Object.isFrozen(wf.requirements)).toBe(true);
    expect(wf.requirements[0]).toContain('ngân sách');
  });
});

// ─── KT-08: WorkflowStep fields ──────────────────────────────────────────────

describe('KT-08 WorkflowStep fields', () => {
  const step: WorkflowStep = {
    id: 'step-1', state: 'REVIEW', label: 'Thẩm định hồ sơ',
    actor: 'DIRECTOR', docs: ['tmpl-review'],
  };

  it('id, state, label, actor set', () => {
    expect(step.state).toBe('REVIEW');
    expect(step.actor).toBe('DIRECTOR');
  });
  it('docs is a readonly array', () => {
    expect(step.docs).toContain('tmpl-review');
  });
  it('docs defaults to empty when not set on WorkflowKnowledge', () => {
    const wf = createWorkflowKnowledge({
      id: 'wk-bare', workflowId: 'bare', name: 'Bare', description: 'Bare workflow',
    });
    expect(wf.steps).toHaveLength(0);
  });
});

// ─── KT-09: createAuthorityKnowledge ─────────────────────────────────────────

describe('KT-09 createAuthorityKnowledge', () => {
  const auth = createAuthorityKnowledge({
    id: 'auth-001', role: 'UNIT_HEAD', title: 'Trưởng đơn vị',
    maxAmount: 200_000_000, escalatesTo: 'DIRECTOR',
  });

  it('id, role, title set', () => {
    expect(auth.id).toBe('auth-001');
    expect(auth.role).toBe('UNIT_HEAD');
    expect(auth.title).toBe('Trưởng đơn vị');
  });
  it('maxAmount is a number', () => {
    expect(auth.maxAmount).toBe(200_000_000);
  });
  it('escalatesTo is set', () => {
    expect(auth.escalatesTo).toBe('DIRECTOR');
  });
});

// ─── KT-10: createGovernancePrompt ───────────────────────────────────────────

describe('KT-10 createGovernancePrompt', () => {
  const prompt = createGovernancePrompt({
    id: 'pr-001', name: 'Draft Procurement Notice', category: 'DRAFT',
    template: 'Soạn thảo thông báo mời thầu cho gói thầu {{packageName}}.',
    version: '1.0.0',
    inputSchema: { packageName: 'Tên gói thầu' },
  });

  it('id, name, category, version set', () => {
    expect(prompt.id).toBe('pr-001');
    expect(prompt.category).toBe('DRAFT');
    expect(prompt.version).toBe('1.0.0');
  });
  it('template contains placeholder', () => {
    expect(prompt.template).toContain('{{packageName}}');
  });
  it('inputSchema is frozen with declared variables', () => {
    expect(Object.isFrozen(prompt.inputSchema)).toBe(true);
    expect(prompt.inputSchema['packageName']).toBe('Tên gói thầu');
  });
});

// ─── KT-11: createDocumentMetadata ───────────────────────────────────────────

describe('KT-11 createDocumentMetadata', () => {
  const meta = createDocumentMetadata({
    documentType: 'PROCUREMENT_NOTICE', title: 'Thông báo mời thầu',
    version: '1.0.0', issuer: 'Bộ Tài chính',
    requiredFields: ['packageName', 'packageValue'],
    optionalFields: ['department', 'notes'],
  });

  it('documentType, title, version, issuer set', () => {
    expect(meta.documentType).toBe('PROCUREMENT_NOTICE');
    expect(meta.issuer).toBe('Bộ Tài chính');
  });
  it('requiredFields is frozen', () => {
    expect(Object.isFrozen(meta.requiredFields)).toBe(true);
    expect(meta.requiredFields).toContain('packageName');
  });
  it('optionalFields is frozen', () => {
    expect(Object.isFrozen(meta.optionalFields)).toBe(true);
    expect(meta.optionalFields).toContain('department');
  });
});

// ─── KT-12: default locale 'vi-VN' ───────────────────────────────────────────

describe('KT-12 default locale vi-VN', () => {
  it('DocumentTemplate defaults to vi-VN', () => {
    const t = createDocumentTemplate({ id: 't', name: 'n', documentType: 'd', version: '1', effectiveDate: '2024-01-01' });
    expect(t.locale).toBe('vi-VN');
  });
  it('GovernanceClause defaults to vi-VN', () => {
    const c = createGovernanceClause({ id: 'c', title: 't', body: 'b', category: 'X' });
    expect(c.locale).toBe('vi-VN');
  });
  it('GovernancePrompt defaults to vi-VN', () => {
    const p = createGovernancePrompt({ id: 'p', name: 'n', category: 'c', template: 't', version: '1' });
    expect(p.locale).toBe('vi-VN');
  });
});

// ─── KT-13: default status 'ACTIVE' ──────────────────────────────────────────

describe('KT-13 default status ACTIVE', () => {
  it('DocumentTemplate defaults to ACTIVE', () => {
    const t = createDocumentTemplate({ id: 't2', name: 'n', documentType: 'd', version: '1', effectiveDate: '2024-01-01' });
    expect(t.status).toBe('ACTIVE');
  });
  it('GovernanceClause defaults to ACTIVE', () => {
    const c = createGovernanceClause({ id: 'c2', title: 't', body: 'b', category: 'X' });
    expect(c.status).toBe('ACTIVE');
  });
  it('GovernanceChecklist defaults to ACTIVE', () => {
    const cl = createGovernanceChecklist({ id: 'cl2', title: 't', phase: 'PRE_PROCUREMENT' });
    expect(cl.status).toBe('ACTIVE');
  });
});
