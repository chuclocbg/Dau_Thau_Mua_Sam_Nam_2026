/**
 * Legal v8.0 — DocumentDependencyResolver
 *
 * resolve(lastAppliedDate, currentDate) → DocumentDependencyResult
 *
 * Consumes a TemplateDependencyResult and expands template-level nodes and
 * edges into document-level nodes and edges using the static DOCUMENT_REGISTRY.
 *
 * Document node shape:
 *   { id: documentId, template: templateId, type: 'DOCUMENT' }
 *
 * Node order:
 *   1. Template order from TemplateDependencyResult.templates
 *   2. Registry order within each template
 *
 * Document edge types:
 *   SELF     — every document → itself; one per document; always first
 *   TEMPLATE — one per (templateEdge × srcDoc × dstDoc); all template edge
 *              types (SELF and DOMAIN) are expanded; skips no template edges
 *
 * For NONE scope or non-READY status the template list is empty, so
 * documents and documentEdges naturally resolve to [].
 *
 * status, impactScope, and impactLevel are forwarded unchanged.
 *
 * resolveFromTemplate() is exported so tests can inject synthetic
 * TemplateDependencyResult objects for all scope/topology/registry scenarios.
 *
 * Calls TemplateDependencyResolver.resolve() exactly once.
 * Never calls DependencyGraphBuilder, ImpactAnalyzer, KnowledgeGraphBuilder,
 * RegulationClassifier, RegulationParser, RegulationFetcher, SnapshotBuilder,
 * or any v4.x engine directly.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. Deterministic. No singleton. No cache. No side effects.
 * No AI. No NLP. No browser globals. No hooks. No IndexedDB. No HTTP.
 */

import { TemplateDependencyResolver }   from './TemplateDependencyResolver';
import type { ImpactScope, ImpactLevel } from './ImpactAnalyzer';
import type { SnapshotStatus }           from './SnapshotBuilder';
import { DOCUMENT_REGISTRY }            from '../legal/documentRegistry';

// ─── Public types ─────────────────────────────────────────────────────────────

export type DocumentNodeType = 'DOCUMENT';
export type DocumentEdgeType = 'SELF' | 'TEMPLATE';

export interface DocumentNode {
  id:       string;
  template: string;
  type:     DocumentNodeType;
}

export interface DocumentEdge {
  from: string;
  to:   string;
  type: DocumentEdgeType;
}

export interface DocumentDependencyMetadata {
  documentCount: number;
  edgeCount:     number;
  targetDate:    string;
}

export interface DocumentDependencyResult {
  status:        SnapshotStatus;
  impactScope:   ImpactScope;
  impactLevel:   ImpactLevel;
  documents:     readonly DocumentNode[];
  documentEdges: readonly DocumentEdge[];
  metadata:      DocumentDependencyMetadata;
}

// ─── Internal narrow type ─────────────────────────────────────────────────────

interface MinTemplateNode {
  id:     string;
  domain: string;
  type:   string;
}

interface MinTemplateEdge {
  from: string;
  to:   string;
  type: string;
}

interface MinTemplate {
  status:        SnapshotStatus;
  impactScope:   ImpactScope;
  impactLevel:   ImpactLevel;
  templates:     readonly MinTemplateNode[];
  templateEdges: readonly MinTemplateEdge[];
  metadata:      { targetDate: string };
}

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function resolveFromTemplate(tmpl: MinTemplate): DocumentDependencyResult {
  const { status, impactScope, impactLevel } = tmpl;
  const targetDate = tmpl.metadata.targetDate;

  // Expand template nodes → document nodes (template order then registry order)
  const documents: DocumentNode[] = [];
  for (const t of tmpl.templates) {
    for (const docId of DOCUMENT_REGISTRY[t.id] ?? []) {
      documents.push({ id: docId, template: t.id, type: 'DOCUMENT' });
    }
  }

  const documentEdges: DocumentEdge[] = [];

  // SELF edges — one per document
  for (const doc of documents) {
    documentEdges.push({ from: doc.id, to: doc.id, type: 'SELF' });
  }

  // TEMPLATE edges — expand every template edge to document pairs
  for (const tEdge of tmpl.templateEdges) {
    const srcDocs = documents.filter(d => d.template === tEdge.from);
    const dstDocs = documents.filter(d => d.template === tEdge.to);
    for (const src of srcDocs) {
      for (const dst of dstDocs) {
        documentEdges.push({ from: src.id, to: dst.id, type: 'TEMPLATE' });
      }
    }
  }

  const metadata: DocumentDependencyMetadata = {
    documentCount: documents.length,
    edgeCount:     documentEdges.length,
    targetDate,
  };

  return { status, impactScope, impactLevel, documents, documentEdges, metadata };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class DocumentDependencyResolver {
  constructor(
    private readonly templateResolver: TemplateDependencyResolver = new TemplateDependencyResolver(),
  ) {}

  resolve(lastAppliedDate: string, currentDate: string): DocumentDependencyResult {
    return resolveFromTemplate(this.templateResolver.resolve(lastAppliedDate, currentDate));
  }
}
