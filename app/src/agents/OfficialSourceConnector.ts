/**
 * Legal v7.1 — OfficialSourceConnector
 *
 * connect(lastAppliedDate, currentDate) → ConnectResult
 *
 * Consumes a CrawlResult and routes each CrawlAction to the appropriate
 * external source, producing four job buckets:
 *
 *   approvalJobs — one per ALERT_OPERATOR action
 *                  source=OPERATOR_QUEUE, action=PUSH_APPROVAL,
 *                  priority forwarded from crawlAction
 *
 *   cacheJobs    — one per INVALIDATE_CACHE action
 *                  source=CACHE_LAYER, action=INVALIDATE, priority=LOW
 *
 *   auditJobs    — one per WRITE_AUDIT action
 *                  source=AUDIT_WRITER, action=WRITE,
 *                  priority forwarded from crawlAction
 *
 *   fetchJobs    — from RECRAWL_PRIORITY: 4 FETCH jobs in source order
 *                    [GOV_PORTAL, MOISA, MPI, MOF], priority forwarded
 *                  from DEFER: 1 WAIT job on GOV_PORTAL, priority=LOW
 *
 * The DEFER path creates exactly one fetchJob (WAIT) rather than four
 * (FETCH), because deferral means no active crawl is triggered — only
 * the primary portal is marked as "check next window".
 *
 * connectFromCrawl() is exported so tests can inject synthetic CrawlResult
 * objects for scenarios real data cannot produce (CRITICAL recrawl,
 * approval alerts, cache invalidation, HIGH-priority audit entries).
 *
 * Calls GovernmentCrawler.crawl() exactly once.
 * Never calls NotificationCenter, SchedulerAgent, WorkflowAgent,
 * RollbackManager, HumanReviewQueue, TemplateAutoUpdater,
 * ChangeImpactAgent, LegalUpdateAgent, or any v4.x engine directly.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. Deterministic. No singleton. No cache. No side effects.
 * No LLM. No browser globals. No hooks. No IndexedDB. No UI.
 */

import { GovernmentCrawler }  from './GovernmentCrawler';
import type { CrawlAction }   from './GovernmentCrawler';

// ─── Public types ─────────────────────────────────────────────────────────────

export type ConnectorSource   = 'OPERATOR_QUEUE' | 'CACHE_LAYER' | 'AUDIT_WRITER' | 'MOISA' | 'MPI' | 'MOF' | 'GOV_PORTAL';
export type ConnectorAction   = 'PUSH_APPROVAL' | 'INVALIDATE' | 'WRITE' | 'FETCH' | 'WAIT';
export type ConnectorPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ConnectorJob {
  source:   ConnectorSource;
  action:   ConnectorAction;
  priority: ConnectorPriority;
}

export interface ConnectResult {
  approvalJobs: readonly ConnectorJob[];
  cacheJobs:    readonly ConnectorJob[];
  auditJobs:    readonly ConnectorJob[];
  fetchJobs:    readonly ConnectorJob[];
}

// ─── Internal narrow type ─────────────────────────────────────────────────────

// Only the field connectFromCrawl actually reads.
interface MinCrawl {
  crawlActions: readonly CrawlAction[];
}

// ─── Source order for multi-source fetch ─────────────────────────────────────

const FETCH_SOURCES: readonly ConnectorSource[] = ['GOV_PORTAL', 'MOISA', 'MPI', 'MOF'];

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function connectFromCrawl(crawl: MinCrawl): ConnectResult {
  const approvalJobs: ConnectorJob[] = [];
  const cacheJobs:    ConnectorJob[] = [];
  const auditJobs:    ConnectorJob[] = [];
  const fetchJobs:    ConnectorJob[] = [];

  for (const action of crawl.crawlActions) {
    if (action.type === 'ALERT_OPERATOR') {
      approvalJobs.push({ source: 'OPERATOR_QUEUE', action: 'PUSH_APPROVAL', priority: action.priority });
    } else if (action.type === 'INVALIDATE_CACHE') {
      cacheJobs.push({ source: 'CACHE_LAYER', action: 'INVALIDATE', priority: 'LOW' });
    } else if (action.type === 'WRITE_AUDIT') {
      auditJobs.push({ source: 'AUDIT_WRITER', action: 'WRITE', priority: action.priority });
    } else if (action.type === 'RECRAWL_PRIORITY') {
      for (const source of FETCH_SOURCES) {
        fetchJobs.push({ source, action: 'FETCH', priority: action.priority });
      }
    } else {
      // DEFER — one WAIT job on the primary portal only
      fetchJobs.push({ source: 'GOV_PORTAL', action: 'WAIT', priority: 'LOW' });
    }
  }

  return { approvalJobs, cacheJobs, auditJobs, fetchJobs };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class OfficialSourceConnector {
  constructor(private readonly crawler: GovernmentCrawler = new GovernmentCrawler()) {}

  connect(lastAppliedDate: string, currentDate: string): ConnectResult {
    return connectFromCrawl(this.crawler.crawl(lastAppliedDate, currentDate));
  }
}
