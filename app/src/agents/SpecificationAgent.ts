/**
 * P6-02A: SpecificationAgent — type declarations + class skeleton.
 *
 * State machine (to be implemented in P6-02B):
 *   idle → reviewing-input → generating-spec → checking-brands
 *        → [suggesting-alternatives?] → composing-response → idle
 *
 * Builds on P5-02 (specGenerator.ts): adds reasoning fields,
 * multi-item batch processing, and LegalReviewerAgent feedback loop (P6-03).
 */

// ─── Type-only imports ────────────────────────────────────────────────────────

import type { AgentMessage, IAgent } from './types';
import type { AgentRegistry }        from './AgentRegistry';
import type { LegalFinding }         from '../ai/legalReviewer';
import type { ProcurementPackage }   from '../demoData';
import type { SpecSuggestion }       from '../ai/specGenerator';

// ─── Runtime imports — P5-02 ──────────────────────────────────────────────────

import { generateItemSpec, detectBrandLocking } from '../ai/specGenerator';

// ─── Re-export P5-02 public API as unified entry point ───────────────────────

export type { SpecSuggestion };
export { generateItemSpec, detectBrandLocking };

// ─── PackageType ──────────────────────────────────────────────────────────────

/** Derived from ProcurementPackage to avoid duplicating the union literal. */
export type PackageType = NonNullable<ProcurementPackage['packageType']>;

// ─── SpecInput ────────────────────────────────────────────────────────────────

export interface SpecInput {
  /** Item name in Vietnamese, as entered by the user. */
  itemName: string;
  packageType: PackageType;
  estimatedUnitPrice?: number;
  /** Existing spec text to audit for brand references. */
  existingSpecs?: string;
  /** Findings forwarded from LegalReviewerAgent (P6-03) for feedback loop. */
  legalFindings?: LegalFinding[];
}

// ─── SpecOutput ───────────────────────────────────────────────────────────────

export interface SpecOutput {
  /** Brand-neutral specification text, ready for HSMT insertion. */
  specs: string;
  /** One reasoning entry per criterion — required for audit traceability. */
  reasoning: string[];
  /** Brand names detected and removed from the spec. */
  brandWarnings: string[];
  /** Functional alternatives to any brand-locked criteria. */
  alternatives: string[];
  complianceStatus: 'compliant' | 'warning' | 'violation';
  /** Legal citations justifying the spec decisions. */
  legalBasis: string[];
}

// ─── BatchSpecInput / BatchSpecOutput ─────────────────────────────────────────

export interface BatchSpecInput {
  items: SpecInput[];
  /** Optional shared context applied to every item (e.g. lab environment). */
  sharedContext?: string;
}

export interface BatchSpecOutput {
  results: Array<{ itemName: string; output: SpecOutput }>;
  totalBrandWarnings: number;
  /** Worst compliance status across all items in the batch. */
  overallComplianceStatus: 'compliant' | 'warning' | 'violation';
  legalBasis: string[];
}

// ─── SpecState ────────────────────────────────────────────────────────────────

export type SpecState =
  | 'idle'
  | 'reviewing-input'
  | 'generating-spec'
  | 'checking-brands'
  | 'suggesting-alternatives'
  | 'composing-response';

// ─── SpecStateEvent ───────────────────────────────────────────────────────────

/** Emitted to the registry trace on every state transition. */
export interface SpecStateEvent {
  previousState: SpecState;
  nextState:     SpecState;
  timestamp:     number;
  detail?:       string;
}

// ─── SpecificationAgent ───────────────────────────────────────────────────────

export class SpecificationAgent implements IAgent {
  readonly id   = 'specification' as const;
  readonly name = 'Specification Agent';

  private state:           SpecState    = 'idle';
  private currentTraceId:  string | null = null;
  private readonly registry: AgentRegistry;

  constructor(registry: AgentRegistry) {
    this.registry = registry;
  }

  getCapabilities(): string[] {
    return [
      'spec-generation',
      'brand-detection',
      'alternative-suggestion',
      'batch-spec-processing',
    ];
  }

  // process() and private helpers will be implemented in P6-02B.
  async process(_msg: AgentMessage): Promise<AgentMessage> {
    throw new Error(
      'SpecificationAgent.process() not yet implemented — complete P6-02B first',
    );
  }
}
