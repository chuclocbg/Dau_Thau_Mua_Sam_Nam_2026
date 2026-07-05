/**
 * VietnamLegalStructureParser tests
 *
 * Groups (13 × 3 = 39):
 *   VLS-01  parseMetadata — symbol extraction
 *   VLS-02  parseMetadata — document type resolution
 *   VLS-03  parseMetadata — issuer authority mapping
 *   VLS-04  parseMetadata — effective date extraction
 *   VLS-05  parseArticles — article count
 *   VLS-06  parseArticles — article number and title
 *   VLS-07  parseArticles — article content capture
 *   VLS-08  parseClauses  — clause detection
 *   VLS-09  parseClauses  — clause numbering and content
 *   VLS-10  parsePoints   — point label extraction
 *   VLS-11  parseChapters — chapter detection and title
 *   VLS-12  parseAppendices — appendix extraction
 *   VLS-13  parse() — full document round-trip
 */

import { describe, it, expect } from 'vitest';
import {
  VietnamLegalStructureParser,
  parseMetadata,
  parseArticles,
  parseClauses,
  parsePoints,
  parseChapters,
  parseAppendices,
} from '../agents/VietnamLegalStructureParser';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const LUAT_HEADER = `QUỐC HỘI
CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
Số: 22/2023/QH15

LUẬT ĐẤU THẦU

Căn cứ Hiến pháp nước Cộng hòa xã hội chủ nghĩa Việt Nam;
Luật này có hiệu lực thi hành từ ngày 01 tháng 01 năm 2024.`;

const NGHI_DINH_HEADER = `CHÍNH PHỦ
CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Số: 214/2025/NĐ-CP

NGHỊ ĐỊNH
Quy định chi tiết một số điều và hướng dẫn thi hành Luật Đấu thầu

Nghị định này có hiệu lực từ ngày 01/07/2025.`;

const THONG_TU_HEADER = `BỘ TÀI CHÍNH
CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Số: 79/2025/TT-BTC

THÔNG TƯ
Quy định về thanh toán vốn đầu tư sử dụng ngân sách nhà nước`;

const ARTICLE_TEXT = `Điều 1. Phạm vi điều chỉnh
Luật này quy định về hoạt động đấu thầu bao gồm lựa chọn nhà thầu.

Điều 2. Đối tượng áp dụng
1. Tổ chức, cá nhân tham gia hoặc có liên quan đến hoạt động đấu thầu.
2. Luật này không áp dụng đối với các trường hợp sau đây:
a) Mua sắm trong nội bộ cơ quan nhà nước.
b) Mua sắm có giá trị nhỏ.

Điều 3. Giải thích từ ngữ
Trong Luật này, các từ ngữ dưới đây được hiểu như sau:
1. Đấu thầu là quá trình lựa chọn nhà thầu để thực hiện gói thầu.
2. Nhà thầu là tổ chức, cá nhân đáp ứng yêu cầu về năng lực.`;

const CHAPTER_TEXT = `Chương I
QUY ĐỊNH CHUNG

Điều 1. Phạm vi điều chỉnh
Luật này quy định về đấu thầu.

Chương II
LỰA CHỌN NHÀ THẦU

Điều 2. Phương thức lựa chọn nhà thầu
Có các phương thức sau đây.`;

const APPENDIX_TEXT = `Điều 96. Điều khoản thi hành
Luật này có hiệu lực từ ngày 01 tháng 01 năm 2024.

Phụ lục I
DANH MỤC CÁC GÓI THẦU ÁP DỤNG ĐẤU THẦU QUA MẠNG

Nội dung phụ lục danh mục gói thầu.

Phụ lục II
MẪU HỒ SƠ MỜI THẦU

Nội dung mẫu hồ sơ mời thầu.`;

// ─── VLS-01: parseMetadata — symbol extraction ────────────────────────────────

describe('VLS-01 parseMetadata extracts document symbol correctly', () => {
  it('extracts "22/2023/QH15" from Luật header', () => {
    expect(parseMetadata(LUAT_HEADER).symbol).toBe('22/2023/QH15');
  });
  it('extracts "214/2025/NĐ-CP" from Nghị định header', () => {
    expect(parseMetadata(NGHI_DINH_HEADER).symbol).toBe('214/2025/NĐ-CP');
  });
  it('extracts "79/2025/TT-BTC" from Thông tư header', () => {
    expect(parseMetadata(THONG_TU_HEADER).symbol).toBe('79/2025/TT-BTC');
  });
});

// ─── VLS-02: parseMetadata — document type resolution ────────────────────────

describe('VLS-02 parseMetadata resolves document type from authority code', () => {
  it('QH15 → documentType = LAW', () => {
    expect(parseMetadata(LUAT_HEADER).documentType).toBe('LAW');
  });
  it('NĐ-CP → documentType = DECREE', () => {
    expect(parseMetadata(NGHI_DINH_HEADER).documentType).toBe('DECREE');
  });
  it('TT-BTC → documentType = CIRCULAR', () => {
    expect(parseMetadata(THONG_TU_HEADER).documentType).toBe('CIRCULAR');
  });
});

// ─── VLS-03: parseMetadata — issuer authority mapping ────────────────────────

describe('VLS-03 parseMetadata maps authority code to issuer name', () => {
  it('QH15 → issuer = "Quốc hội"', () => {
    expect(parseMetadata(LUAT_HEADER).issuer).toBe('Quốc hội');
  });
  it('NĐ-CP → issuer = "Chính phủ"', () => {
    expect(parseMetadata(NGHI_DINH_HEADER).issuer).toBe('Chính phủ');
  });
  it('TT-BTC → issuer = "Bộ Tài chính"', () => {
    expect(parseMetadata(THONG_TU_HEADER).issuer).toBe('Bộ Tài chính');
  });
});

// ─── VLS-04: parseMetadata — effective date extraction ───────────────────────

describe('VLS-04 parseMetadata extracts effective date', () => {
  it('extracts 2024-01-01 from Vietnamese date format in Luật', () => {
    expect(parseMetadata(LUAT_HEADER).effectiveDate).toBe('2024-01-01');
  });
  it('extracts 2025-07-01 from DD/MM/YYYY format in Nghị định', () => {
    expect(parseMetadata(NGHI_DINH_HEADER).effectiveDate).toBe('2025-07-01');
  });
  it('returns null when no effective date found', () => {
    expect(parseMetadata('Số: 99/2026/TT-BXD\nThông tư xây dựng').effectiveDate).toBeNull();
  });
});

// ─── VLS-05: parseArticles — article count ───────────────────────────────────

describe('VLS-05 parseArticles returns correct article count', () => {
  it('returns 3 articles for 3-article fixture', () => {
    expect(parseArticles(ARTICLE_TEXT)).toHaveLength(3);
  });
  it('returns 0 articles when text has no Điều markers', () => {
    expect(parseArticles('This text has no articles')).toHaveLength(0);
  });
  it('returns 2 articles from chapter text', () => {
    expect(parseArticles(CHAPTER_TEXT)).toHaveLength(2);
  });
});

// ─── VLS-06: parseArticles — article number and title ────────────────────────

describe('VLS-06 parseArticles extracts article number and title', () => {
  it('article[0].number = 1', () => {
    expect(parseArticles(ARTICLE_TEXT)[0]!.number).toBe(1);
  });
  it('article[0].title = "Phạm vi điều chỉnh"', () => {
    expect(parseArticles(ARTICLE_TEXT)[0]!.title).toBe('Phạm vi điều chỉnh');
  });
  it('article[1].number = 2, article[2].number = 3', () => {
    const arts = parseArticles(ARTICLE_TEXT);
    expect(arts[1]!.number).toBe(2);
    expect(arts[2]!.number).toBe(3);
  });
});

// ─── VLS-07: parseArticles — article content ─────────────────────────────────

describe('VLS-07 parseArticles captures article content', () => {
  it('article[0].content is non-empty', () => {
    expect(parseArticles(ARTICLE_TEXT)[0]!.content.length).toBeGreaterThan(5);
  });
  it('article[1].content contains "Tổ chức"', () => {
    expect(parseArticles(ARTICLE_TEXT)[1]!.content).toContain('Tổ chức');
  });
  it('article[2].content contains "Đấu thầu"', () => {
    expect(parseArticles(ARTICLE_TEXT)[2]!.content).toContain('Đấu thầu');
  });
});

// ─── VLS-08: parseClauses — clause detection ─────────────────────────────────

describe('VLS-08 parseClauses detects numbered clauses', () => {
  it('article Điều 2 has 2 clauses', () => {
    const art = parseArticles(ARTICLE_TEXT).find(a => a.number === 2);
    expect(art!.clauses).toHaveLength(2);
  });
  it('article Điều 3 has 2 clauses', () => {
    const art = parseArticles(ARTICLE_TEXT).find(a => a.number === 3);
    expect(art!.clauses).toHaveLength(2);
  });
  it('article Điều 1 has 0 clauses (body has no numbered list)', () => {
    const art = parseArticles(ARTICLE_TEXT).find(a => a.number === 1);
    expect(art!.clauses).toHaveLength(0);
  });
});

// ─── VLS-09: parseClauses — clause numbering and content ─────────────────────

describe('VLS-09 parseClauses assigns correct numbers and content', () => {
  it('clause[0].number = 1', () => {
    const body = '1. Tổ chức, cá nhân tham gia.\n2. Luật này không áp dụng.';
    expect(parseClauses(body)[0]!.number).toBe(1);
  });
  it('clause[1].number = 2', () => {
    const body = '1. Tổ chức, cá nhân tham gia.\n2. Luật này không áp dụng.';
    expect(parseClauses(body)[1]!.number).toBe(2);
  });
  it('clause content is non-empty', () => {
    const body = '1. Tổ chức, cá nhân tham gia hoặc có liên quan.';
    expect(parseClauses(body)[0]!.content.length).toBeGreaterThan(0);
  });
});

// ─── VLS-10: parsePoints — point label extraction ────────────────────────────

describe('VLS-10 parsePoints extracts lettered points', () => {
  it('extracts point "a" from "a) Mua sắm nội bộ."', () => {
    const body = 'a) Mua sắm trong nội bộ.\nb) Mua sắm có giá trị nhỏ.';
    expect(parsePoints(body)[0]!.label).toBe('a');
  });
  it('extracts point "b" correctly', () => {
    const body = 'a) Mua sắm trong nội bộ.\nb) Mua sắm có giá trị nhỏ.';
    expect(parsePoints(body)[1]!.label).toBe('b');
  });
  it('returns 0 points when no lettered items', () => {
    const body = '1. Tổ chức tham gia.\n2. Không áp dụng.';
    expect(parsePoints(body)).toHaveLength(0);
  });
});

// ─── VLS-11: parseChapters — chapter detection ───────────────────────────────

describe('VLS-11 parseChapters detects chapters and titles', () => {
  it('returns 2 chapters from chapter fixture', () => {
    const arts = parseArticles(CHAPTER_TEXT);
    expect(parseChapters(CHAPTER_TEXT, arts)).toHaveLength(2);
  });
  it('chapter[0].number = "I"', () => {
    const arts = parseArticles(CHAPTER_TEXT);
    expect(parseChapters(CHAPTER_TEXT, arts)[0]!.number).toBe('I');
  });
  it('chapter[1].title contains "LỰA CHỌN"', () => {
    const arts = parseArticles(CHAPTER_TEXT);
    expect(parseChapters(CHAPTER_TEXT, arts)[1]!.title).toContain('LỰA CHỌN');
  });
});

// ─── VLS-12: parseAppendices — appendix extraction ───────────────────────────

describe('VLS-12 parseAppendices extracts appendix sections', () => {
  it('returns 2 appendices from appendix fixture', () => {
    const tail = APPENDIX_TEXT.slice(APPENDIX_TEXT.indexOf('Phụ lục'));
    expect(parseAppendices(tail)).toHaveLength(2);
  });
  it('appendix[0].number = "I"', () => {
    const tail = APPENDIX_TEXT.slice(APPENDIX_TEXT.indexOf('Phụ lục'));
    expect(parseAppendices(tail)[0]!.number).toBe('I');
  });
  it('appendix[0].title contains "DANH MỤC"', () => {
    const tail = APPENDIX_TEXT.slice(APPENDIX_TEXT.indexOf('Phụ lục'));
    expect(parseAppendices(tail)[0]!.title).toContain('DANH MỤC');
  });
});

// ─── VLS-13: parse() — full document round-trip ──────────────────────────────

describe('VLS-13 VietnamLegalStructureParser.parse() full document', () => {
  const parser = new VietnamLegalStructureParser();
  const full   = LUAT_HEADER + '\n\n' + CHAPTER_TEXT + '\n\n' + APPENDIX_TEXT;

  it('parse() returns metadata with correct symbol', () => {
    expect(parser.parse(full).metadata.symbol).toBe('22/2023/QH15');
  });
  it('parse() articles array has articles', () => {
    expect(parser.parse(LUAT_HEADER + '\n\n' + ARTICLE_TEXT).articles.length).toBeGreaterThan(0);
  });
  it('parse() returns ParsedDocument with all required fields', () => {
    const result = parser.parse(LUAT_HEADER + '\n\n' + ARTICLE_TEXT);
    expect(result).toHaveProperty('metadata');
    expect(result).toHaveProperty('chapters');
    expect(result).toHaveProperty('articles');
    expect(result).toHaveProperty('appendices');
  });
});
