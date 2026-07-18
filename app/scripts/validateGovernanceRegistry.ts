#!/usr/bin/env -S npx tsx
/**
 * Runtime Contract Iteration 2 Slice 6 (SLICE6_PRE_IMPLEMENTATION_DISCLOSURE.md): read-only
 * consistency check between governance-rules/REGISTRY.md's REVIEW-3 table row and
 * governance-rules/REVIEW-3.md's own RuleDefinition YAML block. Compares five field-pairs:
 * Rule ID/rule_id, Category/category, Status/status, Script/script (literal equality), and
 * Command/command_adapter (a known naming correspondence, not literal equality -- REGISTRY.md
 * states the slash-command form, REVIEW-3.md states the adapter file path). Reports any
 * disagreement, or reports that all agree. Neither artifact has any relationship to
 * REVIEW_LOG.md, REPORTABLE_EXECUTION_SIGNALS.md, or any candidate reportable-execution
 * semantic -- this capability cannot touch reportable-execution semantics even in principle.
 *
 * Fully self-contained: imports nothing from any other script in this repository. Performs no
 * write of any kind, to either file it reads, under any circumstance.
 */

import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function repoRoot(): string {
  return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
}

interface RegistryFields {
  readonly ruleId: string | null
  readonly category: string | null
  readonly status: string | null
  readonly script: string | null
  readonly command: string | null
}

interface RuleDefinitionFields {
  readonly ruleId: string | null
  readonly category: string | null
  readonly status: string | null
  readonly script: string | null
  readonly commandAdapter: string | null
}

/** Extracts REVIEW-3's own row from REGISTRY.md's markdown table. Read-only. */
function parseRegistryRow(text: string, ruleId: string): RegistryFields | null {
  const rowLine = text.split('\n').find(line => line.includes(`[${ruleId}]`))
  if (!rowLine) return null
  const cells = rowLine.split('|').map(c => c.trim()).filter(c => c.length > 0)
  const stripBackticks = (s: string) => s.replace(/^`|`$/g, '')
  const linkTextMatch = cells[0]?.match(/^\[([^\]]+)\]/)
  return {
    ruleId: linkTextMatch ? linkTextMatch[1] : null,
    category: cells[1] ?? null,
    status: cells[2] ?? null,
    script: cells[3] ? stripBackticks(cells[3]) : null,
    command: cells[4] ? stripBackticks(cells[4]) : null,
  }
}

/** Extracts the fields this check needs from REVIEW-3.md's YAML block. Read-only. */
function parseRuleDefinition(text: string): RuleDefinitionFields {
  const field = (name: string): string | null => {
    const m = text.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))
    return m ? m[1].trim().replace(/^"|"$/g, '') : null
  }
  return {
    ruleId: field('rule_id'),
    category: field('category'),
    status: field('status'),
    script: field('script'),
    commandAdapter: field('command_adapter'),
  }
}

/** Derives REGISTRY.md's slash-command form from REVIEW-3.md's adapter file path, per the known,
 *  fixed correspondence ".claude/commands/<name>.md" <-> "/<name>". Returns null if the path
 *  doesn't match the expected shape. */
function deriveSlashCommand(commandAdapterPath: string): string | null {
  const m = commandAdapterPath.match(/^\.claude\/commands\/([^/]+)\.md$/)
  return m ? `/${m[1]}` : null
}

interface Mismatch {
  readonly field: string
  readonly registryValue: string
  readonly ruleDefinitionValue: string
}

function findMismatches(registry: RegistryFields, ruleDef: RuleDefinitionFields): Mismatch[] {
  const mismatches: Mismatch[] = []

  const compareLiteral = (field: string, registryValue: string | null, ruleDefValue: string | null) => {
    if (registryValue !== ruleDefValue) {
      mismatches.push({
        field,
        registryValue: registryValue ?? '(missing)',
        ruleDefinitionValue: ruleDefValue ?? '(missing)',
      })
    }
  }

  compareLiteral('Rule ID / rule_id', registry.ruleId, ruleDef.ruleId)
  compareLiteral('Category / category', registry.category, ruleDef.category)
  compareLiteral('Status / status', registry.status, ruleDef.status)
  compareLiteral('Script / script', registry.script, ruleDef.script)

  const derivedCommand = ruleDef.commandAdapter ? deriveSlashCommand(ruleDef.commandAdapter) : null
  if (registry.command !== derivedCommand) {
    mismatches.push({
      field: 'Command / command_adapter',
      registryValue: registry.command ?? '(missing)',
      ruleDefinitionValue:
        derivedCommand !== null
          ? `${derivedCommand} (derived from ${ruleDef.commandAdapter})`
          : `(could not derive from ${ruleDef.commandAdapter ?? '(missing)'})`,
    })
  }

  return mismatches
}

function main() {
  const root = repoRoot()
  const registryPath = join(root, 'PROJECT_KNOWLEDGE_SYSTEM', '05_ENGINEERING_PLATFORM', 'governance-rules', 'REGISTRY.md')
  const ruleDefPath = join(root, 'PROJECT_KNOWLEDGE_SYSTEM', '05_ENGINEERING_PLATFORM', 'governance-rules', 'REVIEW-3.md')

  console.log('=== Governance Registry: Consistency Check (REGISTRY.md vs REVIEW-3.md) ===')
  console.log('Compares stated fields for agreement only. Takes no position on which artifact')
  console.log('should change. No semantic is chosen, scored, ranked, or implied by any finding below.\n')

  if (!existsSync(registryPath) || !existsSync(ruleDefPath)) {
    console.log('Nothing to check -- REGISTRY.md and/or REVIEW-3.md do not exist.')
    return
  }

  const registryText = readFileSync(registryPath, 'utf8')
  const ruleDefText = readFileSync(ruleDefPath, 'utf8')

  const registry = parseRegistryRow(registryText, 'REVIEW-3')
  if (registry === null) {
    console.log('No REVIEW-3 row found in REGISTRY.md. Nothing to check.')
    return
  }

  const ruleDef = parseRuleDefinition(ruleDefText)

  const mismatches = findMismatches(registry, ruleDef)

  if (mismatches.length === 0) {
    console.log('No mismatches found -- REGISTRY.md and REVIEW-3.md agree on all five field-pairs.')
    return
  }

  console.log(`${mismatches.length} mismatch(es) found:`)
  for (const m of mismatches) {
    console.log(`  - ${m.field}: REGISTRY.md says "${m.registryValue}", REVIEW-3.md says "${m.ruleDefinitionValue}"`)
  }
}

main()
