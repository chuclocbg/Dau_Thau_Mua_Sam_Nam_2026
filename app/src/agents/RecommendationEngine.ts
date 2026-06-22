/**
 * Legal v9.9 — RecommendationEngine
 *
 * Accepts a DocumentListPanel, calls panel.render(descriptor) exactly once,
 * and produces a RecommendationResult containing a prioritised list of
 * actionable Recommendations derived from the PanelOutput.
 *
 * Recommendation codes:
 *   NO_ACTION         — panel is empty; no documents required for this period
 *   NAMED_FOCUS       — a specific document was requested (namedLabel ≠ null)
 *   PREPARE_ALL       — top-level summary: prepare all n documents by date
 *   FOCUS_REQUIRED    — mandatory documents present; address them first
 *   CONSIDER_OPTIONAL — optional documents available; review them
 *
 * Priority assignment (lower number = higher priority):
 *   1. NAMED_FOCUS (when namedLabel ≠ null)
 *   2. PREPARE_ALL  (always present when hasActions)
 *   3. FOCUS_REQUIRED (when requiredItems.length > 0)
 *   4. CONSIDER_OPTIONAL (when optionalItems.length > 0)
 *   Numbering advances sequentially so gaps never occur and order is stable.
 *
 * When isEmpty:
 *   recommendations = [{ code:'NO_ACTION', priority:1, labels:[] }]
 *   primaryCode = 'NO_ACTION'
 *   hasActions  = false
 *
 * Recommendation.labels:
 *   NAMED_FOCUS       — [namedLabel]
 *   PREPARE_ALL       — all labels (requiredItems + optionalItems), source order
 *   FOCUS_REQUIRED    — required labels only, source order
 *   CONSIDER_OPTIONAL — optional labels only, source order
 *   NO_ACTION         — []
 *
 * recommendFromPanel() is exported for direct test injection with synthetic
 * PanelOutput objects.
 *
 * Calls panel.render() exactly once per recommend() invocation.
 * Does NOT call UiIntegrationLayer.prepare() or PipelineOrchestrator.run() directly.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. No mutation. No cache. No I/O. No side effects.
 * No singleton. No randomness. Deterministic output per fixed input.
 * No AI. No LLM. No filesystem. No browser globals.
 * No hooks. No IndexedDB. No HTTP.
 */

import { buildPanel }                   from './DocumentListPanel';
import type { DocumentListPanel }       from './DocumentListPanel';
import type { QueryDescriptor }         from './QueryPlanner';

// ─── Public types ─────────────────────────────────────────────────────────────

export type RecommendationCode =
  | 'NO_ACTION'
  | 'NAMED_FOCUS'
  | 'PREPARE_ALL'
  | 'FOCUS_REQUIRED'
  | 'CONSIDER_OPTIONAL';

export interface Recommendation {
  code:     RecommendationCode;
  message:  string;
  priority: number;
  labels:   readonly string[];
}

export interface RecommendationResult {
  recommendations: readonly Recommendation[];
  primaryCode:     RecommendationCode;
  hasActions:      boolean;
  targetDate:      string;
  totalCount:      number;
}

// ─── Internal narrow types ────────────────────────────────────────────────────

interface MinItem { label: string; }

interface MinPanelOutput {
  targetDate:    string;
  isEmpty:       boolean;
  namedLabel:    string | null;
  requiredItems: readonly MinItem[];
  optionalItems: readonly MinItem[];
  totalCount:    number;
}

interface MinDocumentListPanel {
  render(descriptor?: QueryDescriptor): MinPanelOutput;
}

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function recommendFromPanel(panel: MinPanelOutput): RecommendationResult {
  if (panel.isEmpty) {
    return {
      recommendations: [{ code: 'NO_ACTION', message: 'No documents required for this period',
                          priority: 1, labels: [] }],
      primaryCode: 'NO_ACTION',
      hasActions:  false,
      targetDate:  panel.targetDate,
      totalCount:  panel.totalCount,
    };
  }

  const recs: Recommendation[] = [];
  let p = 1;
  const n = panel.totalCount;
  const r = panel.requiredItems.length;
  const o = panel.optionalItems.length;

  if (panel.namedLabel !== null) {
    recs.push({ code: 'NAMED_FOCUS', priority: p++,
                message: `Review named document: ${panel.namedLabel}`,
                labels: [panel.namedLabel] });
  }

  recs.push({ code: 'PREPARE_ALL', priority: p++,
              message: `Prepare all ${n} document${n !== 1 ? 's' : ''} by ${panel.targetDate}`,
              labels: [...panel.requiredItems, ...panel.optionalItems].map(i => i.label) });

  if (r > 0) {
    recs.push({ code: 'FOCUS_REQUIRED', priority: p++,
                message: `Focus on ${r} required document${r !== 1 ? 's' : ''} first`,
                labels: panel.requiredItems.map(i => i.label) });
  }

  if (o > 0) {
    recs.push({ code: 'CONSIDER_OPTIONAL', priority: p++,
                message: `Consider adding ${o} optional document${o !== 1 ? 's' : ''}`,
                labels: panel.optionalItems.map(i => i.label) });
  }

  // items are pushed in priority order; sort is explicit for stability
  recs.sort((a, b) => a.priority - b.priority);

  return {
    recommendations: recs,
    primaryCode:     recs[0].code,
    hasActions:      true,
    targetDate:      panel.targetDate,
    totalCount:      panel.totalCount,
  };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class RecommendationEngine {
  constructor(private readonly panel: MinDocumentListPanel) {}

  recommend(descriptor: QueryDescriptor = {}): RecommendationResult {
    return recommendFromPanel(this.panel.render(descriptor));
  }
}

// ─── Pipeline factory ─────────────────────────────────────────────────────────

export function buildRecommendationEngine(
  lastAppliedDate: string,
  currentDate:     string,
  panel:           DocumentListPanel = buildPanel(lastAppliedDate, currentDate),
): RecommendationEngine {
  return new RecommendationEngine(panel);
}
