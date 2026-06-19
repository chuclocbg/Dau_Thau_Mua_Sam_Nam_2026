/**
 * P6 agents barrel — public API for the multi-agent procurement system.
 *
 * Import from this path rather than directly from individual agent modules
 * so that future agents can be added here without changing call sites.
 */

// ─── Core message contracts ────────────────────────────────────────────────────

export { AgentRegistry } from './AgentRegistry';

export type { AgentId, AgentMessage, IAgent } from './types';

// ─── P6-01: Procurement Planner Agent ─────────────────────────────────────────

export {
  PlannerAgent,
  generateTraceId,
  buildMinimalProcurementPackage,
  parseGoalIntoItems,
  detectPackageSplitting,
  validateAuthority,
  buildCalendar,
  type PlannerInput,
  type PlannerOutput,
  type PlannerState,
  type PlannerStateEvent,
  type SplitWarningPayload,
} from './PlannerAgent';

// ─── P6-02: Specification Agent ───────────────────────────────────────────────

export {
  SpecificationAgent,
  reviewSpec,
  suggestAlternatives,
  generateSpecWithReasoning,
  batchGenerate,
  type SpecInput,
  type SpecOutput,
  type BatchSpecInput,
  type BatchSpecOutput,
  type SpecState,
  type SpecStateEvent,
  type PackageType,
} from './SpecificationAgent';

// ─── P6-03: Legal Reviewer Agent ──────────────────────────────────────────────

export {
  LegalReviewerAgent,
  detectCrossDocumentIssues,
  calculateComplianceScore,
  summarizeFindings,
  reviewPackage,
  type DossierReviewInput,
  type DossierReviewOutput,
  type CrossCheckIssue,
  type ReviewerState,
  type ReviewerStateEvent,
} from './LegalReviewerAgent';

// ─── P6-04: Risk Agent ────────────────────────────────────────────────────────

export {
  RiskAgent,
  detectSystemicRisks,
  buildRiskMatrix,
  calculateAuditExposure,
  buildMitigationPlan,
  type RiskInput,
  type RiskOutput,
  type RiskMatrixEntry,
  type SystemicRisk,
  type MitigationStep,
  type OverallRisk,
  type RiskState,
  type RiskStateEvent,
} from './RiskAgent';

// ─── P6-05: Conversational Chat Agent ─────────────────────────────────────────

export {
  ChatAgent,
  searchKnowledge,
  buildAnswer,
  chat,
  suggestFollowUps,
  extractPackageContext,
  type ChatMessage,
  type ChatInput,
  type ChatOutput,
  type ChatState,
  type ChatStateEvent,
} from './ChatAgent';

// ─── P6-06: Autonomous Procurement Agent ──────────────────────────────────────

export {
  AutonomousAgent,
  runPlanning,
  runSpecifying,
  runLegalReview,
  runRiskAssessment,
  buildSessionSummary,
  type WorkflowState,
  type AgentSession,
  type UserQuestion,
  type UserAnswer,
  type AutonomousInput,
  type AutonomousOutput,
  type AutonomousStateEvent,
} from './AutonomousAgent';
