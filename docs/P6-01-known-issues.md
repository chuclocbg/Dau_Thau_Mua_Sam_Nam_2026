# P6-01 Known Issues

**Phase:** P6-01 PlannerAgent  
**Recorded:** 2026-06-14  
**Checkpoint:** P6-01-complete (commit `d3d2627`)  
**Source:** Real-world verification against 3 procurement scenarios.

---

## ISSUE-001 — Mechanical workshop consumables not recognized by packageGenerator

**Severity:** HIGH  
**Scenario:** "Mua vật tư tiêu hao cho xưởng thực hành cơ khí"  
**Affected component:** `app/src/ai/packageGenerator.ts`

**Observed behaviour:**  
`generatePackageSuggestion` returns category `"Không xác định"`, `estimatedTotal: 0`, `confidence: 'low'`, and `procurementMethodHint: "Không xác định được — nhập tổng giá trị ước tính thủ công."` for inputs describing mechanical workshop consumables.

**Downstream impact:**  
All fields derived from the estimate are invalid: authority level (`rector_direct` on 0 VND), procurement method (unresolved), quarter assignment (`Q2` instead of `Q1` for consumables), calendar lead time (30-day default fallback), and legal basis. The resulting dossier is not audit-ready.

**Root cause:**  
`packageGenerator` has no category rule for mechanical/workshop consumable materials ("vật tư tiêu hao cơ khí", "vật tư cơ khí", "dụng cụ xưởng").

**Fix direction (do not implement until P6-02 is scoped):**  
Add a category rule for mechanical consumables in `packageGenerator`. Alternatively, implement a mandatory manual-entry fallback path in `PlannerAgent.process()` when `confidence === 'low'` and `estimatedTotal === 0`.

---

## ISSUE-002 — confidence='medium' for unambiguous 300-computer scenario

**Severity:** MEDIUM  
**Scenario:** "Mua 300 bộ máy tính cho phòng thực hành năm 2026"  
**Affected component:** `app/src/ai/packageGenerator.ts`

**Observed behaviour:**  
The full-sentence input is correctly categorized as "Máy tính và thiết bị tin học" with a correct estimate of 6,000,000,000 VND, but `confidence` is `'medium'` rather than `'high'`. The short form "máy tính để bàn" returns `confidence: 'high'`.

**Root cause:**  
`generatePackageSuggestion` likely matches the full-sentence goal with a lower confidence score because the keyword match is less direct when the input contains contextual phrases ("cho phòng thực hành năm 2026").

**Fix direction:**  
Consider pre-processing the goal string in `PlannerAgent` to strip common context phrases (year references, purpose clauses) before passing each item to `generatePackageSuggestion`, or adjust the matching logic in `packageGenerator` to anchor on core noun phrases.

---

## ISSUE-003 — collectAllLegalBasis() does not deduplicate equivalent citations

**Severity:** MEDIUM  
**Scenario:** S1 (ministry authority level)  
**Affected component:** `app/src/agents/PlannerAgent.ts` — `collectAllLegalBasis()`

**Observed behaviour:**  
For ministry-level packages, the legal basis array contains two entries that reference the same article:
- `"Điều 38-41 Luật Đấu thầu 22/2023/QH15 — lập và phê duyệt KHLCNT"` (fixed citation)
- `"Điều 38-41 Luật Đấu thầu 22/2023/QH15 — KHLCNT"` (from `AUTHORITY_BASIS_MINISTRY`)

**Root cause:**  
`collectAllLegalBasis` uses `Set<string>` for deduplication. The two strings differ in their suffix, so the Set treats them as distinct. The fixed citation and the ministry authority basis were authored independently with slightly different text.

**Fix direction:**  
Either normalize citation strings before insertion (e.g., strip the suffix after the em-dash, or use only the article number as the dedup key), or align the text of `AUTHORITY_BASIS_MINISTRY[0]` with the fixed citation so they are identical strings and the Set collapses them naturally.

---

## ISSUE-004 — output.warnings is always empty even when confidence='low'

**Severity:** MEDIUM  
**Scenario:** S3 (unrecognized category)  
**Affected component:** `app/src/agents/PlannerAgent.ts` — `process()`

**Observed behaviour:**  
When `generatePackageSuggestion` returns `confidence: 'low'` or `estimatedTotal: 0`, `PlannerAgent` still returns `output.warnings: []`. The caller receives no actionable message beyond reading the `confidence` field directly.

**Audit impact:**  
A dossier with 0-VND packages and empty warnings would pass silently to the next stage with no indication that manual review is required. State Audit expects explicit flags on incomplete data.

**Fix direction:**  
In `process()`, after building `packages`, check for any package where `confidence === 'low'` or `estimatedTotal === 0` and push a descriptive Vietnamese warning into `output.warnings`, e.g.:  
`"Gói [tên]: không xác định được danh mục hoặc giá trị — cần nhập thủ công trước khi lập hồ sơ."`

---

## ISSUE-005 — budgetUtilization=-1 sentinel is not surfaced to users

**Severity:** LOW  
**Scenario:** All three scenarios  
**Affected component:** `app/src/agents/PlannerAgent.ts` — `process()`

**Observed behaviour:**  
When `PlannerInput.totalBudget` is not provided, `output.budgetUtilization` is set to `-1` as a sentinel value. This is documented in the `PlannerOutput` interface comment but is not communicated to the caller via `output.warnings`.

**Fix direction:**  
Add a warning entry when `budgetUtilization === -1`, e.g.:  
`"totalBudget không được cung cấp — không tính được tỷ lệ sử dụng ngân sách."` This is a low-priority quality-of-life improvement; the sentinel value itself is not a correctness bug.

---

## Status

| ID | Severity | Component | Status |
|---|---|---|---|
| ISSUE-001 | HIGH | packageGenerator | Open — defer to P6-02 scope |
| ISSUE-002 | MEDIUM | packageGenerator | Open — defer to P6-02 scope |
| ISSUE-003 | MEDIUM | PlannerAgent | Open — defer to P6-02 scope |
| ISSUE-004 | MEDIUM | PlannerAgent | Open — defer to P6-02 scope |
| ISSUE-005 | LOW | PlannerAgent | Open — defer to P6-02 scope |
