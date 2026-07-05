/**
 * LegalTextExtractor — converts PDF/DOCX/HTML to plain text for structure parsing.
 *
 * extractText()  — plain text passthrough (normalises line endings)
 * extractHtml()  — strips HTML tags via DOMParser (browser/jsdom compatible)
 * extractDocx()  — unzips word/document.xml via jszip, strips XML tags
 * extractByFormat() — dispatches to the right extractor
 * detectFormat() — infers format from filename or MIME type
 *
 * PDF note: full PDF binary extraction (pdfjs-dist) is deferred.
 *   For now, extractPdf() accepts pre-extracted text strings or base64 blobs
 *   that have already been converted to text by the calling layer.
 *   This matches real usage: Vietnamese govt portals publish HTML/DOCX first.
 *
 * No side effects. No HTTP. No Node.js fs.
 */

import JSZip from 'jszip';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DocFormat = 'TEXT' | 'HTML' | 'DOCX' | 'PDF';

export interface ExtractResult {
  readonly text:   string;
  readonly format: DocFormat;
  readonly pages:  number;    // 0 when unknown
}

// ─── Format detection ─────────────────────────────────────────────────────────

export function detectFormat(hint: string): DocFormat {
  const lower = hint.toLowerCase();
  if (lower.endsWith('.docx') || lower === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'DOCX';
  if (lower.endsWith('.pdf')  || lower === 'application/pdf') return 'PDF';
  if (lower.endsWith('.html') || lower.endsWith('.htm')  || lower === 'text/html') return 'HTML';
  return 'TEXT';
}

// ─── Plain text ───────────────────────────────────────────────────────────────

export function extractText(raw: string): ExtractResult {
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  return { text, format: 'TEXT', pages: 0 };
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

export function extractHtml(html: string): ExtractResult {
  if (!html.trim()) return { text: '', format: 'HTML', pages: 0 };

  // DOMParser is available in browser + jsdom environments
  const doc  = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body ?? doc.documentElement;

  // Replace block elements with newlines before extracting text
  const blockTags = ['P', 'DIV', 'BR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
                     'LI', 'TR', 'TD', 'TH', 'SECTION', 'ARTICLE'];
  for (const tag of blockTags) {
    for (const el of Array.from(body.getElementsByTagName(tag))) {
      el.prepend(doc.createTextNode('\n'));
    }
  }

  const raw  = body.textContent ?? '';
  const text = raw.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return { text, format: 'HTML', pages: 0 };
}

// ─── DOCX ─────────────────────────────────────────────────────────────────────

export async function extractDocx(buffer: ArrayBuffer): Promise<ExtractResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error('Invalid DOCX: cannot unzip buffer');
  }

  const xmlFile = zip.file('word/document.xml');
  if (!xmlFile) throw new Error('Invalid DOCX: word/document.xml not found');

  const xml = await xmlFile.async('text');

  // Replace paragraph/run markers with newlines, then strip all XML tags
  const withBreaks = xml
    .replace(/<w:p[ >]/g, '\n<w:p ')   // paragraph → newline
    .replace(/<w:br\/>/g, '\n');        // explicit break

  const text = withBreaks
    .replace(/<[^>]+>/g, '')            // strip all tags
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { text, format: 'DOCX', pages: 0 };
}

// ─── PDF (pre-extracted text) ─────────────────────────────────────────────────

export function extractPdfText(text: string): ExtractResult {
  // ponytail: full pdfjs-dist integration deferred; accept pre-extracted text.
  // Vietnamese govt portals provide DOCX/HTML alongside PDF; use those first.
  return extractText(text);
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function extractByFormat(
  input:  string | ArrayBuffer,
  format: DocFormat,
): Promise<ExtractResult> {
  switch (format) {
    case 'HTML':
      return extractHtml(input as string);
    case 'DOCX':
      return extractDocx(input as ArrayBuffer);
    case 'PDF':
      return extractPdfText(input as string);
    default:
      return extractText(input as string);
  }
}
