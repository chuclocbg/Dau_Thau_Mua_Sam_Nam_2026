/**
 * Integration tests — Doc 14 OPEN_BIDDING narrative correction (PRIORITY2_DOMAIN_AUDIT.md A.4,
 * ADR-A4-BID-MODEL.md Track 1).
 *
 * getWinnerSupplier(pkg) uses the same 3-quote market-survey data for every method tier,
 * including OPEN_BIDDING. Before this fix, Document 14's narrative unconditionally stated
 * "Tổ chuyên gia đã tiến hành đánh giá hồ sơ đề xuất của nhà thầu" (the expert team evaluated
 * the bidder's dossier) even for OPEN_BIDDING, implying a distinct, formal bid-dossier
 * evaluation occurred when the underlying data is definitionally the same market survey used
 * at cost-estimation time. This fix corrects the narrative wording for OPEN_BIDDING only, to
 * plainly state the evaluation is based on the pre-tender market survey. No new data model, no
 * new legal content, no change to getWinnerSupplier() itself or to any other document/method
 * tier.
 *
 * To inspect DOCX content we use Packer.toBuffer() + JSZip to extract the underlying
 * word/document.xml and search it as plain text (matches the convention established in
 * doc24/doc27/doc12.integration.test.ts).
 */
import { describe, it, expect } from 'vitest';
import { documentTemplates } from '../docTemplates';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { pkgS1Wins } from './fixtures';

const doc14 = documentTemplates.find(d => d.id === 14)!;

const SURVEY_MARKER = 'khảo sát giá thị trường';
const ORIGINAL_WORDING = 'Tổ chuyên gia đã tiến hành đánh giá hồ sơ đề xuất của nhà thầu';

const extractDocXml = async (docConfig: typeof doc14, pkg: typeof pkgS1Wins, methodCode: string): Promise<string> => {
  const docxDoc = docConfig.getDocx(pkg, methodCode);
  const buffer = await Packer.toBuffer(docxDoc);
  const zip = await JSZip.loadAsync(buffer);
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('word/document.xml not found in DOCX');
  return file.async('string');
};

describe('Doc 14 — exists and basic structure', () => {
  it('doc 14 exists in documentTemplates', () => {
    expect(doc14).toBeDefined();
    expect(doc14.name).toBe('Báo cáo đánh giá');
  });
});

describe('Doc 14 — applicability gate (unchanged by this fix)', () => {
  it('is required for OPEN_BIDDING (unchanged)', () => {
    expect(doc14.getCategory('OPEN_BIDDING')).toBe('required');
  });
  it('is required for COMPETITIVE_SHOPPING (unchanged)', () => {
    expect(doc14.getCategory('COMPETITIVE_SHOPPING')).toBe('required');
  });
});

describe('Doc 14 — HTML narrative corrected for OPEN_BIDDING only (the fix)', () => {
  it('HTML states the market-survey basis for OPEN_BIDDING', () => {
    const html = doc14.getHtml(pkgS1Wins, 'OPEN_BIDDING');
    expect(html).toContain(SURVEY_MARKER);
    expect(html).toContain('không phải hồ sơ dự thầu chính thức');
  });
  it('HTML does NOT use the original bid-dossier wording for OPEN_BIDDING', () => {
    const html = doc14.getHtml(pkgS1Wins, 'OPEN_BIDDING');
    expect(html).not.toContain(ORIGINAL_WORDING);
  });
  it('HTML still uses the original wording for COMPETITIVE_SHOPPING (unchanged for other tiers)', () => {
    const html = doc14.getHtml(pkgS1Wins, 'COMPETITIVE_SHOPPING');
    expect(html).toContain(ORIGINAL_WORDING);
    expect(html).not.toContain(SURVEY_MARKER);
  });
  it('HTML still names the winning supplier for OPEN_BIDDING (getWinnerSupplier unchanged)', () => {
    const html = doc14.getHtml(pkgS1Wins, 'OPEN_BIDDING');
    expect(html).toContain(pkgS1Wins.supplier1Name);
  });
  it('HTML renders without throwing for every method tier', () => {
    for (const m of ['OPEN_BIDDING', 'COMPETITIVE_SHOPPING', 'DIRECT_SELECTION_SIMPLIFIED', 'DIRECT_50']) {
      expect(() => doc14.getHtml(pkgS1Wins, m)).not.toThrow();
    }
  });
});

describe('Doc 14 — DOCX narrative corrected for OPEN_BIDDING only (the fix)', () => {
  it('DOCX states the market-survey basis for OPEN_BIDDING', async () => {
    const xml = await extractDocXml(doc14, pkgS1Wins, 'OPEN_BIDDING');
    expect(xml).toContain(SURVEY_MARKER);
  });
  it('DOCX does NOT use the original bid-dossier wording for OPEN_BIDDING', async () => {
    const xml = await extractDocXml(doc14, pkgS1Wins, 'OPEN_BIDDING');
    expect(xml).not.toContain('Tổ chuyên gia báo cáo kết quả đánh giá hồ sơ đề xuất của nhà thầu');
  });
  it('DOCX still uses the original wording for COMPETITIVE_SHOPPING (unchanged for other tiers)', async () => {
    const xml = await extractDocXml(doc14, pkgS1Wins, 'COMPETITIVE_SHOPPING');
    expect(xml).toContain('Tổ chuyên gia báo cáo kết quả đánh giá hồ sơ đề xuất của nhà thầu');
  });
  it('DOCX renders without throwing for every method tier', async () => {
    for (const m of ['OPEN_BIDDING', 'COMPETITIVE_SHOPPING', 'DIRECT_SELECTION_SIMPLIFIED', 'DIRECT_50']) {
      await expect(extractDocXml(doc14, pkgS1Wins, m)).resolves.toBeDefined();
    }
  });
});
