// ── Public API — Knowledge Platform (Phase N, Stage 1: core only) ────────────

// Types
export type {
  KnowledgeLayer, EffectivePeriod, KnowledgeItem, KnowledgeApplicabilityRule,
  KnowledgeContext, KnowledgeQuery, KnowledgeResult, KnowledgeSuggestion,
  IKnowledgeProvider, KnowledgeRelationType, KnowledgeErrorCode, AIKnowledgeContext,
} from './platform/knowledgeTypes.ts'
export { KNOWLEDGE_RELATION_TYPES, KNOWLEDGE_ERROR_CODES, KnowledgeError } from './platform/knowledgeTypes.ts'

// Platform
export type { IKnowledgePlatform } from './platform/knowledgePlatform.ts'
export { DefaultKnowledgePlatform } from './platform/knowledgePlatform.ts'
export type { IProviderRegistry } from './platform/providerRegistry.ts'
export { createProviderRegistry } from './platform/providerRegistry.ts'
export { QueryRouter } from './platform/queryRouter.ts'

// Search
export type { IEmbeddingAdapter } from './search/embeddingAdapter.ts'
export { NoOpEmbeddingAdapter } from './search/embeddingAdapter.ts'
export type { IVectorStoreAdapter, VectorMatch } from './search/vectorStoreAdapter.ts'
export { MemoryVectorStoreAdapter } from './search/vectorStoreAdapter.ts'
export { SearchEngine, scoreKeyword } from './search/searchEngine.ts'
export { ResultRanker } from './search/resultRanker.ts'

// Graph
export type { IKnowledgeGraph, KnowledgeGraphEdge, Subgraph } from './graph/knowledgeGraph.ts'
export { KnowledgeGraphService } from './graph/knowledgeGraph.ts'

// Repositories
export type {
  IKnowledgeItemRepository, IKnowledgeRelationRepository, IApplicabilityRepository, KnowledgeRepositories,
} from './repositories/knowledgeRepositories.ts'
export { buildMemoryKnowledgeRepositories } from './repositories/memoryKnowledgeRepositories.ts'

// Application
export { Retriever, isEffectiveOn, matchesApplicability } from './application/retriever.ts'
export { Resolver } from './application/resolver.ts'
export type { ResolvedItem } from './application/resolver.ts'

// Providers (16 of 16 — Phase N complete; see docs/knowledge-platform.md)
export { BaseKnowledgeProvider } from './providers/baseProvider.ts'
export { LegalProvider } from './providers/legal/legalProvider.ts'
export { ProcurementProvider } from './providers/procurement/procurementProvider.ts'
export { TemplateProvider } from './providers/templates/templateProvider.ts'
export { ChecklistProvider } from './providers/checklists/checklistProvider.ts'
export { OntologyProvider } from './providers/ontology/ontologyProvider.ts'
export { GlossaryProvider } from './providers/glossary/glossaryProvider.ts'
export { VendorKnowledgeProvider } from './providers/vendor/vendorKnowledgeProvider.ts'
export { AssetKnowledgeProvider } from './providers/asset/assetKnowledgeProvider.ts'
export { BudgetKnowledgeProvider } from './providers/budget/budgetKnowledgeProvider.ts'
export { NotificationKnowledgeProvider } from './providers/notification/notificationKnowledgeProvider.ts'
export { SchoolPolicyProvider } from './providers/school/schoolPolicyProvider.ts'
export { CaseProvider } from './providers/cases/caseProvider.ts'
export { RiskProvider } from './providers/risk/riskProvider.ts'
export { AuditProvider } from './providers/audit/auditProvider.ts'
export { BestPracticeProvider } from './providers/bestpractice/bestPracticeProvider.ts'
export { AIFeedbackProvider } from './providers/aifeedback/aiFeedbackProvider.ts'
