# Conflict Resolution Strategy

Part of: [reasoning-architecture.md](../decisions/reasoning-architecture.md)

Conflict resolution is applied in Stage 3 (Reasoning Engine) via `IConflictResolver`. The strategy is a fixed 4-tier cascade. The tier order is immutable.

---

## When Conflict Arises

A conflict is declared when two or more applicable knowledge items from the same reasoning call prescribe different (incompatible) requirements for the same dimension.

```
Conflict detection conditions (ALL must hold):
  1. Both items are in scope for the given ReasoningContext
  2. Both items have overlapping effectiveFrom / effectiveTo windows at asOfDate
  3. Both items address the same legal dimension:
       - same concept ('tạm ứng', 'bảo lãnh', 'ngưỡng đấu thầu')
       - same packageType / fundSource scope
  4. The items prescribe different values or outcomes:
       - Item A: advance payment max 30%
       - Item B: advance payment max 20%
       → CONFLICT
```

**Not a conflict:**
- Items addressing different dimensions (threshold vs. guarantee requirement)
- Items at different scopes that do not overlap (A applies to GOODS; B applies to CONSTRUCTION)
- Items with non-overlapping effective periods (A expired before B took effect)
- Items where one IMPLEMENTS the other (hierarchical relationship; not a conflict)

---

## 4-Tier Resolution Strategy

Every conflict is processed through this cascade. The cascade stops at the first tier that resolves the conflict. If all four tiers fail: UNRESOLVED.

### Tier 1 — Legal Hierarchy

```
Rule: The item with the lower authority level number prevails.

authorityLevel ranking (from hierarchy.md):
  1 = Hiến pháp (Constitution)
  3 = Luật (Law)
  6 = Nghị định (Decree)
  8 = Thông tư (Circular)
  14 = Quy chế (Internal Regulation)
  (full 14-level table in hierarchy.md)

Resolution logic:
  if item_A.authorityLevel < item_B.authorityLevel:
    → item_A prevails
    → item_B is set aside (role = CONFLICT_SOURCE, not applied)
    → resolution = RESOLVED_BY_HIERARCHY
    → trace: 'Văn bản [A] (cấp [N]) ưu tiên hơn văn bản [B] (cấp [M])'

Example:
  Conflict: Luật 22/2023/QH15 (authorityLevel=3) vs. TT 79/2025/TT-BTC (authorityLevel=8)
  → Law prevails over Circular.

If same authority level → proceed to Tier 2.
```

### Tier 2 — More Restrictive Principle

```
Context: applies when Layer 3 (organizational, `school` domain) conflicts with
         Layer 1 (legal) or Layer 2 (business).

Vietnamese legal principle: Tổ chức có thể đặt ra quy định nội bộ NGHIÊM NGẶT HƠN luật
nhưng không được ít nghiêm ngặt hơn luật. Internal regulation may be MORE restrictive
than national law but never LESS restrictive.

Resolution logic:
  if item_A.layer = 3 AND item_A.domain = 'school':
    if item_A.value is MORE restrictive than item_B.value:
      → item_A (school policy) prevails as the applied rule
      → item_B (national law) remains in appliedArticles as SUPPORTING_BASIS
        (it is the floor; the school policy is the ceiling)
      → resolution = RESOLVED_BY_MORE_RESTRICTIVE
      → trace: 'Quy chế nội bộ [A] nghiêm ngặt hơn → áp dụng [A]'

    if item_A.value is LESS restrictive than item_B.value:
      → This is a VIOLATION of the more-restrictive principle
      → Add warning: 'Quy chế nội bộ ít nghiêm ngặt hơn pháp luật — vi phạm'
      → item_B (law) prevails
      → humanReviewRequired = true (policy may need to be updated)
      → resolution = RESOLVED_BY_HIERARCHY (law overrides non-compliant policy)
      → trace: 'Quy chế nội bộ [A] ít nghiêm ngặt hơn pháp luật [B] → pháp luật ưu tiên, cần rà soát quy chế'

"More restrictive" determination:
  For NUMERIC thresholds: smaller value = more restrictive for maximums; larger value for minimums
    advance payment max: 20% is more restrictive than 30%
    advance payment min guarantee: 10% is less restrictive than 15%
  For REQUIREMENT existence: requiring something is more restrictive than not requiring it
    requiring bid security = more restrictive; not requiring = less restrictive
  For PROCEDURE: more steps = more restrictive; fewer steps = less restrictive

If neither item is Layer 3, OR same layer → proceed to Tier 3.
```

### Tier 3 — Lex Posterior

```
Latin: "lex posterior derogat priori" — the later law repeals the earlier one.

Applies when: same authority level, same layer, different effectiveFrom dates.

Resolution logic:
  if item_A.effectiveFrom > item_B.effectiveFrom:
    → item_A (newer) prevails
    → item_B (older) is set aside unless item_A explicitly preserves it
    → resolution = RESOLVED_BY_LEX_POSTERIOR
    → trace: 'Văn bản [A] (có hiệu lực từ [date]) muộn hơn → ưu tiên theo nguyên tắc luật sau'

Caveats:
  - Lex posterior applies only if both documents address the SAME legal dimension
    (same subject matter, same scope)
  - If one document explicitly preserves provisions of the other:
    ('Giữ nguyên hiệu lực các quy định tại Điều X...') → those provisions survive
    → preserve both; no conflict; add cross-reference relation
  - Lex posterior does NOT apply if the older document is more specific (→ use Tier 4)

If same effectiveFrom date, OR if lex posterior is inapplicable due to caveats → proceed to Tier 4.
```

### Tier 4 — Lex Specialis

```
Latin: "lex specialis derogat legi generali" — the specific law overrides the general law.

Applies when: same authority level, same layer, same effectiveFrom, different scopes.

Resolution logic:
  Determine which item has a narrower (more specific) scope:
    Narrower scope indicators:
      - applies to specific packageType (GOODS only) vs. all types
      - applies to specific fundSource (ODA) vs. all sources
      - applies to specific procurement method vs. all methods
      - applies to specific value range vs. all values
      - applies to specific department/region vs. nationwide
      - issued under a specific implementing program vs. general law

  if item_A scope is subset of item_B scope:
    → item_A (more specific) prevails for the specific context
    → item_B (more general) still applies to other contexts
    → resolution = RESOLVED_BY_LEX_SPECIALIS
    → trace: 'Văn bản [A] (phạm vi hẹp hơn: [scope]) ưu tiên hơn văn bản [B] (phạm vi rộng)'

Example:
  Item A: TT specifically about ODA procurement (procurementType=ODA)
  Item B: TT about all STATE_BUDGET procurement (procurementType=STATE_BUDGET)
  Context: ODA procurement
  → Item A (ODA-specific) prevails

If scope cannot be determined, or both items have equivalent scope → UNRESOLVED.
```

### UNRESOLVED — Human Review Escalation

```
When all 4 tiers fail to resolve:
  → Set DetectedConflict.resolution = UNRESOLVED
  → Set humanReviewRequired = true
  → Add humanReviewReason: 'Xung đột pháp lý không thể giải quyết tự động giữa [A] và [B]'
  → confidence deduction: −0.20 per unresolved conflict
  → Both conflicting items remain in appliedArticles with role = CONFLICT_SOURCE
  → decision may still be composed (without the conflicting dimension) but will be marked PARTIAL
  → Add warning: 'Cần tư vấn pháp lý: xung đột giữa [A] và [B] chưa được giải quyết'

Escalation information provided to reviewer:
  - Both conflicting items with full text
  - The dimension they conflict on
  - Why each tier failed to resolve
  - Suggested resolution approach
  - Legal counsel contact if available from SchoolPolicyProvider
```

---

## IConflictResolver Interface

```typescript
interface IConflictResolver {
  detect(
    items:   KnowledgeItemRef[],
    context: ReasoningContext
  ): DetectedConflict[]

  resolve(
    conflict: DetectedConflict,
    context:  ReasoningContext
  ): ResolvedConflict

  isMoreRestrictive(
    candidate:  KnowledgeItemRef,
    baseline:   KnowledgeItemRef,
    dimension:  string
  ): boolean | null    // null = cannot determine
}
```

The default implementation is `HierarchyConflictResolver` (implements the 4-tier cascade above). Custom resolvers for specific conflict types may be registered for special cases — but the 4-tier cascade is the foundation that all implementations start from.

---

## Conflict Examples

### Example 1 — Advance Payment Rate (Tier 2)

```
Context: STATE_BUDGET, GOODS, advance payment 35%

Item A: TT 79/2025/TT-BTC Điều 15 (authorityLevel=8, layer=1)
  → advance payment max 30% for STATE_BUDGET

Item B: School policy 'Quy chế chi tiêu nội bộ' (authorityLevel=14, layer=3)
  → advance payment max 20% for all fund sources

Tier 1: Item A authorityLevel=8 < Item B authorityLevel=14 → A prevails by hierarchy?
  WAIT: this is a Layer 3 school policy. Tier 2 applies first for Layer 3 conflicts.

Tier 2: Item B (school, layer=3) vs Item A (law, layer=1)
  Item B (20%) is MORE restrictive than Item A (30%)
  → Item B (school policy 20%) is the applied ceiling
  → Item A (law 30%) is the legal floor (still noted in appliedArticles as SUPPORTING_BASIS)

Resolution: RESOLVED_BY_MORE_RESTRICTIVE
Applied: max 20% advance payment
Citations: 'Quy chế chi tiêu nội bộ (max 20%) căn cứ theo TT 79/2025/TT-BTC Điều 15 (max 30%)'
```

### Example 2 — Threshold Conflict (Tier 3)

```
Context: GOODS, STATE_BUDGET, estimatedValue = 3B VNĐ

Item A: NĐ 24/2024/NĐ-CP Điều 20 (authorityLevel=6, effectiveFrom=2024-03-01)
  → open tender required for GOODS > 2B VNĐ

Item B: NĐ 50/2022/NĐ-CP Điều 18 (authorityLevel=6, effectiveFrom=2022-06-01)
  → open tender required for GOODS > 3B VNĐ

Same authority level. Same layer.

Tier 1: same authorityLevel=6 → no resolution
Tier 2: neither is Layer 3 → skip
Tier 3: Item A effectiveFrom=2024-03-01 > Item B effectiveFrom=2022-06-01
  → Item A (newer, 2024) prevails
  → threshold = 2B VNĐ; 3B > 2B → open tender required

Resolution: RESOLVED_BY_LEX_POSTERIOR
Note: check if Item A explicitly repeals Item B's threshold → if yes, Item B fully superseded
```

### Example 3 — Scope Conflict (Tier 4)

```
Context: ODA-funded CONSULTING, estimatedValue = 800M VNĐ

Item A: TT 09/2023/TT-BKHĐT (authorityLevel=8, layer=2)
  → General circular: consulting tender threshold > 500M requires open tender

Item B: TT 12/2024/TT-BKHĐT (authorityLevel=8, layer=2, same effectiveFrom month)
  → ODA-specific circular: consulting tender threshold > 1B VNĐ for ODA packages

Same authority level. Same layer. Same effectiveFrom date range.

Tier 1: same → skip
Tier 2: neither Layer 3 → skip
Tier 3: same effective period → skip
Tier 4: Item B scope = ODA only (narrow); Item A scope = all sources (broad)
  Context has fundSource=ODA → Item B (ODA-specific) prevails
  Threshold = 1B VNĐ; 800M < 1B → open tender NOT required for this ODA consulting package

Resolution: RESOLVED_BY_LEX_SPECIALIS
```

### Example 4 — UNRESOLVED

```
Context: GOODS, STATE_BUDGET, advance payment question

Item A: CV 1234/BTC-2025 (authorityLevel=11)
  → advance guarantee required for all STATE_BUDGET contracts

Item B: CV 5678/BKHDT-2025 (authorityLevel=11, same date)
  → advance guarantee required only for STATE_BUDGET contracts > 500M VNĐ

Context: estimatedValue = 300M VNĐ

Tier 1: same authorityLevel=11 → no resolution
Tier 2: neither Layer 3 → skip
Tier 3: same effectiveFrom → skip
Tier 4: Item A (all contracts) vs Item B (> 500M only)
  Item B has narrower scope. Context has estimatedValue = 300M < 500M.
  But: Official Letters (CV) are non-binding and cannot conflict with Circulars.
  Item A from BTC (MOF); Item B from BKHDT (MPI) — different ministries, same level.
  Scope: Item A says 'all'; Item B says '> 500M'. For 300M contract:
  Item A → guarantee required
  Item B → guarantee NOT required (300M < 500M)
  Both same authority, same date, same layer. Cannot determine which ministry's CV prevails.

Resolution: UNRESOLVED
humanReviewRequired: true
humanReviewReason: 'Công văn BTC và BKHĐT mâu thuẫn về yêu cầu bảo lãnh tạm ứng cho gói 300M. Cần tư vấn pháp lý.'
```
