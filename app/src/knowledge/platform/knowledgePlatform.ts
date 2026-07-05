import type {
  KnowledgeItem, KnowledgeContext, KnowledgeResult, IKnowledgeProvider, AIKnowledgeContext,
} from './knowledgeTypes.ts'
import type { IProviderRegistry } from './providerRegistry.ts'
import { createProviderRegistry } from './providerRegistry.ts'
import { QueryRouter } from './queryRouter.ts'
import type { KnowledgeRepositories } from '../repositories/knowledgeRepositories.ts'
import { Retriever } from '../application/retriever.ts'
import { Resolver } from '../application/resolver.ts'
import type { IKnowledgeGraph } from '../graph/knowledgeGraph.ts'
import { KnowledgeGraphService } from '../graph/knowledgeGraph.ts'

// ── Well-known domain keys ─────────────────────────────────────────────────────
// These name the convenience methods below (resolveTemplates → 'templates', etc.)
// — they do NOT restrict which domains may be registered (Rule 1: domain stays an
// open string everywhere else). A brand-new domain works immediately through
// searchKnowledge()/resolveApplicableDocuments()/registerProvider() with zero
// changes here; a named convenience method is just documentation-as-code for the
// 16 domains the frozen spec already anticipates.

const DOMAIN_KEYS = Object.freeze({
  LEGAL: 'legal',
  TEMPLATES: 'templates',
  CHECKLISTS: 'checklists',
  BEST_PRACTICE: 'bestpractice',
  CASES: 'cases',
  RISK: 'risk',
  AUDIT: 'audit',
  SCHOOL: 'school',
  VENDOR: 'vendor',
  ASSET: 'asset',
  BUDGET: 'budget',
} as const)

// ── IKnowledgePlatform — the ONLY interface the (future) AI Advisory Layer may import ──

export interface IKnowledgePlatform {
  registerProvider(provider: IKnowledgeProvider): void

  searchKnowledge(text: string, domains?: readonly string[], context?: KnowledgeContext, limit?: number): Promise<readonly KnowledgeResult[]>
  resolveKnowledge(itemId: string): Promise<KnowledgeItem | null>
  resolveApplicableDocuments(domain: string, asOfDate: string, context: KnowledgeContext): Promise<readonly KnowledgeItem[]>

  resolveLegalBasis(context: KnowledgeContext, asOfDate: string): Promise<readonly KnowledgeItem[]>
  resolveTemplates(context: KnowledgeContext, asOfDate: string): Promise<readonly KnowledgeItem[]>
  resolveChecklist(context: KnowledgeContext, asOfDate: string): Promise<readonly KnowledgeItem[]>
  resolveBestPractice(context: KnowledgeContext, asOfDate: string): Promise<readonly KnowledgeItem[]>
  resolveCases(context: KnowledgeContext, asOfDate: string): Promise<readonly KnowledgeItem[]>
  resolveRisk(context: KnowledgeContext, asOfDate: string): Promise<readonly KnowledgeItem[]>
  resolveAuditFinding(context: KnowledgeContext, asOfDate: string): Promise<readonly KnowledgeItem[]>
  resolveSchoolPolicy(context: KnowledgeContext, asOfDate: string): Promise<readonly KnowledgeItem[]>
  resolveVendorKnowledge(context: KnowledgeContext, asOfDate: string): Promise<readonly KnowledgeItem[]>
  resolveAssetKnowledge(context: KnowledgeContext, asOfDate: string): Promise<readonly KnowledgeItem[]>
  resolveBudgetKnowledge(context: KnowledgeContext, asOfDate: string): Promise<readonly KnowledgeItem[]>

  /** Every registered domain's applicable items, keyed by domain. */
  resolveContext(context: KnowledgeContext, asOfDate: string): Promise<Readonly<Record<string, readonly KnowledgeItem[]>>>

  /** Thin composition bundle for the future AI Advisory Layer (Phase X). */
  buildAIContext(context: KnowledgeContext, asOfDate: string): Promise<AIKnowledgeContext>
}

// ── DefaultKnowledgePlatform ───────────────────────────────────────────────────

export class DefaultKnowledgePlatform implements IKnowledgePlatform {
  private readonly registry: IProviderRegistry
  private readonly router: QueryRouter
  private readonly retriever: Retriever
  private readonly resolver: Resolver
  readonly graph: IKnowledgeGraph

  constructor(repos: KnowledgeRepositories) {
    this.registry = createProviderRegistry()
    this.router = new QueryRouter(this.registry)
    this.retriever = new Retriever(repos)
    this.graph = new KnowledgeGraphService(repos.relations)
    this.resolver = new Resolver(repos, this.graph)
  }

  registerProvider(provider: IKnowledgeProvider): void {
    this.registry.register(provider)
  }

  async searchKnowledge(
    text: string,
    domains?: readonly string[],
    context?: KnowledgeContext,
    limit?: number,
  ): Promise<readonly KnowledgeResult[]> {
    return this.router.route({ text, domains, context, limit })
  }

  async resolveKnowledge(itemId: string): Promise<KnowledgeItem | null> {
    return this.resolver.resolve(itemId)
  }

  async resolveApplicableDocuments(
    domain: string,
    asOfDate: string,
    context: KnowledgeContext,
  ): Promise<readonly KnowledgeItem[]> {
    return this.retriever.resolveApplicableDocuments(domain, asOfDate, context)
  }

  resolveLegalBasis(context: KnowledgeContext, asOfDate: string) {
    return this.retriever.resolveApplicableDocuments(DOMAIN_KEYS.LEGAL, asOfDate, context)
  }
  resolveTemplates(context: KnowledgeContext, asOfDate: string) {
    return this.retriever.resolveApplicableDocuments(DOMAIN_KEYS.TEMPLATES, asOfDate, context)
  }
  resolveChecklist(context: KnowledgeContext, asOfDate: string) {
    return this.retriever.resolveApplicableDocuments(DOMAIN_KEYS.CHECKLISTS, asOfDate, context)
  }
  resolveBestPractice(context: KnowledgeContext, asOfDate: string) {
    return this.retriever.resolveApplicableDocuments(DOMAIN_KEYS.BEST_PRACTICE, asOfDate, context)
  }
  resolveCases(context: KnowledgeContext, asOfDate: string) {
    return this.retriever.resolveApplicableDocuments(DOMAIN_KEYS.CASES, asOfDate, context)
  }
  resolveRisk(context: KnowledgeContext, asOfDate: string) {
    return this.retriever.resolveApplicableDocuments(DOMAIN_KEYS.RISK, asOfDate, context)
  }
  resolveAuditFinding(context: KnowledgeContext, asOfDate: string) {
    return this.retriever.resolveApplicableDocuments(DOMAIN_KEYS.AUDIT, asOfDate, context)
  }
  resolveSchoolPolicy(context: KnowledgeContext, asOfDate: string) {
    return this.retriever.resolveApplicableDocuments(DOMAIN_KEYS.SCHOOL, asOfDate, context)
  }
  resolveVendorKnowledge(context: KnowledgeContext, asOfDate: string) {
    return this.retriever.resolveApplicableDocuments(DOMAIN_KEYS.VENDOR, asOfDate, context)
  }
  resolveAssetKnowledge(context: KnowledgeContext, asOfDate: string) {
    return this.retriever.resolveApplicableDocuments(DOMAIN_KEYS.ASSET, asOfDate, context)
  }
  resolveBudgetKnowledge(context: KnowledgeContext, asOfDate: string) {
    return this.retriever.resolveApplicableDocuments(DOMAIN_KEYS.BUDGET, asOfDate, context)
  }

  async resolveContext(
    context: KnowledgeContext,
    asOfDate: string,
  ): Promise<Readonly<Record<string, readonly KnowledgeItem[]>>> {
    const domains = this.registry.listDomains()
    const entries = await Promise.all(
      domains.map(async domain =>
        [domain, await this.retriever.resolveApplicableDocuments(domain, asOfDate, context)] as const,
      ),
    )
    return Object.fromEntries(entries)
  }

  async buildAIContext(context: KnowledgeContext, asOfDate: string): Promise<AIKnowledgeContext> {
    const [legalBasis, templates, checklists, bestPractices, risks, cases] = await Promise.all([
      this.resolveLegalBasis(context, asOfDate),
      this.resolveTemplates(context, asOfDate),
      this.resolveChecklist(context, asOfDate),
      this.resolveBestPractice(context, asOfDate),
      this.resolveRisk(context, asOfDate),
      this.resolveCases(context, asOfDate),
    ])

    return {
      legalBasis, templates, checklists, bestPractices, risks, cases,
      generatedAt: new Date().toISOString(),
    }
  }
}
