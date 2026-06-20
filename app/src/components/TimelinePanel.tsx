/**
 * Legal v2.7 — TimelinePanel
 *
 * Read-only visualization of the 8-stage procurement lifecycle.
 * Each stage shows ✓ (present), ⚠ (missing), or no icon (unknown).
 * The first missing stage in fixed order becomes the "current stage".
 *
 * Returns null when both presentDocuments and missingDocuments are empty.
 * Never throws. All arrays default to [].
 *
 * Pure functional. No hooks. No browser globals. No LLM calls.
 * No state changes. No IndexedDB. SSR-compatible.
 */

import React from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimelinePanelProps {
  /** Present procurement documents — same shape as ChecklistPanelProps.presentDocuments */
  presentDocuments?: Array<{ label: string; docType?: string }>;
  /** RequiredDocument[] from AgentMessage.missingDocuments (unknown[] in transport) */
  missingDocuments?: unknown[];
}

// ─── Stage definitions ────────────────────────────────────────────────────────

interface Stage {
  id:    string;
  label: string;
}

// Fixed procurement lifecycle order — matches legalChecklistEngine docType identifiers.
const LIFECYCLE_STAGES: Stage[] = [
  { id: 'to-trinh',             label: 'Tờ trình' },
  { id: 'khlcnt',               label: 'KHLCNT' },
  { id: 'hsyc',                 label: 'HSYC' },
  { id: 'quyet-dinh-phe-duyet', label: 'Quyết định phê duyệt' },
  { id: 'hop-dong',             label: 'Hợp đồng' },
  { id: 'bien-ban-nghiem-thu',  label: 'Nghiệm thu' },
  { id: 'bien-ban-ban-giao',    label: 'Bàn giao' },
  { id: 'thanh-ly',             label: 'Thanh lý' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function TimelinePanel({
  presentDocuments = [],
  missingDocuments = [],
}: TimelinePanelProps) {
  if (presentDocuments.length === 0 && missingDocuments.length === 0) return null;

  const presentSet = new Set(
    presentDocuments.map((d) => d.docType ?? ''),
  );
  const missingSet = new Set(
    (missingDocuments as Array<{ docType?: string }>).map((d) => d.docType ?? ''),
  );

  // First missing stage in fixed lifecycle order determines the current stage.
  const currentStage = LIFECYCLE_STAGES.find((s) => missingSet.has(s.id));

  return (
    <div data-panel="timeline">
      <h3 data-field="title">Vòng đời hồ sơ mua sắm</h3>

      {/* Current stage indicator — absent when all documents are present */}
      {currentStage != null && (
        <div data-field="current-stage" data-stage-id={currentStage.id}>
          <span data-field="current-stage-label">{currentStage.label}</span>
        </div>
      )}

      <ol data-field="stage-list">
        {LIFECYCLE_STAGES.map((stage, i) => {
          const status    = presentSet.has(stage.id)
            ? 'present'
            : missingSet.has(stage.id)
            ? 'missing'
            : 'unknown';
          const icon      = status === 'present' ? '✓' : status === 'missing' ? '⚠' : '';
          const isCurrent = currentStage?.id === stage.id;

          return (
            <li
              key={stage.id}
              data-field="stage"
              data-stage-id={stage.id}
              data-stage-status={status}
              data-stage-index={i}
              data-current-stage={String(isCurrent)}
            >
              {icon !== '' && (
                <span data-field="stage-icon" data-icon={icon}>{icon}</span>
              )}
              <span data-field="stage-label">{stage.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
