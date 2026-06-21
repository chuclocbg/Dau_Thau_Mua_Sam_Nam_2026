/**
 * Legal v7.5 — RegulationClassifier
 *
 * classify(lastAppliedDate, currentDate) → ClassifyResult
 *
 * Consumes a ParseResult and classifies each ParsedRegulation into a domain
 * by mapping the existing `category` field through one rule:
 *
 *   PROCUREMENT → BIDDING
 *   FINANCE     → FINANCIAL
 *   PERSONNEL   → HR
 *   GENERAL     → GENERAL
 *
 * All other ParsedRegulation fields are carried through unchanged.
 * Status is forwarded unchanged from RegulationParser — never recomputed.
 *
 *   READY            — one ClassifiedRegulation per parsed regulation,
 *                      order preserved
 *   PENDING_APPROVAL — regulations = []
 *   UNCHANGED        — regulations = []
 *
 * metadata.domainCount is the cardinality of the domain set across all
 * classified regulations: new Set(regulations.map(r => r.domain)).size.
 * For empty regulations arrays this is 0.
 *
 * Classification is rule-based because the domain membership of each source
 * is fixed by institutional mandate (MPI owns procurement, MOF owns finance,
 * etc.) and does not change between regulation cycles.  No probabilistic
 * inference is needed; the category field already encodes the answer.
 *
 * classifyFromParsed() is exported so tests can inject synthetic ParseResult
 * objects for all three status paths and for domainCount edge cases.
 *
 * Calls RegulationParser.parse() exactly once.
 * Never calls RegulationFetcher, SnapshotBuilder, OfficialSourceConnector,
 * GovernmentCrawler, NotificationCenter, SchedulerAgent, WorkflowAgent,
 * RollbackManager, HumanReviewQueue, TemplateAutoUpdater, ChangeImpactAgent,
 * LegalUpdateAgent, or any v4.x engine directly.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. Deterministic. No singleton. No cache. No side effects.
 * No LLM. No AI. No browser globals. No hooks. No IndexedDB. No HTTP.
 */

import { RegulationParser }    from './RegulationParser';
import type { SnapshotStatus } from './SnapshotBuilder';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ClassifiedRegulation {
  source:        string;
  title:         string;
  url:           string;
  effectiveDate: string;
  authority:     string;
  category:      string;
  domain:        string;
}

export interface ClassifyMetadata {
  count:       number;
  domainCount: number;
  targetDate:  string;
}

export interface ClassifyResult {
  status:      SnapshotStatus;
  regulations: readonly ClassifiedRegulation[];
  metadata:    ClassifyMetadata;
}

// ─── Internal narrow type ─────────────────────────────────────────────────────

interface MinParsedReg {
  source:        string;
  title:         string;
  url:           string;
  effectiveDate: string;
  authority:     string;
  category:      string;
}

interface MinParsed {
  status:      SnapshotStatus;
  regulations: readonly MinParsedReg[];
  metadata:    { targetDate: string };
}

// ─── Domain lookup table ──────────────────────────────────────────────────────

const DOMAIN: Record<string, string> = {
  PROCUREMENT: 'BIDDING',
  FINANCE:     'FINANCIAL',
  PERSONNEL:   'HR',
  GENERAL:     'GENERAL',
};

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function classifyFromParsed(parsed: MinParsed): ClassifyResult {
  const status = parsed.status;

  const regulations: ClassifiedRegulation[] =
    status === 'READY'
      ? parsed.regulations.map(reg => ({
          source:        reg.source,
          title:         reg.title,
          url:           reg.url,
          effectiveDate: reg.effectiveDate,
          authority:     reg.authority,
          category:      reg.category,
          domain:        DOMAIN[reg.category],
        }))
      : [];

  const metadata: ClassifyMetadata = {
    count:       regulations.length,
    domainCount: new Set(regulations.map(r => r.domain)).size,
    targetDate:  parsed.metadata.targetDate,
  };

  return { status, regulations, metadata };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class RegulationClassifier {
  constructor(private readonly parser: RegulationParser = new RegulationParser()) {}

  classify(lastAppliedDate: string, currentDate: string): ClassifyResult {
    return classifyFromParsed(this.parser.parse(lastAppliedDate, currentDate));
  }
}
