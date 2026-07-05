/**
 * Payment History Service
 *
 * Audit trail for PaymentRequest lifecycle events.
 * History entries are APPEND-ONLY per PRINCIPLE 3 (immutable history).
 * No entry is ever modified or deleted.
 */

import type { PaymentHistoryEntry, PaymentAction, PaymentStatus, PaymentEvent } from './paymentTypes';
import type { IPaymentHistoryRepository } from './paymentRepository';
import { buildHistoryEntry, buildPaymentEvent } from './paymentFactory';

let _seq = 0;
function seq(): string { return `hist-${Date.now()}-${++_seq}`; }
function evtSeq(): string { return `evt-${Date.now()}-${++_seq}`; }

// ─── Record a lifecycle transition ────────────────────────────────────────────

export async function recordPaymentAction(
  repo:        IPaymentHistoryRepository,
  requestId:   string,
  action:      PaymentAction,
  performedBy: string,
  options?:    { fromStatus?: PaymentStatus; toStatus?: PaymentStatus; notes?: string },
): Promise<PaymentHistoryEntry> {
  const entry = buildHistoryEntry({
    id:          seq(),
    requestId,
    action,
    performedBy,
    fromStatus:  options?.fromStatus,
    toStatus:    options?.toStatus,
    notes:       options?.notes,
  });
  return repo.create(entry as Omit<PaymentHistoryEntry, 'id' | 'createdAt' | 'updatedAt'>);
}

// ─── Get full history for a request ──────────────────────────────────────────

export async function getPaymentHistory(
  repo:      IPaymentHistoryRepository,
  requestId: string,
): Promise<readonly PaymentHistoryEntry[]> {
  return repo.findByRequestId(requestId);
}

// ─── Reconstruct events from history ─────────────────────────────────────────

export function historyToEvents(
  entries: readonly PaymentHistoryEntry[],
): readonly PaymentEvent[] {
  return entries.map(e =>
    buildPaymentEvent({
      id:          evtSeq(),
      requestId:   e.requestId,
      eventType:   e.action,
      performedBy: e.performedBy,
      notes:       e.notes,
    }),
  );
}

// ─── Check if a specific action has occurred ─────────────────────────────────

export function hasActionOccurred(
  entries: readonly PaymentHistoryEntry[],
  action:  PaymentAction,
): boolean {
  return entries.some(e => e.action === action);
}

// ─── Get most recent status from history ─────────────────────────────────────

export function getLastStatus(
  entries: readonly PaymentHistoryEntry[],
): PaymentStatus | undefined {
  const sorted = [...entries].sort((a, b) => b.performedAt.localeCompare(a.performedAt));
  return sorted[0]?.toStatus;
}

// ─── Count actions of a given type ───────────────────────────────────────────

export function countActions(
  entries: readonly PaymentHistoryEntry[],
  action:  PaymentAction,
): number {
  return entries.filter(e => e.action === action).length;
}
