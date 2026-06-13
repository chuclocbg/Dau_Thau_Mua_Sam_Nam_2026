/**
 * Integration tests — P1-04: Docs 14, 15, 16, 17 winner declaration.
 *
 * Each of these documents previously hardcoded supplier1Name as the winner.
 * After P1-04, they call getWinnerSupplier() so the correct supplier is named
 * when supplier 2 or 3 has the lower price.
 *
 * Test strategy: use pkgS2Wins (S2 cheapest). Verify the winner name appears
 * in the document and supplier1Name does NOT appear in the winner-declaration
 * sentences.
 */
import { describe, it, expect } from 'vitest';
import { documentTemplates } from '../docTemplates';
import { pkgS1Wins, pkgS2Wins, pkgS3Wins } from './fixtures';

const getDoc = (id: number) => documentTemplates.find(d => d.id === id)!;

// ---------------------------------------------------------------------------
// Helper: strips HTML tags to get visible text for text assertions
// ---------------------------------------------------------------------------
const stripHtml = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

// ---------------------------------------------------------------------------
// Parameterised test suite — same assertions for Docs 14, 15, 16, 17
// ---------------------------------------------------------------------------
const winnerDeclarationDocs = [14, 15, 16, 17];

for (const docId of winnerDeclarationDocs) {
  describe(`Doc ${docId} — HTML winner declaration`, () => {
    const doc = getDoc(docId);

    it(`doc ${docId} exists in documentTemplates`, () => {
      expect(doc).toBeDefined();
    });

    it(`doc ${docId}: supplier1Name is named when S1 is cheapest`, () => {
      const html = doc.getHtml(pkgS1Wins, 'COMPETITIVE_SHOPPING');
      const text = stripHtml(html);
      expect(text).toContain(pkgS1Wins.supplier1Name);
    });

    it(`doc ${docId}: supplier2Name is named when S2 is cheapest (not supplier1Name in winner position)`, () => {
      const html = doc.getHtml(pkgS2Wins, 'COMPETITIVE_SHOPPING');
      // supplier2Name must appear somewhere (as the winner)
      expect(html).toContain(pkgS2Wins.supplier2Name);
      // supplier1Name must NOT appear in the document at all when S2 wins
      // (it was never mentioned in these docs other than as the hardcoded winner)
      expect(html).not.toContain(pkgS2Wins.supplier1Name);
    });

    it(`doc ${docId}: supplier3Name is named when S3 is cheapest`, () => {
      const html = doc.getHtml(pkgS3Wins, 'COMPETITIVE_SHOPPING');
      expect(html).toContain(pkgS3Wins.supplier3Name);
      expect(html).not.toContain(pkgS3Wins.supplier1Name);
    });

    it(`doc ${docId}: getDocx does not throw`, () => {
      expect(() => doc.getDocx(pkgS1Wins, 'COMPETITIVE_SHOPPING')).not.toThrow();
      expect(() => doc.getDocx(pkgS2Wins, 'COMPETITIVE_SHOPPING')).not.toThrow();
    });
  });
}

// ---------------------------------------------------------------------------
// Doc 17 specifically — winning price must match the winner's quoted total,
// not the budget (unitPrice) total
// ---------------------------------------------------------------------------
describe('Doc 17 — winning price uses supplier quoted price (P1-04)', () => {
  it('when S2 wins, displayed price equals S2 quoted total not unitPrice total', () => {
    const doc17 = getDoc(17);
    const html = doc17.getHtml(pkgS2Wins, 'COMPETITIVE_SHOPPING');

    const s2Total = pkgS2Wins.items.reduce((s, i) => s + i.quantity * i.supplier2Price, 0);
    const unitPriceTotal = pkgS2Wins.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

    // If the two totals are the same in the fixture this test is vacuous — verify they differ
    expect(s2Total).not.toBe(unitPriceTotal);

    // S2 quoted total must appear in the decision
    const formatted = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(s2Total);
    expect(html).toContain(formatted);
  });
});
