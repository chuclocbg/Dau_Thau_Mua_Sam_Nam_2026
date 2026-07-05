import type {
  AppliedArticle, ConditionOperator, DetectedException, EvaluationRuleMetadata,
  LegalRuleResult, LegalRuleStatus, LegalThresholdResult, ReasoningContext, RuleCondition,
  RuleKnowledgeItemRef, ThresholdKnowledgeItemRef,
} from '../domain/reasoningTypes.ts'

// ── Stage 4 — Rule Engine ───────────────────────────────────────────────────────
// Per app/knowledge/reasoning/rules.md. Pure evaluator: contains no rule definitions
// itself — all rules/thresholds are supplied via ResolvedKnowledge (mock fixtures in
// Batch A; the real Knowledge Platform corpus from X.3 onward). Updating a rule value
// requires only a fixture/corpus update, never a code change here.

// ── Exception detection ─────────────────────────────────────────────────────────

interface ExceptionPatternDef {
  readonly patternCode: string
  readonly triggers: readonly string[]
}

const EXCEPTION_PATTERNS: readonly ExceptionPatternDef[] = [
  { patternCode: 'EXCEPT_CLAUSE', triggers: ['trừ trường hợp', 'trừ khi', 'ngoại trừ'] },
  { patternCode: 'SCOPE_EXCLUSION', triggers: ['không áp dụng'] },
  { patternCode: 'SPECIAL_CASE', triggers: ['trường hợp đặc biệt', 'trường hợp khẩn cấp'] },
  { patternCode: 'CONDITIONAL_PERMIT', triggers: ['miễn là', 'với điều kiện là'] },
  { patternCode: 'EMERGENCY_PROCUREMENT', triggers: ['khẩn cấp', 'thiên tai', 'dịch bệnh'] },
  { patternCode: 'SINGLE_SUPPLIER', triggers: ['nhà thầu duy nhất', 'độc quyền'] },
]

// A monetary-threshold condition ('dưới 50.000.000 đồng', 'trên 2 tỷ') is the one
// exception-condition shape Batch A can mechanically evaluate against context —
// everything else defaults to isApplicable = null (per CLAUDE.md's no-fabrication
// principle: an exception's applicability is never guessed, only genuinely computed
// or left for human/MissingEvidence review).
const MONEY_CONDITION_PATTERN = /(dưới|trên)\s+([\d.,]+)\s*(tỷ|triệu|đồng)/i

function parseVndAmount(digits: string, unit: string): bigint {
  const normalized = digits.replace(/[.,]/g, '')
  const base = BigInt(normalized)
  if (unit.toLowerCase() === 'tỷ') return base * 1_000_000_000n
  if (unit.toLowerCase() === 'triệu') return base * 1_000_000n
  return base
}

function evaluateExceptionApplicability(
  conditionText: string, context: ReasoningContext,
): boolean | null {
  const match = MONEY_CONDITION_PATTERN.exec(conditionText)
  if (!match || context.estimatedValue === undefined) return null
  const threshold = parseVndAmount(match[2]!, match[3]!)
  return match[1]!.toLowerCase() === 'dưới'
    ? context.estimatedValue < threshold
    : context.estimatedValue > threshold
}

export function detectExceptions(
  article: AppliedArticle, context: ReasoningContext,
): DetectedException[] {
  const text = article.extractedText.toLowerCase()
  const exceptions: DetectedException[] = []
  const seenSentenceEnds = new Set<number>()
  let exceptionSeq = 0

  for (const pattern of EXCEPTION_PATTERNS) {
    for (const trigger of pattern.triggers) {
      const index = text.indexOf(trigger)
      if (index < 0) continue
      const rest = article.extractedText.slice(index)
      const relativeEnd = rest.search(/[.;]/)
      const sentenceEnd = relativeEnd === -1 ? article.extractedText.length : index + relativeEnd
      // Multiple pattern definitions can match overlapping trigger phrases within the
      // same sentence (e.g. 'trừ trường hợp khẩn cấp' matches EXCEPT_CLAUSE, SPECIAL_CASE,
      // and EMERGENCY_PROCUREMENT all at once, at different start offsets but the same
      // sentence boundary) — dedupe by sentence-end position so one legal clause
      // produces one DetectedException, not one per pattern hit.
      if (seenSentenceEnds.has(sentenceEnd)) continue
      seenSentenceEnds.add(sentenceEnd)
      const conditionText = (rest.split(/[.;]/)[0] ?? rest).trim()
      const isApplicable = evaluateExceptionApplicability(conditionText, context)
      exceptions.push({
        exceptionId: `${article.itemId}-exc-${++exceptionSeq}`,
        sourceItemId: article.itemId,
        patternCode: pattern.patternCode,
        exceptionText: conditionText,
        conditionText,
        isApplicable,
        impactOnDecision: isApplicable === true
          ? 'Ngoại lệ áp dụng — quy tắc liên quan không áp dụng cho trường hợp này'
          : isApplicable === false
            ? 'Ngoại lệ không áp dụng cho trường hợp này'
            : 'Không đủ thông tin để xác nhận ngoại lệ này',
      })
    }
  }
  return exceptions
}

// ── Threshold evaluation ────────────────────────────────────────────────────────

function parseThresholdNumber(value: string, unit: 'VND' | 'PERCENT' | 'DAYS'): bigint | number {
  return unit === 'PERCENT' ? Number.parseFloat(value) : BigInt(value)
}

function readContextValue(context: ReasoningContext, field: string): bigint | number | undefined {
  const value = context[field]
  if (typeof value === 'bigint' || typeof value === 'number') return value
  return undefined
}

function compareThreshold(
  contextValue: bigint | number, operator: 'GT' | 'GTE' | 'LT' | 'LTE' | 'BETWEEN', threshold: bigint | number,
): boolean {
  if (typeof contextValue === 'bigint' && typeof threshold === 'bigint') {
    switch (operator) {
      case 'GT': return contextValue > threshold
      case 'GTE': return contextValue >= threshold
      case 'LT': return contextValue < threshold
      case 'LTE': return contextValue <= threshold
      default: return false
    }
  }
  const a = Number(contextValue), b = Number(threshold)
  switch (operator) {
    case 'GT': return a > b
    case 'GTE': return a >= b
    case 'LT': return a < b
    case 'LTE': return a <= b
    default: return false
  }
}

export function evaluateThreshold(
  item: ThresholdKnowledgeItemRef, context: ReasoningContext,
): LegalThresholdResult | null {
  const { threshold } = item
  const contextValue = readContextValue(context, threshold.contextField)
  if (contextValue === undefined) return null

  const thresholdValue = parseThresholdNumber(threshold.value, threshold.unit)
  const passed = compareThreshold(contextValue, threshold.operator, thresholdValue)

  return {
    thresholdItemId: item.itemId,
    thresholdCode: threshold.thresholdCode,
    description: threshold.note ?? threshold.thresholdCode,
    thresholdValue: typeof thresholdValue === 'bigint' ? thresholdValue : BigInt(Math.round(thresholdValue * 100)),
    contextValue: typeof contextValue === 'bigint' ? contextValue : BigInt(Math.round(contextValue * 100)),
    operator: threshold.operator,
    passed,
    legalBasis: item.legalBasis,
  }
}

// ── Rule condition evaluation ────────────────────────────────────────────────────

function evaluateOperator(operator: ConditionOperator, fieldValue: unknown, value: string): boolean {
  switch (operator) {
    case 'EXISTS': return fieldValue !== undefined && fieldValue !== null
    case 'NOT_EXISTS': return fieldValue === undefined || fieldValue === null
    case 'EQ': return String(fieldValue) === value
    case 'NEQ': return String(fieldValue) !== value
    case 'IN': return value.split(',').includes(String(fieldValue))
    case 'NOT_IN': return !value.split(',').includes(String(fieldValue))
    case 'GT': case 'GTE': case 'LT': case 'LTE': {
      if (typeof fieldValue !== 'bigint' && typeof fieldValue !== 'number') return false
      const threshold = typeof fieldValue === 'bigint' ? BigInt(value) : Number.parseFloat(value)
      return compareThreshold(fieldValue, operator, threshold)
    }
    case 'BETWEEN': {
      if (typeof fieldValue !== 'bigint' && typeof fieldValue !== 'number') return false
      const [minRaw, maxRaw] = value.split(',')
      if (typeof fieldValue === 'bigint') {
        return fieldValue >= BigInt(minRaw!) && fieldValue <= BigInt(maxRaw!)
      }
      return fieldValue >= Number.parseFloat(minRaw!) && fieldValue <= Number.parseFloat(maxRaw!)
    }
    default: return false
  }
}

export function evaluateConditions(
  conditions: readonly RuleCondition[], context: ReasoningContext,
): { allMet: boolean; unmetConditions: RuleCondition[]; missingFields: string[] } {
  const unmetConditions: RuleCondition[] = []
  const missingFields: string[] = []

  for (const condition of conditions) {
    const fieldValue = context[condition.field]
    if ((fieldValue === undefined || fieldValue === null) && condition.operator !== 'NOT_EXISTS') {
      missingFields.push(condition.field)
      continue
    }
    if (!evaluateOperator(condition.operator, fieldValue, condition.value)) {
      unmetConditions.push(condition)
    }
  }

  return { allMet: unmetConditions.length === 0 && missingFields.length === 0, unmetConditions, missingFields }
}

export function evaluateRule(
  item: RuleKnowledgeItemRef, context: ReasoningContext, exceptions: readonly DetectedException[],
): LegalRuleResult {
  const rule: EvaluationRuleMetadata = item.rule
  const { allMet, missingFields } = evaluateConditions(rule.conditions, context)

  const applicableException = (rule.exceptionCodes ?? [])
    .map(code => exceptions.find(e => e.patternCode === code && e.isApplicable === true))
    .find((e): e is DetectedException => e !== undefined)

  let status: LegalRuleStatus
  let explanation: string
  if (applicableException) {
    status = 'EXCEPTION'
    explanation = rule.outcome.exception ?? applicableException.impactOnDecision
  } else if (missingFields.length > 0) {
    status = 'INCONCLUSIVE'
    explanation = rule.outcome.inconclusive ?? `Thiếu thông tin: ${missingFields.join(', ')}`
  } else if (allMet) {
    status = 'PASS'
    explanation = rule.outcome.pass
  } else {
    status = 'FAIL'
    explanation = rule.outcome.fail
  }

  return {
    ruleItemId: item.itemId,
    ruleCode: rule.ruleCode,
    status,
    evidence: [item.itemId],
    legalBasis: item.legalBasis,
    explanation,
    missingFields,
  }
}
