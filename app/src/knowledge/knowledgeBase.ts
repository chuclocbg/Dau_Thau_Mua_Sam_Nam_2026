/**
 * Phase 16 — Governance Knowledge Base
 *
 * Single facade over all 8 knowledge content stores.
 * Indexed at construction time — all lookups are O(1) Map lookups.
 *
 * Public APIs:
 *   findTemplate(id)             → DocumentTemplate | undefined
 *   findClause(id)               → GovernanceClause | undefined
 *   findChecklist(id)            → GovernanceChecklist | undefined
 *   findCitation(id)             → LegalCitation | undefined
 *   findWorkflow(id)             → WorkflowKnowledge | undefined
 *   findAuthority(role)          → AuthorityKnowledge | undefined
 *   findPrompt(id)               → GovernancePrompt | undefined
 *   resolveTemplate(id)          → ResolvedTemplate | undefined
 *   resolveChecklist(phase)      → readonly GovernanceChecklist[]
 *   resolveDocumentMetadata(type)→ DocumentMetadata | undefined
 *   buildGovernanceKnowledgeBase(...)  — factory
 *
 * resolveTemplate hydrates a template by pulling its referenced clauses,
 * citations, and checklists from their respective stores. Unknown ids in
 * the template's reference lists are silently skipped (content may be
 * loaded incrementally).
 *
 * Does not call the Reasoning Engine or kernel modules at runtime.
 * The Document Generator (Phase 17) uses both the Reasoning Engine and
 * the Knowledge Base independently — they do not call each other.
 *
 * Pure. No I/O. No side effects. No any. No React. No browser globals.
 */

import type {
  DocumentTemplate,
  GovernanceClause,
  GovernanceChecklist,
  LegalCitation,
  WorkflowKnowledge,
  AuthorityKnowledge,
  GovernancePrompt,
  DocumentMetadata,
} from './knowledgeTypes';

// ─── Resolved template ────────────────────────────────────────────────────────

/** A template with all referenced clauses, citations, and checklists hydrated. */
export interface ResolvedTemplate {
  readonly template:   DocumentTemplate;
  readonly clauses:    readonly GovernanceClause[];
  readonly citations:  readonly LegalCitation[];
  readonly checklists: readonly GovernanceChecklist[];
}

// ─── Knowledge Base ───────────────────────────────────────────────────────────

export class GovernanceKnowledgeBase {
  private readonly templateIndex:    Map<string, DocumentTemplate>;
  private readonly clauseIndex:      Map<string, GovernanceClause>;
  private readonly checklistIndex:   Map<string, GovernanceChecklist>;
  private readonly citationIndex:    Map<string, LegalCitation>;
  private readonly workflowIndex:    Map<string, WorkflowKnowledge>;
  private readonly authorityByRole:  Map<string, AuthorityKnowledge>;
  private readonly promptIndex:      Map<string, GovernancePrompt>;
  private readonly metadataByType:   Map<string, DocumentMetadata>;
  private readonly checklistsByPhase: Map<string, readonly GovernanceChecklist[]>;

  constructor(
    templates:   readonly DocumentTemplate[],
    clauses:     readonly GovernanceClause[],
    checklists:  readonly GovernanceChecklist[],
    citations:   readonly LegalCitation[],
    workflows:   readonly WorkflowKnowledge[],
    authorities: readonly AuthorityKnowledge[],
    prompts:     readonly GovernancePrompt[],
    metadatas:   readonly DocumentMetadata[],
  ) {
    this.templateIndex   = new Map(templates.map(t => [t.id,            t]));
    this.clauseIndex     = new Map(clauses.map(c   => [c.id,            c]));
    this.checklistIndex  = new Map(checklists.map(c => [c.id,           c]));
    this.citationIndex   = new Map(citations.map(c  => [c.id,           c]));
    this.workflowIndex   = new Map(workflows.map(w  => [w.id,           w]));
    this.authorityByRole = new Map(authorities.map(a => [a.role,        a]));
    this.promptIndex     = new Map(prompts.map(p    => [p.id,           p]));
    this.metadataByType  = new Map(metadatas.map(m  => [m.documentType, m]));

    const byPhase = new Map<string, GovernanceChecklist[]>();
    for (const cl of checklists) {
      const arr = byPhase.get(cl.phase) ?? [];
      arr.push(cl);
      byPhase.set(cl.phase, arr);
    }
    this.checklistsByPhase = new Map(
      [...byPhase.entries()].map(([k, v]) => [k, Object.freeze(v)]),
    );
  }

  // ── Point lookups ──────────────────────────────────────────────────────────

  findTemplate(id: string): DocumentTemplate | undefined {
    return this.templateIndex.get(id);
  }

  findClause(id: string): GovernanceClause | undefined {
    return this.clauseIndex.get(id);
  }

  findChecklist(id: string): GovernanceChecklist | undefined {
    return this.checklistIndex.get(id);
  }

  findCitation(id: string): LegalCitation | undefined {
    return this.citationIndex.get(id);
  }

  findWorkflow(id: string): WorkflowKnowledge | undefined {
    return this.workflowIndex.get(id);
  }

  /** Looks up authority by role string (matches AUTHORITY_MATRIX metadata.role). */
  findAuthority(role: string): AuthorityKnowledge | undefined {
    return this.authorityByRole.get(role);
  }

  findPrompt(id: string): GovernancePrompt | undefined {
    return this.promptIndex.get(id);
  }

  // ── Resolution ─────────────────────────────────────────────────────────────

  /**
   * Hydrates a template by resolving its clause, citation, and checklist ids.
   * Unknown ids in the reference lists are silently skipped.
   * Returns undefined when the template id itself is unknown.
   */
  resolveTemplate(id: string): ResolvedTemplate | undefined {
    const template = this.templateIndex.get(id);
    if (!template) return undefined;

    const clauses    = template.clauses.map(cid   => this.clauseIndex.get(cid)).filter((x): x is GovernanceClause    => x !== undefined);
    const citations  = template.citations.map(cid  => this.citationIndex.get(cid)).filter((x): x is LegalCitation     => x !== undefined);
    const checklists = template.checklists.map(cid => this.checklistIndex.get(cid)).filter((x): x is GovernanceChecklist => x !== undefined);

    return {
      template,
      clauses:    Object.freeze(clauses),
      citations:  Object.freeze(citations),
      checklists: Object.freeze(checklists),
    };
  }

  /** Returns all active checklists for the given workflow phase. */
  resolveChecklist(phase: string): readonly GovernanceChecklist[] {
    return this.checklistsByPhase.get(phase) ?? Object.freeze([]);
  }

  /** Looks up the DocumentMetadata schema for the given document type. */
  resolveDocumentMetadata(documentType: string): DocumentMetadata | undefined {
    return this.metadataByType.get(documentType);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function buildGovernanceKnowledgeBase(
  templates:   readonly DocumentTemplate[]   = [],
  clauses:     readonly GovernanceClause[]   = [],
  checklists:  readonly GovernanceChecklist[]= [],
  citations:   readonly LegalCitation[]      = [],
  workflows:   readonly WorkflowKnowledge[]  = [],
  authorities: readonly AuthorityKnowledge[] = [],
  prompts:     readonly GovernancePrompt[]   = [],
  metadatas:   readonly DocumentMetadata[]   = [],
): GovernanceKnowledgeBase {
  return new GovernanceKnowledgeBase(
    templates, clauses, checklists, citations, workflows, authorities, prompts, metadatas,
  );
}
