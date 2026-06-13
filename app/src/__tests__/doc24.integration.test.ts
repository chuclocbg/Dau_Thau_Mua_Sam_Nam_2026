/**
 * Integration tests — P1-05: Doc 24 DOCX status column.
 *
 * Before P1-05 the DOCX status column read "Đã hoàn thành" for all four
 * publication obligations — a false declaration that the obligations had been
 * completed before the dossier was even created.
 *
 * After P1-05 the column header was renamed to
 * "Ngày đăng tải thực tế (điền sau khi thực hiện)" and each cell contains
 * a blank date placeholder "Ngày ..... tháng ..... năm .....".
 *
 * To inspect DOCX content we use Packer.toBuffer() + JSZip to extract the
 * underlying word/document.xml and search it as plain text.
 */
import { describe, it, expect } from 'vitest';
import { documentTemplates } from '../docTemplates';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { pkgS1Wins } from './fixtures';

const doc24 = documentTemplates.find(d => d.id === 24)!;

const extractDocXml = async (docConfig: typeof doc24, pkg: typeof pkgS1Wins): Promise<string> => {
  const docxDoc = docConfig.getDocx(pkg, 'COMPETITIVE_SHOPPING');
  const buffer = await Packer.toBuffer(docxDoc);
  const zip = await JSZip.loadAsync(buffer as ArrayBuffer);
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('word/document.xml not found in DOCX');
  return file.async('string');
};

describe('Doc 24 — exists and basic structure', () => {
  it('doc 24 exists in documentTemplates', () => {
    expect(doc24).toBeDefined();
    expect(doc24.name).toBe('Checklist đăng tải trên Hệ thống mạng đấu thầu quốc gia');
  });

  it('is required for COMPETITIVE_SHOPPING and OPEN_BIDDING', () => {
    expect(doc24.getCategory('COMPETITIVE_SHOPPING')).toBe('required');
    expect(doc24.getCategory('OPEN_BIDDING')).toBe('required');
  });

  it('is not applicable for DIRECT_50', () => {
    expect(doc24.getCategory('DIRECT_50')).toBe('not_applicable');
  });
});

describe('Doc 24 — HTML does not contain false completion claim', () => {
  it('HTML does not contain "Đã hoàn thành"', () => {
    const html = doc24.getHtml(pkgS1Wins, 'COMPETITIVE_SHOPPING');
    expect(html).not.toContain('Đã hoàn thành');
    expect(html).not.toContain('Hoàn thành');
  });

  it('HTML renders without throwing', () => {
    expect(() => doc24.getHtml(pkgS1Wins, 'COMPETITIVE_SHOPPING')).not.toThrow();
  });
});

describe('Doc 24 DOCX — status column contains blank placeholders (P1-05)', () => {
  it('DOCX contains blank date placeholder, not "Đã hoàn thành"', async () => {
    const xml = await extractDocXml(doc24, pkgS1Wins);
    expect(xml).not.toContain('Đã hoàn thành');
    expect(xml).toContain('Ngày ..... tháng ..... năm .....');
  });

  it('DOCX column header mentions "điền sau khi thực hiện"', async () => {
    const xml = await extractDocXml(doc24, pkgS1Wins);
    expect(xml).toContain('điền sau khi thực hiện');
  });

  it('DOCX contains all 4 obligation rows', async () => {
    const xml = await extractDocXml(doc24, pkgS1Wins);
    expect(xml).toContain('Kế hoạch lựa chọn nhà thầu');
    expect(xml).toContain('Hồ sơ mời thầu');
    expect(xml).toContain('Kết quả lựa chọn nhà thầu');
    expect(xml).toContain('kết quả thực hiện hợp đồng');
  });

  it('DOCX placeholder appears exactly 4 times (one per obligation row)', async () => {
    const xml = await extractDocXml(doc24, pkgS1Wins);
    const matches = xml.match(/Ngày \.\.\.\.\. tháng \.\.\.\.\. năm \.\.\.\.\./g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(4);
  });
});
