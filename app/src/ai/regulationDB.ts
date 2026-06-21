/**
 * Legal v4.0 — Regulation Database
 *
 * Static registry of Vietnamese public procurement regulations sourced from
 * the legal priority list in CLAUDE.md. Captures thresholds, method rules,
 * contract type rules, fund-source rules, and document prerequisites that
 * are otherwise hardcoded across the engine layer.
 *
 * Purely additive: existing engines remain untouched. This module exposes
 * the same constants as queryable, source-tracked, effective-dated data.
 *
 * All VND values are integer numbers (no decimals). Dates are ISO 8601
 * (YYYY-MM-DD). Sources are real citations from the CLAUDE.md legal list.
 *
 * Pure data. No LLM. No browser globals. No hooks. No IndexedDB. No UI.
 */

import type { ProcurementMethod, FundSource } from './legalApplicabilityEngine';
import type { ContractType }                   from './contractReviewer';
import type { RiskLevel }                      from './legalRiskEngine';

// ─── Entity types ─────────────────────────────────────────────────────────────

export interface Threshold {
  /** Unique identifier, e.g. 'DIRECT_APPOINTMENT_LIMIT'. */
  code: string;
  value: number;
  currency: 'VND';
  source: string;
  effectiveDate: string;  // YYYY-MM-DD
  description: string;
}

export interface ProcurementBand {
  /** Maps to docTemplates getProcurementMethod() codes. */
  code: 'DIRECT_50' | 'DIRECT_SELECTION_SIMPLIFIED' | 'COMPETITIVE_SHOPPING' | 'OPEN_BIDDING';
  /** Recommended engine-layer procurement method for this band. */
  recommendedMethod: ProcurementMethod;
  valueMin: number;
  /** Use Number.MAX_SAFE_INTEGER for the open-ended upper band. */
  valueMax: number;
  source: string;
}

export interface ContractTypeReg {
  contractType: ContractType;
  maxDurationDays: number;
  mandatoryClauses: string[];
  compatibleMethods: ProcurementMethod[];
  source: string;
}

export interface FundSourceReg {
  fundSource: FundSource;
  mandatoryClauses: string[];
  source: string;
}

export interface DocumentRequirement {
  /** The document being prepared. */
  stage: string;
  /** Document that must already exist before `stage` can be prepared. */
  requiredDocument: string;
  source: string;
}

export interface RiskThreshold {
  minScore: number;
  riskLevel: RiskLevel;
}

// ─── Threshold registry ───────────────────────────────────────────────────────

export const THRESHOLDS: readonly Threshold[] = [
  {
    code: 'DIRECT_50_LIMIT',
    value: 50_000_000,
    currency: 'VND',
    source: 'Điểm m Khoản 1 Điều 23 Luật Đấu thầu số 22/2023/QH15; Khoản 4 Điều 80 Nghị định 214/2025/NĐ-CP; Thông tư 13/2026/TT-BCT',
    effectiveDate: '2025-07-01',
    description: 'Giá trị tối đa để áp dụng chỉ định thầu không qua quy trình (≤50 triệu đồng)',
  },
  {
    code: 'DIRECT_SELECTION_SIMPLIFIED_LIMIT',
    value: 500_000_000,
    currency: 'VND',
    source: 'Điểm m Khoản 1 Điều 23 Luật Đấu thầu số 22/2023/QH15 (sửa đổi bởi Luật số 90/2025/QH15); Khoản 2 và 3 Điều 80 Nghị định 214/2025/NĐ-CP',
    effectiveDate: '2025-07-01',
    description: 'Giá trị tối đa để áp dụng chỉ định thầu rút gọn (≤500 triệu đồng)',
  },
  {
    code: 'COMPETITIVE_SHOPPING_LIMIT',
    value: 5_000_000_000,
    currency: 'VND',
    source: 'Điều 24 Luật Đấu thầu số 22/2023/QH15 (sửa đổi bởi Luật số 90/2025/QH15); Điều 81 Nghị định 214/2025/NĐ-CP; Thông tư 79/2025/TT-BTC',
    effectiveDate: '2025-07-01',
    description: 'Giá trị tối đa để áp dụng chào hàng cạnh tranh (≤5 tỷ đồng)',
  },
  {
    code: 'PERFORMANCE_SECURITY_THRESHOLD',
    value: 50_000_000,
    currency: 'VND',
    source: 'Luật Đấu thầu số 22/2023/QH15; Nghị định 214/2025/NĐ-CP',
    effectiveDate: '2025-07-01',
    description: 'Giá trị gói thầu tối thiểu bắt buộc có điều khoản bảo đảm thực hiện hợp đồng',
  },
  {
    code: 'DIRECT_APPOINTMENT_LIMIT',
    value: 100_000_000,
    currency: 'VND',
    source: 'Nghị định 214/2025/NĐ-CP',
    effectiveDate: '2025-07-01',
    description: 'Ngưỡng giá trị chỉ định thầu rút gọn trên mức này có rủi ro kiểm toán cao',
  },
];

// ─── Procurement bands ────────────────────────────────────────────────────────
// Mirrors docTemplates.ts getProcurementMethod() thresholds (≤ comparisons).

export const PROCUREMENT_BANDS: readonly ProcurementBand[] = [
  {
    code: 'DIRECT_50',
    recommendedMethod: 'chi-dinh-thau-rut-gon',
    valueMin: 0,
    valueMax: 50_000_000,
    source: 'Khoản 4 Điều 80 Nghị định 214/2025/NĐ-CP',
  },
  {
    code: 'DIRECT_SELECTION_SIMPLIFIED',
    recommendedMethod: 'chi-dinh-thau-rut-gon',
    valueMin: 50_000_001,
    valueMax: 500_000_000,
    source: 'Khoản 2 và 3 Điều 80 Nghị định 214/2025/NĐ-CP',
  },
  {
    code: 'COMPETITIVE_SHOPPING',
    recommendedMethod: 'chao-hang-canh-tranh',
    valueMin: 500_000_001,
    valueMax: 5_000_000_000,
    source: 'Điều 81 Nghị định 214/2025/NĐ-CP',
  },
  {
    code: 'OPEN_BIDDING',
    recommendedMethod: 'dau-thau-rong-rai',
    valueMin: 5_000_000_001,
    valueMax: Number.MAX_SAFE_INTEGER,
    source: 'Luật Đấu thầu số 22/2023/QH15; Nghị định 214/2025/NĐ-CP; Thông tư 79/2025/TT-BTC',
  },
];

// ─── Contract type registry ───────────────────────────────────────────────────
// Sources: contractReviewer.ts METHOD_COMPATIBLE_TYPES, MAX_DURATION_DAYS,
//          TYPE_MANDATORY_CLAUSES, UNIVERSAL_MANDATORY_CLAUSES.

const UNIVERSAL: readonly string[] = [
  'doi-tuong', 'gia-tri', 'thoi-han', 'thanh-toan',
  'nghiem-thu', 'phat-vi-pham', 'bat-kha-khang', 'tranh-chap',
];

export const CONTRACT_TYPE_REGS: readonly ContractTypeReg[] = [
  {
    contractType: 'tron-goi',
    maxDurationDays: 365,
    mandatoryClauses: [...UNIVERSAL, 'bao-hanh'],
    compatibleMethods: [
      'dau-thau-rong-rai', 'chao-hang-canh-tranh', 'mua-sam-truc-tiep',
      'chi-dinh-thau', 'chi-dinh-thau-rut-gon',
    ],
    source: 'Nghị định 214/2025/NĐ-CP; Luật Đấu thầu số 22/2023/QH15',
  },
  {
    contractType: 'theo-don-gia-dinh-truoc',
    maxDurationDays: 730,
    mandatoryClauses: [...UNIVERSAL, 'bao-hanh', 'bao-dam-thuc-hien'],
    compatibleMethods: [
      'dau-thau-rong-rai', 'chao-hang-canh-tranh', 'mua-sam-truc-tiep', 'chi-dinh-thau',
    ],
    source: 'Nghị định 214/2025/NĐ-CP',
  },
  {
    contractType: 'theo-don-gia-dieu-chinh',
    maxDurationDays: 1825,
    mandatoryClauses: [...UNIVERSAL, 'bao-hanh', 'bao-dam-thuc-hien', 'dieu-chinh-gia'],
    compatibleMethods: ['dau-thau-rong-rai'],
    source: 'Nghị định 214/2025/NĐ-CP',
  },
  {
    contractType: 'theo-thoi-gian',
    maxDurationDays: 365,
    mandatoryClauses: [...UNIVERSAL],
    compatibleMethods: ['dau-thau-rong-rai', 'chi-dinh-thau'],
    source: 'Nghị định 214/2025/NĐ-CP',
  },
  {
    contractType: 'ket-hop',
    maxDurationDays: 1095,
    mandatoryClauses: [...UNIVERSAL, 'bao-hanh'],
    compatibleMethods: ['dau-thau-rong-rai'],
    source: 'Nghị định 214/2025/NĐ-CP',
  },
];

// ─── Fund source registry ─────────────────────────────────────────────────────
// Sources: contractReviewer.ts FUND_MANDATORY_CLAUSES.

export const FUND_SOURCE_REGS: readonly FundSourceReg[] = [
  {
    fundSource: 'ngan-sach-nha-nuoc',
    mandatoryClauses: ['bao-dam-thuc-hien'],
    source: 'Luật Đấu thầu số 22/2023/QH15; Nghị định 214/2025/NĐ-CP',
  },
  {
    fundSource: 'von-su-nghiep',
    mandatoryClauses: [],
    source: 'Luật Ngân sách Nhà nước; Nghị định 60/2021/NĐ-CP',
  },
  {
    fundSource: 'von-tu-co',
    mandatoryClauses: [],
    source: 'Luật Quản lý, sử dụng tài sản công số 15/2017/QH14',
  },
  {
    fundSource: 'von-vay-oda',
    mandatoryClauses: ['tuan-thu-nha-tai-tro'],
    source: 'Nghị định 52/2026/NĐ-CP về quản lý và sử dụng vốn ODA',
  },
];

// ─── Document prerequisites ───────────────────────────────────────────────────
// Sources: legalChecklistEngine.ts PREREQUISITES map.
// One entry per (stage, requiredDocument) pair for granular querying.

const DOC_REQ_SOURCE = 'Luật Đấu thầu số 22/2023/QH15; Nghị định 214/2025/NĐ-CP';

export const DOCUMENT_REQUIREMENTS: readonly DocumentRequirement[] = [
  // khlcnt requires to-trinh
  { stage: 'khlcnt',               requiredDocument: 'to-trinh',             source: DOC_REQ_SOURCE },
  // hsyc requires to-trinh + khlcnt
  { stage: 'hsyc',                 requiredDocument: 'to-trinh',             source: DOC_REQ_SOURCE },
  { stage: 'hsyc',                 requiredDocument: 'khlcnt',               source: DOC_REQ_SOURCE },
  // quyet-dinh-phe-duyet requires to-trinh + khlcnt + hsyc
  { stage: 'quyet-dinh-phe-duyet', requiredDocument: 'to-trinh',             source: DOC_REQ_SOURCE },
  { stage: 'quyet-dinh-phe-duyet', requiredDocument: 'khlcnt',               source: DOC_REQ_SOURCE },
  { stage: 'quyet-dinh-phe-duyet', requiredDocument: 'hsyc',                 source: DOC_REQ_SOURCE },
  // hop-dong requires full pre-award chain
  { stage: 'hop-dong',             requiredDocument: 'to-trinh',             source: DOC_REQ_SOURCE },
  { stage: 'hop-dong',             requiredDocument: 'khlcnt',               source: DOC_REQ_SOURCE },
  { stage: 'hop-dong',             requiredDocument: 'hsyc',                 source: DOC_REQ_SOURCE },
  { stage: 'hop-dong',             requiredDocument: 'quyet-dinh-phe-duyet', source: DOC_REQ_SOURCE },
  // bien-ban-nghiem-thu requires hop-dong
  { stage: 'bien-ban-nghiem-thu',  requiredDocument: 'hop-dong',             source: DOC_REQ_SOURCE },
  // bien-ban-ban-giao requires hop-dong + nghiem-thu
  { stage: 'bien-ban-ban-giao',    requiredDocument: 'hop-dong',             source: DOC_REQ_SOURCE },
  { stage: 'bien-ban-ban-giao',    requiredDocument: 'bien-ban-nghiem-thu',  source: DOC_REQ_SOURCE },
  // thanh-toan requires hop-dong + nghiem-thu + ban-giao
  { stage: 'thanh-toan',           requiredDocument: 'hop-dong',             source: DOC_REQ_SOURCE },
  { stage: 'thanh-toan',           requiredDocument: 'bien-ban-nghiem-thu',  source: DOC_REQ_SOURCE },
  { stage: 'thanh-toan',           requiredDocument: 'bien-ban-ban-giao',    source: DOC_REQ_SOURCE },
  // thanh-ly requires the complete post-award chain
  { stage: 'thanh-ly',             requiredDocument: 'hop-dong',             source: DOC_REQ_SOURCE },
  { stage: 'thanh-ly',             requiredDocument: 'bien-ban-nghiem-thu',  source: DOC_REQ_SOURCE },
  { stage: 'thanh-ly',             requiredDocument: 'bien-ban-ban-giao',    source: DOC_REQ_SOURCE },
  { stage: 'thanh-ly',             requiredDocument: 'thanh-toan',           source: DOC_REQ_SOURCE },
];

// ─── Risk scoring thresholds ──────────────────────────────────────────────────
// Source: legalRiskEngine.ts RISK_THRESHOLDS (descending order, first match wins).

export const RISK_THRESHOLDS: readonly RiskThreshold[] = [
  { minScore: 40, riskLevel: 'CRITICAL' },
  { minScore: 25, riskLevel: 'HIGH'     },
  { minScore: 15, riskLevel: 'MEDIUM'   },
  { minScore: 0,  riskLevel: 'LOW'      },
];
