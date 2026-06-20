/**
 * Legal Knowledge Base Pipeline — Legal v1.1
 *
 * Scans Legal/ directory recursively, extracts text from .md and .docx files,
 * chunks long documents, and generates app/src/ai/legalKnowledgeBase.ts.
 *
 * Usage:
 *   npm run build:legal                          # dry-run: print generated source
 *   npm run build:legal -- --write               # overwrite legalKnowledgeBase.ts
 *   npm run build:legal -- --legal-dir <path>    # custom Legal directory
 *   npm run build:legal -- --output <path>       # custom output file
 *
 * All exported functions are tested in legal-kb-pipeline.test.ts.
 * Existing legalKnowledgeBase.ts is NOT modified unless --write is passed.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

// ─── Public types ──────────────────────────────────────────────────────────────

export interface DocFile {
  absPath: string;
  relPath: string;     // relative to Legal/ root
  ext: '.md' | '.docx';
  name: string;        // basename without extension
}

export interface DocumentMetadata {
  id: string;
  title: string;
  category: string;    // Laws | Decrees | Circulars | VBHN | Forms | SchoolRegulations | ProcurementExamples | root
  sourceFile: string;  // relPath
  keywords: string[];
  effectiveDate: string;
  content: string;     // cleaned body text
  isPlaceholder: boolean;
}

// Matches the LegalEntry shape in legalKnowledgeBase.ts — must stay in sync
export interface LegalEntry {
  id: string;
  title: string;
  source: string;
  keywords: string[];
  content: string;
  appliesTo?: string[];
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const PLACEHOLDER_SIGNALS = [
  'File này là placeholder',
  'YÊU CẦU HÀNH ĐỘNG',
  'cần được tải từ nguồn chính thức',
];

const SUPPORTED_EXTS = new Set(['.md', '.docx']);

// Vietnamese + English stop words for keyword extraction
const STOP_WORDS = new Set([
  'và', 'của', 'trong', 'là', 'có', 'được', 'theo', 'với', 'về', 'cho', 'đến',
  'từ', 'này', 'các', 'một', 'không', 'khi', 'tại', 'như', 'sau', 'đã',
  'việc', 'hoặc', 'nếu', 'thì', 'đó', 'quy', 'định', 'điều', 'khoản',
  'the', 'and', 'or', 'to', 'of', 'in', 'for', 'is', 'are', 'be',
  'quy', 'pháp', 'luật', 'phải', 'thực', 'hiện', 'phạm', 'vi', 'trường',
  'hợp', 'đơn', 'vị', 'cơ', 'quan', 'nhà', 'nước', 'chính', 'phủ',
]);

const CATEGORY_APPLIESTO: Record<string, string[]> = {
  Laws:                  ['legal-review', 'khlcnt', 'authority'],
  Decrees:               ['procurement', 'budget-planning', 'khlcnt'],
  Circulars:             ['publication', 'payment', 'khlcnt'],
  VBHN:                  ['legal-review', 'khlcnt', 'authority'],
  Forms:                 ['documentation'],
  SchoolRegulations:     ['authority', 'budget-planning'],
  ProcurementExamples:   ['procurement'],
  root:                  ['legal-review'],
};

// ─── Scanner (Phase C) ─────────────────────────────────────────────────────────

/**
 * Recursively scans a directory and returns all supported .md and .docx files.
 * Unsupported file types are silently ignored.
 */
export function scanLegalDir(legalDir: string): DocFile[] {
  const results: DocFile[] = [];
  walk(legalDir, legalDir, results);
  return results.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

function walk(rootDir: string, currentDir: string, out: DocFile[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return; // unreadable directory — skip gracefully
  }
  for (const entry of entries) {
    const full = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      walk(rootDir, full, out);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === '.md' || ext === '.docx') {
        out.push({
          absPath: full,
          relPath: path.relative(rootDir, full).replace(/\\/g, '/'),
          ext: ext as '.md' | '.docx',
          name: path.basename(entry.name, ext),
        });
      }
      // unsupported files (.pdf, .png, etc.) silently ignored
    }
  }
}

// ─── Readers ───────────────────────────────────────────────────────────────────

export function readMdText(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Extracts plain text from a .docx file using JSZip.
 * Strips XML tags and normalises whitespace.
 */
export async function readDocxText(filePath: string): Promise<string> {
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);
  const xmlFile = zip.file('word/document.xml');
  if (!xmlFile) return '';
  const xml = await xmlFile.async('string');
  return xmlToPlainText(xml);
}

function xmlToPlainText(xml: string): string {
  // Insert spaces before paragraph/run tags so words don't fuse
  const spaced = xml
    .replace(/<w:p[ >]/g, '\n<w:p ')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:br[^>]*\/>/g, '\n');
  // Strip all XML tags
  const stripped = spaced.replace(/<[^>]+>/g, '');
  // Normalise whitespace (preserve newlines)
  return stripped
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

// ─── Metadata Extractor (Phase D) ──────────────────────────────────────────────

/**
 * Extracts structured metadata from a raw document file.
 * Works for both .md and (text-extracted) .docx content.
 */
export function extractMetadata(file: DocFile, rawText: string): DocumentMetadata {
  const isPlaceholder = PLACEHOLDER_SIGNALS.some(s => rawText.includes(s));

  // Category from directory (first path component)
  const parts = file.relPath.split('/');
  const category = parts.length > 1 ? (parts[0] ?? 'root') : 'root';

  // Title: from first # heading, or fallback to filename
  const titleMatch = rawText.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : file.name;

  // Effective date from metadata fields
  const dateMatch = rawText.match(/\*\*(?:Ngày|Năm)\s+ban\s+hành[^:]*:\*\*\s*(.+)/);
  const effectiveDate = dateMatch ? dateMatch[1].trim() : '';

  // Body: remove frontmatter-style metadata lines and HTML-style bold fields
  const body = rawText
    .replace(/^#+\s+.+$/gm, '')                     // remove headings
    .replace(/^\*\*[^*]+:\*\*.*$/gm, '')             // remove **Field:** lines
    .replace(/^\|[^\n]*\|/gm, '')                    // remove table rows
    .replace(/^[-*]\s+https?:\/\/\S+/gm, '')         // remove URL-only bullets
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const keywords = textToKeywords(body.length > 100 ? body : rawText, 8);

  // Deterministic ID from relative file path
  const id = pathToId(file.relPath);

  return {
    id,
    title,
    category,
    sourceFile: file.relPath,
    keywords,
    effectiveDate,
    content: body,
    isPlaceholder,
  };
}

function pathToId(relPath: string): string {
  return 'doc-' + relPath
    .replace(/\\/g, '/')
    .replace(/\.[^.]+$/, '')          // remove extension
    .toLowerCase()
    .replace(/[^\w/]+/g, '-')         // non-word chars → dash
    .replace(/\/+/g, '-')             // slashes → dash
    .replace(/-+/g, '-')              // collapse dashes
    .replace(/^-|-$/g, '')            // trim leading/trailing dashes
    .slice(0, 60);                    // cap length
}

// ─── Keyword Extractor ─────────────────────────────────────────────────────────

/**
 * Extracts top-N meaningful keywords from text using token frequency.
 */
export function textToKeywords(text: string, limit = 8): string[] {
  const tokens = tokenize(text);
  const freq: Map<string, number> = new Map();
  for (const t of tokens) {
    if (!STOP_WORDS.has(t) && t.length >= 4) {
      freq.set(t, (freq.get(t) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([t]) => t);
}

/** Same normalisation as legalKnowledgeBase.ts BM25 engine */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3);
}

// ─── Chunker (Phase E) ─────────────────────────────────────────────────────────

/**
 * Splits a document body into chunks of ≤ maxWords words each.
 * Tries to split at section boundaries (## headings or "Điều X.") first,
 * then falls back to paragraph (\n\n) boundaries.
 * Each chunk includes a brief heading path prefix for context.
 */
export function chunkText(text: string, maxWords = 1500): string[] {
  if (countWords(text) <= maxWords) return text.trim() ? [text.trim()] : [];

  // Split at section headers: ## heading or Điều N.
  const sections = splitAtSections(text);
  const chunks: string[] = [];
  let buffer = '';

  for (const section of sections) {
    const candidate = buffer ? buffer + '\n\n' + section : section;
    if (countWords(candidate) <= maxWords) {
      buffer = candidate;
    } else {
      if (buffer) chunks.push(buffer.trim());
      // If this single section is too large, split at paragraphs
      if (countWords(section) > maxWords) {
        chunks.push(...splitAtParagraphs(section, maxWords));
        buffer = '';
      } else {
        buffer = section;
      }
    }
  }
  if (buffer.trim()) chunks.push(buffer.trim());

  return chunks.filter(c => c.length > 0);
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function splitAtSections(text: string): string[] {
  // Split at ## headings and at "Điều N." patterns at line start
  const parts = text.split(/(?=\n(?:#{2,}\s|\*\*(?:Điều|Chương|Phần|Mục)\s))/);
  return parts.map(p => p.trim()).filter(Boolean);
}

function splitAtParagraphs(text: string, maxWords: number): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let buf = '';
  for (const para of paragraphs) {
    const candidate = buf ? buf + '\n\n' + para : para;
    if (countWords(candidate) <= maxWords) {
      buf = candidate;
    } else {
      if (buf) chunks.push(buf.trim());
      buf = countWords(para) > maxWords ? hardSplit(para, maxWords) : para;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks.filter(Boolean);
}

function hardSplit(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  return words.slice(0, maxWords).join(' ');
}

// ─── Entry Generator (Phase F) ────────────────────────────────────────────────

/**
 * Creates a LegalEntry from document metadata and a text chunk.
 */
export function makeEntry(
  meta: DocumentMetadata,
  content: string,
  chunkIdx: number,
  totalChunks: number,
): LegalEntry {
  const id = totalChunks > 1
    ? `${meta.id}-c${String(chunkIdx + 1).padStart(3, '0')}`
    : meta.id;

  const source = meta.effectiveDate
    ? `${meta.title} (${meta.effectiveDate})`
    : meta.title;

  const keywords = content.length > 50
    ? textToKeywords(content, 8)
    : meta.keywords;

  const appliesTo = CATEGORY_APPLIESTO[meta.category] ?? ['legal-review'];

  return {
    id,
    title: totalChunks > 1
      ? `${meta.title} [phần ${chunkIdx + 1}/${totalChunks}]`
      : meta.title,
    source,
    keywords: keywords.length >= 2 ? keywords : [...keywords, meta.category],
    content: content.slice(0, 3000),   // cap at 3000 chars per entry
    appliesTo,
  };
}

// ─── Source Generator ──────────────────────────────────────────────────────────

// Preserved verbatim from the current legalKnowledgeBase.ts — the search engine
// that ChatAgent and LegalReviewerAgent depend on.
const SEARCH_ENGINE_SOURCE = `
// ─── Search Engine ─────────────────────────────────────────────────────────────

// Minimum 3 chars to avoid noise from short tokens
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^\\w\\s]/g, ' ')
    .split(/\\s+/)
    .filter(t => t.length >= 3);
}

const MIN_SCORE_THRESHOLD = 4;

function scoreEntry(query: string, entry: LegalEntry): number {
  const qTokens = tokenize(query);
  const entryText = [entry.title, ...entry.keywords, entry.content, entry.source]
    .join(' ')
    .toLowerCase();
  const entryTokens = tokenize(entryText);

  let score = 0;
  for (const qt of qTokens) {
    const kwMatch = entry.keywords.some(kw => kw.toLowerCase().includes(qt));
    if (kwMatch) score += 3;
    if (entry.title.toLowerCase().includes(qt)) score += 2;
    const count = entryTokens.filter(t => t === qt || t.includes(qt)).length;
    score += count * 0.5;
  }
  return score;
}

function extractHighlights(query: string, entry: LegalEntry): string[] {
  const qTokens = tokenize(query);
  const lines = entry.content.split('\\n').filter(l => l.trim());
  return lines
    .filter(line => qTokens.some(t => tokenize(line).some(et => et.includes(t))))
    .slice(0, 3);
}

export function searchLegalKB(query: string, topK = 3): SearchResult[] {
  if (!query.trim()) return [];
  return LEGAL_KB
    .map(entry => ({
      entry,
      score: scoreEntry(query, entry),
      highlights: extractHighlights(query, entry),
    }))
    .filter(r => r.score >= MIN_SCORE_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export function answerQuestion(question: string): {
  answer: string;
  sources: string[];
  confidence: 'high' | 'medium' | 'low';
} {
  const results = searchLegalKB(question, 2);
  if (results.length === 0) {
    return {
      answer: 'Không tìm thấy thông tin liên quan trong cơ sở tri thức pháp luật.',
      sources: [],
      confidence: 'low',
    };
  }
  const top = results[0];
  const confidence: 'high' | 'medium' | 'low' =
    top.score >= 8 ? 'high' : top.score >= 4 ? 'medium' : 'low';
  const highlights = top.highlights.length > 0
    ? top.highlights.join('\\n')
    : top.entry.content.split('\\n').slice(0, 3).join('\\n');
  const answer = \`**\${top.entry.title}**\\n_Căn cứ: \${top.entry.source}_\\n\\n\${highlights}\`;
  return { answer, sources: results.map(r => r.entry.source), confidence };
}
`.trimStart();

/**
 * Generates the complete legalKnowledgeBase.ts source from a set of entries.
 * The output is a valid TypeScript module with the same public API.
 */
export function generateKBSource(entries: LegalEntry[]): string {
  const entriesJson = JSON.stringify(entries, null, 2)
    .replace(/"([^"]+)":/g, '$1:')    // unquote keys for TS style
    .replace(/"/g, "'");              // single quotes

  return `/**
 * AUTO-GENERATED by scripts/buildLegalKB.ts — do not edit manually.
 * Run \`npm run build:legal -- --write\` to regenerate.
 * Generated: ${new Date().toISOString()}
 * Source: Legal/ directory (${entries.length} entries)
 */

export interface LegalEntry {
  id: string;
  title: string;
  source: string;
  keywords: string[];
  content: string;
  appliesTo?: string[];
}

export interface SearchResult {
  entry: LegalEntry;
  score: number;
  highlights: string[];
}

export const LEGAL_KB: LegalEntry[] = ${entriesJson};

${SEARCH_ENGINE_SOURCE}
`;
}

// ─── Pipeline orchestrator ─────────────────────────────────────────────────────

export interface PipelineResult {
  scanned: number;
  skipped: number;
  placeholders: number;
  entries: LegalEntry[];
}

/**
 * Runs the full pipeline: scan → read → extract metadata → chunk → generate entries.
 * Returns all generated entries (placeholders excluded).
 */
export async function runPipeline(legalDir: string): Promise<PipelineResult> {
  const files = scanLegalDir(legalDir);
  const entries: LegalEntry[] = [];
  let placeholders = 0;
  let skipped = 0;

  for (const file of files) {
    let rawText: string;
    try {
      rawText = file.ext === '.md'
        ? readMdText(file.absPath)
        : await readDocxText(file.absPath);
    } catch {
      skipped++;
      continue;
    }

    if (!rawText.trim()) { skipped++; continue; }

    const meta = extractMetadata(file, rawText);

    if (meta.isPlaceholder) {
      placeholders++;
      continue;
    }

    if (meta.content.length < 50) { skipped++; continue; }

    const chunks = chunkText(meta.content);
    if (chunks.length === 0) { skipped++; continue; }

    for (let i = 0; i < chunks.length; i++) {
      entries.push(makeEntry(meta, chunks[i], i, chunks.length));
    }
  }

  return { scanned: files.length, skipped, placeholders, entries };
}

// ─── CLI entry point ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const shouldWrite = args.includes('--write');

  const legalDirArg = args.indexOf('--legal-dir');
  const outputArg = args.indexOf('--output');

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const legalDir = legalDirArg >= 0
    ? path.resolve(args[legalDirArg + 1])
    : path.resolve(scriptDir, '../..', 'Legal');

  const outputPath = outputArg >= 0
    ? path.resolve(args[outputArg + 1])
    : path.resolve(scriptDir, '../src/ai/legalKnowledgeBase.ts');

  console.log(`Scanning: ${legalDir}`);
  const result = await runPipeline(legalDir);

  console.log(`Scanned: ${result.scanned} files`);
  console.log(`Placeholders skipped: ${result.placeholders}`);
  console.log(`Other skipped: ${result.skipped}`);
  console.log(`Entries generated: ${result.entries.length}`);

  const source = generateKBSource(result.entries);

  if (shouldWrite) {
    fs.writeFileSync(outputPath, source, 'utf-8');
    console.log(`Written: ${outputPath}`);
  } else {
    console.log('\n--- DRY RUN (pass --write to save) ---');
    console.log(source.slice(0, 500) + '\n...[truncated]');
  }
}

// Run only when executed directly (not when imported by tests)
const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main().catch(err => { console.error(err); process.exit(1); });
}
