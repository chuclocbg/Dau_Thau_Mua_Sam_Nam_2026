# Engineering Platform — Future Backlog

**Status:** PLAYBOOK-ONLY, NO CONTRACT AUTHORITY. Every item below is Product-Spec-recommended
(§32/§30/§13) and was previously described in `ENGINEERING_PLATFORM_IMPLEMENTATION_PLAYBOOK.md`
as a numbered phase. `GOVERNANCE_RUNTIME_IMPLEMENTATION_CONTRACT.md`'s own Implementation Order
table ends at Phase 4 — nothing below has ever been, or currently is, Contract-authorized. See
`CONTRACT_PLAYBOOK_ALIGNMENT_REVIEW.md` for the full investigation and
`PLAYBOOK_FUTURE_ROADMAP_DECISION.md` for why this content lives here rather than in the
Playbook's own active phase table.

**Naming discipline, binding for this document:** items here are named "Backlog Item," never
"Phase" — that word is reserved for Contract-traceable work. No item here is numbered in a way
that continues the Playbook's own Phase 0–4 sequence.

---

## Backlog Item A (formerly Phase 5 — First Governance Rule Pack)

**Trigger for reconsideration:** a second real governance rule's need is evidenced by an actual,
repeated manual process this platform doesn't yet automate — not assumed, not scheduled.

**Goal:** Port the Product Spec's §32 starter rule set (Repository, Architecture, ADR, Budget,
Documentation, CI, Review, Release — one rule each) as generic, non-repository-specific
`RuleDefinition`s.

**Deliverables:** 8+ new `RuleDefinition` files in the Registry; scripts only for the ones with
an evidenced, immediate consumer (Product Spec Principle 5's "nothing built ahead of evidenced
need" still applies — a designed-but-unscripted rule is a valid, honest state).

**Required verification:** Each scripted rule passes its own Template's Definition of Done
(`ENGINEERING_PLATFORM_IMPLEMENTATION_PLAYBOOK.md` Part 4).

**Rollback strategy:** Per-rule `git revert`, one commit per rule, never bundled.

**Est. effort:** Medium (8 rules, staged one at a time).

**Expected reuse:** Medium — the *format* is 100% reused; each rule's `Check` logic is, by
design, never reused (Object Model's own permanent exception).

**Stop conditions:** Any rule whose dependency (e.g. a structured frozen-path list) doesn't yet
exist stops until that dependency is built first.

---

## Backlog Item B (formerly Phase 6 — Command Platform Pack)

**Trigger for reconsideration:** Backlog Item A has real, scripted rule content to wrap — this
item is substantively downstream of Item A and should not be attempted before it.

**Goal:** Ship thin command adapters for every scripted rule from Backlog Item A.

**Deliverables:** One command adapter per rule, per the Product Spec §7/§30 contract.

**Required verification:** Grep-verified zero duplicated logic in every adapter.

**Rollback strategy:** `git revert` per command.

**Est. effort:** Low.

**Expected reuse:** High — the adapter *shape* is fully generic.

**Stop conditions:** A command adapter containing any logic beyond invoke-and-relay is a defect,
blocking that command's own completion.

---

## Backlog Item C (formerly Phase 8 — Plugin System)

**Trigger for reconsideration:** a second real adopting repository or a second real rule pack
exists to justify it — not speculatively. Independently corroborated by
`ENGINEERING_PLATFORM_REDUCTION_PLAN.md` Part B, which separately flagged this exact mechanism as
"premature extensibility": a schema built for zero real plugins.

**Goal:** Build the Plugin System (Product Spec §13).

**Deliverables:** A plugin manifest schema + a scanned `plugins/` directory loader.

**Required verification:** A real, non-trivial second plugin installs and its rules/commands are
discoverable without any Core Platform file being modified.

**Rollback strategy:** `git revert`.

**Est. effort:** Medium.

**Expected reuse:** Unknown until a second real consumer exists — do not estimate reuse for a
mechanism with no proven second instance.

**Stop conditions:** This item does not begin at all until its own precondition (a second real
consumer) is met. This is itself the stop condition, stated in advance — unchanged from how the
Playbook itself already described this item before relocation.

---

*End of backlog. No item here is scheduled, prioritized against the others, or implied to be
next. Each is reconsidered independently, only when its own named trigger condition is met.*
