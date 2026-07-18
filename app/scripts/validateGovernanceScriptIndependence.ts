#!/usr/bin/env -S npx tsx
/**
 * Runtime Contract Iteration 2 Slice 8 (SLICE8_PRE_IMPLEMENTATION_DISCLOSURE.md): read-only
 * independence guard for the Governance Runtime script family. Every one of Slices 2-7's own
 * Pre-Implementation Disclosure documents has individually asserted, in prose, that its new
 * script "imports nothing from" every other named Governance Runtime script -- a claim
 * re-verified by hand at each prior Selection/Disclosure/Review cycle, but never once
 * mechanically checked by any tool until now. This script reads the six Iteration-2-created
 * scripts' own top-level import statements and confirms each resolves to either a Node built-in
 * module specifier or is flagged as disallowed because it references one of the nine known
 * Governance Runtime script paths.
 *
 * Structural independence check only. Takes no position on the correctness or safety of any
 * inspected script's own capabilities -- flags only whether its own import statements resolve to
 * an allowed Node built-in or a disallowed sibling Governance Runtime script reference. This
 * capability is scoped entirely to app/scripts/ source text and has no relationship whatsoever to
 * REVIEW_LOG.md, REPORTABLE_EXECUTION_SIGNALS.md, or any candidate reportable-execution semantic.
 *
 * Fully self-contained: imports only node:child_process, node:fs, node:path. Performs no write of
 * any kind, to any file it reads or references, under any circumstance.
 */

import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function repoRoot(): string {
  return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
}

/** The six Iteration-2-created Governance Runtime scripts this check reads and inspects. */
const TARGET_SCRIPTS: readonly string[] = [
  'app/scripts/summarizeReportableExecutionSignals.ts',
  'app/scripts/validateReportableExecutionSignals.ts',
  'app/scripts/correlateReportableExecutionSignals.ts',
  'app/scripts/validateReviewLog.ts',
  'app/scripts/validateGovernanceRegistry.ts',
  'app/scripts/summarizeReviewLog.ts',
]

/** Base filenames of all nine known Governance Runtime scripts (the six above plus the three
 *  Contract-phase files) -- an import specifier referencing any of these is disallowed. */
const GOVERNANCE_SCRIPT_NAMES: readonly string[] = [
  'governanceRuntime',
  'verifyPushState',
  'validateGovernanceRule',
  'summarizeReportableExecutionSignals',
  'validateReportableExecutionSignals',
  'correlateReportableExecutionSignals',
  'validateReviewLog',
  'validateGovernanceRegistry',
  'summarizeReviewLog',
]

interface ImportFinding {
  readonly specifier: string
  readonly allowed: boolean
  readonly reason: string
}

interface FileResult {
  readonly path: string
  readonly compliant: boolean
  readonly findings: readonly ImportFinding[]
}

/** Extracts every top-level import statement's module specifier, tolerant of both single-line
 *  and multi-line import statements (per Risk 2's disclosed multi-line concern). Read-only --
 *  never writes back to the file it parses. */
function extractImportSpecifiers(text: string): string[] {
  const matches = text.matchAll(/import\s+[\s\S]*?from\s+['"]([^'"]+)['"]/g)
  return [...matches].map(m => m[1])
}

/** A Node built-in module specifier is one beginning with the "node:" prefix -- a presence-style
 *  allowlist, not an exhaustive enumeration of every possible built-in module name, so a future
 *  script legitimately needing a different built-in (e.g. node:crypto) is not mistakenly
 *  flagged. */
function isNodeBuiltin(specifier: string): boolean {
  return specifier.startsWith('node:')
}

/** Detects a disallowed sibling-script reference by checking whether the specifier's text
 *  contains a known Governance Runtime script's own base filename, tolerant of
 *  relative-path-prefix variation (./, ../, with or without a .ts extension) rather than
 *  requiring one exact path string. */
function findReferencedGovernanceScript(specifier: string): string | null {
  return GOVERNANCE_SCRIPT_NAMES.find(name => specifier.includes(name)) ?? null
}

function classifyImport(specifier: string): ImportFinding {
  if (isNodeBuiltin(specifier)) {
    return { specifier, allowed: true, reason: 'Node built-in module' }
  }
  const referenced = findReferencedGovernanceScript(specifier)
  if (referenced) {
    return { specifier, allowed: false, reason: `references sibling Governance Runtime script "${referenced}"` }
  }
  return { specifier, allowed: false, reason: 'not a recognized Node built-in module' }
}

function checkFile(relativePath: string, root: string): FileResult {
  const fullPath = join(root, relativePath)
  if (!existsSync(fullPath)) {
    return {
      path: relativePath,
      compliant: false,
      findings: [{ specifier: '(file not found)', allowed: false, reason: 'declared target file does not exist' }],
    }
  }
  const text = readFileSync(fullPath, 'utf8')
  const findings = extractImportSpecifiers(text).map(classifyImport)
  return { path: relativePath, compliant: findings.every(f => f.allowed), findings }
}

function printFileResult(r: FileResult): void {
  console.log(`${r.compliant ? 'COMPLIANT' : 'VIOLATION'} -- ${r.path}`)
  for (const f of r.findings) {
    if (!f.allowed) {
      console.log(`  - disallowed import "${f.specifier}": ${f.reason}`)
    }
  }
}

function main() {
  const root = repoRoot()

  console.log('=== Governance Runtime Script Independence Guard ===')
  console.log('Structural independence check only. Takes no position on the correctness or')
  console.log("safety of any inspected script's own capabilities -- flags only whether its own")
  console.log('import statements resolve to an allowed Node built-in or a disallowed sibling')
  console.log('Governance Runtime script reference. No semantic is chosen, scored, ranked,')
  console.log('recommended, or interpreted by any result below.\n')

  const results = TARGET_SCRIPTS.map(path => checkFile(path, root))
  for (const r of results) {
    printFileResult(r)
  }

  const compliantCount = results.filter(r => r.compliant).length
  console.log(`\n${compliantCount}/${results.length} scripts compliant.`)
}

main()
