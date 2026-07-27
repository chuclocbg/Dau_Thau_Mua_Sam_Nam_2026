/**
 * VietnamLegalStructureParser — pure text-to-structure parser for Vietnamese legal documents.
 *
 * Parses plain text (extracted from PDF/DOCX/HTML) into a structured document.
 * Supports: Luật, Nghị định, Thông tư, Quyết định.
 *
 * Structural hierarchy:
 *   Chương (Chapter) → Điều (Article) → Khoản (Clause) → Điểm (Point)
 *   Phụ lục (Appendix) parsed separately.
 *
 * No I/O. No side effects. Pure.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type VietnamDocType =
  | 'LAW'
  | 'DECREE'
  | 'CIRCULAR'
  | 'DECISION'
  | 'RESOLUTION'
  | 'UNKNOWN';

export interface DocumentMetadata {
  readonly symbol:        string;          // "22/2023/QH15"
  readonly documentType:  VietnamDocType;
  readonly issuer:        string;          // "Quốc hội"
  readonly title:         string;
  readonly signDate:      string | null;   // YYYY-MM-DD
  readonly effectiveDate: string | null;   // YYYY-MM-DD
}

export interface ParsedPoint {
  readonly label:   string;   // 'a', 'b', 'c'
  readonly content: string;
}

export interface ParsedClause {
  readonly number:  number;
  readonly content: string;
  readonly points:  readonly ParsedPoint[];
}

export interface ParsedArticle {
  readonly number:  number;
  readonly title:   string;
  readonly content: string;
  readonly clauses: readonly ParsedClause[];
}

export interface ParsedChapter {
  readonly number:   string;   // 'I', 'II', '1', '2'
  readonly title:    string;
  readonly articles: readonly ParsedArticle[];
}

export interface ParsedAppendix {
  readonly number:  string;
  readonly title:   string;
  readonly content: string;
}

export interface ParsedDocument {
  readonly metadata:   DocumentMetadata;
  readonly chapters:   readonly ParsedChapter[];
  readonly articles:   readonly ParsedArticle[];
  readonly appendices: readonly ParsedAppendix[];
}

// ─── Symbol / authority mappings ──────────────────────────────────────────────

const AUTHORITY_ISSUER: Record<string, string> = {
  QH15:      'Quốc hội',
  QH14:      'Quốc hội',
  QH13:      'Quốc hội',
  'NĐ-CP':   'Chính phủ',
  'ND-CP':   'Chính phủ',
  TTg:       'Thủ tướng Chính phủ',
  'TT-BTC':  'Bộ Tài chính',
  'TT-BCT':  'Bộ Công Thương',
  'TT-BKHĐT':'Bộ Kế hoạch và Đầu tư',
  'TT-BYT':  'Bộ Y tế',
  'TT-BGDĐT':'Bộ Giáo dục và Đào tạo',
  'TT-BXD':  'Bộ Xây dựng',
  'TT-BTNMT':'Bộ Tài nguyên và Môi trường',
  'TT-BTTTT':'Bộ Thông tin và Truyền thông',
};

function resolveIssuer(authorityCode: string): string {
  return AUTHORITY_ISSUER[authorityCode] ?? authorityCode;
}

function resolveDocType(authorityCode: string): VietnamDocType {
  if (/^QH/.test(authorityCode))    return 'LAW';
  if (/NĐ-CP|ND-CP/.test(authorityCode)) return 'DECREE';
  if (/^TT-/.test(authorityCode))   return 'CIRCULAR';
  if (/^QĐ-|TTg/.test(authorityCode)) return 'DECISION';
  if (/NQ-/.test(authorityCode))    return 'RESOLUTION';
  return 'UNKNOWN';
}

// ─── Regex patterns ───────────────────────────────────────────────────────────

// "22/2023/QH15" or "214/2025/NĐ-CP"
const SYMBOL_RE = /(\d+)\/(\d{4})\/([A-ZĐÁÂÊÔƠƯ0-9][\w\-ĐÁÂÊÔƠƯđáâêôơư]*)/;

// "Điều 43. Title text" or "Điều 43 Title text"
const ARTICLE_RE  = /^Điều\s+(\d+)\.?\s*(.*)$/m;

// "Phụ lục" or "PHỤ LỤC"
const APPENDIX_RE = /(?:Phụ\s+lục|PHỤ\s+LỤC)\s*([IVX\d]*)\s*(.*?)$/m;

// Date patterns: "01 tháng 01 năm 2024" or "01/01/2024"
const VN_DATE_RE    = /(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/;
const ISO_DATE_RE   = /(\d{2})\/(\d{2})\/(\d{4})/;

// Clause start: "1. " at start of line (paragraph number)
const CLAUSE_START_RE = /^(\d+)\.\s+(.+)/;

// Point start: "a) " at start of line
const POINT_START_RE = /^([a-zđ])\)\s+(.+)/;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseVnDate(text: string): string | null {
  const m = text.match(VN_DATE_RE);
  if (m) {
    const [, d, mo, y] = m;
    return `${y!}-${mo!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
  }
  const m2 = text.match(ISO_DATE_RE);
  if (m2) {
    const [, d, mo, y] = m2;
    return `${y!}-${mo!}-${d!}`;
  }
  return null;
}

function extractTitle(text: string): string {
  // Title is the first substantial non-blank line that isn't a header code
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    // Skip document number lines, republic headers, etc.
    if (SYMBOL_RE.test(line)) continue;
    if (/^(CỘNG HÒA|Độc lập|Số:|QUỐC HỘI|CHÍNH PHỦ|BỘ)/.test(line)) continue;
    if (line.length > 10 && line.length < 300) return line;
  }
  return '';
}

// ─── Core parsers ─────────────────────────────────────────────────────────────

export function parseMetadata(text: string): DocumentMetadata {
  const symMatch = text.match(SYMBOL_RE);
  const symbol   = symMatch ? symMatch[0] : '';
  const authCode = symMatch ? symMatch[3]! : '';

  const effectiveLine = text.match(
    /có hiệu lực(?:\s+thi\s+hành)?\s+(?:từ\s+)?(?:ngày\s+)?(.{5,30})/i,
  );
  const signLine = text.match(/ngày\s+(.{5,30}?)(?:\n|\.)/);

  return {
    symbol,
    documentType:  resolveDocType(authCode),
    issuer:        resolveIssuer(authCode),
    title:         extractTitle(text),
    signDate:      signLine      ? parseVnDate(signLine[1]!)      : null,
    effectiveDate: effectiveLine ? parseVnDate(effectiveLine[1]!) : null,
  };
}

export function parseArticles(text: string): ParsedArticle[] {
  // Split on "Điều N" boundaries; skip text before first Điều
  const parts = text.split(/(?=^Điều\s+\d+)/m);
  const articles: ParsedArticle[] = [];

  for (const part of parts) {
    const headerMatch = part.match(ARTICLE_RE);
    if (!headerMatch) continue;

    const number  = parseInt(headerMatch[1]!, 10);
    const title   = headerMatch[2]!.trim();
    const body    = part.slice(part.indexOf('\n') + 1).trim();

    articles.push({
      number,
      title,
      content: body,
      clauses: parseClauses(body),
    });
  }

  return articles;
}

export function parseClauses(articleBody: string): ParsedClause[] {
  const lines   = articleBody.split('\n');
  const clauses: ParsedClause[] = [];
  let current:   { number: number; lines: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const body = current.lines.join('\n').trim();
    clauses.push({
      number:  current.number,
      content: body,
      points:  parsePoints(body),
    });
    current = null;
  };

  for (const line of lines) {
    const m = line.trim().match(CLAUSE_START_RE);
    if (m) {
      flush();
      current = { number: parseInt(m[1]!, 10), lines: [m[2]!] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  flush();

  return clauses;
}

export function parsePoints(clauseBody: string): ParsedPoint[] {
  const lines  = clauseBody.split('\n');
  const points: ParsedPoint[] = [];
  let current: { label: string; lines: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    points.push({ label: current.label, content: current.lines.join(' ').trim() });
    current = null;
  };

  for (const line of lines) {
    const m = line.trim().match(POINT_START_RE);
    if (m) {
      flush();
      current = { label: m[1]!, lines: [m[2]!] };
    } else if (current) {
      current.lines.push(line.trim());
    }
  }
  flush();

  return points;
}

export function parseChapters(text: string, articles: ParsedArticle[]): ParsedChapter[] {
  // Split on chapter boundaries; map each chapter's article range
  const chapterMatches = [...text.matchAll(
    /^(?:Chương|CHƯƠNG)\s+([IVX\d]+)\s*(.*?)$/gm,
  )];

  if (chapterMatches.length === 0) return [];

  // For each chapter, find which articles fall within its text segment
  const segments = chapterMatches.map((m, i) => ({
    number:    m[1]!,
    title:     m[2]!.trim(),
    textStart: m.index!,
    textEnd:   chapterMatches[i + 1]?.index ?? text.length,
  }));

  // Find article numbers that appear within each chapter's text range
  const articlePositions = [...text.matchAll(/^Điều\s+(\d+)/gm)].map(m => ({
    number:   parseInt(m[1]!, 10),
    position: m.index!,
  }));

  return segments.map(seg => ({
    number:   seg.number,
    title:    seg.title,
    articles: articles.filter(a => {
      const pos = articlePositions.find(p => p.number === a.number);
      return pos && pos.position >= seg.textStart && pos.position < seg.textEnd;
    }),
  }));
}

export function parseAppendices(text: string): ParsedAppendix[] {
  const parts = text.split(/(?=^(?:Phụ\s+lục|PHỤ\s+LỤC)\s*[IVX\d]*)/mi);
  const appendices: ParsedAppendix[] = [];

  for (const part of parts) {
    const m = part.match(APPENDIX_RE);
    if (!m) continue;
    appendices.push({
      number:  m[1]! || '1',
      title:   m[2]!.trim(),
      content: part.slice(part.indexOf('\n') + 1).trim(),
    });
  }

  return appendices;
}

// ─── Main class ───────────────────────────────────────────────────────────────

export class VietnamLegalStructureParser {
  parse(text: string): ParsedDocument {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Split off appendices (everything after last Điều)
    const appendixIdx = normalized.search(/^(?:Phụ\s+lục|PHỤ\s+LỤC)/mi);
    const mainText    = appendixIdx > 0 ? normalized.slice(0, appendixIdx) : normalized;
    const tailText    = appendixIdx > 0 ? normalized.slice(appendixIdx)    : '';

    const metadata   = parseMetadata(mainText);
    const articles   = parseArticles(mainText);
    const chapters   = parseChapters(mainText, articles);
    const appendices = parseAppendices(tailText || mainText);

    return { metadata, chapters, articles, appendices };
  }
}
