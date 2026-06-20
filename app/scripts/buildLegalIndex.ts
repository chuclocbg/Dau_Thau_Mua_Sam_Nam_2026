/**
 * Legal Knowledge Base Index Generator — Legal v1.2
 *
 * Scans Legal/ directory, processes each document through the same pipeline
 * as buildLegalKB.ts, and writes a deterministic JSON index to
 * app/src/ai/legalIndex.json.
 *
 * Usage:
 *   npm run build:index                          # dry-run: print entry count
 *   npm run build:index -- --write               # write legalIndex.json
 *   npm run build:index -- --legal-dir <path>    # custom Legal directory
 *   npm run build:index -- --output <path>       # custom output path
 *
 * All exported functions are tested in legal-index-pipeline.test.ts.
 * ChatAgent and LegalReviewerAgent are NOT modified.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  scanLegalDir,
  readMdText,
  readDocxText,
  extractMetadata,
  chunkText,
  makeEntry,
} from './buildLegalKB.js';

// ─── Public types ──────────────────────────────────────────────────────────────

export const SCHEMA_VERSION = '1.2';

/** One chunk of a legal document, enriched with document-level metadata. */
export interface IndexEntry {
  id: string;
  title: string;
  category: string;      // Laws | Decrees | Circulars | VBHN | Forms | School_Regulations | Procurement_Examples | root
  sourceFile: string;    // relative path inside Legal/
  effectiveDate: string; // e.g. "21/06/2021" or ""
  keywords: string[];
  content: string;       // chunk text, capped at 3000 chars
  appliesTo: string[];   // BM25 category tags
}

export interface LegalIndex {
  schemaVersion: string;
  entries: IndexEntry[];
}

// ─── Index builder ─────────────────────────────────────────────────────────────

/**
 * Runs the full pipeline and returns a LegalIndex with one IndexEntry per chunk.
 * Placeholder files and files shorter than 50 chars are skipped.
 * Output is deterministic: scanLegalDir returns files sorted by relPath.
 */
export async function buildIndex(legalDir: string): Promise<LegalIndex> {
  const files = scanLegalDir(legalDir);
  const entries: IndexEntry[] = [];

  for (const file of files) {
    let rawText: string;
    try {
      rawText = file.ext === '.md'
        ? readMdText(file.absPath)
        : await readDocxText(file.absPath);
    } catch {
      continue;
    }

    if (!rawText.trim()) continue;

    const meta = extractMetadata(file, rawText);
    if (meta.isPlaceholder || meta.content.length < 50) continue;

    const chunks = chunkText(meta.content);
    if (chunks.length === 0) continue;

    for (let i = 0; i < chunks.length; i++) {
      const entry = makeEntry(meta, chunks[i], i, chunks.length);
      entries.push({
        id: entry.id,
        title: entry.title,
        category: meta.category,
        sourceFile: meta.sourceFile,
        effectiveDate: meta.effectiveDate,
        keywords: entry.keywords,
        content: entry.content,
        appliesTo: entry.appliesTo ?? [],
      });
    }
  }

  return { schemaVersion: SCHEMA_VERSION, entries };
}

/**
 * Serialises a LegalIndex to UTF-8 JSON.
 * Uses JSON.stringify (no post-processing) so Vietnamese text is preserved
 * and all string escaping is correct.
 */
export function generateIndexJson(index: LegalIndex): string {
  return JSON.stringify(index, null, 2);
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
    : path.resolve(scriptDir, '../src/ai/legalIndex.json');

  console.log(`Scanning: ${legalDir}`);
  const index = await buildIndex(legalDir);
  console.log(`Entries: ${index.entries.length}`);

  const json = generateIndexJson(index);

  if (shouldWrite) {
    fs.writeFileSync(outputPath, json, 'utf-8');
    console.log(`Written: ${outputPath}`);
  } else {
    console.log('\n--- DRY RUN (pass --write to save) ---');
    console.log(json.slice(0, 400) + '\n...[truncated]');
  }
}

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main().catch(err => { console.error(err); process.exit(1); });
}
