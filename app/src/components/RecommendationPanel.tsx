/**
 * Legal v2.6 — RecommendationPanel
 *
 * Read-only visualization that groups recommendation strings by severity.
 * Input strings follow the optional [LEVEL] text prefix convention
 * (same format as warnings). Strings without a prefix are grouped under LOW.
 *
 * Four collapsible sections in fixed order:
 *   1. Hành động khẩn cấp  — CRITICAL
 *   2. Ưu tiên cao          — HIGH
 *   3. Cần thực hiện        — MEDIUM
 *   4. Khuyến nghị          — LOW (also catches un-prefixed strings)
 *
 * Each section collapses when its group is empty.
 * Returns null when recommendations array is empty or absent.
 * Never throws. Default array to [].
 *
 * Pure functional. No hooks. No browser globals. No LLM calls.
 * No state changes. No IndexedDB. No parsing beyond severity extraction.
 * SSR-compatible.
 */

import React from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecommendationPanelProps {
  /**
   * Recommendation strings, optionally prefixed with [LEVEL].
   * Un-prefixed strings fall into the LOW group.
   */
  recommendations?: string[];
}

// ─── Internal constants ───────────────────────────────────────────────────────

const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
type Severity = (typeof SEVERITY_ORDER)[number];

const SECTION_TITLE: Record<Severity, string> = {
  CRITICAL: 'Hành động khẩn cấp',
  HIGH:     'Ưu tiên cao',
  MEDIUM:   'Cần thực hiện',
  LOW:      'Khuyến nghị',
};

const LEVEL_COLOR: Record<Severity, string> = {
  CRITICAL: 'red',
  HIGH:     'orange',
  MEDIUM:   'yellow',
  LOW:      'green',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function severityOf(s: string): Severity | '' {
  const m = s.match(/^\[(CRITICAL|HIGH|MEDIUM|LOW)\]/);
  return (m?.[1] as Severity) ?? '';
}

/**
 * Parses each string for a [LEVEL] prefix and groups the body text by severity.
 * Strings without a prefix fall into the LOW bucket.
 * Exported for direct unit testing.
 */
export function groupRecommendations(
  recommendations: string[],
): Record<Severity, string[]> {
  const groups: Record<Severity, string[]> = {
    CRITICAL: [],
    HIGH:     [],
    MEDIUM:   [],
    LOW:      [],
  };
  for (const rec of recommendations) {
    const sev  = severityOf(rec);
    const body = sev !== '' ? rec.slice(`[${sev}] `.length) : rec;
    const key: Severity = sev !== '' ? sev : 'LOW';
    groups[key].push(body);
  }
  return groups;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RecommendationPanel({
  recommendations = [],
}: RecommendationPanelProps) {
  if (recommendations.length === 0) return null;

  const groups = groupRecommendations(recommendations);

  return (
    <div data-panel="recommendation">
      {SEVERITY_ORDER.map(sev => {
        const items = groups[sev];
        if (items.length === 0) return null;
        const color = LEVEL_COLOR[sev];
        return (
          <section
            key={sev}
            data-section={`recommendations-${sev.toLowerCase()}`}
            data-severity={sev}
          >
            <h3
              data-field="section-title"
              data-risk-level={sev}
              data-risk-color={color}
              style={{ color, fontWeight: 'bold' }}
            >
              {SECTION_TITLE[sev]}
            </h3>
            <ul data-field="recommendation-list">
              {items.map((item, i) => (
                <li
                  key={i}
                  data-field="recommendation"
                  data-recommendation-severity={sev}
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
