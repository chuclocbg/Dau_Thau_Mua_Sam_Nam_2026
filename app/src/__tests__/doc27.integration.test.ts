/**
 * Integration tests — Doc 27 applicability gate (PRIORITY2_DOMAIN_AUDIT.md A.2).
 *
 * Before this fix, getCategory('OPEN_BIDDING') returned 'required' even
 * though this document's own generated content hardcodes "Hình thức lựa
 * chọn nhà thầu: Chào hàng cạnh tranh" and cites Điều 81 NĐ 214/2025/NĐ-CP
 * (the chào hàng cạnh tranh article) unconditionally — a false statement
 * of procurement method and a wrong legal citation if issued for a real
 * OPEN_BIDDING package (>5 tỷ VNĐ).
 *
 * After this fix, this document is required only for COMPETITIVE_SHOPPING
 * (the one method its content is actually correct for) and no longer
 * applicable to OPEN_BIDDING. Its existing, correct content for
 * COMPETITIVE_SHOPPING is unchanged and unrelated legal citations
 * (Điều 28 Luật Đấu thầu, Điều 81 NĐ 214/2025) are preserved verbatim.
 *
 * To inspect DOCX content we use Packer.toBuffer() + JSZip to extract the
 * underlying word/document.xml and search it as plain text (matches the
 * convention established in doc24.integration.test.ts).
 */
import { describe, it, expect } from 'vitest';
import { documentTemplates } from '../docTemplates';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { pkgS1Wins } from './fixtures';

const doc27 = documentTemplates.find(d => d.id === 27)!;

const extractDocXml = async (docConfig: typeof doc27, pkg: typeof pkgS1Wins, methodCode: string): Promise<string> => {
  const docxDoc = docConfig.getDocx(pkg, methodCode);
  const buffer = await Packer.toBuffer(docxDoc);
  const zip = await JSZip.loadAsync(buffer);
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('word/document.xml not found in DOCX');
  return file.async('string');
};

describe('Doc 27 — exists and basic structure', () => {
  it('doc 27 exists in documentTemplates', () => {
    expect(doc27).toBeDefined();
    expect(doc27.name).toBe('Thông báo mời chào hàng');
  });
});

describe('Doc 27 — applicability gate (the fix)', () => {
  it('is required for COMPETITIVE_SHOPPING (unchanged — content is correct for this method)', () => {
    expect(doc27.getCategory('COMPETITIVE_SHOPPING')).toBe('required');
    expect(doc27.getCategoryLabel('COMPETITIVE_SHOPPING')).toBe('Bắt buộc');
  });

  it('is NOT applicable for OPEN_BIDDING (the fix — was incorrectly "required")', () => {
    expect(doc27.getCategory('OPEN_BIDDING')).toBe('not_applicable');
    expect(doc27.getCategoryLabel('OPEN_BIDDING')).toBe('Không áp dụng');
  });

  it('is recommended for DIRECT_SELECTION_SIMPLIFIED (unchanged)', () => {
    expect(doc27.getCategory('DIRECT_SELECTION_SIMPLIFIED')).toBe('recommended');
  });

  it('is not applicable for DIRECT_50 (unchanged)', () => {
    expect(doc27.getCategory('DIRECT_50')).toBe('not_applicable');
  });
});

describe('Doc 27 — HTML content preserved for COMPETITIVE_SHOPPING', () => {
  it('HTML still states the correct method name for its one applicable method', () => {
    const html = doc27.getHtml(pkgS1Wins, 'COMPETITIVE_SHOPPING');
    expect(html).toContain('Chào hàng cạnh tranh');
  });

  it('HTML still cites Điều 28 Luật Đấu thầu and Điều 81 NĐ 214/2025 (unrelated citations preserved)', () => {
    const html = doc27.getHtml(pkgS1Wins, 'COMPETITIVE_SHOPPING');
    expect(html).toContain('Điều 28 Luật Đấu thầu số 22/2023/QH15');
    expect(html).toContain('Điều 81 Nghị định số 214/2025/NĐ-CP');
  });

  it('HTML renders without throwing', () => {
    expect(() => doc27.getHtml(pkgS1Wins, 'COMPETITIVE_SHOPPING')).not.toThrow();
  });
});

describe('Doc 27 — DOCX content preserved for COMPETITIVE_SHOPPING', () => {
  it('DOCX still states the correct method name', async () => {
    const xml = await extractDocXml(doc27, pkgS1Wins, 'COMPETITIVE_SHOPPING');
    expect(xml).toContain('Chào hàng cạnh tranh');
  });

  it('DOCX still cites Điều 28 and Điều 81 (unrelated citations preserved)', async () => {
    const xml = await extractDocXml(doc27, pkgS1Wins, 'COMPETITIVE_SHOPPING');
    expect(xml).toContain('Điều 28 Luật Đấu thầu số 22/2023/QH15');
    expect(xml).toContain('Điều 81 NĐ 214/2025/NĐ-CP');
  });
});
