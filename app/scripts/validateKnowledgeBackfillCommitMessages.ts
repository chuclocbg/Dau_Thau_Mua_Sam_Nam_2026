#!/usr/bin/env -S npx tsx
/**
 * Runtime Contract Iteration 2 Slice 11 (SLICE11_PRE_IMPLEMENTATION_DISCLOSURE.md): read-only
 * commit-message match check for KNOWLEDGE_UPDATE_BACKFILL.md. SLICE10_PRE_IMPLEMENTATION_
 * DISCLOSURE.md's own Scope explicitly named this as future, unaddressed territory: confirming a
 * hash exists (Slice 10's own responsibility) and confirming its content matches its entry's own
 * narrative are deliberately distinct. This script closes the narrowest, least interpretive slice
 * of that deferred gap: for each entry's parenthetically-quoted commit-message text, confirm it
 * matches that hash's real `git log -1 --format=%s <hash>` subject line -- literal,
 * whitespace-normalized string equality only, never diff, body, author, or any interpretive
 * judgment about content. This capability has no relationship whatsoever to REVIEW_LOG.md,
 * REPORTABLE_EXECUTION_SIGNALS.md, or any candidate reportable-execution semantic.
 *
 * Every git invocation is made through execFileSync with an explicit argument array, never a
 * shell command string -- no value derived from parsed markdown text or git's own output is ever
 * interpolated into a shell string anywhere in this script.
 *
 * Fully self-contained: imports only node:child_process, node:fs, node:path. Performs no write of
 * any kind, to any file it reads or to git's own object database or history, under any
 * circumstance.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function repoRoot(): string {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
}

/** Splits KNOWLEDGE_UPDATE_BACKFILL.md into raw per-entry blocks, tolerant of minor formatting
 *  variation -- the same technique already used identically by validateKnowledgeBackfill.ts and
 *  validateKnowledgeBackfillCommits.ts. Read-only -- never writes back to the file it parses. */
function splitEntryBlocks(text: string): string[] {
  return text.split(/\n---\n\n/).filter(block => /^##\s/m.test(block))
}

interface HashMessagePair {
  readonly entryLabel: string
  readonly hash: string
  readonly quotedMessage: string
}

/** Extracts each entry's hash and quoted message independently. An entry missing either value
 *  contributes nothing to check -- hash presence is Slice 9's own concern, and a missing message
 *  is a distinct, undisclosed structural gap this candidate does not claim to cover. */
function extractHashMessagePairs(blocks: string[]): HashMessagePair[] {
  const pairs: HashMessagePair[] = []
  for (const block of blocks) {
    const hashMatch = block.match(/\*\*Authoritative source:\*\*\s*commit\s*`([^`]+)`/)
    const messageMatch = block.match(/\*\*Authoritative source:\*\*\s*commit\s*`[^`]+`\s*\(`([\s\S]*?)`\)/)
    if (!hashMatch || !messageMatch) continue
    const hash = hashMatch[1].trim()
    const quotedMessage = messageMatch[1]
    if (hash.length === 0 || quotedMessage.trim().length === 0) continue
    const headerMatch = block.match(/^##\s*(.+)$/m)
    pairs.push({
      entryLabel: headerMatch ? headerMatch[1].trim() : `entry ${pairs.length + 1}`,
      hash,
      quotedMessage,
    })
  }
  return pairs
}

/** Collapses every run of whitespace (including embedded newlines from markdown word-wrap) to a
 *  single space and trims leading/trailing whitespace. */
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Confirms a hash resolves to a real commit object, purely as a prerequisite gate -- not its
 *  own reported finding. Existence-checking and its own anomaly reporting remain exclusively
 *  Slice 10's responsibility, never duplicated here. */
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

/** Returns the resolved commit's real subject line via `git log -1 --format=%s <hash>`. Only
 *  called after resolvesToRealCommit() has already confirmed the hash resolves. */
function realSubjectLine(hash: string): string {
  return execFileSync('git', ['log', '-1', '--format=%s', hash], { encoding: 'utf8' }).trim()
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

  console.log('=== Knowledge Backfill: Commit-Message Match Check ===')
  console.log('Literal text-comparison check only. Takes no position on any entry\'s content or')
  console.log("on the underlying Slice's own correctness -- confirms only that each entry's own")
  console.log('quoted commit message matches that hash\'s real subject line in git history. No')
  console.log('semantic is chosen, scored, ranked, recommended, or interpreted by any finding')
  console.log('below.\n')

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

  const pairs = extractHashMessagePairs(blocks)

  if (pairs.length === 0) {
    console.log('No entries with both an extractable hash and an extractable message found. Nothing to validate.')
    return
  }

  const checked: HashMessagePair[] = []
  const anomalies: Anomaly[] = []

  for (const p of pairs) {
    if (!resolvesToRealCommit(p.hash)) continue
    checked.push(p)
    const normalizedQuoted = normalizeWhitespace(p.quotedMessage)
    const normalizedReal = normalizeWhitespace(realSubjectLine(p.hash))
    if (normalizedQuoted !== normalizedReal) {
      anomalies.push({
        description: `${p.entryLabel}: quoted message "${normalizedQuoted}" does not match real subject line "${normalizedReal}"`,
      })
    }
  }

  console.log(`Messages checked: ${checked.length}\n`)

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
