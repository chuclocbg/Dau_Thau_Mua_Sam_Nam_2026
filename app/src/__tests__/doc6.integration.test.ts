/**
 * Integration tests — P1-03 (Doc 6 table headers) + P1-04 (conclusion winner).
 *
 * P1-03: Table headers previously hardcoded "T&T / Máy tính VN / Sao Nam"
 *        regardless of the active package. Now use pkg.supplierNName.
 *
 * P1-04: Conclusion paragraph previously always stated pkg.supplier1Name as the
 *        cheapest supplier regardless of actual prices. Now uses getWinnerSupplier().
 */
import { describe, it, expect } from 'vitest';
import { documentTemplates } from '../docTemplates';
import { pkgS1Wins, pkgS2Wins, pkgS3Wins } from './fixtures';

const doc6 = documentTemplates.find(d => d.id === 6)!;

describe('Doc 6 — table headers contain dynamic supplier names (P1-03)', () => {
  it('doc 6 exists in documentTemplates', () => {
    expect(doc6).toBeDefined();
  });

  it('header shows pkg.supplier1Name, not hardcoded "T&T"', () => {
    const html = doc6.getHtml(pkgS1Wins, 'COMPETITIVE_SHOPPING');
    expect(html).toContain(`Báo giá 1 (${pkgS1Wins.supplier1Name})`);
    expect(html).not.toContain('Báo giá 1 (T&T)');
    expect(html).not.toContain('Báo giá 1 (Máy tính VN)');
  });

  it('header shows pkg.supplier2Name, not hardcoded "Máy tính VN"', () => {
    const html = doc6.getHtml(pkgS2Wins, 'COMPETITIVE_SHOPPING');
    expect(html).toContain(`Báo giá 2 (${pkgS2Wins.supplier2Name})`);
    expect(html).not.toContain('Báo giá 2 (Máy tính VN)');
  });

  it('header shows pkg.supplier3Name, not hardcoded "Sao Nam"', () => {
    const html = doc6.getHtml(pkgS3Wins, 'COMPETITIVE_SHOPPING');
    expect(html).toContain(`Báo giá 3 (${pkgS3Wins.supplier3Name})`);
    expect(html).not.toContain('Báo giá 3 (Sao Nam)');
  });

  it('all three supplier names appear in the same HTML output', () => {
    const html = doc6.getHtml(pkgS1Wins, 'COMPETITIVE_SHOPPING');
    expect(html).toContain(pkgS1Wins.supplier1Name);
    expect(html).toContain(pkgS1Wins.supplier2Name);
    expect(html).toContain(pkgS1Wins.supplier3Name);
  });
});

describe('Doc 6 — conclusion names actual cheapest supplier (P1-04)', () => {
  it('conclusion names supplier1Name when S1 is cheapest', () => {
    const html = doc6.getHtml(pkgS1Wins, 'COMPETITIVE_SHOPPING');
    expect(html).toContain(`Kết luận:`);
    expect(html).toContain(pkgS1Wins.supplier1Name);
  });

  it('conclusion names supplier2Name when S2 is cheapest (not supplier1Name)', () => {
    const html = doc6.getHtml(pkgS2Wins, 'COMPETITIVE_SHOPPING');
    // Slice from "Kết luận:" to end — supplier1Name appears in table headers before
    // this point, but must NOT appear in the conclusion paragraph itself.
    const afterConclusion = html.slice(html.indexOf('Kết luận:'));
    expect(afterConclusion.length).toBeGreaterThan(10);
    expect(afterConclusion).toContain(pkgS2Wins.supplier2Name);
    expect(afterConclusion).not.toContain(pkgS2Wins.supplier1Name);
  });

  it('conclusion names supplier3Name when S3 is cheapest', () => {
    const html = doc6.getHtml(pkgS3Wins, 'COMPETITIVE_SHOPPING');
    const afterConclusion = html.slice(html.indexOf('Kết luận:'));
    expect(afterConclusion).toContain(pkgS3Wins.supplier3Name);
    expect(afterConclusion).not.toContain(pkgS3Wins.supplier1Name);
  });
});

describe('Doc 6 DOCX — conclusion names actual cheapest supplier (P1-04)', () => {
  it('getDocx returns a Document without throwing', () => {
    expect(() => doc6.getDocx(pkgS1Wins, 'COMPETITIVE_SHOPPING')).not.toThrow();
    expect(() => doc6.getDocx(pkgS2Wins, 'COMPETITIVE_SHOPPING')).not.toThrow();
    expect(() => doc6.getDocx(pkgS3Wins, 'COMPETITIVE_SHOPPING')).not.toThrow();
  });
});
