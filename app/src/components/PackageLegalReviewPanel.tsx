/**
 * 8-E: PackageLegalReviewPanel — surfaces P5-03 reviewPackage() findings.
 *
 * Accepts a pre-computed LegalReviewResult so the component is pure,
 * SSR-compatible, and testable via renderToString without any side effects.
 * Callers (App.tsx) invoke reviewPackage(selectedPackage) and pass the result.
 *
 * Findings are rendered with severity badges and data-* attributes.
 * Severity order in result is guaranteed by reviewPackage (CRITICAL → LOW).
 */

import type { LegalReviewResult, LegalFinding } from '../ai/legalReviewer';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PackageLegalReviewPanelProps {
  result:   LegalReviewResult;
  loading?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function FindingItem({ finding }: { finding: LegalFinding }) {
  return (
    <li
      data-finding={finding.code}
      data-severity={finding.severity}
      data-category={finding.category}
    >
      <span data-field="severity">{`[${finding.severity}]`}</span>
      <span data-field="code">{finding.code}</span>
      <span data-field="message">{finding.message}</span>
      <span data-field="legal-basis">{finding.legalBasis}</span>
      <span data-field="recommendation">{finding.recommendation}</span>
    </li>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PackageLegalReviewPanel({
  result,
  loading = false,
}: PackageLegalReviewPanelProps) {
  if (loading) {
    return (
      <div data-panel="legal-review" data-state="loading">
        <span data-field="message">Đang phân tích hồ sơ pháp lý...</span>
      </div>
    );
  }

  const findingCount = result.findings.length;

  if (findingCount === 0) {
    return (
      <div data-panel="legal-review" data-state="clean" data-finding-count={0}>
        <span data-field="summary">{result.summary}</span>
        <span data-field="message">Không phát hiện rủi ro pháp lý.</span>
      </div>
    );
  }

  return (
    <div
      data-panel="legal-review"
      data-state="findings"
      data-finding-count={findingCount}
      data-has-critical={String(result.hasCritical)}
      data-has-high={String(result.hasHigh)}
    >
      <h2 data-field="title">Kết quả kiểm tra pháp lý</h2>
      <span data-field="summary">{result.summary}</span>
      <span data-field="finding-count">{findingCount}</span>
      <ul data-field="finding-list">
        {result.findings.map((f, i) => (
          <FindingItem key={`${f.code}-${i}`} finding={f} />
        ))}
      </ul>
    </div>
  );
}
