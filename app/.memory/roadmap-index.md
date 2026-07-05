# Roadmap Index

Current roadmap: Infrastructure-first, then Knowledge Layer, then Business Expansion.
Full roadmap detail: `.memory/roadmap-v2.md`

**Current Phase = Phase N (FROZEN). Current Milestone = Knowledge Platform v1.0** (Release
Candidate audit passed 2026-07-05, recommendation GO WITH NOTES — see `.memory/repository-health.md`).
**Next Phase = Phase X (AI Advisory Layer). Next Planned Milestone = Phase X Architecture Design**
— not started, pending explicit user approval before any code is written.

---

## Phase Map

```
INFRASTRUCTURE FOUNDATION
  ✅ A–I  Business core (FROZEN — 12,254 tests)
  ✅ J    Authentication & Authorization (FROZEN)
  ✅ K    Storage & Attachment Service (FROZEN)
  ✅ L    Notification Service (FROZEN)
  ✅ M0   Docker Infrastructure Foundation (design complete)
  ✅ M1   Production Prisma Layer (IMPLEMENTED, PENDING PRODUCTION VERIFICATION — no live DB in this env)

KNOWLEDGE LAYER
  ✅ N1   Corpus Foundation (spec frozen)
  ✅ N2   Legal Reasoning Architecture (spec frozen)
  ✅ N3   AI Context Contract (spec frozen)
  ✅ N    Knowledge Platform — FROZEN, 16/16 providers built (Stage 1+2, Batches 1-4)

BUSINESS EXPANSION
  ⬜ O    Supplier / Contractor Registry
  ⬜ P    Tender Announcement
  ⬜ Q    Bid Submission
  ⬜ R    Bid Opening & Evaluation
  ⬜ S    Contractor Selection & Award
  ⬜ T    Contract Performance Monitoring
  ⬜ U    Final Settlement (Quyết toán)

PLATFORM SERVICES
  ⬜ V    Document Generator
  ⬜ W    Dashboard & Reporting
  ⬜ X    AI Advisory Layer                     ← NEXT (awaiting explicit approval to start)

EXTERNAL INTEGRATION
  ⬜ Y    Public Portal (ĐTMUA / eBid)
```

---

## Critical Path

```
J (Auth) ─────────────┐
K (Storage) ─────────┬┤
L (Notification) ────┤├──→ M (Prisma) ──→ N (Knowledge, FROZEN) ──→ O ──→ P ──→ Q ──→ R ──→ S
                           ↓                                            ↓
                           └──────────────────────────────────→ T → U → V → W → X → Y
```

J, K, L are frozen. M1 is implemented but not yet verified against a live database (no Docker in
this environment). N is now fully frozen at 16/16 providers. **X is the explicitly named next
phase**, but the roadmap's own dependency order (X needs "all business modules + Knowledge
Platform complete") means O through W are still the literal prerequisite path — X was named next
by explicit user instruction, not because its own dependencies (O-W) are satisfied. Do not begin
Phase X code without further explicit approval, per the user's standing instruction.

---

## Phase Sizing

| Phase | Source Files | Tests | Complexity |
|-------|-------------|-------|-----------|
| J Auth | ~10 | ~390 | Medium |
| K Storage | ~9 | ~351 | Medium |
| L Notification | ~10 | ~390 | Medium |
| M Prisma | ~24 | ~390 | High |
| N Knowledge | ~28 | ~1092 | Very High |
| O Supplier | ~7 | ~312 | Low |
| P Tender | ~9 | ~351 | Medium |
| Q Bid | ~8 | ~312 | Medium |
| R Evaluation | ~10 | ~390 | High |
| S Award | ~7 | ~273 | Medium |
| T Monitoring | ~8 | ~312 | Medium |
| U Settlement | ~9 | ~351 | High |
| V Document | ~8 | ~312 | Medium |
| W Dashboard | ~6 | ~234 | Low |
| X AI Advisory | ~14 | ~546 | Very High |
| Y Portal | ~10 | ~390 | High |

---

## Decisions That Shape the Roadmap

- **Phase J before anything** — Auth is a prerequisite for every subsequent module.
- **Phase N before O** — Every business expansion module makes legal decisions that need dynamic resolution.
- **Phase M before N** — Knowledge Platform needs real DB (PostgreSQL full-text, vector extensions).
- **Phase X last** — AI Advisory needs all business modules + Knowledge Platform complete.

See `.memory/decisions/` for decision rationale.
