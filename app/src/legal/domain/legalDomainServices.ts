/**
 * Domain Services — core legal reasoning functions.
 *
 * Rules:
 *   - Every exported function is stateless.
 *   - Pure functions receive all data as parameters (no hidden state).
 *   - Async functions inject repository interfaces as parameters (DI).
 *   - No repository may contain business logic — only CRUD.
 *   - No service may reference a concrete repository class.
 */

import type { LegalDocument } from '../legalRegistry';
import type { Article } from '../legalSchema';
import type {
  IAmendmentRepository,
  IEffectivePeriodRepository,
} from '../legalRepositories';
import {
  docTypeToLevel,
  isHigherAuthority,
  type ApplicabilityContext,
  type ApplicabilityResult,
  type AmendmentChainEntry,
  type ConflictResolution,
  type EffectiveDocumentResult,
  type LegalStatus,
} from './legalDomainTypes';

// ─── 1. determineApplicableLaw ───────────────────────────────────────────────
// Pure. Caller resolves in-force status; pass predicate to keep this testable
// without async dependencies.

export function determineApplicableLaw(
  docs: readonly LegalDocument[],
  context: ApplicabilityContext,
  isInForceOn: (docId: string) => boolean,
): readonly LegalDocument[] {
  return docs
    .filter(d => isInForceOn(d.id))
    .filter(d => !context.domainId || d.tags.includes(context.domainId))
    .sort((a, b) => docTypeToLevel(a.type) - docTypeToLevel(b.type));
}

// ─── 2. resolveEffectiveDocument ─────────────────────────────────────────────
// Async: needs periodRepo to determine if document is in force on the given date.

export async function resolveEffectiveDocument(
  docId: string,
  asOfDate: string,
  periodRepo: IEffectivePeriodRepository,
): Promise<EffectiveDocumentResult> {
  const period = await periodRepo.resolveEffectivePeriod(docId, asOfDate);
  const isInForce = period !== null;
  return {
    docId,
    isInForce,
    period,
    status: isInForce ? 'IN_FORCE' : 'UNKNOWN',
  };
}

// ─── 3. resolveAmendmentChain ────────────────────────────────────────────────
// Async: fetches amendments from repo and returns them in chronological order.

export async function resolveAmendmentChain(
  docId: string,
  asOfDate: string,
  amendRepo: IAmendmentRepository,
): Promise<readonly AmendmentChainEntry[]> {
  const amendments = await amendRepo.listAmendments(docId, asOfDate);
  return amendments
    .slice()
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
    .map(amendment => ({ amendment, appliedDate: amendment.effectiveDate }));
}

// ─── 4. resolveHierarchyConflict ─────────────────────────────────────────────
// Pure. Determines which of two conflicting documents prevails.
// Rules (in order): HIERARCHY → LEX_POSTERIOR → PRIORITY.

export function resolveHierarchyConflict(
  docA: LegalDocument,
  docB: LegalDocument,
): ConflictResolution {
  const levelA = docTypeToLevel(docA.type);
  const levelB = docTypeToLevel(docB.type);

  if (levelA !== levelB) {
    const [win, lose] = levelA < levelB ? [docA, docB] : [docB, docA];
    return {
      prevailingDocId: win.id,
      yieldsDocId:     lose.id,
      rule:            'HIERARCHY',
      reason:          `${win.type} (level ${docTypeToLevel(win.type)}) overrides ${lose.type} (level ${docTypeToLevel(lose.type)})`,
    };
  }

  if (docA.effectiveDate !== docB.effectiveDate) {
    const [win, lose] = docA.effectiveDate >= docB.effectiveDate ? [docA, docB] : [docB, docA];
    return {
      prevailingDocId: win.id,
      yieldsDocId:     lose.id,
      rule:            'LEX_POSTERIOR',
      reason:          `Later document (${win.effectiveDate}) prevails over earlier (${lose.effectiveDate})`,
    };
  }

  const [win, lose] = docA.priority <= docB.priority ? [docA, docB] : [docB, docA];
  return {
    prevailingDocId: win.id,
    yieldsDocId:     lose.id,
    rule:            'PRIORITY',
    reason:          `Document with priority ${win.priority} prevails`,
  };
}

// ─── 5. determineApplicability ───────────────────────────────────────────────
// Pure. Filters articles by keyword match. Title match scores 1.0; content
// match scores 0.5. No subjectMatter → all articles returned at score 1.0.

export function determineApplicability(
  articles: readonly Article[],
  context: ApplicabilityContext,
): readonly ApplicabilityResult[] {
  if (!context.subjectMatter) {
    return articles.map(a => ({
      articleId:      a.id,
      documentId:     a.documentId,
      relevanceScore: 1.0,
      reason:         'no subject filter',
    }));
  }

  const keyword = context.subjectMatter.toLowerCase();
  const results: ApplicabilityResult[] = [];

  for (const a of articles) {
    const inTitle   = a.title.toLowerCase().includes(keyword);
    const inContent = a.content.toLowerCase().includes(keyword);
    if (inTitle || inContent) {
      results.push({
        articleId:      a.id,
        documentId:     a.documentId,
        relevanceScore: inTitle ? 1.0 : 0.5,
        reason:         inTitle ? 'keyword in article title' : 'keyword in article content',
      });
    }
  }

  return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// ─── 6. resolveLegalStatus ───────────────────────────────────────────────────
// Async: checks effective period then amendment history to determine status.
// Hierarchy: IN_FORCE → SUSPENDED → SUPERSEDED → REPEALED → UNKNOWN.

export async function resolveLegalStatus(
  docId: string,
  asOfDate: string,
  periodRepo: IEffectivePeriodRepository,
  amendRepo: IAmendmentRepository,
): Promise<LegalStatus> {
  const effective = await resolveEffectiveDocument(docId, asOfDate, periodRepo);

  if (effective.isInForce) {
    const amends = await amendRepo.listAmendments(docId, asOfDate);
    if (amends.some(a => a.amendmentType === 'SUSPEND')) return 'SUSPENDED';
    return 'IN_FORCE';
  }

  // Not in force — determine why from amendment history
  const allAmends = await amendRepo.listAmendments(docId);
  const before = (effectiveDate: string) => effectiveDate <= asOfDate;

  if (allAmends.some(a => a.amendmentType === 'REPLACE' && before(a.effectiveDate))) return 'SUPERSEDED';
  if (allAmends.some(a => a.amendmentType === 'REPEAL'  && before(a.effectiveDate))) return 'REPEALED';
  if (allAmends.some(a => a.amendmentType === 'SUSPEND' && before(a.effectiveDate))) return 'SUSPENDED';
  return 'UNKNOWN';
}

// re-export helper for consumers
export { isHigherAuthority };
