#!/usr/bin/env -S npx tsx
/**
 * Governance Engine, Validator (GOVERNANCE_RUNTIME_IMPLEMENTATION_CONTRACT.md Phase 4) --
 * on-demand check that a RuleDefinition file is well-formed.
 *
 * Scope boundary (GOVERNANCE_OBJECT_MODEL.md's Validator entry, Architecture Review
 * remediation): validates a RuleDefinition's well-formedness only, on-demand, at
 * authoring/edit time -- never per-execution Evidence sanity-checking, and never wired into
 * verifyPushState.ts's own execution (forbidden by that same scope boundary, restated in
 * GOVERNANCE_ENGINE_RUNTIME.md §5).
 *
 * Two checks, matching §5's own stated scope exactly:
 *   1. Does the declared `script` path exist and appear runnable standalone?
 *   2. Does the declared `command_adapter` file contain any logic beyond "invoke the script
 *      and relay output" (a grep-based heuristic, not a perfect check -- §5's own words)?
 *
 * Zero new dependencies: reads the RuleDefinition's YAML block via a targeted line scan for
 * exactly the two fields this scope needs, matching findMaskedStepNames()'s own established
 * regex-scan precedent in governanceRuntime.ts rather than adding a YAML parser library.
 *
 * Purely read-only: performs zero file-system writes, deliberately -- unlike Phase 3's
 * Report, nothing here mutates any tracked or untracked file. This script's own rollback is
 * `git revert`, the simplest category, matching every other non-mutating phase.
 */

import { existsSync, readFileSync } from 'node:fs'
import { repoRoot } from './lib/governanceRuntime.ts'

/** GOVERNANCE_OBJECT_MODEL.md's ValidationResult entry -- the outcome of one Validator run. */
interface ValidationResult {
  readonly ruleId: string
  readonly ok: boolean
  readonly findings: readonly string[]
}

function extractYamlBlock(markdownText: string): string | null {
  const match = markdownText.match(/```yaml\n([\s\S]*?)```/)
  return match ? match[1] : null
}

function extractYamlField(yamlBlock: string, field: string): string | null {
  const match = yamlBlock.match(new RegExp(`^${field}:\\s*(.+?)\\s*(?:#.*)?$`, 'm'))
  if (!match) return null
  return match[1].trim().replace(/^["']|["']$/g, '')
}

/**
 * Validates one RuleDefinition markdown file against RULE_DEFINITION_FORMAT.md's schema, per
 * GOVERNANCE_ENGINE_RUNTIME.md §5's stated scope. Read-only throughout.
 */
function validateRuleDefinition(ruleDefPath: string, root: string): ValidationResult {
  const findings: string[] = []

  if (!existsSync(ruleDefPath)) {
    return { ruleId: ruleDefPath, ok: false, findings: [`RuleDefinition file not found: ${ruleDefPath}`] }
  }
  const text = readFileSync(ruleDefPath, 'utf8')
  const yamlBlock = extractYamlBlock(text)
  if (!yamlBlock) {
    return { ruleId: ruleDefPath, ok: false, findings: ['No ```yaml code block found in the RuleDefinition file.'] }
  }

  const ruleId = extractYamlField(yamlBlock, 'rule_id') ?? ruleDefPath
  const scriptField = extractYamlField(yamlBlock, 'script')
  const adapterField = extractYamlField(yamlBlock, 'command_adapter')

  // Check 1: declared script exists and appears runnable standalone.
  if (!scriptField) {
    findings.push('No `script` field declared.')
  } else {
    const scriptPath = `${root}/${scriptField}`
    if (!existsSync(scriptPath)) {
      findings.push(`Declared script not found: ${scriptField}`)
    } else {
      const firstLine = readFileSync(scriptPath, 'utf8').split('\n')[0] ?? ''
      if (!/^#!.*\bnpx tsx\b/.test(firstLine)) {
        findings.push(
          `Declared script has no standalone-invocation shebang (expected a "#!...npx tsx" first line): ${scriptField}`,
        )
      }
    }
  }

  // Check 2: declared command adapter contains no logic beyond invoke-and-relay (heuristic).
  if (!adapterField) {
    findings.push('No `command_adapter` field declared.')
  } else {
    const adapterPath = `${root}/${adapterField}`
    if (!existsSync(adapterPath)) {
      findings.push(`Declared command adapter not found: ${adapterField}`)
    } else {
      const adapterText = readFileSync(adapterPath, 'utf8')
      if (!scriptField || !adapterText.includes(scriptField)) {
        findings.push(
          `Command adapter does not appear to invoke the declared script (expected to find "${scriptField}" referenced): ${adapterField}`,
        )
      }
      const suspiciousLogicPattern = /\b(git rev-parse|git status|git fetch|curl |fetch\()/
      const codeBlocks = adapterText.match(/```[\s\S]*?```/g) ?? []
      for (const block of codeBlocks) {
        const invokesScript = scriptField ? block.includes(scriptField) : false
        if (suspiciousLogicPattern.test(block) && !invokesScript) {
          findings.push(
            `Command adapter contains a code block with its own verification logic, not just script invocation: ${block.slice(0, 80).replace(/\n/g, ' ')}...`,
          )
        }
      }
    }
  }

  return { ruleId, ok: findings.length === 0, findings }
}

function printValidationResult(r: ValidationResult): void {
  console.log(`${r.ok ? 'WELL-FORMED' : 'MALFORMED'} -- ${r.ruleId}`)
  for (const f of r.findings) {
    console.log(`  - ${f}`)
  }
  console.log('')
}

function main() {
  const target = process.argv[2]
  if (!target) {
    console.error('[validateGovernanceRule] usage: npx tsx app/scripts/validateGovernanceRule.ts <path-to-RuleDefinition.md>')
    process.exit(1)
  }
  const root = repoRoot()
  const result = validateRuleDefinition(target, root)
  printValidationResult(result)
  process.exit(result.ok ? 0 : 1)
}

main()
