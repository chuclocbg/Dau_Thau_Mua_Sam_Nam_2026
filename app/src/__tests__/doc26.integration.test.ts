/**
 * Integration tests — Doc 26 applicability gate (PRIORITY2_DOMAIN_AUDIT.md A.1).
 *
 * Before this fix, getCategory returned 'required' for every method except
 * DIRECT_50 -- including COMPETITIVE_SHOPPING and OPEN_BIDDING -- even
 * though this document's own audit-risk text and legal citation cite
 * "NĐ 214/2025 Điều 80", which is specifically the chỉ định thầu
 * (direct-appointment) article, applicable only to DIRECT_50 and
 * DIRECT_SELECTION_SIMPLIFIED. COMPETITIVE_SHOPPING is governed by Điều 81
 * (see Document 27) and OPEN_BIDDING by the Luật's general open-tender
 * provisions -- neither of which this RFQ's own citation supports.
 *
 * After this fix, this document is required only for
 * DIRECT_SELECTION_SIMPLIFIED (the one method its own cited legal basis
 * actually supports). Its existing, correct content is unchanged and the
 * Điều 80 citation is preserved verbatim.
 *
 * To inspect DOCX content we use Packer.toBuffer() + JSZip to extract the
 * underlying word/document.xml and search it as plain text (matches the
 * convention established in doc24.integration.test.ts / doc27.integration.test.ts).
 */
import { describe, it, expect } from 'vitest';
import { documentTemplates } from '../docTemplates';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { pkgS1Wins } from './fixtures';

const doc26 = documentTemplates.find(d => d.id === 26)!;

const extractDocXml = async (docConfig: typeof doc26, pkg: typeof pkgS1Wins, methodCode: string): Promise<string> => {
  const docxDoc = docConfig.getDocx(pkg, methodCode);
  const buffer = await Packer.toBuffer(docxDoc);
  const zip = await JSZip.loadAsync(buffer);
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('word/document.xml not found in DOCX');
  return file.async('string');
};

describe('Doc 26 — exists and basic structure', () => {
  it('doc 26 exists in documentTemplates', () => {
    expect(doc26).toBeDefined();
    expect(doc26.name).toBe('Phiếu yêu cầu báo giá (RFQ)');
  });
});

describe('Doc 26 — applicability gate (the fix)', () => {
  it('is required for DIRECT_SELECTION_SIMPLIFIED (the one method its own Điều 80 citation supports)', () => {
    expect(doc26.getCategory('DIRECT_SELECTION_SIMPLIFIED')).toBe('required');
    expect(doc26.getCategoryLabel('DIRECT_SELECTION_SIMPLIFIED')).toBe('Bắt buộc');
  });

  it('is NOT applicable for COMPETITIVE_SHOPPING (the fix -- was incorrectly "required"; served by Doc 27 instead)', () => {
    expect(doc26.getCategory('COMPETITIVE_SHOPPING')).toBe('not_applicable');
    expect(doc26.getCategoryLabel('COMPETITIVE_SHOPPING')).toBe('Không áp dụng');
  });

  it('is NOT applicable for OPEN_BIDDING (the fix -- was incorrectly "required"; served by Doc 12 instead)', () => {
    expect(doc26.getCategory('OPEN_BIDDING')).toBe('not_applicable');
    expect(doc26.getCategoryLabel('OPEN_BIDDING')).toBe('Không áp dụng');
  });

  it('is not applicable for DIRECT_50 (unchanged)', () => {
    expect(doc26.getCategory('DIRECT_50')).toBe('not_applicable');
  });
});

describe('Doc 26 — HTML content preserved for DIRECT_SELECTION_SIMPLIFIED', () => {
  it('HTML still cites Điều 80 Nghị định 214/2025 (unrelated citation preserved)', () => {
    const html = doc26.getHtml(pkgS1Wins, 'DIRECT_SELECTION_SIMPLIFIED');
    expect(html).toContain('Điều 80 Nghị định số 214/2025/NĐ-CP');
  });

  it('HTML renders without throwing', () => {
    expect(() => doc26.getHtml(pkgS1Wins, 'DIRECT_SELECTION_SIMPLIFIED')).not.toThrow();
  });
});

describe('Doc 26 — DOCX content preserved for DIRECT_SELECTION_SIMPLIFIED', () => {
  it('DOCX still cites Điều 80 (unrelated citation preserved)', async () => {
    const xml = await extractDocXml(doc26, pkgS1Wins, 'DIRECT_SELECTION_SIMPLIFIED');
    expect(xml).toContain('Điều 80');
  });
});
