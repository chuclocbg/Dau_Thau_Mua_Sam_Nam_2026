/**
 * Workflow state definitions
 *
 * Groups (13 × 3 = 39):
 *   WS-01  WORKFLOW_STATE_IDS — 17 entries, first=DRAFT, last=COMPLETED
 *   WS-02  STATES map — contains all 17 state keys
 *   WS-03  DRAFT state — displayName, description, responsibleRole
 *   WS-04  COMPLETED state — allowedTransitions is empty, has legalBasis
 *   WS-05  METHOD_SELECTED — requiredDocuments contains KHLCNT
 *   WS-06  DOCUMENT_PREPARATION — requiredDocuments contains HSMT
 *   WS-07  EVALUATION state — requiredDocuments contains evaluation record
 *   WS-08  Every state has a non-empty Vietnamese displayName
 *   WS-09  Every state has at least one legalBasis entry with document + article
 *   WS-10  Every state's allowedTransitions contains only valid state IDs
 *   WS-11  getStateDefinition — returns correct state for known IDs
 *   WS-12  State order — position assertions for key states
 *   WS-13  Every state has validationRules and generatedOutputs arrays
 */

import { describe, it, expect } from 'vitest';
import {
  WORKFLOW_STATE_IDS,
  isWorkflowStateId,
} from '../procurement/workflow/workflowContext';
import { STATES, getStateDefinition } from '../procurement/workflow/workflowState';

// ─── WS-01: WORKFLOW_STATE_IDS ───────────────────────────────────────────────

describe('WS-01 WORKFLOW_STATE_IDS has 17 entries in correct order', () => {
  it('has exactly 17 state IDs', () => {
    expect(WORKFLOW_STATE_IDS).toHaveLength(17);
  });
  it('first state is DRAFT', () => {
    expect(WORKFLOW_STATE_IDS[0]).toBe('DRAFT');
  });
  it('last state is COMPLETED', () => {
    expect(WORKFLOW_STATE_IDS.at(-1)).toBe('COMPLETED');
  });
});

// ─── WS-02: STATES map ───────────────────────────────────────────────────────

describe('WS-02 STATES map contains entries for all 17 state IDs', () => {
  it('STATES has exactly 17 keys', () => {
    expect(Object.keys(STATES)).toHaveLength(17);
  });
  it('every state ID in WORKFLOW_STATE_IDS has an entry in STATES', () => {
    for (const id of WORKFLOW_STATE_IDS) {
      expect(STATES[id]).toBeTruthy();
    }
  });
  it('every STATES entry id matches its map key', () => {
    for (const [key, def] of Object.entries(STATES)) {
      expect(def.id).toBe(key);
    }
  });
});

// ─── WS-03: DRAFT state ──────────────────────────────────────────────────────

describe('WS-03 DRAFT state has correct metadata', () => {
  const draft = STATES['DRAFT'];

  it('displayName is a Vietnamese string', () => {
    expect(draft.displayName).toMatch(/[Dd]ự thảo/);
  });
  it('description is a non-empty string', () => {
    expect(draft.description.length).toBeGreaterThan(10);
  });
  it('responsibleRole identifies a person/unit', () => {
    expect(draft.responsibleRole.length).toBeGreaterThan(0);
  });
});

// ─── WS-04: COMPLETED state ──────────────────────────────────────────────────

describe('WS-04 COMPLETED state has empty allowedTransitions and valid legalBasis', () => {
  const completed = STATES['COMPLETED'];

  it('allowedTransitions is an empty array', () => {
    expect(completed.allowedTransitions).toHaveLength(0);
  });
  it('legalBasis has at least one entry', () => {
    expect(completed.legalBasis.length).toBeGreaterThan(0);
  });
  it('displayName mentions completion', () => {
    expect(completed.displayName).toMatch(/[Hh]oàn thành/);
  });
});

// ─── WS-05: METHOD_SELECTED required documents ───────────────────────────────

describe('WS-05 METHOD_SELECTED requires KHLCNT before advancing', () => {
  const ms = STATES['METHOD_SELECTED'];

  it('requiredDocuments includes ke-hoach-lua-chon-nha-thau', () => {
    expect(ms.requiredDocuments).toContain('ke-hoach-lua-chon-nha-thau');
  });
  it('has legal basis referencing Điều 21', () => {
    expect(ms.legalBasis.some(b => b.article.includes('Điều 21'))).toBe(true);
  });
  it('allowedTransitions leads to PLAN_APPROVED', () => {
    expect(ms.allowedTransitions).toContain('PLAN_APPROVED');
  });
});

// ─── WS-06: DOCUMENT_PREPARATION required documents ─────────────────────────

describe('WS-06 DOCUMENT_PREPARATION requires HSMT before advancing', () => {
  const dp = STATES['DOCUMENT_PREPARATION'];

  it('requiredDocuments includes ho-so-moi-thau', () => {
    expect(dp.requiredDocuments).toContain('ho-so-moi-thau');
  });
  it('has legal basis referencing Điều 34', () => {
    expect(dp.legalBasis.some(b => b.article.includes('Điều 34'))).toBe(true);
  });
  it('allowedTransitions leads to DOCUMENT_APPROVED', () => {
    expect(dp.allowedTransitions).toContain('DOCUMENT_APPROVED');
  });
});

// ─── WS-07: EVALUATION required documents ────────────────────────────────────

describe('WS-07 EVALUATION requires evaluation record before advancing', () => {
  const ev = STATES['EVALUATION'];

  it('requiredDocuments includes bien-ban-danh-gia', () => {
    expect(ev.requiredDocuments).toContain('bien-ban-danh-gia');
  });
  it('legalBasis references Điều 40 Luật 22/2023', () => {
    expect(ev.legalBasis.some(b => b.document === '22/2023/QH15' && b.article.includes('40'))).toBe(true);
  });
  it('allowedTransitions leads to APPROVAL', () => {
    expect(ev.allowedTransitions).toContain('APPROVAL');
  });
});

// ─── WS-08: Every state has a Vietnamese displayName ─────────────────────────

describe('WS-08 every state has a non-empty Vietnamese displayName', () => {
  it('all 17 displayNames are strings with content', () => {
    for (const id of WORKFLOW_STATE_IDS) {
      expect(STATES[id].displayName.length).toBeGreaterThan(0);
    }
  });
  it('no two states share the same displayName', () => {
    const names = WORKFLOW_STATE_IDS.map(id => STATES[id].displayName);
    expect(new Set(names).size).toBe(names.length);
  });
  it('APPROVAL displayName mentions phê duyệt', () => {
    expect(STATES['APPROVAL'].displayName).toMatch(/[Pp]hê duyệt/);
  });
});

// ─── WS-09: Every state legalBasis has document + article ────────────────────

describe('WS-09 every state has at least one legalBasis entry with document and article', () => {
  it('all states have at least one legalBasis entry', () => {
    for (const id of WORKFLOW_STATE_IDS) {
      expect(STATES[id].legalBasis.length).toBeGreaterThan(0);
    }
  });
  it('every legalBasis entry has a non-empty document string', () => {
    for (const id of WORKFLOW_STATE_IDS) {
      for (const lb of STATES[id].legalBasis) {
        expect(lb.document.length).toBeGreaterThan(0);
      }
    }
  });
  it('every legalBasis entry has a non-empty article string', () => {
    for (const id of WORKFLOW_STATE_IDS) {
      for (const lb of STATES[id].legalBasis) {
        expect(lb.article.length).toBeGreaterThan(0);
      }
    }
  });
});

// ─── WS-10: allowedTransitions contains only valid state IDs ─────────────────

describe('WS-10 allowedTransitions are valid WorkflowStateIds', () => {
  it('all transition targets pass isWorkflowStateId check', () => {
    for (const id of WORKFLOW_STATE_IDS) {
      for (const target of STATES[id].allowedTransitions) {
        expect(isWorkflowStateId(target)).toBe(true);
      }
    }
  });
  it('DRAFT allowedTransitions has exactly 1 entry', () => {
    expect(STATES['DRAFT'].allowedTransitions).toHaveLength(1);
  });
  it('PAYMENT allowedTransitions leads to COMPLETED', () => {
    expect(STATES['PAYMENT'].allowedTransitions).toContain('COMPLETED');
  });
});

// ─── WS-11: getStateDefinition ───────────────────────────────────────────────

describe('WS-11 getStateDefinition returns correct state', () => {
  it('returns DRAFT definition for "DRAFT"', () => {
    expect(getStateDefinition('DRAFT').id).toBe('DRAFT');
  });
  it('returns COMPLETED definition for "COMPLETED"', () => {
    expect(getStateDefinition('COMPLETED').id).toBe('COMPLETED');
  });
  it('returns APPROVAL definition for "APPROVAL"', () => {
    const d = getStateDefinition('APPROVAL');
    expect(d.id).toBe('APPROVAL');
    expect(d.responsibleRole.length).toBeGreaterThan(0);
  });
});

// ─── WS-12: State position assertions ────────────────────────────────────────

describe('WS-12 key states appear at expected positions in WORKFLOW_STATE_IDS', () => {
  it('METHOD_SELECTED is at index 3', () => {
    expect(WORKFLOW_STATE_IDS.indexOf('METHOD_SELECTED')).toBe(3);
  });
  it('EVALUATION is at index 10', () => {
    expect(WORKFLOW_STATE_IDS.indexOf('EVALUATION')).toBe(10);
  });
  it('ACCEPTANCE comes before PAYMENT', () => {
    const accIdx = WORKFLOW_STATE_IDS.indexOf('ACCEPTANCE');
    const payIdx = WORKFLOW_STATE_IDS.indexOf('PAYMENT');
    expect(accIdx).toBeLessThan(payIdx);
  });
});

// ─── WS-13: validationRules and generatedOutputs ─────────────────────────────

describe('WS-13 every state has validationRules and generatedOutputs arrays', () => {
  it('all states have at least one validationRule', () => {
    for (const id of WORKFLOW_STATE_IDS) {
      expect(STATES[id].validationRules.length).toBeGreaterThan(0);
    }
  });
  it('all states have at least one generatedOutput', () => {
    for (const id of WORKFLOW_STATE_IDS) {
      expect(STATES[id].generatedOutputs.length).toBeGreaterThan(0);
    }
  });
  it('all states have at least one requiredInput', () => {
    for (const id of WORKFLOW_STATE_IDS) {
      expect(STATES[id].requiredInputs.length).toBeGreaterThan(0);
    }
  });
});
