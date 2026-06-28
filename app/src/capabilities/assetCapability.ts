/**
 * Phase 19 — Asset Capability
 *
 * Second production business capability.  Accepts a GovernanceCase (Phase 19
 * pattern) and orchestrates the Reasoning Engine to produce an AssetDecision.
 *
 * Input type: GovernanceCase   (contains the GovernanceContext used internally)
 * Output type: AssetDecision   (complete governance output for asset operations)
 *
 * Public APIs:
 *   analyzeAsset(c)           → GovernanceDecision   (full 7-step reasoning)
 *   resolveAssetAuthority(c)  → readonly AuthorityLevel[]
 *   resolveAssetCompliance(c) → readonly ComplianceWarning[]
 *   resolveAssetWorkflow(c)   → readonly GovernanceConfig[]
 *   generateAssetDecision(c)  → AssetDecision         (complete output)
 *   buildAssetCapability(...)  — factory
 *
 * Framework integration:
 *   const adapter: Capability = {
 *     metadata: createCapabilityMetadata({ domain: 'ASSETS', ... }),
 *     execute:  (ctx) => assetCap.generateAssetDecision(createCase({ context: ctx, ... })),
 *   };
 *   framework.registry.registerCapability(adapter);
 *
 * No business logic beyond orchestration. No UI. No HTTP. No React.
 * Pure. No I/O. No side effects. No any. No browser globals.
 */

import type { GovernanceReasoningEngine } from '../reasoning/reasoningEngine';
import type { GovernanceCase }            from '../cases/caseModel';
import type { GovernanceConfig }          from '../legal/governanceConfig';
import type { LegalDocument }            from '../legal/legalRegistry';
import type {
  GovernanceDecision,
  AuthorityLevel,
  ComplianceWarning,
  RiskAssessment,
} from '../reasoning/decisionModel';

// ─── AssetDecision types ──────────────────────────────────────────────────────

export type AssetRecommendation = 'PROCEED' | 'ESCALATE' | 'BLOCK' | 'INSUFFICIENT_DATA';

export interface AssetDecision {
  readonly governanceCase:     GovernanceCase;
  readonly governanceDecision: GovernanceDecision;
  readonly applicableLaw:      readonly LegalDocument[];
  readonly applicableWorkflow: readonly GovernanceConfig[];
  readonly approvalAuthority:  readonly AuthorityLevel[];
  readonly complianceWarnings: readonly ComplianceWarning[];
  readonly riskAssessment:     RiskAssessment;
  readonly recommendation:     AssetRecommendation;
  readonly nextSteps:          readonly string[];
  readonly requiredApprovals:  readonly string[];
  readonly decidedAt:          string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveAssetRecommendation(decision: GovernanceDecision): AssetRecommendation {
  // verdict and AssetRecommendation share the same four values
  return decision.summary.verdict as AssetRecommendation;
}

function buildAssetNextSteps(
  recommendation: AssetRecommendation,
  approvalCount:  number,
): readonly string[] {
  switch (recommendation) {
    case 'PROCEED':
      return Object.freeze(
        approvalCount > 0
          ? ['Submit asset for approval.', 'Attach required supporting documents.', 'Initiate asset workflow.']
          : ['Initiate asset workflow.', 'Attach required supporting documents.'],
      );
    case 'ESCALATE':
      return Object.freeze([
        'Escalate to higher authority.',
        'Attach compliance documentation.',
        'Await senior approval before proceeding.',
      ]);
    case 'BLOCK':
      return Object.freeze([
        'Resolve critical compliance issues.',
        'Consult legal advisory before resubmitting.',
      ]);
    default:
      return Object.freeze(['Provide complete asset governance context and resubmit.']);
  }
}

function resolveRequiredApprovals(
  chain:        readonly AuthorityLevel[],
  packageValue: number | undefined,
): readonly string[] {
  if (chain.length === 0) return Object.freeze([]);
  const amount   = packageValue;
  const approver = amount !== undefined
    ? chain.find(a => a.maxAmount === undefined || a.maxAmount >= amount)
    : chain[0];
  return approver ? Object.freeze([approver.role]) : Object.freeze([]);
}

// ─── Factory ──────────────────────────────────────────────────────────────────

function createAssetDecision(params: {
  readonly governanceCase:     GovernanceCase;
  readonly governanceDecision: GovernanceDecision;
  readonly applicableLaw:      readonly LegalDocument[];
  readonly applicableWorkflow: readonly GovernanceConfig[];
  readonly approvalAuthority:  readonly AuthorityLevel[];
  readonly complianceWarnings: readonly ComplianceWarning[];
  readonly riskAssessment:     RiskAssessment;
  readonly recommendation:     AssetRecommendation;
  readonly nextSteps:          readonly string[];
  readonly requiredApprovals:  readonly string[];
}): AssetDecision {
  return {
    governanceCase:     params.governanceCase,
    governanceDecision: params.governanceDecision,
    applicableLaw:      Object.freeze([...params.applicableLaw]),
    applicableWorkflow: Object.freeze([...params.applicableWorkflow]),
    approvalAuthority:  Object.freeze([...params.approvalAuthority]),
    complianceWarnings: Object.freeze([...params.complianceWarnings]),
    riskAssessment:     params.riskAssessment,
    recommendation:     params.recommendation,
    nextSteps:          Object.freeze([...params.nextSteps]),
    requiredApprovals:  Object.freeze([...params.requiredApprovals]),
    decidedAt:          new Date().toISOString(),
  };
}

// ─── Capability class ─────────────────────────────────────────────────────────

export class AssetCapability {
  constructor(
    private readonly reasoningEngine: GovernanceReasoningEngine,
  ) {}

  /** Runs the full 7-step reasoning pipeline for the asset case. */
  analyzeAsset(governanceCase: GovernanceCase): GovernanceDecision {
    return this.reasoningEngine.generateDecision(governanceCase.context);
  }

  /** Returns the ordered approval authority chain (ascending maxAmount). */
  resolveAssetAuthority(governanceCase: GovernanceCase): readonly AuthorityLevel[] {
    return this.reasoningEngine.resolveAuthority(governanceCase.context);
  }

  /** Returns compliance warnings for the asset context. */
  resolveAssetCompliance(governanceCase: GovernanceCase): readonly ComplianceWarning[] {
    return this.reasoningEngine.resolveCompliance(governanceCase.context);
  }

  /** Returns applicable workflow configs for the asset context. */
  resolveAssetWorkflow(governanceCase: GovernanceCase): readonly GovernanceConfig[] {
    return this.reasoningEngine.resolveWorkflow(governanceCase.context);
  }

  /** Orchestrates all four APIs into a complete AssetDecision. */
  generateAssetDecision(governanceCase: GovernanceCase): AssetDecision {
    const decision    = this.analyzeAsset(governanceCase);
    const workflow    = this.resolveAssetWorkflow(governanceCase);
    const authority   = this.resolveAssetAuthority(governanceCase);
    const compliance  = this.resolveAssetCompliance(governanceCase);
    const rec         = deriveAssetRecommendation(decision);
    const nextSteps   = buildAssetNextSteps(rec, authority.length);
    const approvals   = resolveRequiredApprovals(authority, governanceCase.context.packageValue);

    return createAssetDecision({
      governanceCase,
      governanceDecision: decision,
      applicableLaw:      decision.applicableLaws,
      applicableWorkflow: workflow,
      approvalAuthority:  authority,
      complianceWarnings: compliance,
      riskAssessment:     decision.riskAssessment,
      recommendation:     rec,
      nextSteps,
      requiredApprovals:  approvals,
    });
  }
}

export function buildAssetCapability(
  reasoningEngine: GovernanceReasoningEngine,
): AssetCapability {
  return new AssetCapability(reasoningEngine);
}
