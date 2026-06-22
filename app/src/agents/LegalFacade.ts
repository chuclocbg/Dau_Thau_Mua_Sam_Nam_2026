/**
 * Legal v10.1 — LegalFacade
 *
 * Final public entry point for the Legal document pipeline. Exposes a single
 * method — query(descriptor) — that delegates to AuditTrail exactly twice:
 * once to record the execution (audit), once to retrieve the accumulated
 * history (report). Returns a LegalResult combining both.
 *
 * This is a boundary layer, not a processing layer. It does not:
 *   - transform, filter, or re-order any data
 *   - add business logic or conditional branching on result content
 *   - hold any state of its own beyond the injected AuditTrail instance
 *
 * LegalResult fields:
 *   record  — the AuditRecord produced by the current query() call
 *   history — the full AuditHistory snapshot (includes the current record)
 *
 * Because AuditTrail.audit() appends and returns the same object reference,
 * and AuditTrail.report() returns records as a direct array reference,
 * the following identity always holds after query():
 *   result.record === result.history.latestRecord
 *
 * legalFromAudit() is exported as a pure helper for direct injection in tests
 * with synthetic AuditRecord / AuditHistory objects. It is a thin constructor
 * that exists only to give tests a named seam.
 *
 * Consumer contract:
 *   const facade = buildLegalFacade(lastAppliedDate, currentDate);
 *   const { record, history } = facade.query({ scope: 'required' });
 *   // record  → current execution outcome
 *   // history → cumulative audit log since facade was instantiated
 *
 * Calls trail.audit() exactly once and trail.report() exactly once per
 * query() invocation.
 * Does NOT call RecommendationEngine.recommend() or any lower layer directly.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure (legalFromAudit). No mutation. No cache. No I/O. No side effects.
 * No singleton. No randomness. Deterministic output per fixed input.
 * No AI. No LLM. No filesystem. No browser globals.
 * No hooks. No IndexedDB. No HTTP.
 */

import { buildAuditTrail }           from './AuditTrail';
import type { AuditTrail,
              AuditRecord,
              AuditHistory }         from './AuditTrail';
import type { QueryDescriptor }      from './QueryPlanner';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface LegalResult {
  record:  AuditRecord;
  history: AuditHistory;
}

// ─── Internal narrow types ────────────────────────────────────────────────────

interface MinAuditTrail {
  audit(descriptor?: QueryDescriptor): AuditRecord;
  report(): AuditHistory;
}

// ─── Exported pure helper ─────────────────────────────────────────────────────

export function legalFromAudit(record: AuditRecord, history: AuditHistory): LegalResult {
  return { record, history };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class LegalFacade {
  constructor(private readonly trail: MinAuditTrail) {}

  query(descriptor: QueryDescriptor = {}): LegalResult {
    const record  = this.trail.audit(descriptor);
    const history = this.trail.report();
    return legalFromAudit(record, history);
  }
}

// ─── Pipeline factory ─────────────────────────────────────────────────────────

export function buildLegalFacade(
  lastAppliedDate: string,
  currentDate:     string,
  trail:           AuditTrail = buildAuditTrail(lastAppliedDate, currentDate),
): LegalFacade {
  return new LegalFacade(trail);
}
