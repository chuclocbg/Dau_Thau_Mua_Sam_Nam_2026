/**
 * Integration tests — P1-09: Doc 25 "Bản cam kết không xung đột lợi ích".
 *
 * This document did not exist before P1-09. It is required for
 * COMPETITIVE_SHOPPING and OPEN_BIDDING per Điều 16 Luật Đấu thầu 22/2023.
 *
 * Tests verify:
 * 1. The document exists in documentTemplates as id=25
 * 2. Category logic is correct per method type
 * 3. HTML contains all committee members, all bidders, and Article 16 citation
 * 4. DOCX generation does not throw
 */
import { describe, it, expect } from 'vitest';
import { documentTemplates } from '../docTemplates';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { pkgS1Wins } from './fixtures';

const doc25 = documentTemplates.find(d => d.id === 25)!;

const extractDocXml = async (): Promise<string> => {
  const docxDoc = doc25.getDocx(pkgS1Wins, 'COMPETITIVE_SHOPPING');
  const buffer = await Packer.toBuffer(docxDoc);
  const zip = await JSZip.loadAsync(buffer as ArrayBuffer);
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('word/document.xml not found in DOCX');
  return file.async('string');
};

describe('Doc 25 — existence and identity (P1-09)', () => {
  it('doc 25 exists in documentTemplates', () => {
    expect(doc25).toBeDefined();
  });

  it('has the correct name', () => {
    expect(doc25.name).toBe('Bản cam kết không xung đột lợi ích');
  });

  it('is the last document — id 25 follows id 24', () => {
    const ids = documentTemplates.map(d => d.id);
    expect(ids).toContain(25);
    const idx24 = ids.indexOf(24);
    const idx25 = ids.indexOf(25);
    expect(idx25).toBe(idx24 + 1);
  });
});

describe('Doc 25 — category logic per procurement method (P1-09)', () => {
  it('required for COMPETITIVE_SHOPPING', () => {
    expect(doc25.getCategory('COMPETITIVE_SHOPPING')).toBe('required');
  });

  it('required for OPEN_BIDDING', () => {
    expect(doc25.getCategory('OPEN_BIDDING')).toBe('required');
  });

  it('recommended for DIRECT_SELECTION_SIMPLIFIED', () => {
    expect(doc25.getCategory('DIRECT_SELECTION_SIMPLIFIED')).toBe('recommended');
  });

  it('not applicable for DIRECT_50', () => {
    expect(doc25.getCategory('DIRECT_50')).toBe('not_applicable');
  });
});

describe('Doc 25 — HTML content (P1-09)', () => {
  it('HTML renders without throwing', () => {
    expect(() => doc25.getHtml(pkgS1Wins, 'COMPETITIVE_SHOPPING')).not.toThrow();
  });

  it('HTML contains all three committee members', () => {
    const html = doc25.getHtml(pkgS1Wins, 'COMPETITIVE_SHOPPING');
    expect(html).toContain(pkgS1Wins.expertTeamLeader.split(' (')[0]);
    expect(html).toContain(pkgS1Wins.expertTeamMember1.split(' (')[0]);
    expect(html).toContain(pkgS1Wins.expertTeamMember2.split(' (')[0]);
  });

  it('HTML lists all three bidder names', () => {
    const html = doc25.getHtml(pkgS1Wins, 'COMPETITIVE_SHOPPING');
    expect(html).toContain(pkgS1Wins.supplier1Name);
    expect(html).toContain(pkgS1Wins.supplier2Name);
    expect(html).toContain(pkgS1Wins.supplier3Name);
  });

  it('HTML cites Article 16 of Procurement Law 22/2023', () => {
    const html = doc25.getHtml(pkgS1Wins, 'COMPETITIVE_SHOPPING');
    expect(html).toContain('Điều 16');
    expect(html).toContain('22/2023/QH15');
  });

  it('HTML cites NĐ 214/2025', () => {
    const html = doc25.getHtml(pkgS1Wins, 'COMPETITIVE_SHOPPING');
    expect(html).toContain('214/2025');
  });

  it('HTML contains the package name', () => {
    const html = doc25.getHtml(pkgS1Wins, 'COMPETITIVE_SHOPPING');
    expect(html).toContain(pkgS1Wins.packageName);
  });

  it('HTML contains the 5 numbered commitments', () => {
    const html = doc25.getHtml(pkgS1Wins, 'COMPETITIVE_SHOPPING');
    for (let i = 1; i <= 5; i++) {
      expect(html).toContain(`<b>${i}.</b>`);
    }
  });

  it('audit risk mentions Article 16', () => {
    const risk = doc25.getAuditRisk(pkgS1Wins);
    expect(risk).toContain('Điều 16');
    expect(risk).toContain('22/2023');
  });
});

describe('Doc 25 — DOCX generation (P1-09)', () => {
  it('getDocx does not throw', () => {
    expect(() => doc25.getDocx(pkgS1Wins, 'COMPETITIVE_SHOPPING')).not.toThrow();
  });

  it('DOCX XML contains "không xung đột lợi ích"', async () => {
    const xml = await extractDocXml();
    expect(xml.toLowerCase()).toContain('không xung đột lợi ích');
  });

  it('DOCX XML contains the committee leader name', async () => {
    const xml = await extractDocXml();
    expect(xml).toContain(pkgS1Wins.expertTeamLeader.split(' (')[0]);
  });

  it('DOCX XML contains Article 16 citation', async () => {
    const xml = await extractDocXml();
    expect(xml).toContain('Điều 16');
  });
});
