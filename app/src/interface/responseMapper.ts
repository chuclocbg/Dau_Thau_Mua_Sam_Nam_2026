/**
 * Phase 14 — Response Mapper
 *
 * Maps a GovernanceResult<T> to an HTTP response envelope.
 *
 * Status mapping:
 *   SUCCESS         → 200 OK
 *   PENDING         → 202 Accepted  (operation queued, not yet complete)
 *   REQUIRES_REVIEW → 202 Accepted  (human review required before proceeding)
 *   FAILED          → 400 Bad Request (validation error, guard failure, etc.)
 *
 * The full GovernanceResult is always forwarded as the response body so callers
 * can inspect status, messages, warnings, errors, auditTrail, and legalReferences
 * regardless of the HTTP status code.
 *
 * Pure. No I/O. No side effects. No any. No React. No browser globals.
 */

import type { GovernanceResult, ResultStatus } from '../application/governanceContext';
import type { HttpResponse }                   from './ports';

// ─── Status → HTTP code ───────────────────────────────────────────────────────

/**
 * Maps a GovernanceResult status to an HTTP status code.
 *
 * REQUIRES_REVIEW maps to 202 (not 422) because the request was understood
 * and an action was taken — a human must now review before the process can
 * continue. 422 would imply a semantic error in the request itself.
 */
export function mapStatusToHttp(status: ResultStatus): number {
  switch (status) {
    case 'SUCCESS':         return 200;
    case 'PENDING':         return 202;
    case 'REQUIRES_REVIEW': return 202;
    case 'FAILED':          return 400;
  }
}

// ─── Result → HTTP response ───────────────────────────────────────────────────

/**
 * Wraps a GovernanceResult in an HttpResponse with the appropriate status code.
 * The body is the unmodified GovernanceResult — no re-mapping or stripping.
 */
export function mapResultToResponse<T>(result: GovernanceResult<T>): HttpResponse<T> {
  return {
    httpStatus: mapStatusToHttp(result.status),
    body:       result,
  };
}
