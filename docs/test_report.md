# Test Report — Phase 1 (Critical Fixes)

**Date:** 13/06/2026  
**Project:** Hệ thống hồ sơ mua sắm — Trường Cao đẳng Kỹ thuật Công nghiệp  
**Commit:** `09403e5`  
**Result:** 162 / 162 passed — 0 failed — 0 skipped

---

## 1. Test Environment

| Item | Value |
|---|---|
| Runtime | Node.js (via Vitest) |
| Test framework | Vitest 4.1.8 |
| DOM environment | jsdom 29.1.1 |
| TypeScript | 6.0.2 |
| React | 19.2.6 |
| DOMPurify | 3.0.5 (types) + 3.4.10 (runtime) |
| docx | 9.7.1 |
| jszip | 3.10.1 |
| Config file | `app/vitest.config.ts` |
| Test directory | `app/src/__tests__/` |

---

## 2. Summary by File

| File | Type | Tests | Passed | Failed | Phase |
|---|---|---|---|---|---|
| `numberToWords.test.ts` | Unit | 27 | 27 | 0 | P1-01 |
| `procurement-method.test.ts` | Unit | 22 | 22 | 0 | P1-02 |
| `winner-supplier.test.ts` | Unit | 13 | 13 | 0 | P1-04 |
| `doc6.integration.test.ts` | Integration | 9 | 9 | 0 | P1-03 |
| `docs14-17.integration.test.ts` | Integration | 21 | 21 | 0 | P1-04 |
| `doc24.integration.test.ts` | Integration | 9 | 9 | 0 | P1-05 |
| `doc25.integration.test.ts` | Integration | 19 | 19 | 0 | P1-09 |
| `sanitization.test.ts` | Security | 22 | 22 | 0 | P1-06 |
| `demo-data.regression.test.ts` | Regression | 20 | 20 | 0 | P1-07, P1-08 |
| **TOTAL** | | **162** | **162** | **0** | |

---

## 3. Test Details by File

### 3.1 `numberToWords.test.ts` — 27 tests (P1-01)

**Purpose:** Verify the Vietnamese number-to-words algorithm covers all value ranges and
edge cases from 0 to 999 billion VND.

| Suite | Description |
|---|---|
| Edge cases | 0 → "Không đồng"; negative → "Giá trị không hợp lệ"; NaN/Infinity → "Giá trị không hợp lệ" |
| Ones | 1 through 9 spelled correctly |
| Teens | 11 → "mười một"; 15 → "mười lăm"; 21 → "hai mươi mốt" |
| Hundreds | 100, 105 (linh), 110, 115, 205, 250 |
| Thousands | 1,000; 15,000; 150,000; 105,000 |
| Millions | 1,000,000; 1,500,000; 80,000,000 |
| Billions | 1,000,000,000; 5,000,000,000; 12,345,678,901 |
| Demo data regression | All four demo package totals produce exact expected strings |
| Capitalisation | First character is always uppercase |

**Key rule verified:** "lăm" only appears after a tens digit (tens ≥ 1). After "linh" (hundreds
present but tens = 0), the ones digit uses the standard "năm" — e.g. 105,000 → "Một trăm linh
năm nghìn đồng chẵn", not "lăm nghìn".

---

### 3.2 `procurement-method.test.ts` — 22 tests (P1-02)

**Purpose:** Verify `getProcurementMethod()` returns the correct procurement method code and
legal basis for every threshold range per NĐ 214/2025/NĐ-CP.

| Suite | Description |
|---|---|
| DIRECT_50 | 0, 1, 49,999,999, 50,000,000 |
| DIRECT_SELECTION_SIMPLIFIED | 50,000,001; 100M; 499,999,999; 500,000,000 |
| COMPETITIVE_SHOPPING | 500,000,001; 1B; 4,999,999,999; **5,000,000,000** |
| OPEN_BIDDING | **5,000,000,001**; 10B; 100B |
| Regression — old boundary | 5,100,000,000 must return OPEN_BIDDING (was COMPETITIVE_SHOPPING before fix) |
| Legal basis | Each method returns non-empty `basis[]` array citing correct regulations |
| Method name | Each method returns correct Vietnamese display name |

**Critical regression test:** Values between 5B and 10B (e.g. 7,000,000,000) now correctly
return OPEN_BIDDING, not COMPETITIVE_SHOPPING as they did before P1-02.

---

### 3.3 `winner-supplier.test.ts` — 13 tests (P1-04)

**Purpose:** Verify `getWinnerSupplier()` selects the actual lowest bidder by summing
`quantity × supplierNPrice` across all items.

| Suite | Description |
|---|---|
| Single-item, S1 wins | Returns supplier1Name, correct total, rank = 1 |
| Single-item, S2 wins | Returns supplier2Name, correct total, rank = 2 |
| Single-item, S3 wins | Returns supplier3Name, correct total, rank = 3 |
| Multi-item, S2 wins on aggregate | S2 is cheapest across 2 items even though S1 wins item 1 |
| Tie-break | All equal → supplier 1 wins by rank precedence |
| Rank field | rank field reflects actual position (1, 2, or 3) |
| Total accuracy | Returned total equals actual computed sum, not unitPrice × quantity |

---

### 3.4 `doc6.integration.test.ts` — 9 tests (P1-03)

**Purpose:** Verify Doc 6 (Bảng so sánh báo giá) HTML uses dynamic supplier names in both
the table headers and the conclusion statement.

| Suite | Description |
|---|---|
| HTML headers — S1 wins | `supplier1Name` appears in column header |
| HTML headers — S2 wins | `supplier2Name` appears in column header |
| HTML headers — S3 wins | `supplier3Name` appears in column header |
| No hardcoded names | "T&T", "Máy tính VN", "Sao Nam" do not appear for non-Goi-1 packages |
| Conclusion statement | Winner name appears in the conclusion paragraph |
| Conclusion amount | Formatted winner total appears in the conclusion paragraph |
| DOCX generation | `getDocx()` returns a Buffer without throwing |
| DOCX winner name | Winner name present in DOCX XML (verified via JSZip) |
| Category | Returns 'required' for COMPETITIVE_SHOPPING |

---

### 3.5 `docs14-17.integration.test.ts` — 21 tests (P1-04)

**Purpose:** Verify Docs 14, 15, 16, 17 (evaluation and approval documents) name the actual
lowest bidder determined by `getWinnerSupplier()`, not always supplier 1.

| Doc | Tests | Key assertions |
|---|---|---|
| Doc 14 (Báo cáo đánh giá) | 5 | Winner name in HTML and DOCX; price matches winner total |
| Doc 15 (Báo cáo thẩm định) | 5 | Same; appraiser name preserved |
| Doc 16 (Tờ trình phê duyệt) | 5 | Same; rector name and date preserved |
| Doc 17 (Quyết định phê duyệt) | 6 | Same; budget total ≠ winner total when unitPrice differs from supplier price |

**Fixture design note:** `pkgS2Wins` uses `unitPrice: 1,100,000` and `supplier2Price: 1,000,000`
(10 items), making budget total (11M) intentionally different from winner quoted total (10M).
Doc 17 must show the winner's quoted total, not the budget total.

---

### 3.6 `doc24.integration.test.ts` — 9 tests (P1-05)

**Purpose:** Verify Doc 24 (Bảng theo dõi đăng tải) DOCX uses blank date placeholders in the
"actual publication date" column, not the hardcoded "Đã hoàn thành" string.

| Test | Description |
|---|---|
| DOCX Buffer | `getDocx()` returns a valid Buffer |
| No "Đã hoàn thành" | String not present anywhere in DOCX XML |
| No "Da hoan thanh" | ASCII variant not present |
| Row 1 placeholder | "Ngày ..... tháng ..... năm ....." present in DOCX XML |
| Row 2 placeholder | Same |
| Row 3 placeholder | Same |
| Row 4 placeholder | Same |
| HTML — no hardcoded | HTML output also does not contain "Đã hoàn thành" |
| HTML — placeholder | HTML output contains blank date placeholder |

DOCX content verified by unpacking the generated `.docx` buffer with JSZip and inspecting
`word/document.xml` directly.

---

### 3.7 `doc25.integration.test.ts` — 19 tests (P1-09)

**Purpose:** Verify Doc 25 (Bản cam kết không xung đột lợi ích) exists with correct legal
basis, category logic, all committee members, all bidders, and DOCX export.

| Suite | Tests | Description |
|---|---|---|
| Existence | 2 | Doc 25 found in documentTemplates array; id = 25 |
| Category logic | 3 | DIRECT_50 → 'not_applicable'; DIRECT_SELECTION_SIMPLIFIED → 'recommended'; COMPETITIVE_SHOPPING and OPEN_BIDDING → 'required' |
| Legal basis | 1 | "Điều 16" and "22/2023" cited in HTML |
| Committee members | 3 | expertTeamLeader, expertTeamMember1, expertTeamMember2 all appear in HTML |
| Bidder list | 3 | supplier1Name, supplier2Name, supplier3Name all appear in HTML |
| Commitments | 2 | At least 3 numbered commitment clauses present |
| DOCX export | 3 | Buffer generated; expertTeamLeader present in DOCX XML; no placeholder text |
| Signer | 1 | `getSigner()` references expert team / committee |
| Sign date | 1 | `getSignDate()` returns `pkg.dateEvaluate` |

---

### 3.8 `sanitization.test.ts` — 22 tests (P1-06)

**Purpose:** Verify DOMPurify is functional in jsdom and that all document HTML output is safe
when passed through `DOMPurify.sanitize()` as done in App.tsx.

| Suite | Tests | Description |
|---|---|---|
| DOMPurify baseline | 4 | `<script>` stripped; `onerror` stripped; `javascript:` href stripped; safe HTML preserved |
| XSS in supplier names (7 docs) | 14 | `<script>` and `onerror` stripped for Docs 1, 6, 14, 15, 16, 17, 25 when pkgXss used |
| Legitimate content preserved | 4 | Package name, supplier names, winner name survive sanitization; all 24 existing docs produce non-empty HTML after sanitize |

**Note:** `supplier3Name = 'javascript:alert(1)'` as plain text content is NOT an XSS vector —
DOMPurify correctly preserves it as visible text. Only attribute-based `javascript:` URIs are
dangerous. Tests assert `<script>` and `onerror` are stripped, not the text literal.

---

### 3.9 `demo-data.regression.test.ts` — 20 tests (P1-07, P1-08)

**Purpose:** Verify all four demo packages have internally consistent date sequences with no
same-day approvals, no weekend backdating patterns, and adequate delivery-to-acceptance gaps.

| Suite | Tests | Description |
|---|---|---|
| Date ordering — all 4 packages | 4 | Each date field appears in correct chronological order |
| No same-day approval chain | 4 | dateEvaluate, dateAppraise, dateResultProposal, dateResultApprove are all distinct dates |
| Gói 4 — no Saturday bunching | 1 | Five approval steps are NOT all on the same Saturday |
| HSYC→close gap — all 4 packages | 4 | dateBidClose − dateDocIssue ≥ 7 calendar days (≈5 working days) |
| Delivery-to-acceptance gaps | 3 | Gói 1: ≥ 5 days; Gói 2: ≥ 3 days; Gói 3: ≥ 7 days |
| Gói 4 — acceptable same-day | 1 | Gói 4 (stationery) is allowed same-day delivery+acceptance |
| dateAssetIncrease ordering | 3 | dateAssetIncrease ≥ dateAcceptance for Gói 1, 3, and 4 |

---

## 4. Fixtures — `fixtures.ts`

Shared across all test files. Key fixtures:

| Export | Description |
|---|---|
| `pkgS1Wins` | 10 × 1,000,000; S1 prices cheapest |
| `pkgS2Wins` | 10 × 1,200,000 / 1,000,000 / 1,300,000; S2 cheapest; `unitPrice = 1,100,000` intentionally |
| `pkgS3Wins` | S3 cheapest |
| `pkgTie` | All three suppliers equal → tie-break to rank 1 |
| `pkgMultiItemS2Wins` | 2-item package where S2 wins on aggregate |
| `makePkgWithTotal(n)` | Factory for threshold boundary tests |
| `pkgXss` | XSS payloads in packageName, supplier1Name (script tag), supplier2Name (onerror), supplier3Name (javascript: text) |

---

## 5. Failure History (resolved before merge)

Six test failures were encountered and resolved during development. All were errors in test
expectations, not in application code.

| # | File | Root cause | Fix |
|---|---|---|---|
| 1 | numberToWords | Expected "lăm" after "linh" — wrong Vietnamese rule | Changed expectation to "năm" |
| 2 | doc6.integration | Regex `/Kết luận:[^<]*/` stopped at `</b>` | Switched to `html.slice(indexOf(...))` |
| 3 | doc6.integration | Same regex, second assertion | Same fix |
| 4 | docs14-17.integration | `pkgS2Wins` had `unitPrice === supplier2Price` (both 1M), making Doc 17 price test vacuous | Changed `unitPrice` to 1,100,000 |
| 5 | sanitization | Asserted `not.toContain('alert(')` — plain text is not XSS | Changed assertion to `not.toContain('<script>')` |
| 6 | sanitization | Same assertion, second test | Same fix |

No application logic was modified to make tests pass. All fixes were in test expectations or
test fixture design.

---

## 6. How to Run

```bash
cd app
npm install
npm test                 # run all 162 tests
npm run test:watch       # watch mode
npm run test:coverage    # with V8 coverage report
```

Coverage targets: `src/docTemplates.ts`, `src/demoData.ts`, `src/App.tsx`.
