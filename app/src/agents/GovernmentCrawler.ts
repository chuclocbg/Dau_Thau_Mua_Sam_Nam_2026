/**
 * Legal v7.0 — GovernmentCrawler
 *
 * crawl(lastAppliedDate, currentDate) → CrawlResult
 *
 * Consumes a NotifyResult and converts each notification channel into a
 * corresponding crawl action, then appends exactly one recrawl/defer action:
 *
 *   ALERT_OPERATOR  — one action when approvalNotifications.length > 0
 *                     (severity = impactLevel; target = "approvalQueue")
 *   INVALIDATE_CACHE — one action per updateNotification
 *                     (target = notification.message; priority = LOW)
 *   WRITE_AUDIT      — one action per auditNotification
 *                     (target = notification.message;
 *                      priority = HIGH when severity==="HIGH", else LOW)
 *   RECRAWL_PRIORITY — when impactLevel is CRITICAL or HIGH
 *   DEFER            — when impactLevel is MEDIUM or LOW
 *
 * Ordering: ALERT_OPERATOR → INVALIDATE_CACHE → WRITE_AUDIT →
 *           RECRAWL_PRIORITY|DEFER.  Within each group source order is
 *           preserved.  No sorting.  No grouping.  No deduplication.
 *
 * crawlFromNotify() is exported so tests can inject synthetic NotifyResult
 * objects for scenarios that real data cannot produce (CRITICAL impact,
 * non-empty approval/update channels, ROLLBACK audit entries).
 *
 * Calls NotificationCenter.notify() exactly once.
 * Never calls SchedulerAgent, WorkflowAgent, RollbackManager,
 * HumanReviewQueue, TemplateAutoUpdater, ChangeImpactAgent,
 * LegalUpdateAgent, or any v4.x engine directly.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. Deterministic. No singleton. No cache. No side effects.
 * No LLM. No browser globals. No hooks. No IndexedDB. No UI.
 */

import { NotificationCenter } from './NotificationCenter';
import type { Notification }  from './NotificationCenter';
import type { ImpactLevel }   from '../ai/updatePackageEngine';

// ─── Public types ─────────────────────────────────────────────────────────────

export type CrawlActionType = 'ALERT_OPERATOR' | 'INVALIDATE_CACHE' | 'WRITE_AUDIT' | 'RECRAWL_PRIORITY' | 'DEFER';
export type CrawlPriority   = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface CrawlAction {
  type:     CrawlActionType;
  target:   string;
  priority: CrawlPriority;
}

export interface CrawlResult {
  impactLevel:           ImpactLevel;
  approvalNotifications: readonly Notification[];
  updateNotifications:   readonly Notification[];
  auditNotifications:    readonly Notification[];
  crawlActions:          readonly CrawlAction[];
}

// ─── Internal narrow type ─────────────────────────────────────────────────────

// Only the fields crawlFromNotify actually reads.
interface MinNotify {
  impactLevel:           ImpactLevel;
  approvalNotifications: readonly Notification[];
  updateNotifications:   readonly Notification[];
  auditNotifications:    readonly Notification[];
}

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function crawlFromNotify(notify: MinNotify): CrawlResult {
  const actions: CrawlAction[] = [];

  // 1. ALERT_OPERATOR — one action when any approvals are pending
  if (notify.approvalNotifications.length > 0) {
    actions.push({
      type:     'ALERT_OPERATOR',
      target:   'approvalQueue',
      priority: notify.impactLevel,
    });
  }

  // 2. INVALIDATE_CACHE — one per update notification
  for (const n of notify.updateNotifications) {
    actions.push({
      type:     'INVALIDATE_CACHE',
      target:   n.message,
      priority: 'LOW',
    });
  }

  // 3. WRITE_AUDIT — one per audit notification, in order
  for (const n of notify.auditNotifications) {
    actions.push({
      type:     'WRITE_AUDIT',
      target:   n.message,
      priority: n.severity === 'HIGH' ? 'HIGH' : 'LOW',
    });
  }

  // 4. RECRAWL_PRIORITY or DEFER — exactly one, always last
  if (notify.impactLevel === 'CRITICAL') {
    actions.push({ type: 'RECRAWL_PRIORITY', target: 'critical-regulations',      priority: 'CRITICAL' });
  } else if (notify.impactLevel === 'HIGH') {
    actions.push({ type: 'RECRAWL_PRIORITY', target: 'high-priority-regulations', priority: 'HIGH' });
  } else {
    actions.push({ type: 'DEFER',            target: 'next-window',               priority: 'LOW' });
  }

  return {
    impactLevel:           notify.impactLevel,
    approvalNotifications: notify.approvalNotifications,
    updateNotifications:   notify.updateNotifications,
    auditNotifications:    notify.auditNotifications,
    crawlActions:          actions,
  };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class GovernmentCrawler {
  constructor(private readonly notificationCenter: NotificationCenter = new NotificationCenter()) {}

  crawl(lastAppliedDate: string, currentDate: string): CrawlResult {
    return crawlFromNotify(this.notificationCenter.notify(lastAppliedDate, currentDate));
  }
}
