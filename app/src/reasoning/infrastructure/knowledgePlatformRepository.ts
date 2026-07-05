import type { IKnowledgePlatform } from '../../knowledge/platform/knowledgePlatform.ts'
import type { KnowledgeContext } from '../../knowledge/platform/knowledgeTypes.ts'
import { toKnowledgeItemRef } from '../application/knowledgeReferenceMapper.ts'
import type { KnowledgeReference } from '../domain/knowledgeReferenceTypes.ts'
import type { IKnowledgeRepository, KnowledgeRetrievalResult } from '../domain/knowledgeRepositoryTypes.ts'
import type { ReasoningContext } from '../domain/reasoningTypes.ts'

// ── KnowledgePlatformRepository — Phase X.3.2 ──────────────────────────────────
// The sole file in src/reasoning/ permitted to import IKnowledgePlatform (Constraint C-06),
// verified by an architecture guard test. Wraps the real, frozen Knowledge Platform behind
// IKnowledgeRepository — no ranking, no scoring, no conflict resolution, no citation
// generation, no evidence selection, no filtering beyond what the platform call itself
// already does. A real KnowledgeItem passed to toKnowledgeReferenceMapper.ts's
// toKnowledgeItemRef() satisfies KnowledgeReference structurally (TypeScript structural
// typing) — no adapter/cast needed between the two, per X.3.1's own design note.

function toKnowledgeContext(context: ReasoningContext): KnowledgeContext {
  return {
    packageType: context.packageType,
    procurementMethod: context.procurementMethod,
    fundSource: context.fundSource,
    department: context.department,
    valueAmount: context.estimatedValue,
    asOfDate: context.asOfDate,
  }
}

function mapAll(items: readonly KnowledgeReference[]): KnowledgeRetrievalResult {
  const mapped = items.map(toKnowledgeItemRef)
  return {
    items: mapped.map(m => m.item),
    effectivePeriodAssumedItemIds: mapped
      .filter(m => m.effectivePeriodAssumedFromCreation)
      .map(m => m.item.itemId),
  }
}

export class KnowledgePlatformRepository implements IKnowledgeRepository {
  constructor(private readonly platform: IKnowledgePlatform) {}

  async resolveKnowledge(
    domain: string, context: ReasoningContext, asOfDate: string,
  ): Promise<KnowledgeRetrievalResult> {
    const items = await this.platform.resolveApplicableDocuments(domain, asOfDate, toKnowledgeContext(context))
    return mapAll(items)
  }

  async searchKnowledge(
    text: string, domains: readonly string[], context: ReasoningContext, limit: number,
  ): Promise<KnowledgeRetrievalResult> {
    const results = await this.platform.searchKnowledge(text, domains, toKnowledgeContext(context), limit)
    return mapAll(results.map(r => r.item))
  }
}

export function buildKnowledgePlatformRepository(platform: IKnowledgePlatform): IKnowledgeRepository {
  return new KnowledgePlatformRepository(platform)
}
