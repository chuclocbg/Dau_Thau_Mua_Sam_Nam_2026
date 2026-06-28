/**
 * Phase 16 — Knowledge Base tests
 *
 * Groups (13 × 3 = 39):
 *   KB-01  (3)  findTemplate — found and not found
 *   KB-02  (3)  findClause — found and not found
 *   KB-03  (3)  findChecklist — found and not found
 *   KB-04  (3)  findCitation — found and not found
 *   KB-05  (3)  findWorkflow — found and not found
 *   KB-06  (3)  findAuthority — found by role, not found
 *   KB-07  (3)  findPrompt — found and not found
 *   KB-08  (3)  resolveTemplate — hydrates clauses, citations, checklists
 *   KB-09  (3)  resolveTemplate — returns undefined for unknown id
 *   KB-10  (3)  resolveTemplate — skips unknown clause/citation/checklist ids
 *   KB-11  (3)  resolveChecklist — by phase, multiple, empty phase
 *   KB-12  (3)  resolveDocumentMetadata — found and not found by type
 *   KB-13  (3)  buildGovernanceKnowledgeBase — factory and empty defaults
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
} from '../knowledge/knowledgeTypes';
import {
  GovernanceKnowledgeBase,
  buildGovernanceKnowledgeBase,
} from '../knowledge/knowledgeBase';

// ─── Content fixtures ─────────────────────────────────────────────────────────

const TMPL = createDocumentTemplate({
  id: 'tmpl-kb', name: 'Thông báo mời thầu', documentType: 'PROCUREMENT_NOTICE',
  version: '1.0.0', effectiveDate: '2024-01-01',
  clauses: ['cl-kb', 'cl-missing'], citations: ['cit-kb'], checklists: ['ck-pre'],
});

const CLAUSE = createGovernanceClause({
  id: 'cl-kb', title: 'Căn cứ pháp lý', body: 'Căn cứ Luật {{year}}.', category: 'LEGAL_BASIS',
});

const CHECKLIST_PRE = createGovernanceChecklist({
  id: 'ck-pre', title: 'Danh mục trước đấu thầu', phase: 'PRE_PROCUREMENT',
  items: [{ id: 'i1', label: 'Xác nhận ngân sách', required: true }],
});

const CHECKLIST_PRE2 = createGovernanceChecklist({
  id: 'ck-pre2', title: 'Danh mục trước đấu thầu 2', phase: 'PRE_PROCUREMENT',
});

const CHECKLIST_EVAL = createGovernanceChecklist({
  id: 'ck-eval', title: 'Danh mục đánh giá', phase: 'EVALUATION',
});

const CITATION = createLegalCitation({
  id: 'cit-kb', symbol: '43/2013/QH13', title: 'Luật Đấu thầu',
  text: 'Đấu thầu là quá trình...', article: 'Điều 1',
});

const WORKFLOW = createWorkflowKnowledge({
  id: 'wk-kb', workflowId: 'procurement-standard',
  name: 'Quy trình mua sắm', description: 'Quy trình chuẩn.',
});

const AUTHORITY = createAuthorityKnowledge({
  id: 'auth-kb', role: 'UNIT_HEAD', title: 'Trưởng đơn vị', maxAmount: 200_000_000,
});

const PROMPT = createGovernancePrompt({
  id: 'pr-kb', name: 'Draft Notice', category: 'DRAFT',
  template: 'Soạn thảo {{type}}.', version: '1.0.0',
});

const META = createDocumentMetadata({
  documentType: 'PROCUREMENT_NOTICE', title: 'Thông báo mời thầu',
  version: '1.0.0', requiredFields: ['packageName'],
});

// ─── Shared test KB ───────────────────────────────────────────────────────────

function buildFullKb(): GovernanceKnowledgeBase {
  return buildGovernanceKnowledgeBase(
    [TMPL], [CLAUSE], [CHECKLIST_PRE, CHECKLIST_PRE2, CHECKLIST_EVAL],
    [CITATION], [WORKFLOW], [AUTHORITY], [PROMPT], [META],
  );
}

// ─── KB-01: findTemplate ──────────────────────────────────────────────────────

describe('KB-01 findTemplate', () => {
  const kb = buildFullKb();

  it('returns template for known id', () => {
    expect(kb.findTemplate('tmpl-kb')).toBeDefined();
    expect(kb.findTemplate('tmpl-kb')?.name).toBe('Thông báo mời thầu');
  });
  it('returns undefined for unknown id', () => {
    expect(kb.findTemplate('no-such')).toBeUndefined();
  });
  it('documentType is accessible on found template', () => {
    expect(kb.findTemplate('tmpl-kb')?.documentType).toBe('PROCUREMENT_NOTICE');
  });
});

// ─── KB-02: findClause ────────────────────────────────────────────────────────

describe('KB-02 findClause', () => {
  const kb = buildFullKb();

  it('returns clause for known id', () => {
    expect(kb.findClause('cl-kb')).toBeDefined();
  });
  it('returns undefined for unknown id', () => {
    expect(kb.findClause('no-such')).toBeUndefined();
  });
  it('clause body is accessible', () => {
    expect(kb.findClause('cl-kb')?.body).toContain('{{year}}');
  });
});

// ─── KB-03: findChecklist ─────────────────────────────────────────────────────

describe('KB-03 findChecklist', () => {
  const kb = buildFullKb();

  it('returns checklist for known id', () => {
    expect(kb.findChecklist('ck-pre')).toBeDefined();
  });
  it('returns undefined for unknown id', () => {
    expect(kb.findChecklist('ghost')).toBeUndefined();
  });
  it('items are accessible on found checklist', () => {
    expect(kb.findChecklist('ck-pre')?.items).toHaveLength(1);
  });
});

// ─── KB-04: findCitation ──────────────────────────────────────────────────────

describe('KB-04 findCitation', () => {
  const kb = buildFullKb();

  it('returns citation for known id', () => {
    expect(kb.findCitation('cit-kb')).toBeDefined();
  });
  it('returns undefined for unknown id', () => {
    expect(kb.findCitation('ghost-cit')).toBeUndefined();
  });
  it('symbol is accessible on found citation', () => {
    expect(kb.findCitation('cit-kb')?.symbol).toBe('43/2013/QH13');
  });
});

// ─── KB-05: findWorkflow ──────────────────────────────────────────────────────

describe('KB-05 findWorkflow', () => {
  const kb = buildFullKb();

  it('returns workflow knowledge for known id', () => {
    expect(kb.findWorkflow('wk-kb')).toBeDefined();
  });
  it('returns undefined for unknown id', () => {
    expect(kb.findWorkflow('ghost-wf')).toBeUndefined();
  });
  it('workflowId is accessible', () => {
    expect(kb.findWorkflow('wk-kb')?.workflowId).toBe('procurement-standard');
  });
});

// ─── KB-06: findAuthority ─────────────────────────────────────────────────────

describe('KB-06 findAuthority by role', () => {
  const kb = buildFullKb();

  it('returns authority for known role', () => {
    expect(kb.findAuthority('UNIT_HEAD')).toBeDefined();
  });
  it('returns undefined for unknown role', () => {
    expect(kb.findAuthority('UNKNOWN_ROLE')).toBeUndefined();
  });
  it('maxAmount is accessible on found authority', () => {
    expect(kb.findAuthority('UNIT_HEAD')?.maxAmount).toBe(200_000_000);
  });
});

// ─── KB-07: findPrompt ────────────────────────────────────────────────────────

describe('KB-07 findPrompt', () => {
  const kb = buildFullKb();

  it('returns prompt for known id', () => {
    expect(kb.findPrompt('pr-kb')).toBeDefined();
  });
  it('returns undefined for unknown id', () => {
    expect(kb.findPrompt('ghost-pr')).toBeUndefined();
  });
  it('template text is accessible', () => {
    expect(kb.findPrompt('pr-kb')?.template).toContain('{{type}}');
  });
});

// ─── KB-08: resolveTemplate — hydration ───────────────────────────────────────

describe('KB-08 resolveTemplate hydrates clause, citation, checklist', () => {
  const kb = buildFullKb();
  const resolved = kb.resolveTemplate('tmpl-kb');

  it('resolved.template is the original template', () => {
    expect(resolved?.template.id).toBe('tmpl-kb');
  });
  it('clauses array contains the resolved clause', () => {
    expect(resolved?.clauses.some(c => c.id === 'cl-kb')).toBe(true);
  });
  it('citations array contains the resolved citation', () => {
    expect(resolved?.citations.some(c => c.id === 'cit-kb')).toBe(true);
  });
});

// ─── KB-09: resolveTemplate — not found ───────────────────────────────────────

describe('KB-09 resolveTemplate returns undefined for unknown id', () => {
  const kb = buildFullKb();

  it('returns undefined for unknown template id', () => {
    expect(kb.resolveTemplate('no-such-tmpl')).toBeUndefined();
  });
  it('empty KB resolveTemplate also returns undefined', () => {
    expect(buildGovernanceKnowledgeBase().resolveTemplate('x')).toBeUndefined();
  });
  it('resolved arrays are frozen when found', () => {
    const r = kb.resolveTemplate('tmpl-kb');
    expect(Object.isFrozen(r?.clauses)).toBe(true);
    expect(Object.isFrozen(r?.citations)).toBe(true);
  });
});

// ─── KB-10: resolveTemplate — skips unknown ids ───────────────────────────────

describe('KB-10 resolveTemplate skips unknown clause and checklist ids', () => {
  const kb = buildFullKb();
  // tmpl-kb references 'cl-missing' (not in KB) and 'ck-pre' (in KB)
  const resolved = kb.resolveTemplate('tmpl-kb');

  it('unknown clause id cl-missing is silently skipped', () => {
    const ids = resolved?.clauses.map(c => c.id);
    expect(ids).not.toContain('cl-missing');
  });
  it('known clause cl-kb is still included', () => {
    expect(resolved?.clauses.some(c => c.id === 'cl-kb')).toBe(true);
  });
  it('checklist ck-pre is included (is in KB)', () => {
    expect(resolved?.checklists.some(c => c.id === 'ck-pre')).toBe(true);
  });
});

// ─── KB-11: resolveChecklist by phase ─────────────────────────────────────────

describe('KB-11 resolveChecklist by phase', () => {
  const kb = buildFullKb();

  it('returns all checklists for PRE_PROCUREMENT (2)', () => {
    expect(kb.resolveChecklist('PRE_PROCUREMENT')).toHaveLength(2);
  });
  it('returns one checklist for EVALUATION', () => {
    expect(kb.resolveChecklist('EVALUATION')).toHaveLength(1);
  });
  it('returns empty frozen array for unknown phase', () => {
    const result = kb.resolveChecklist('UNKNOWN_PHASE');
    expect(result).toHaveLength(0);
    expect(Object.isFrozen(result)).toBe(true);
  });
});

// ─── KB-12: resolveDocumentMetadata ───────────────────────────────────────────

describe('KB-12 resolveDocumentMetadata', () => {
  const kb = buildFullKb();

  it('returns metadata for known documentType', () => {
    expect(kb.resolveDocumentMetadata('PROCUREMENT_NOTICE')).toBeDefined();
  });
  it('returns undefined for unknown type', () => {
    expect(kb.resolveDocumentMetadata('UNKNOWN_TYPE')).toBeUndefined();
  });
  it('requiredFields accessible on found metadata', () => {
    expect(kb.resolveDocumentMetadata('PROCUREMENT_NOTICE')?.requiredFields).toContain('packageName');
  });
});

// ─── KB-13: buildGovernanceKnowledgeBase factory ─────────────────────────────

describe('KB-13 buildGovernanceKnowledgeBase factory', () => {
  it('returns a GovernanceKnowledgeBase instance', () => {
    expect(buildGovernanceKnowledgeBase()).toBeInstanceOf(GovernanceKnowledgeBase);
  });
  it('factory with no args creates empty KB (all finds return undefined)', () => {
    const kb = buildGovernanceKnowledgeBase();
    expect(kb.findTemplate('x')).toBeUndefined();
    expect(kb.findClause('x')).toBeUndefined();
    expect(kb.findAuthority('x')).toBeUndefined();
  });
  it('factory correctly registers all content types', () => {
    const kb = buildFullKb();
    expect(kb.findTemplate('tmpl-kb')).toBeDefined();
    expect(kb.findAuthority('UNIT_HEAD')).toBeDefined();
    expect(kb.findPrompt('pr-kb')).toBeDefined();
  });
});
