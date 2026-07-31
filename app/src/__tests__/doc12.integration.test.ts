/**
 * Integration tests — Doc 12 OPEN_BIDDING disclaimer (PRIORITY2_DOMAIN_AUDIT.md A.5,
 * ADR-A5-DOC12-SPLIT.md Track 1).
 *
 * Document 12's own title already concedes it is a summary ("BẢN TÓM TẮT PHÁT HÀNH"), yet it
 * was applied identically across every method tier including OPEN_BIDDING, the highest-value,
 * most legally load-bearing tier -- risking a reader mistaking the summary for a complete,
 * issuance-ready HSMT. This fix adds a prominent disclaimer to the OPEN_BIDDING variant only,
 * stating it is a planning/internal draft and that a complete HSMT must be separately prepared
 * before formal issuance. No new legal content is authored -- the disclaimer is pure meta-
 * commentary about the document's own completeness status, not a legal citation or business
 * rule. The disclaimer must NOT appear for any other method tier, and all existing content
 * (chapters, citations) must be preserved unchanged.
 *
 * To inspect DOCX content we use Packer.toBuffer() + JSZip to extract the underlying
 * word/document.xml and search it as plain text (matches the convention established in
 * doc24.integration.test.ts / doc27.integration.test.ts).
 */
import { describe, it, expect } from 'vitest';
import { documentTemplates } from '../docTemplates';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { pkgS1Wins } from './fixtures';

const doc12 = documentTemplates.find(d => d.id === 12)!;

const DISCLAIMER_MARKER = 'LƯU Ý';
const DISCLAIMER_TEXT = 'chưa phải là Hồ sơ mời thầu hoàn chỉnh';

const extractDocXml = async (docConfig: typeof doc12, pkg: typeof pkgS1Wins, methodCode: string): Promise<string> => {
  const docxDoc = docConfig.getDocx(pkg, methodCode);
  const buffer = await Packer.toBuffer(docxDoc);
  const zip = await JSZip.loadAsync(buffer);
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('word/document.xml not found in DOCX');
  return file.async('string');
};

describe('Doc 12 — exists and basic structure', () => {
  it('doc 12 exists in documentTemplates', () => {
    expect(doc12).toBeDefined();
    expect(doc12.name).toBe('Hồ sơ mời thầu hoặc hồ sơ yêu cầu');
  });
});

describe('Doc 12 — applicability gate (unchanged by this fix)', () => {
  it('is required for OPEN_BIDDING (unchanged)', () => {
    expect(doc12.getCategory('OPEN_BIDDING')).toBe('required');
  });
  it('is required for COMPETITIVE_SHOPPING (unchanged)', () => {
    expect(doc12.getCategory('COMPETITIVE_SHOPPING')).toBe('required');
  });
  it('is not applicable for DIRECT_50 (unchanged)', () => {
    expect(doc12.getCategory('DIRECT_50')).toBe('not_applicable');
  });
});

describe('Doc 12 — HTML disclaimer appears only for OPEN_BIDDING (the fix)', () => {
  it('HTML contains the disclaimer for OPEN_BIDDING', () => {
    const html = doc12.getHtml(pkgS1Wins, 'OPEN_BIDDING');
    expect(html).toContain(DISCLAIMER_MARKER);
    expect(html).toContain(DISCLAIMER_TEXT);
  });
  it('HTML does NOT contain the disclaimer for COMPETITIVE_SHOPPING', () => {
    const html = doc12.getHtml(pkgS1Wins, 'COMPETITIVE_SHOPPING');
    expect(html).not.toContain(DISCLAIMER_TEXT);
  });
  it('HTML does NOT contain the disclaimer for DIRECT_SELECTION_SIMPLIFIED', () => {
    const html = doc12.getHtml(pkgS1Wins, 'DIRECT_SELECTION_SIMPLIFIED');
    expect(html).not.toContain(DISCLAIMER_TEXT);
  });
  it('HTML still contains all 5 existing chapters for OPEN_BIDDING (content preserved)', () => {
    const html = doc12.getHtml(pkgS1Wins, 'OPEN_BIDDING');
    expect(html).toContain('Chương I. Chỉ dẫn nhà thầu');
    expect(html).toContain('Chương II. Bảng dữ liệu đấu thầu');
    expect(html).toContain('Chương III. Tiêu chuẩn đánh giá');
    expect(html).toContain('Chương IV. Yêu cầu về kỹ thuật');
    expect(html).toContain('Chương V. Dự thảo Hợp đồng');
  });
  it('HTML renders without throwing for every method tier', () => {
    for (const m of ['OPEN_BIDDING', 'COMPETITIVE_SHOPPING', 'DIRECT_SELECTION_SIMPLIFIED', 'DIRECT_50']) {
      expect(() => doc12.getHtml(pkgS1Wins, m)).not.toThrow();
    }
  });
});

describe('Doc 12 — DOCX disclaimer appears only for OPEN_BIDDING (the fix)', () => {
  it('DOCX contains the disclaimer for OPEN_BIDDING', async () => {
    const xml = await extractDocXml(doc12, pkgS1Wins, 'OPEN_BIDDING');
    expect(xml).toContain(DISCLAIMER_MARKER);
    expect(xml).toContain('chưa phải là Hồ sơ mời thầu hoàn chỉnh');
  });
  it('DOCX does NOT contain the disclaimer for COMPETITIVE_SHOPPING', async () => {
    const xml = await extractDocXml(doc12, pkgS1Wins, 'COMPETITIVE_SHOPPING');
    expect(xml).not.toContain('hoàn chỉnh để phát hành chính thức');
  });
  it('DOCX still contains existing content for OPEN_BIDDING (content preserved)', async () => {
    const xml = await extractDocXml(doc12, pkgS1Wins, 'OPEN_BIDDING');
    expect(xml).toContain('HỒ SƠ YÊU CẦU MUA SẮM HÀNG HÓA');
  });
  it('DOCX renders without throwing for every method tier', async () => {
    for (const m of ['OPEN_BIDDING', 'COMPETITIVE_SHOPPING', 'DIRECT_SELECTION_SIMPLIFIED', 'DIRECT_50']) {
      await expect(extractDocXml(doc12, pkgS1Wins, m)).resolves.toBeDefined();
    }
  });
});
