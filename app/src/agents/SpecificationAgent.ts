/**
 * P6-02C: SpecificationAgent — complete implementation.
 *
 * State machine:
 *   idle → reviewing-input → generating-spec → checking-brands
 *        → composing-response → idle
 *
 * Builds on P5-02 (specGenerator.ts): adds reasoning fields,
 * multi-item batch processing, and LegalReviewerAgent feedback loop (P6-03).
 *
 * Pure functions (P6-02B):
 *   reviewSpec()                — brand detection (extends P5-02)
 *   suggestAlternatives()       — functional alternatives per brand
 *   generateSpecWithReasoning() — SpecInput → SpecOutput with audit reasoning
 *   batchGenerate()             — batch processing of SpecInput[]
 *
 * Agent methods (P6-02C):
 *   emit()              — registry event emitter
 *   transition()        — state machine step + event log
 *   buildErrorResponse() — error AgentMessage, always resets state to idle
 *   buildResponse()     — success AgentMessage with legalBasis
 *   collectLegalBasis() — merges SpecOutput citations + LegalFinding citations
 *   process()           — main entry point, never throws uncaught exceptions
 */

// ─── Type-only imports ────────────────────────────────────────────────────────

import type { AgentId, AgentMessage, IAgent } from './types';
import type { AgentRegistry }                  from './AgentRegistry';
import type { LegalFinding }                   from '../ai/legalReviewer';
import type { ProcurementPackage }             from '../demoData';
import type { SpecSuggestion }                 from '../ai/specGenerator';

// ─── Runtime imports ──────────────────────────────────────────────────────────

import { generateItemSpec, detectBrandLocking } from '../ai/specGenerator';
import { generateTraceId }                      from './detectPackageSplitting';

// ─── Re-export P5-02 public API as unified entry point ───────────────────────

export type { SpecSuggestion };
export { generateItemSpec, detectBrandLocking };

// ─── PackageType ──────────────────────────────────────────────────────────────

/** Derived from ProcurementPackage to avoid duplicating the union literal. */
export type PackageType = NonNullable<ProcurementPackage['packageType']>;

// ─── SpecInput ────────────────────────────────────────────────────────────────

export interface SpecInput {
  /** Item name in Vietnamese, as entered by the user. */
  itemName: string;
  packageType: PackageType;
  estimatedUnitPrice?: number;
  /** Existing spec text to audit for brand references. */
  existingSpecs?: string;
  /** Findings forwarded from LegalReviewerAgent (P6-03) for feedback loop. */
  legalFindings?: LegalFinding[];
}

// ─── SpecOutput ───────────────────────────────────────────────────────────────

export interface SpecOutput {
  /** Brand-neutral specification text, ready for HSMT insertion. */
  specs: string;
  /** One reasoning entry per criterion — required for audit traceability. */
  reasoning: string[];
  /** Brand names detected and removed from the spec. */
  brandWarnings: string[];
  /** Functional alternatives to any brand-locked criteria. */
  alternatives: string[];
  complianceStatus: 'compliant' | 'warning' | 'violation';
  /** Legal citations justifying the spec decisions. */
  legalBasis: string[];
}

// ─── BatchSpecInput / BatchSpecOutput ─────────────────────────────────────────

export interface BatchSpecInput {
  items: SpecInput[];
  /** Optional shared context applied to every item (e.g. lab environment). */
  sharedContext?: string;
}

export interface BatchSpecOutput {
  results: Array<{ itemName: string; output: SpecOutput }>;
  totalBrandWarnings: number;
  /** Worst compliance status across all items in the batch. */
  overallComplianceStatus: 'compliant' | 'warning' | 'violation';
  legalBasis: string[];
}

// ─── SpecState ────────────────────────────────────────────────────────────────

export type SpecState =
  | 'idle'
  | 'reviewing-input'
  | 'generating-spec'
  | 'checking-brands'
  | 'suggesting-alternatives'
  | 'composing-response';

// ─── SpecStateEvent ───────────────────────────────────────────────────────────

/** Emitted to the registry trace on every state transition. */
export interface SpecStateEvent {
  previousState: SpecState;
  nextState:     SpecState;
  timestamp:     number;
  detail?:       string;
}

// ─── Legal basis constants ────────────────────────────────────────────────────

const SPEC_LEGAL_BASIS: readonly string[] = [
  'Điều 44 khoản 7 Luật Đấu thầu 22/2023/QH15 — không khóa thương hiệu, không hạn chế xuất xứ',
  'Khoản 1 Điều 10 Luật Đấu thầu 22/2023/QH15 — nguyên tắc cạnh tranh, công bằng, minh bạch',
];

// ─── P6-02B: Pure functions ───────────────────────────────────────────────────

/**
 * Detects brand names in a specification string and optional item name.
 * Extends P5-02 detectBrandLocking by including the item name in the scan.
 *
 * @returns Array of detected brand name strings (empty = clean).
 */
export function reviewSpec(specs: string, itemName = ''): string[] {
  return detectBrandLocking(`${itemName} ${specs}`.trim());
}

/**
 * Returns functional alternatives for each detected brand name.
 * Generic catch-all alternative always included first.
 * Category-specific alternatives are added per brand.
 */
export function suggestAlternatives(specs: string, brandWarnings: string[]): string[] {
  if (brandWarnings.length === 0) return [];

  const alternatives: string[] = [
    'Cho phép sản phẩm/thiết bị tương đương hoặc cao hơn của bất kỳ nhà sản xuất ' +
    'nào đáp ứng tiêu chí kỹ thuật tối thiểu quy định trong HSMT.',
  ];

  for (const brand of brandWarnings) {
    const lower = brand.toLowerCase();
    if (/dell|hp|hewlett|asus|lenovo|acer|apple|mac/.test(lower)) {
      alternatives.push(
        `Thay "${brand}": CPU ≥[tốc độ tối thiểu] GHz, RAM ≥[X] GB, SSD ≥[X] GB — ` +
        'ghi rõ thông số chức năng, không nêu tên thương hiệu.',
      );
    } else if (/panasonic|daikin|mitsubishi|carrier|gree|electrolux|fujitsu/.test(lower)) {
      alternatives.push(
        `Thay "${brand}": điều hòa inverter đạt nhãn năng lượng cấp 2 trở lên, ` +
        'COP ≥3.0, môi chất lạnh R-32 hoặc R-410A.',
      );
    } else if (/merck|sigma|fisher|thermo/.test(lower)) {
      alternatives.push(
        `Thay "${brand}": hóa chất độ tinh khiết AR/ACS grade, có Certificate of Analysis ` +
        'từng lô, nhà sản xuất đạt ISO 9001 hoặc tương đương.',
      );
    } else if (/canon|epson|brother|ricoh|xerox|sharp|toshiba|konica/.test(lower)) {
      alternatives.push(
        `Thay "${brand}": máy in tốc độ ≥[X] trang/phút, độ phân giải ≥600 dpi, ` +
        'bảo hành ≥12 tháng, tương thích Windows 10/11.',
      );
    } else if (/cisco|huawei|d.link|tp.link|netgear|mikrotik|ubiquiti/.test(lower)) {
      alternatives.push(
        `Thay "${brand}": thiết bị mạng băng thông ≥[X] Gbps, hỗ trợ VLAN IEEE 802.1Q, ` +
        'bảo hành ≥36 tháng.',
      );
    } else {
      alternatives.push(
        `Thay "${brand}": ghi rõ thông số kỹ thuật chức năng tối thiểu — ` +
        'không nêu tên thương hiệu, xuất xứ, hoặc mã sản phẩm cụ thể.',
      );
    }
  }

  return alternatives;
}

/** Builds one reasoning entry per spec criterion line for audit traceability. */
function buildReasoning(specs: string, input: SpecInput): string[] {
  if (!specs.trim()) {
    return [
      'Chưa có yêu cầu kỹ thuật — cần soạn thủ công theo nguyên tắc: ' +
      'chức năng, ngưỡng tối thiểu, tương đương hoặc tốt hơn.',
    ];
  }
  const lines = specs.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return ['Yêu cầu kỹ thuật rỗng.'];

  const tag = `[${input.packageType}] ${input.itemName}`;
  return lines.map(line => {
    const criterion = line.replace(/;$/, '').trim();
    return (
      `${tag} — "${criterion}": tiêu chí chức năng tối thiểu, ` +
      'không khóa thương hiệu (Điều 44 khoản 7 Luật ĐT 22/2023).'
    );
  });
}

/**
 * Generates a brand-neutral SpecOutput from a SpecInput.
 *
 * Wraps P5-02 generateItemSpec and adds:
 *   - reasoning[] per criterion
 *   - alternatives[] for every detected brand
 *   - complianceStatus derived from brandWarnings + legalFindings
 *   - legalBasis with SPEC_LEGAL_BASIS citations
 */
export function generateSpecWithReasoning(input: SpecInput): SpecOutput {
  const base          = generateItemSpec(input.itemName, input.existingSpecs ?? '');
  const brandWarnings = reviewSpec(base.specs, input.itemName);
  const reasoning     = buildReasoning(base.specs, input);
  const alternatives  = suggestAlternatives(base.specs, brandWarnings);

  const hasCritical  = input.legalFindings?.some(f => f.severity === 'CRITICAL') ?? false;
  const complianceStatus: SpecOutput['complianceStatus'] =
    brandWarnings.length > 0
      ? (hasCritical ? 'violation' : 'warning')
      : 'compliant';

  return {
    specs:            base.specs,
    reasoning,
    brandWarnings,
    alternatives,
    complianceStatus,
    legalBasis:       [...SPEC_LEGAL_BASIS],
  };
}

/**
 * Generates SpecOutput for every item in the batch.
 * Applies sharedContext to existingSpecs of each item when provided.
 * overallComplianceStatus reflects the worst status across all items.
 */
export function batchGenerate(input: BatchSpecInput): BatchSpecOutput {
  const results: BatchSpecOutput['results']         = [];
  let totalBrandWarnings                            = 0;
  let overallComplianceStatus: SpecOutput['complianceStatus'] = 'compliant';
  const allLegal = new Set<string>(SPEC_LEGAL_BASIS);

  for (const item of input.items) {
    const enriched: SpecInput = input.sharedContext
      ? {
          ...item,
          existingSpecs: [item.existingSpecs, input.sharedContext]
            .filter(Boolean)
            .join('\n'),
        }
      : item;

    const output = generateSpecWithReasoning(enriched);
    results.push({ itemName: item.itemName, output });
    totalBrandWarnings += output.brandWarnings.length;
    for (const b of output.legalBasis) allLegal.add(b);

    if (output.complianceStatus === 'violation') {
      overallComplianceStatus = 'violation';
    } else if (
      output.complianceStatus === 'warning' &&
      overallComplianceStatus !== 'violation'
    ) {
      overallComplianceStatus = 'warning';
    }
  }

  return {
    results,
    totalBrandWarnings,
    overallComplianceStatus,
    legalBasis: [...allLegal],
  };
}

// ─── SpecificationAgent ───────────────────────────────────────────────────────

export class SpecificationAgent implements IAgent {
  readonly id   = 'specification' as const;
  readonly name = 'Specification Agent';

  private state:           SpecState    = 'idle';
  private currentTraceId:  string | null = null;
  private readonly registry: AgentRegistry;

  constructor(registry: AgentRegistry) {
    this.registry = registry;
  }

  getCapabilities(): string[] {
    return [
      'spec-generation',
      'brand-detection',
      'alternative-suggestion',
      'batch-spec-processing',
    ];
  }

  // ── emit + transition ──────────────────────────────────────────────────────

  private emit(partial: Omit<AgentMessage, 'traceId' | 'from' | 'timestamp'>): void {
    const msg: AgentMessage = {
      traceId:   this.currentTraceId!,
      from:      'specification',
      timestamp: Date.now(),
      ...partial,
    };
    this.registry.log(msg);
    if (msg.to === 'broadcast') {
      this.registry.notifySubscribers(msg.type, msg);
    }
  }

  private transition(next: SpecState, detail?: string): void {
    const event: SpecStateEvent = {
      previousState: this.state,
      nextState:     next,
      timestamp:     Date.now(),
      detail,
    };
    this.emit({ to: 'specification', type: 'event', payload: event });
    this.state = next;
  }

  // ── buildErrorResponse + buildResponse ─────────────────────────────────────

  private buildErrorResponse(
    code:    string,
    message: string,
    inState: SpecState,
    to:      AgentId | 'user' = 'user',
  ): AgentMessage {
    const traceId = this.currentTraceId ?? generateTraceId(); // save BEFORE reset
    this.state          = 'idle';
    this.currentTraceId = null;
    return {
      traceId,
      from:      'specification',
      to,
      type:      'error',
      payload:   { code, message, state: inState },
      timestamp: Date.now(),
    };
  }

  private buildResponse(to: AgentId | 'user', output: SpecOutput): AgentMessage {
    return {
      traceId:    this.currentTraceId!,
      from:       'specification',
      to,
      type:       'response',
      payload:    output,
      timestamp:  Date.now(),
      legalBasis: output.legalBasis,
    };
  }

  // ── collectLegalBasis ──────────────────────────────────────────────────────

  private collectLegalBasis(
    specOutput:    SpecOutput,
    legalFindings: LegalFinding[],
  ): string[] {
    const citations = new Set<string>(specOutput.legalBasis);
    for (const finding of legalFindings) {
      citations.add(finding.legalBasis); // LegalFinding.legalBasis is string (single)
    }
    return [...citations];
  }

  // ── process ────────────────────────────────────────────────────────────────

  async process(msg: AgentMessage): Promise<AgentMessage> {
    const traceId    = msg.traceId;
    const callerFrom = msg.from;
    this.currentTraceId = traceId;
    this.registry.log(msg);

    const input = msg.payload as SpecInput;

    if (!input?.itemName?.trim()) {
      return this.buildErrorResponse(
        'SPEC_EMPTY_INPUT',
        'itemName không được rỗng',
        'idle',
        callerFrom,
      );
    }

    try {
      // ── REVIEWING_INPUT
      this.transition('reviewing-input', `Kiểm tra yêu cầu: ${input.itemName}`);

      // ── GENERATING_SPEC
      this.transition('generating-spec');
      const specOutput = generateSpecWithReasoning(input);

      // ── CHECKING_BRANDS
      this.transition('checking-brands');
      if (specOutput.brandWarnings.length > 0) {
        this.emit({
          to:      'broadcast',
          type:    'event',
          payload: {
            itemName:      input.itemName,
            brandWarnings: specOutput.brandWarnings,
            alternatives:  specOutput.alternatives,
          },
        });
      }

      // ── COMPOSING_RESPONSE
      this.transition('composing-response');
      const legalBasis    = this.collectLegalBasis(specOutput, input.legalFindings ?? []);
      const finalOutput: SpecOutput = { ...specOutput, legalBasis };

      const response = this.buildResponse(callerFrom, finalOutput);
      this.registry.log(response);
      this.state          = 'idle';
      this.currentTraceId = null;
      return response;

    } catch (err) {
      return this.buildErrorResponse(
        'SPEC_INTERNAL_ERROR',
        String(err),
        this.state,
        callerFrom,
      );
    }
  }
}
