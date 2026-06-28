/**
 * Phase 16 — Governance Knowledge Base: Content Types
 *
 * Defines the 8 structured content types stored in the Knowledge Base and
 * their corresponding factory functions.  All values are immutable after
 * construction (frozen arrays and metadata objects).
 *
 * Content types:
 *   DocumentTemplate    — document structure (clauses, citations, checklists)
 *   GovernanceClause    — reusable legal clause text with {{placeholders}}
 *   GovernanceChecklist — phase-specific governance checklists
 *   LegalCitation       — exact legal citation (law + article + text)
 *   WorkflowKnowledge   — human-readable workflow description and steps
 *   AuthorityKnowledge  — authority role definition and escalation chain
 *   GovernancePrompt    — structured AI prompt with input schema
 *   DocumentMetadata    — document metadata schema and required fields
 *
 * Factories:
 *   createDocumentTemplate()
 *   createGovernanceClause()
 *   createGovernanceChecklist()
 *   createLegalCitation()
 *   createWorkflowKnowledge()
 *   createAuthorityKnowledge()
 *   createGovernancePrompt()
 *   createDocumentMetadata()
 *
 * Pure. No I/O. No side effects. No any. No React. No browser globals.
 */

// ─── DocumentTemplate ─────────────────────────────────────────────────────────

/** Defines the structure of a governance document (clauses, citations, checklists). */
export interface DocumentTemplate {
  readonly id:            string;
  readonly name:          string;
  readonly documentType:  string;       // e.g. 'PROCUREMENT_NOTICE', 'REJECTION_LETTER'
  readonly version:       string;
  readonly clauses:       readonly string[];   // GovernanceClause ids required by this template
  readonly citations:     readonly string[];   // LegalCitation ids required by this template
  readonly checklists:    readonly string[];   // GovernanceChecklist ids required by this template
  readonly metadata:      Readonly<Record<string, string>>;
  readonly locale:        string;             // defaults to 'vi-VN'
  readonly status:        'ACTIVE' | 'DEPRECATED';
  readonly effectiveDate: string;             // ISO YYYY-MM-DD
}

export function createDocumentTemplate(params: {
  readonly id:            string;
  readonly name:          string;
  readonly documentType:  string;
  readonly version:       string;
  readonly effectiveDate: string;
  readonly clauses?:      readonly string[];
  readonly citations?:    readonly string[];
  readonly checklists?:   readonly string[];
  readonly metadata?:     Record<string, string>;
  readonly locale?:       string;
  readonly status?:       'ACTIVE' | 'DEPRECATED';
}): DocumentTemplate {
  return {
    id:            params.id,
    name:          params.name,
    documentType:  params.documentType,
    version:       params.version,
    effectiveDate: params.effectiveDate,
    clauses:       Object.freeze([...(params.clauses   ?? [])]),
    citations:     Object.freeze([...(params.citations ?? [])]),
    checklists:    Object.freeze([...(params.checklists ?? [])]),
    metadata:      Object.freeze({ ...(params.metadata ?? {}) }),
    locale:        params.locale ?? 'vi-VN',
    status:        params.status ?? 'ACTIVE',
  };
}

// ─── GovernanceClause ─────────────────────────────────────────────────────────

/** Reusable legal clause with {{placeholder}} variables for document assembly. */
export interface GovernanceClause {
  readonly id:       string;
  readonly title:    string;
  readonly body:     string;       // may contain {{variable}} placeholders
  readonly category: string;       // e.g. 'AUTHORITY', 'LEGAL_BASIS', 'COMPLIANCE'
  readonly tags:     readonly string[];
  readonly locale:   string;
  readonly status:   'ACTIVE' | 'DEPRECATED';
}

export function createGovernanceClause(params: {
  readonly id:       string;
  readonly title:    string;
  readonly body:     string;
  readonly category: string;
  readonly tags?:    readonly string[];
  readonly locale?:  string;
  readonly status?:  'ACTIVE' | 'DEPRECATED';
}): GovernanceClause {
  return {
    id:       params.id,
    title:    params.title,
    body:     params.body,
    category: params.category,
    tags:     Object.freeze([...(params.tags ?? [])]),
    locale:   params.locale ?? 'vi-VN',
    status:   params.status ?? 'ACTIVE',
  };
}

// ─── GovernanceChecklist ──────────────────────────────────────────────────────

/** Single item within a GovernanceChecklist. */
export interface ChecklistItem {
  readonly id:       string;
  readonly label:    string;
  readonly required: boolean;
  readonly hint?:    string;
}

/** Phase-specific governance checklist (pre-procurement, evaluation, compliance, approval). */
export interface GovernanceChecklist {
  readonly id:     string;
  readonly title:  string;
  readonly phase:  string;             // e.g. 'PRE_PROCUREMENT', 'EVALUATION', 'COMPLIANCE'
  readonly items:  readonly ChecklistItem[];
  readonly locale: string;
  readonly status: 'ACTIVE' | 'DEPRECATED';
}

export function createGovernanceChecklist(params: {
  readonly id:     string;
  readonly title:  string;
  readonly phase:  string;
  readonly items?: readonly ChecklistItem[];
  readonly locale?: string;
  readonly status?: 'ACTIVE' | 'DEPRECATED';
}): GovernanceChecklist {
  return {
    id:     params.id,
    title:  params.title,
    phase:  params.phase,
    items:  Object.freeze([...(params.items ?? [])]),
    locale: params.locale ?? 'vi-VN',
    status: params.status ?? 'ACTIVE',
  };
}

// ─── LegalCitation ────────────────────────────────────────────────────────────

/** Exact legal citation: document symbol + article + excerpt text. */
export interface LegalCitation {
  readonly id:         string;
  readonly symbol:     string;         // e.g. '43/2013/QH13'
  readonly title:      string;
  readonly article?:   string;         // e.g. 'Điều 5'
  readonly paragraph?: string;         // e.g. 'Khoản 2'
  readonly text:       string;         // cited excerpt
  readonly tags:       readonly string[];
  readonly locale:     string;
}

export function createLegalCitation(params: {
  readonly id:         string;
  readonly symbol:     string;
  readonly title:      string;
  readonly text:       string;
  readonly article?:   string;
  readonly paragraph?: string;
  readonly tags?:      readonly string[];
  readonly locale?:    string;
}): LegalCitation {
  return {
    id:         params.id,
    symbol:     params.symbol,
    title:      params.title,
    text:       params.text,
    article:    params.article,
    paragraph:  params.paragraph,
    tags:       Object.freeze([...(params.tags ?? [])]),
    locale:     params.locale ?? 'vi-VN',
  };
}

// ─── WorkflowKnowledge ────────────────────────────────────────────────────────

/** Single step in a WorkflowKnowledge sequence. */
export interface WorkflowStep {
  readonly id:    string;
  readonly state: string;             // matches workflow state id
  readonly label: string;
  readonly actor: string;             // responsible actor role
  readonly docs:  readonly string[];  // required DocumentTemplate ids for this step
}

/** Human-readable description of a workflow including step-level requirements. */
export interface WorkflowKnowledge {
  readonly id:           string;
  readonly workflowId:   string;      // links to WORKFLOW_DEFINITION config id
  readonly name:         string;
  readonly description:  string;
  readonly steps:        readonly WorkflowStep[];
  readonly requirements: readonly string[];  // general pre-conditions
  readonly locale:       string;
}

export function createWorkflowKnowledge(params: {
  readonly id:            string;
  readonly workflowId:    string;
  readonly name:          string;
  readonly description:   string;
  readonly steps?:        readonly WorkflowStep[];
  readonly requirements?: readonly string[];
  readonly locale?:       string;
}): WorkflowKnowledge {
  return {
    id:           params.id,
    workflowId:   params.workflowId,
    name:         params.name,
    description:  params.description,
    steps:        Object.freeze([...(params.steps        ?? [])]),
    requirements: Object.freeze([...(params.requirements ?? [])]),
    locale:       params.locale ?? 'vi-VN',
  };
}

// ─── AuthorityKnowledge ───────────────────────────────────────────────────────

/** Authority role definition including threshold and escalation target. */
export interface AuthorityKnowledge {
  readonly id:           string;
  readonly role:         string;         // matches AUTHORITY_MATRIX metadata.role
  readonly title:        string;         // human-readable role title
  readonly maxAmount?:   number;         // VND ceiling for this authority
  readonly escalatesTo?: string;         // role of next authority level
  readonly locale:       string;
}

export function createAuthorityKnowledge(params: {
  readonly id:           string;
  readonly role:         string;
  readonly title:        string;
  readonly maxAmount?:   number;
  readonly escalatesTo?: string;
  readonly locale?:      string;
}): AuthorityKnowledge {
  return {
    id:          params.id,
    role:        params.role,
    title:       params.title,
    maxAmount:   params.maxAmount,
    escalatesTo: params.escalatesTo,
    locale:      params.locale ?? 'vi-VN',
  };
}

// ─── GovernancePrompt ─────────────────────────────────────────────────────────

/** Structured AI prompt template with declared input variables. */
export interface GovernancePrompt {
  readonly id:          string;
  readonly name:        string;
  readonly category:    string;           // e.g. 'DRAFT', 'REVIEW', 'SUMMARIZE', 'EXPLAIN'
  readonly template:    string;           // prompt text with {{placeholder}} variables
  readonly inputSchema: Readonly<Record<string, string>>;  // variable name → description
  readonly version:     string;
  readonly locale:      string;
}

export function createGovernancePrompt(params: {
  readonly id:          string;
  readonly name:        string;
  readonly category:    string;
  readonly template:    string;
  readonly version:     string;
  readonly inputSchema?: Record<string, string>;
  readonly locale?:     string;
}): GovernancePrompt {
  return {
    id:          params.id,
    name:        params.name,
    category:    params.category,
    template:    params.template,
    version:     params.version,
    inputSchema: Object.freeze({ ...(params.inputSchema ?? {}) }),
    locale:      params.locale ?? 'vi-VN',
  };
}

// ─── DocumentMetadata ─────────────────────────────────────────────────────────

/** Metadata schema for a document type: required and optional field declarations. */
export interface DocumentMetadata {
  readonly documentType:    string;
  readonly title:           string;
  readonly issuer?:         string;
  readonly version:         string;
  readonly locale:          string;
  readonly requiredFields:  readonly string[];
  readonly optionalFields:  readonly string[];
}

export function createDocumentMetadata(params: {
  readonly documentType:    string;
  readonly title:           string;
  readonly version:         string;
  readonly issuer?:         string;
  readonly requiredFields?: readonly string[];
  readonly optionalFields?: readonly string[];
  readonly locale?:         string;
}): DocumentMetadata {
  return {
    documentType:   params.documentType,
    title:          params.title,
    version:        params.version,
    issuer:         params.issuer,
    requiredFields: Object.freeze([...(params.requiredFields ?? [])]),
    optionalFields: Object.freeze([...(params.optionalFields ?? [])]),
    locale:         params.locale ?? 'vi-VN',
  };
}
