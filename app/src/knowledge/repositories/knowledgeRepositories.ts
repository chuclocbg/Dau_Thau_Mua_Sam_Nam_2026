import type { IBaseRepository } from '../../shared/repository/IBaseRepository.ts'
import type { KnowledgeItem, KnowledgeApplicabilityRule, KnowledgeRelationType } from '../platform/knowledgeTypes.ts'
import type { KnowledgeGraphEdge } from '../graph/knowledgeGraph.ts'

// ── IKnowledgeItemRepository ───────────────────────────────────────────────────

export interface IKnowledgeItemRepository extends IBaseRepository<KnowledgeItem> {
  findByDomain(domain: string): Promise<readonly KnowledgeItem[]>
  findActive(domain?: string): Promise<readonly KnowledgeItem[]>
  findByType(type: string): Promise<readonly KnowledgeItem[]>
}

// ── IKnowledgeRelationRepository — persists KnowledgeGraphEdge rows ───────────
// Consumed by KnowledgeGraphService, which adds BFS path/subgraph queries on top.

export interface IKnowledgeRelationRepository {
  create(fromItemId: string, toItemId: string, relationType: KnowledgeRelationType, metadata?: Readonly<Record<string, string>>): Promise<KnowledgeGraphEdge>
  findByFromItem(fromItemId: string): Promise<readonly KnowledgeGraphEdge[]>
  findByToItem(toItemId: string): Promise<readonly KnowledgeGraphEdge[]>
  findAll(): Promise<readonly KnowledgeGraphEdge[]>
}

// ── IApplicabilityRepository ───────────────────────────────────────────────────

export interface IApplicabilityRepository extends IBaseRepository<KnowledgeApplicabilityRule> {
  findByItemId(itemId: string): Promise<readonly KnowledgeApplicabilityRule[]>
  findActive(): Promise<readonly KnowledgeApplicabilityRule[]>
}

// ── Aggregate ──────────────────────────────────────────────────────────────────

export interface KnowledgeRepositories {
  readonly items: IKnowledgeItemRepository
  readonly relations: IKnowledgeRelationRepository
  readonly applicability: IApplicabilityRepository
}
