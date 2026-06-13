# Changelog

All notable changes to this project are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

*(Phase 2 — High priority items pending. See `docs/refactoring_plan.md`.)*

---

## [1.1.0] — 2026-06-13 — Phase 1: Critical Fixes

Commit: `09403e5`

### Fixed

**P1-01 — `numberToWords()` — full Vietnamese algorithm**  
File: `app/src/docTemplates.ts` (lines 12–65)  
The previous implementation contained 4 hardcoded `if` branches covering only the four demo
package totals. Any other value produced a legally meaningless placeholder string. Replaced
with a complete recursive algorithm supporting values 0 through 999 billion VND.

Vietnamese-specific rules implemented:
- "mười" (10–19) vs "mươi" (20+)
- "mốt" (x1 when tens > 1) vs "một"
- "lăm" (x5 when tens ≥ 1) vs "năm"
- "linh" (0 tens when hundreds > 0)
- Correct capitalisation of first character
- Suffix: " đồng chẵn"

**P1-02 — COMPETITIVE_SHOPPING threshold corrected from 10B to 5B**  
File: `app/src/docTemplates.ts` (line ~105)  
`getProcurementMethod()` used `<= 10,000,000,000` as the upper bound for Chào hàng cạnh tranh.
Per NĐ 214/2025/NĐ-CP and the project SKILL.md, the correct threshold is `<= 5,000,000,000`.
Packages between 5B–10B VND now correctly resolve to OPEN_BIDDING (Đấu thầu rộng rãi).

**P1-03 — Doc 6 HTML table headers use dynamic supplier names**  
File: `app/src/docTemplates.ts` (lines ~776–778)  
Column headers in the HTML preview of Doc 6 (Bảng so sánh báo giá) were hardcoded to
"T&T", "Máy tính VN", "Sao Nam" — the abbreviated names of the Gói 1 demo suppliers.
Replaced with `${pkg.supplier1Name}`, `${pkg.supplier2Name}`, `${pkg.supplier3Name}`.
The DOCX renderer was already using dynamic names; only the HTML preview was affected.

**P1-04 — Winner supplier determined by actual lowest price, not always supplier 1**  
File: `app/src/docTemplates.ts`  
Docs 14, 15, 16, 17 (evaluation report, appraisal report, approval proposal, approval
decision) hardcoded `pkg.supplier1Name` as the winning bidder without any price comparison.
This caused internal contradictions when supplier 1 did not have the lowest total price.

Changes:
- Added `getWinnerSupplier(pkg)` helper function (exported) that sums `quantity × supplierNPrice`
  across all items for each supplier and returns `{ name, total, rank }` for the lowest.
- Updated `getHtml()` and `getDocx()` of Docs 6, 14, 15, 16, 17 to call `getWinnerSupplier(pkg)`
  and use the result for all winner name and winner total references.

**P1-05 — Doc 24 DOCX status column uses blank placeholders**  
File: `app/src/docTemplates.ts` (DOCX renderer, Doc 24)  
The "Ngày đăng tải thực tế" column in Doc 24 (Bảng theo dõi đăng tải thông tin) previously
read "Đã hoàn thành" for all four publication obligations. This was factually incorrect:
the document is generated before any publication has occurred. Replaced with
"Ngày ..... tháng ..... năm ....." so the responsible officer fills in the actual date after
each obligation is fulfilled.

**P1-07 — Demo Gói 4 dates distributed across realistic working days**  
File: `app/src/demoData.ts` (pkg-4, lines ~361–380)  
Five approval milestones (evaluate, appraise, result proposal, result approve, contract sign)
were all set to 2026-06-13 (a Saturday). Additionally, `dateDocIssue → dateBidClose` spanned
only 2 calendar days, violating the 5-working-day minimum per NĐ 214/2025 Article 81.

New dates:
- `dateDocIssue`: 2026-06-09 (Monday)
- `dateBidClose`: 2026-06-16 (Monday, 7 calendar / 5 working days later)
- `dateEvaluate`: 2026-06-18 (Wednesday)
- `dateAppraise`: 2026-06-19 (Thursday)
- `dateResultProposal`: 2026-06-22 (Monday)
- `dateResultApprove`: 2026-06-23 (Tuesday)
- `dateContractSign`: 2026-06-24 (Wednesday)
- `dateDelivery`: 2026-06-26 (Friday)
- `dateAcceptance`: 2026-06-26 (same day — stationery, acceptable)

**P1-08 — Delivery-to-acceptance gaps corrected for complex equipment packages**  
File: `app/src/demoData.ts` (`dateAcceptance` for pkg-1, pkg-2, pkg-3)  
All four demo packages had `dateDelivery === dateAcceptance`. This is a known audit red flag
for complex equipment (same-day delivery and acceptance is physically impossible for 20 PCs,
80 air conditioners, or laboratory instruments requiring installation and calibration).

- Gói 1 (20 PCs + switches + UPS): acceptance moved to 2026-05-27 (+5 days after delivery)
- Gói 2 (80 air conditioners — service): acceptance moved to 2026-06-08 (+3 days)
- Gói 3 (laboratory equipment): acceptance moved to 2026-05-13 (+7 days after delivery)
- Gói 4 (stationery): same-day unchanged — acceptable for consumables

### Added

**P1-09 — Doc 25: Bản cam kết không xung đột lợi ích**  
File: `app/src/docTemplates.ts` (new DocumentConfig appended to `documentTemplates` array)  
Article 16 of Luật Đấu thầu 22/2023/QH15 requires each member of the evaluation committee
to sign an independence declaration before performing evaluation duties. The existing 24-document
set had no template for this mandatory document.

Doc 25 provides:
- `getCategory()`: `'required'` for COMPETITIVE_SHOPPING and OPEN_BIDDING;
  `'recommended'` for DIRECT_SELECTION_SIMPLIFIED; `'not_applicable'` for DIRECT_50
- HTML: lists all three committee members (leader + 2 members), all three bidder names,
  five numbered commitment clauses, and cites Article 16 LĐT 22/2023 + NĐ 214/2025
- DOCX: generates two signature rows — member2 (left) + leader (right), and member3 (left)
- `getSignDate()`: returns `pkg.dateEvaluate`
- Document symbol: `${pkg.departmentCode}/CKXĐLI`

**Test infrastructure**  
Files: `app/src/__tests__/` (9 new files), `app/vitest.config.ts`, updates to `app/package.json`  
- Vitest 4.1.8 + jsdom 29.1.1 added as devDependencies
- `@vitest/coverage-v8` added for V8 coverage reports
- `npm test`, `npm run test:watch`, `npm run test:coverage` scripts added
- 162 tests across 9 files: unit, integration, regression, and security test types
- Shared fixtures in `app/src/__tests__/fixtures.ts`
- DOCX content verified via `Packer.toBuffer()` + JSZip XML inspection

**.gitignore**  
File: `.gitignore` (new, project root)  
Excludes: `node_modules/`, `app/dist/`, `dist/`, `.claude/`, `*.tsbuildinfo`,
`.env*`, `app/coverage/`, `*.log`.

### Security

**P1-06 — DOMPurify wraps all `dangerouslySetInnerHTML` output**  
Files: `app/src/App.tsx`, `app/package.json`  
`dangerouslySetInnerHTML` in the document preview pane was rendering raw template literal
output from `getHtml()`. Since `getHtml()` interpolates user-supplied package fields (supplier
names, package name, etc.) directly into HTML strings, any field containing `<script>` tags
or event handler attributes was injected into the DOM without sanitization.

`DOMPurify` (v3.4.10) is now applied to every `getHtml()` call before rendering:
```typescript
<div dangerouslySetInnerHTML={{
  __html: DOMPurify.sanitize(activeDoc.getHtml(selectedPackage, method.code))
}} />
```
This eliminates the XSS vector for all 24 (now 25) document templates.

---

## [1.0.0] — 2026-06-01 — Initial release

Initial React SPA with:
- 24 procurement document templates (Docs 1–24)
- 4 demo packages covering DIRECT_50, DIRECT_SELECTION_SIMPLIFIED,
  COMPETITIVE_SHOPPING, OPEN_BIDDING method types
- HTML preview + DOCX export for all documents
- ZIP download of all documents for the selected package
- Date validation (ordering only)
- Funding source and procurement method display

---

[Unreleased]: https://github.com/chuclocbg/Dau_Thau_Mua_Sam_Nam_2026/compare/09403e5...HEAD
[1.1.0]: https://github.com/chuclocbg/Dau_Thau_Mua_Sam_Nam_2026/commit/09403e5
[1.0.0]: https://github.com/chuclocbg/Dau_Thau_Mua_Sam_Nam_2026
