# Implementation Slice 01 — Platform Scaffold

**Status:** PRE-IMPLEMENTATION DISCLOSURE. Planning only. No code, no TypeScript, no runtime, no
commit, no CI, no repository modification. This document is the pre-implementation disclosure
required by `GOVERNANCE_VERTICAL_SLICE_TEMPLATE.md` / Playbook Part 4, presented for approval
before any file in this slice is created.

**Traces to:** `ENGINEERING_PLATFORM_IMPLEMENTATION_PLAYBOOK.md` Part 3, Phase 0 ("Platform
Scaffold"); `ENGINEERING_PLATFORM_PRODUCT_SPEC.md` §6, §7, §20, §29; `ENGINEERING_PLATFORM_
REDUCTION_PLAN.md` Part C §6, §7, §8 (the enum trims applied below).

**Target:** a new, standalone platform repository — never this repository, which remains
out of scope per this session's standing instruction. Paths below are relative to that new
repository's root.

---

## Objective

Stand up the empty Core Platform skeleton — folder structure, the Rule Definition Format schema,
the Command contract schema, an empty governance-rules Registry, and a root instructions file —
as pure documentation/schema. Zero executable code. This is the first file any new adopting
repository receives, and the only slice with no prior slice to depend on.

## Affected files

**Created (all new — nothing pre-exists to modify):**

| # | File | Content |
|---|---|---|
| 1 | `PLATFORM.md` | Root instructions: the Layer 1–8/9+ non-dependency rule (Product Spec §3), the 10 Platform Principles (§2), pointers to files 2–3 below. |
| 2 | `PROJECT_KNOWLEDGE_SYSTEM/01_PROJECT_DOCS/ENGINEERING_PLATFORM_PRODUCT_SPEC.md` | Verbatim copy of the frozen design — the onboarding reference (§20). |
| 3 | `PROJECT_KNOWLEDGE_SYSTEM/01_PROJECT_DOCS/ENGINEERING_PLATFORM_IMPLEMENTATION_PLAYBOOK.md` | Verbatim copy — the execution plan this and every future slice traces to. |
| 4 | `PROJECT_KNOWLEDGE_SYSTEM/05_ENGINEERING_PLATFORM/RULE_DEFINITION_FORMAT.md` | The Rule Definition Format schema (Product Spec §6), **with the Reduction Plan's trims applied**: `rollback_behavior` is two-valued (`revert`/`override` — `data-undo` removed), `failure_behavior` is two-valued (`block`/`warn` — `flag` removed), `execution_points` excludes `scheduled`. |
| 5 | `PROJECT_KNOWLEDGE_SYSTEM/05_ENGINEERING_PLATFORM/COMMAND_CONTRACT.md` | The Command contract schema (Product Spec §7), unmodified — the Reduction Plan named no trim against it. |
| 6 | `PROJECT_KNOWLEDGE_SYSTEM/05_ENGINEERING_PLATFORM/governance-rules/REGISTRY.md` | Empty registry — header + column layout only, zero rules populated (matches `GOVERNANCE_RUNTIME_IMPLEMENTATION_CONTRACT.md`'s own, already-executed Phase 0 precedent exactly — a distinct, separate scope from this document's own Playbook-numbered phases below). |

**Directory skeleton implied but not separately tracked this slice** (Product Spec §29):
`02_AI_CONTEXT/`, `03_KNOWLEDGE_BASE/`, `04_PROJECT_MEMORY/`, `05_ENGINEERING_PLATFORM/prompts/`,
`app/.memory/`, `app/scripts/lib/`, `skills/`, `.claude/commands/`. Git does not track empty
directories — each is created for real by whichever future slice first writes a real file into
it (Playbook Phase 1 creates `app/scripts/lib/`'s first file; Backlog Item A — formerly Playbook
Phase 5, relocated per `ENGINEERING_PLATFORM_FUTURE_BACKLOG.md` — creates `governance-rules/`'s
first rule; etc.). Pre-creating empty placeholders here would be exactly the kind of speculative
scaffolding Reduction Plan Part B ("unnecessary flexibility") already flagged against.

**Forbidden for this slice** (out of scope, not merely deferred):
- Any Reusable Runtime code (Playbook Phase 1).
- Any `RuleExecution`/`Report`/`Validator` code (Playbook Phases 2–4 — 3–4 explicitly postponed
  further by the Reduction Plan).
- Any populated governance rule content (Backlog Item A, formerly Playbook Phase 5) or command
  adapter beyond the schema itself (Backlog Item B, formerly Playbook Phase 6) — see
  `ENGINEERING_PLATFORM_FUTURE_BACKLOG.md`.
- Any CI workflow file — verification standup is a later step (Migration Guide Step 5).
- Any dependency manifest (`package.json` or equivalent) — zero dependencies needed for markdown
  and schema files.
- Any Application Stack (L9–L14) content of any kind.
- **Any file inside this repository** (`E:\Dau_Thau_Mua_Sam_Nam_2026`) — standing instruction,
  unconditional.

## Execution order

1. Copy file 2 (Product Spec), then file 3 (Playbook) — establishes the frozen reference base
   everything else points back to.
2. Author file 1 (`PLATFORM.md`) — now able to correctly reference files 2–3 by their final path.
3. Author file 4 (Rule Definition Format) — apply the three Reduction Plan trims explicitly,
   don't silently carry over the original three-valued enums.
4. Author file 5 (Command Contract) — no trim to apply, straightforward transcription.
5. Author file 6 (empty Registry) — trivial, matches the real `REGISTRY.md` precedent's own
   6-line shape.

## Acceptance criteria

- Exactly the 6 files above exist; `git status --porcelain` shows nothing else.
- Files 2–3 are byte-for-byte identical to their source in this repository (a verbatim copy, not
  a re-summary — re-summarizing a frozen document here would itself be a documentation-debt risk
  the Reduction Plan already named).
- File 4's YAML block parses cleanly and contains exactly two `rollback_behavior` values, exactly
  two `failure_behavior` values, and no `scheduled` value under `execution_points` — spot-checked
  against Reduction Plan Part C §6/§7, not assumed correct by construction.
- File 1 correctly states the layer boundary and all 10 principles — spot-checked against Product
  Spec §2/§3 for drift, since restating them by hand is exactly the kind of duplication this
  whole research arc warns about; if in doubt, this file should quote rather than paraphrase.
- Zero executable code exists anywhere in the diff.

## Rollback

`git revert <this slice's commit>`. Full stop — every file created is new and purely additive;
nothing pre-existing is touched; no data, state, or downstream consumer depends on this slice
yet. This is the simplest possible rollback category in the entire platform (Product Spec §12,
Runtime Contract #7).

## Verification commands

No compiler, no test runner — zero executable code exists yet. The appropriate verification for
this slice specifically:

1. YAML-block validity check on files 4 and 6 (the only two files with an embedded schema block)
   — same technique already used for this repository's own real `REVIEW-3.md`/`REGISTRY.md`
   Contract Phase 0, exit code 0 expected, zero parse errors.
2. `diff` files 2–3 against their source in this repository, confirm byte-for-byte match.
3. `git status --porcelain`, confirm the diff contains exactly the 6 declared files and nothing
   from the Forbidden list above.
4. Manual spot-check of file 4's three trimmed enums against Reduction Plan Part C §6/§7 (no
   automated check exists for this yet — a future `Validator`, Playbook Phase 4, would eventually
   mechanize it, but Playbook Phase 4 is explicitly postponed, so this stays a manual, disclosed
   check for now).

**Tests required:** none in the unit-test sense — this slice ships no logic to unit-test. The
four checks above are this slice's complete verification surface, matching Product Spec §8's own
"a purely advisory/reporting rule needs no dry-run mode" reasoning extended to "a purely
documentation slice needs no test suite."

## CI expectations

No CI pipeline is required to exist yet for this slice — it is the first commit of a brand-new
repository. Product Spec §36's CI Architecture remains valid and unmodified but is not exercised
by this slice; standing up the actual pipeline is Migration Guide Step 5 (Verification
initialization), a later slice. If a CI pipeline happens to already exist when this slice lands
(e.g., scaffolded ahead of schedule by a prior, unrelated action), the correct expectation is a
trivial pass — no compiled source, no test file, nothing for any real check to fail against.

## Commit message

```
Engineering Platform Slice 01: platform scaffold

Per ENGINEERING_PLATFORM_IMPLEMENTATION_PLAYBOOK.md Part 3, Phase 0. Stands up the
empty Core Platform skeleton: root instructions, the two frozen reference documents
new adopting repositories require on day one (Product Spec, Implementation Playbook),
the Rule Definition Format schema, the Command contract schema, and an empty
governance-rules Registry.

- PLATFORM.md: layer boundary rule + 10 Platform Principles + pointers.
- ENGINEERING_PLATFORM_PRODUCT_SPEC.md / ENGINEERING_PLATFORM_IMPLEMENTATION_PLAYBOOK.md:
  verbatim copies, unmodified.
- RULE_DEFINITION_FORMAT.md: Product Spec §6's schema, with three Reduction Plan
  trims applied -- rollback_behavior and failure_behavior both reduced from three
  values to two (data-undo and flag removed, zero real usage evidence for either);
  execution_points excludes scheduled (no scheduler exists or is planned). Each trim
  is reversible at a future MAJOR version if real need ever demonstrates otherwise --
  none is a deletion of capability the platform has ever actually used.
- COMMAND_CONTRACT.md: Product Spec §7's schema, unmodified.
- governance-rules/REGISTRY.md: empty, header only -- zero rules populated, matching
  GOVERNANCE_RUNTIME_IMPLEMENTATION_CONTRACT.md's own real Contract Phase 0 precedent exactly.

Zero executable code. Verified: YAML blocks parse cleanly; the two copied reference
documents diff byte-for-byte identical to their source; git status confirms exactly
these six files, nothing else.

No Reusable Runtime, no RuleExecution, no Report, no Validator, no populated
governance rule, no command adapter, no CI workflow, no dependency manifest, and no
Application Stack content was created -- all out of scope for this Playbook Phase 0.
```

## Estimated implementation time

**30–60 minutes.** No new design decisions are made in this slice — every choice it makes was
already resolved by the frozen Product Spec and Reduction Plan; the work is transcription,
verbatim copying, and mechanical schema-trimming, not authorship. This matches Playbook Part 3's
own effort rating for Phase 0 ("Very low — 1 commit, documentation only").

---

*End of pre-implementation disclosure. Waiting for explicit approval before any file listed above
is created. Per instruction: planning only, no code, no runtime, no commit, no CI, no
implementation. Exactly one markdown file was written.*
