import type { LegalBasis } from '../../shared/financial/financialFactory.ts'

// ── Knowledge Platform core types — FROZEN per .memory/knowledge-platform-frozen.md ──
// Rule 1: domain is an open string. Never an enum. New domains never require a type change.

// ── Layer ─────────────────────────────────────────────────────────────────────
// 1=Legal (nationally binding) · 2=Business (operationally binding)
// 3=Organizational (may be MORE restrictive than Layer 1) · 4=Experience (advisory only)

export type KnowledgeLayer = 1 | 2 | 3 | 4

// ── KnowledgeItem — universal across all 16 (eventual) providers ─────────────
// Rule 6: every knowledge artifact — a law, a template, a past case, a risk pattern —
// is a KnowledgeItem. No domain-specific entity type ever escapes src/knowledge/.

export interface EffectivePeriod {
  readonly startDate: string   // YYYY-MM-DD
  readonly endDate?: string    // absent = still in force
}

export interface KnowledgeItem {
  readonly id: string
  readonly domain: string                              // open string — 'legal', 'risk', 'cases', ...
  readonly provider: string                            // provider id that owns this item
  readonly type: string                                // open string — 'LAW', 'TEMPLATE', 'CASE', ...
  readonly title: string
  readonly summary: string
  readonly keywords: readonly string[]
  readonly legalBasis: readonly LegalBasis[]            // RULE-09 — empty when not legally grounded
  readonly relatedItems: readonly string[]              // other KnowledgeItem ids
  readonly metadata: Readonly<Record<string, string>>
  readonly effectivePeriod?: EffectivePeriod
  readonly confidence: number                           // 0.0–1.0
  readonly attachments: readonly string[]               // Storage module AttachmentReference ids
  readonly layer: KnowledgeLayer
  readonly language: string                             // 'vi' | 'en' | ...
  readonly isActive: boolean
  readonly version: string
  readonly createdAt: string
  readonly updatedAt: string
}

// ── KnowledgeApplicabilityRule — universal (Rule 8) ───────────────────────────
// The SAME evaluation logic scopes legal documents, templates, risk patterns, anything.
// undefined on any filter field = "no restriction on this dimension" (matches everything).

export interface KnowledgeApplicabilityRule {
  readonly id: string
  readonly itemId: string
  readonly packageTypes?: readonly string[]
  readonly procurementMethods?: readonly string[]
  readonly fundSources?: readonly string[]
  readonly departments?: readonly string[]
  readonly minValue?: bigint
  readonly maxValue?: bigint
  readonly effectiveFrom: string
  readonly effectiveUntil?: string
  readonly isActive: boolean
  readonly createdAt: string
  readonly updatedAt: string
}

// ── KnowledgeContext — the "what is being worked on right now" bag ───────────
// Providers interpret this per their own domain logic; the platform never inspects it.

export interface KnowledgeContext {
  readonly packageType?: string
  readonly procurementMethod?: string
  readonly fundSource?: string
  readonly department?: string
  readonly valueAmount?: bigint
  readonly asOfDate?: string
  readonly tags?: readonly string[]
  readonly attributes?: Readonly<Record<string, string>>   // open extension bag
}

// ── Query / Result / Suggestion ───────────────────────────────────────────────

export interface KnowledgeQuery {
  readonly text: string
  readonly domains?: readonly string[]   // undefined = search every registered domain
  readonly context?: KnowledgeContext
  readonly limit?: number
}

export interface KnowledgeResult {
  readonly item: KnowledgeItem
  readonly relevance: number      // 0.0–1.0, assigned by ResultRanker
  readonly matchedDomain: string
}

export interface KnowledgeSuggestion {
  readonly item: KnowledgeItem
  readonly reason: string
  readonly confidence: number     // 0.0–1.0
}

// ── IKnowledgeProvider — the ONLY extension point (Rule 2, Rule 5) ────────────
// New domain = new class implementing this + platform.registerProvider(). Zero
// changes to platform/router/ranker/any existing provider.

export interface IKnowledgeProvider {
  readonly domain: string          // open string, unique per provider
  readonly layer: KnowledgeLayer
  readonly version: string

  search(query: KnowledgeQuery): Promise<readonly KnowledgeResult[]>
  resolve(itemId: string): Promise<KnowledgeItem | null>
  suggest(context: KnowledgeContext): Promise<readonly KnowledgeSuggestion[]>
  score(itemId: string, context: KnowledgeContext): Promise<number>
}

// ── KnowledgeGraph relation types — open string set, NEVER an enum (Rule 7) ───
// KNOWLEDGE_RELATION_TYPES documents well-known values for convenience/autocomplete;
// the actual type is plain `string` — new relation types need zero code changes.

export const KNOWLEDGE_RELATION_TYPES = Object.freeze({
  IMPLEMENTS: 'IMPLEMENTS',
  SUPERSEDES: 'SUPERSEDES',
  REFERENCES: 'REFERENCES',
  DEPENDS_ON: 'DEPENDS_ON',
  REQUIRES: 'REQUIRES',
  GENERATES: 'GENERATES',
  USES_TEMPLATE: 'USES_TEMPLATE',
  USES_CHECKLIST: 'USES_CHECKLIST',
  SIMILAR_TO: 'SIMILAR_TO',
  RELATED_TO: 'RELATED_TO',
} as const)
export type KnowledgeRelationType = string

// ── Error ──────────────────────────────────────────────────────────────────────

export const KNOWLEDGE_ERROR_CODES = [
  'ITEM_NOT_FOUND', 'PROVIDER_NOT_FOUND', 'PROVIDER_ALREADY_REGISTERED',
  'VALIDATION_FAILED', 'EDGE_NOT_FOUND',
] as const
export type KnowledgeErrorCode = typeof KNOWLEDGE_ERROR_CODES[number]

export class KnowledgeError extends Error {
  constructor(
    public readonly code: KnowledgeErrorCode,
    public readonly field: string,
    message: string,
  ) {
    super(message)
    this.name = 'KnowledgeError'
  }
}

// ── AIKnowledgeContext — thin composition bundle for the (future) AI Advisory Layer ──
// Phase X consumes ONLY this shape via IKnowledgePlatform.buildAIContext() — never
// providers directly (Rule 4).

export interface AIKnowledgeContext {
  readonly legalBasis: readonly KnowledgeItem[]
  readonly templates: readonly KnowledgeItem[]
  readonly checklists: readonly KnowledgeItem[]
  readonly bestPractices: readonly KnowledgeItem[]
  readonly risks: readonly KnowledgeItem[]
  readonly cases: readonly KnowledgeItem[]
  readonly generatedAt: string
}
