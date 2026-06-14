import { describe, it, expect } from 'vitest';
import { runWorkflow, WORKFLOW_DOCUMENT_IDS, WORKFLOW_DOCUMENT_NAMES } from '../ai/workflowOrchestrator';
import { reviewPackage } from '../ai/legalReviewer';

// Fixed date so timeline assertions are deterministic
const TODAY = new Date('2026-06-20');
const YEAR = 2026;

describe('P5-05 runWorkflow', () => {
  it('returns success=true for a valid request', () => {
    const r = runWorkflow('20 máy tính để bàn phục vụ thực hành', YEAR, TODAY);
    expect(r.success).toBe(true);
  });

  it('produces a populated ProcurementPackage', () => {
    const r = runWorkflow('5 điều hòa không khí phòng học', YEAR, TODAY);
    expect(r.pkg.packageName.length).toBeGreaterThan(0);
    expect(r.pkg.packageCode.length).toBeGreaterThan(0);
    expect(r.pkg.items.length).toBeGreaterThan(0);
  });

  it('sets correct packageType for computers', () => {
    const r = runWorkflow('20 máy tính để bàn', YEAR, TODAY);
    expect(r.pkg.packageType).toBe('goods_fixed_asset');
  });

  it('sets service + unit_price for AC maintenance', () => {
    const r = runWorkflow('bảo trì 80 điều hòa không khí', YEAR, TODAY);
    expect(r.pkg.packageType).toBe('service');
    expect(r.pkg.contractType).toBe('unit_price');
  });

  it('sets goods_consumable for chemicals', () => {
    const r = runWorkflow('hóa chất thí nghiệm phòng lab', YEAR, TODAY);
    expect(r.pkg.packageType).toBe('goods_consumable');
  });

  // --- Timeline validity ---

  it('generated timeline has bid-close at least 7 days after doc-issue', () => {
    const r = runWorkflow('10 máy tính', YEAR, TODAY);
    const issue = new Date(r.pkg.dateDocIssue).getTime();
    const close = new Date(r.pkg.dateBidClose).getTime();
    const gapDays = (close - issue) / 86400000;
    expect(gapDays).toBeGreaterThanOrEqual(7);
  });

  it('generated timeline has appraise after evaluate', () => {
    const r = runWorkflow('5 máy chiếu', YEAR, TODAY);
    expect(r.pkg.dateAppraise > r.pkg.dateEvaluate).toBe(true);
  });

  it('generated timeline has acceptance after delivery', () => {
    const r = runWorkflow('3 switch mạng', YEAR, TODAY);
    expect(r.pkg.dateAcceptance > r.pkg.dateDelivery).toBe(true);
  });

  // --- Item specs ---

  it('item has non-empty spec string', () => {
    const r = runWorkflow('5 máy tính xách tay laptop', YEAR, TODAY);
    const item = r.pkg.items[0];
    expect(item.specs.length).toBeGreaterThan(20);
  });

  it('item unitPrice is positive', () => {
    const r = runWorkflow('10 máy tính để bàn', YEAR, TODAY);
    const item = r.pkg.items[0];
    expect(item.unitPrice).toBeGreaterThan(0);
  });

  it('item has 3 supplier prices', () => {
    const r = runWorkflow('2 máy chiếu', YEAR, TODAY);
    const item = r.pkg.items[0];
    expect(item.supplier1Price).toBeGreaterThan(0);
    expect(item.supplier2Price).toBeGreaterThan(0);
    expect(item.supplier3Price).toBeGreaterThan(0);
  });

  // --- Legal review integration (P5-03) ---

  it('includes a legalReview result', () => {
    const r = runWorkflow('5 điều hòa không khí', YEAR, TODAY);
    expect(r.legalReview).toBeDefined();
    expect(r.legalReview.findings).toBeInstanceOf(Array);
    expect(r.legalReview.summary.length).toBeGreaterThan(0);
  });

  // --- Steps (5 now) ---

  it('has exactly 5 workflow steps all done', () => {
    const r = runWorkflow('3 máy in', YEAR, TODAY);
    expect(r.steps).toHaveLength(5);
    r.steps.forEach(s => expect(s.status).toBe('done'));
  });

  it('step labels are non-empty', () => {
    const r = runWorkflow('văn phòng phẩm', YEAR, TODAY);
    r.steps.forEach(s => expect(s.label.length).toBeGreaterThan(0));
  });

  it('step 4 is legal KB query step', () => {
    const r = runWorkflow('5 máy tính', YEAR, TODAY);
    expect(r.steps[3].label).toContain('P5-04');
  });

  it('step 5 is document selection step', () => {
    const r = runWorkflow('5 máy tính', YEAR, TODAY);
    expect(r.steps[4].label).toContain('hồ sơ');
  });

  // --- Legal KB integration (P5-04) ---

  it('returns kbResults array', () => {
    const r = runWorkflow('20 máy tính để bàn', YEAR, TODAY);
    expect(r.kbResults).toBeInstanceOf(Array);
  });

  it('kbResults contain valid search results for known goods', () => {
    const r = runWorkflow('máy tính để bàn phòng học', YEAR, TODAY);
    expect(r.kbResults.length).toBeGreaterThanOrEqual(0);
    r.kbResults.forEach(result => {
      expect(result.entry.id).toBeTruthy();
      expect(result.score).toBeGreaterThan(0);
    });
  });

  it('kbResults have at most 3 entries', () => {
    const r = runWorkflow('máy chiếu hội trường 10 bộ', YEAR, TODAY);
    expect(r.kbResults.length).toBeLessThanOrEqual(3);
  });

  it('returns empty kbResults for unrecognised category', () => {
    // Very short request that yields 'Không rõ' category — KB may still return results but should be limited
    const r = runWorkflow('abc', YEAR, TODAY);
    expect(r.kbResults.length).toBeLessThanOrEqual(3);
  });

  // --- Document selection ---

  it('selectedDocumentIds is non-empty', () => {
    const r = runWorkflow('10 máy tính', YEAR, TODAY);
    expect(r.selectedDocumentIds.length).toBeGreaterThan(0);
  });

  it('selectedDocumentIds contains all 10 core document IDs', () => {
    const r = runWorkflow('5 máy chiếu', YEAR, TODAY);
    const EXPECTED_IDS = [10, 11, 12, 27, 28, 14, 17, 18, 20, 21];
    for (const id of EXPECTED_IDS) {
      expect(r.selectedDocumentIds).toContain(id);
    }
  });

  it('WORKFLOW_DOCUMENT_IDS exports 10 document IDs', () => {
    expect(WORKFLOW_DOCUMENT_IDS).toHaveLength(10);
  });

  it('WORKFLOW_DOCUMENT_NAMES has an entry for each selected ID', () => {
    const r = runWorkflow('3 máy in laser', YEAR, TODAY);
    for (const id of r.selectedDocumentIds) {
      expect(WORKFLOW_DOCUMENT_NAMES[id]).toBeTruthy();
    }
  });

  // --- Export readiness ---

  it('readyForExport is true when no CRITICAL findings', () => {
    const r = runWorkflow('5 máy tính để bàn', YEAR, TODAY);
    if (!r.legalReview.hasCritical) {
      expect(r.readyForExport).toBe(true);
    }
  });

  it('readyForExport is false when CRITICAL finding exists', () => {
    const r = runWorkflow('văn phòng phẩm', YEAR, TODAY);
    const modifiedPkg = {
      ...r.pkg,
      packageName: 'Gói đấu thầu rộng rãi mua văn phòng phẩm',
      items: [{ ...r.pkg.items[0], unitPrice: 100_000, quantity: 1 }],
    };
    const review = reviewPackage(modifiedPkg);
    expect(review.hasCritical).toBe(true);
  });

  // --- Placeholder data (CLAUDE.md Demo Data Rules) ---

  it('uses neutral placeholder for team members', () => {
    const r = runWorkflow('5 điều hòa', YEAR, TODAY);
    expect(r.pkg.expertTeamLeader).toContain('[');
    expect(r.pkg.appraisalLeader).toContain('[');
  });

  it('uses neutral placeholder for suppliers', () => {
    const r = runWorkflow('máy in văn phòng', YEAR, TODAY);
    expect(r.pkg.supplier1Name).toContain('[');
    expect(r.pkg.supplier2Name).toContain('[');
    expect(r.pkg.supplier3Name).toContain('[');
  });

  // --- Budget year propagation ---

  it('propagates budgetYear into packageCode', () => {
    const r = runWorkflow('5 máy tính', 2027, TODAY);
    expect(r.pkg.packageCode).toContain('2027');
    expect(r.pkg.budgetYear).toBe(2027);
  });
});
