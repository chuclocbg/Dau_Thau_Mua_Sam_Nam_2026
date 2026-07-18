#!/usr/bin/env -S npx tsx
/**
 * Runtime Contract Iteration 2 Slice 10 (SLICE10_PRE_IMPLEMENTATION_DISCLOSURE.md): read-only
 * commit-hash existence check for KNOWLEDGE_UPDATE_BACKFILL.md. IMPLEMENTATION_SLICE_09_
 * SELECTION.md's own Explicit non-goals named this as a distinct, deferred candidate: confirming
 * a cited commit hash actually exists in this repository's own git history, never checked by any
 * tool until now. This script extracts every entry's "**Authoritative source:** commit `<hash>`"
 * citation and confirms each hash resolves to a real commit object via "git rev-parse --verify
 * <hash>^{commit}" -- existence only, never inspecting the resolved commit's own message, author,
 * diff, or content, and never comparing it against the entry's own prose claims. Checks structure
 * only, never content meaning. This capability has no relationship whatsoever to REVIEW_LOG.md,
 * REPORTABLE_EXECUTION_SIGNALS.md, or any candidate reportable-execution semantic.
 *
 * A hash string is validated as hex-only, reasonable-length (4-40 characters) before ever being
 * passed to a shell command -- an invalid-shaped hash is flagged as a malformed-hash anomaly
 * directly, without ever reaching `git`, rather than interpolating untrusted text into a shell
 * command string.
 *
 * Fully self-contained: imports only node:child_process, node:fs, node:path. Performs no write of
 * any kind, to any file it reads or to git's own object database, under any circumstance.
 */

import { execSync, execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function repoRoot(): string {
  return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
}

/** Splits KNOWLEDGE_UPDATE_BACKFILL.md into raw per-entry blocks, tolerant of minor formatting
 *  variation -- the same technique already used identically by validateKnowledgeBackfill.ts.
 *  Read-only -- never writes back to the file it parses. */
function splitEntryBlocks(text: string): string[] {
  return text.split(/\n---\n\n/).filter(block => /^##\s/m.test(block))
}

interface HashCitation {
  readonly entryLabel: string
  readonly hash: string
}

/** Extracts each entry's Authoritative-source hash. An entry with no extractable hash at all
 *  contributes nothing to check -- Slice 9's own validateKnowledgeBackfill.ts already flags a
 *  missing/malformed Authoritative-source line as its own, separate structural anomaly. */
function extractHashCitations(blocks: string[]): HashCitation[] {
  const citations: HashCitation[] = []
  for (const block of blocks) {
    const sourceMatch = block.match(/\*\*Authoritative source:\*\*\s*commit\s*`([^`]+)`/)
    if (!sourceMatch || sourceMatch[1].trim().length === 0) continue
    const headerMatch = block.match(/^##\s*(.+)$/m)
    citations.push({
      entryLabel: headerMatch ? headerMatch[1].trim() : `entry ${citations.length + 1}`,
      hash: sourceMatch[1].trim(),
    })
  }
  return citations
}

const HEX_HASH_PATTERN = /^[0-9a-fA-F]{4,40}$/

/** Confirms a hash resolves to a real commit object via "git rev-parse --verify <hash>^{commit}".
 *  Invoked through execFileSync (argument array, no shell) rather than a shell command string --
 *  the `^{commit}` suffix contains characters a shell may reinterpret (e.g. `^` is cmd.exe's own
 *  escape character on Windows), so passing it as a literal argv entry avoids both that
 *  cross-platform quoting hazard and any shell-injection risk from interpolating parsed text.
 *  Any non-zero exit -- object absent, object present but not a commit, or an ambiguous
 *  short-hash match -- is treated uniformly as a resolution failure; git's own distinct error
 *  text for each case is not specially inspected or suppressed. */
function resolvesToRealCommit(hash: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--verify', `${hash}^{commit}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'ignore', 'ignore'],
    })
    return true
  } catch {
    return false
  }
}

interface Anomaly {
  readonly description: string
}

function main() {
  const backfillPath = join(
    repoRoot(),
    'PROJECT_KNOWLEDGE_SYSTEM',
    '01_PROJECT_DOCS',
    'KNOWLEDGE_UPDATE_BACKFILL.md',
  )

  console.log('=== Knowledge Backfill: Commit-Hash Existence Check ===')
  console.log("Existence check of cited hashes only. Takes no position on any entry's content or")
  console.log("on the underlying Slice's own correctness -- confirms only that each cited hash")
  console.log("resolves to a real commit object in this repository's own git history. No semantic")
  console.log('is chosen, scored, ranked, recommended, or interpreted by any finding below.\n')

  if (!existsSync(backfillPath)) {
    console.log('KNOWLEDGE_UPDATE_BACKFILL.md does not exist. Nothing to validate.')
    return
  }

  const text = readFileSync(backfillPath, 'utf8')
  const blocks = splitEntryBlocks(text)

  if (blocks.length === 0) {
    console.log('No entries yet -- file exists but contains zero recorded entries. Nothing to validate.')
    return
  }

  const citations = extractHashCitations(blocks)

  if (citations.length === 0) {
    console.log('No Authoritative-source hashes found to check. Nothing to validate.')
    return
  }

  console.log(`Hashes checked: ${citations.length}\n`)

  const anomalies: Anomaly[] = []
  for (const c of citations) {
    if (!HEX_HASH_PATTERN.test(c.hash)) {
      anomalies.push({
        description: `${c.entryLabel}: malformed hash "${c.hash}" (not a valid hex commit-hash form)`,
      })
      continue
    }
    if (!resolvesToRealCommit(c.hash)) {
      anomalies.push({ description: `${c.entryLabel}: hash "${c.hash}" does not resolve to a real commit` })
    }
  }

  if (anomalies.length === 0) {
    console.log('No anomalies found.')
    return
  }

  console.log(`${anomalies.length} anomaly(ies) found:`)
  for (const a of anomalies) {
    console.log(`  - ${a.description}`)
  }
}

main()
