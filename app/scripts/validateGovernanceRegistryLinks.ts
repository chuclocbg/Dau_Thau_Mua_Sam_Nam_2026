#!/usr/bin/env -S npx tsx
/**
 * Runtime Contract Iteration 2 Slice 12 (SLICE12_PRE_IMPLEMENTATION_DISCLOSURE.md): read-only
 * check that every markdown link target in governance-rules/REGISTRY.md's own table rows
 * resolves to a real file on disk, relative to REGISTRY.md's own containing directory. Distinct
 * from and non-duplicative of validateGovernanceRegistry.ts (Slice 6), which reads only the
 * link's own text, never its target. Existence only -- a resolved target's own content is never
 * opened or read. Has no relationship to REVIEW_LOG.md, REPORTABLE_EXECUTION_SIGNALS.md, or any
 * candidate reportable-execution semantic.
 *
 * Fully self-contained: imports nothing from any other script in this repository. Performs no
 * write of any kind, under any circumstance.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function repoRoot(): string {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
}

/** Bounds the table's own extent: only the first contiguous run of `|`-prefixed lines is ever
 *  considered table content -- the first non-`|` line (a blank line, or REGISTRY.md's own
 *  trailing prose footer note) ends the table permanently. */
function findTableLines(text: string): string[] {
  const lines = text.split('\n')
  const startIdx = lines.findIndex(l => l.trim().startsWith('|'))
  if (startIdx === -1) return []
  const tableLines: string[] = []
  for (let i = startIdx; i < lines.length; i++) {
    if (!lines[i].trim().startsWith('|')) break
    tableLines.push(lines[i])
  }
  return tableLines
}

function splitCells(row: string): string[] {
  return row.split('|').map(c => c.trim()).filter(c => c.length > 0)
}

function isSeparatorRow(row: string): boolean {
  const cells = splitCells(row)
  return cells.length > 0 && cells.every(c => /^[-:]+$/.test(c))
}

/** Everything strictly after the separator row. Empty if no separator row is found within the
 *  table block, or if the separator row is the block's own last line. */
function extractDataRows(tableLines: string[]): string[] {
  const sepIdx = tableLines.findIndex(isSeparatorRow)
  if (sepIdx === -1) return []
  return tableLines.slice(sepIdx + 1)
}

const LINK_PATTERN = /^\[([^\]]+)\]\(([^)]+)\)$/

interface LinkCheckResult {
  readonly row: string
  readonly kind: 'ok' | 'broken' | 'malformed' | 'external'
  readonly detail: string
}

function checkRow(row: string, registryDir: string): LinkCheckResult {
  const firstCell = splitCells(row)[0] ?? ''
  const match = firstCell.match(LINK_PATTERN)
  if (!match) {
    return {
      row,
      kind: 'malformed',
      detail: `first cell does not parse as a markdown link: "${firstCell}"`,
    }
  }

  const target = match[2]
  if (/^https?:\/\//.test(target)) {
    return { row, kind: 'external', detail: `external URL, not checked: ${target}` }
  }

  const fragmentIdx = target.indexOf('#')
  const filePath = fragmentIdx === -1 ? target : target.slice(0, fragmentIdx)
  const resolved = join(registryDir, filePath)

  return existsSync(resolved)
    ? { row, kind: 'ok', detail: resolved }
    : { row, kind: 'broken', detail: `link target does not exist: ${resolved}` }
}

function main() {
  const root = repoRoot()
  const registryDir = join(root, 'PROJECT_KNOWLEDGE_SYSTEM', '05_ENGINEERING_PLATFORM', 'governance-rules')
  const registryPath = join(registryDir, 'REGISTRY.md')

  console.log('=== Governance Registry: Link-Target Existence Check (REGISTRY.md) ===')
  console.log("Confirms each table row's own markdown link target resolves to a real file on")
  console.log('disk. Takes no position on the correctness of any governance rule, or on which')
  console.log('artifact -- the link or its target -- should change, if either. Existence only.\n')

  if (!existsSync(registryPath)) {
    console.log('Nothing to check -- REGISTRY.md does not exist.')
    return
  }

  const tableLines = findTableLines(readFileSync(registryPath, 'utf8'))
  const dataRows = extractDataRows(tableLines)

  if (dataRows.length === 0) {
    console.log("No data rows found in REGISTRY.md's table. Nothing to check.")
    return
  }

  const results = dataRows.map(row => checkRow(row, registryDir))
  const ok = results.filter(r => r.kind === 'ok')
  const broken = results.filter(r => r.kind === 'broken')
  const malformed = results.filter(r => r.kind === 'malformed')
  const external = results.filter(r => r.kind === 'external')

  console.log(`${dataRows.length} data row(s) found.`)
  console.log(`  ${ok.length} link target(s) resolved to a real file.`)
  console.log(`  ${broken.length} broken link(s).`)
  console.log(`  ${malformed.length} malformed link syntax anomaly(ies).`)
  console.log(`  ${external.length} external link(s), not checked.\n`)

  for (const r of broken) console.log(`  [BROKEN]    ${r.row.trim()} -- ${r.detail}`)
  for (const r of malformed) console.log(`  [MALFORMED] ${r.row.trim()} -- ${r.detail}`)
  for (const r of external) console.log(`  [SKIPPED]   ${r.row.trim()} -- ${r.detail}`)

  if (broken.length === 0 && malformed.length === 0) {
    console.log('No broken or malformed links found.')
  }
}

main()
