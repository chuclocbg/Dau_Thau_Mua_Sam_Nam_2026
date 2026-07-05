import { buildOutputValidator, OutputValidator } from './outputValidator.ts'
import { formatFinalAnswer } from './responseFormatter.ts'
import type { AIContext } from '../domain/aiTypes.ts'
import type {
  AIValidationResult, FinalAnswer, LLMOutput, ValidationReport,
  ValidationReportSection, ValidationSeverity,
} from './validationTypes.ts'

// ── ValidationPipeline — the "Output Validation" stage in the full pipeline ────
// Conversation -> Reasoning -> AIContext -> PromptBuilder -> PromptRenderer ->
// LLMAdapter -> [ValidationPipeline: OutputValidator -> ResponseFormatter] ->
// Human Review Decision -> Final Answer.
//
// Wires OutputValidator (detection) and ResponseFormatter (remediation) together
// and produces the ValidationReport (responsibility 10). This is the only file
// in this milestone that a caller outside src/ai/validation/ needs to import.

const SEVERITY_ORDER: readonly ValidationSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

function buildValidationReport(validation: AIValidationResult, contextId: string): ValidationReport {
  const bySeverity: ValidationReportSection[] = SEVERITY_ORDER
    .map((severity): ValidationReportSection => {
      const matching = validation.issues.filter(i => i.severity === severity)
      return { severity, count: matching.length, summaries: matching.map(i => i.description) }
    })
    .filter(section => section.count > 0)

  return {
    contextId, passed: validation.passed, totalIssues: validation.issues.length, bySeverity,
    wasRedacted: validation.wasRedacted,
    humanReviewRecommended: validation.issues.some(i => i.severity === 'CRITICAL' || i.severity === 'HIGH'),
    generatedAt: new Date().toISOString(),
  }
}

export interface ValidationPipelineInput {
  readonly output: LLMOutput
  readonly context: AIContext
}

export interface ValidationPipelineResult {
  readonly validation: AIValidationResult
  readonly finalAnswer: FinalAnswer
  readonly report: ValidationReport
}

export class ValidationPipeline {
  constructor(private readonly validator: OutputValidator = buildOutputValidator()) {}

  run(input: ValidationPipelineInput): ValidationPipelineResult {
    const validation = this.validator.validate(input.output, input.context)
    const finalAnswer = formatFinalAnswer(input.output, validation, input.context)
    const report = buildValidationReport(validation, input.context.contextId)
    return { validation, finalAnswer, report }
  }
}

export function buildValidationPipeline(): ValidationPipeline {
  return new ValidationPipeline()
}
