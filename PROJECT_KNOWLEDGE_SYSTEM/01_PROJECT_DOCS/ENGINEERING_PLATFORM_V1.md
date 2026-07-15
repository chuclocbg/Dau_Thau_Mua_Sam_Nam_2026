# Engineering Platform v1 — Developer Productivity & Governance Design

**Status:** DESIGN ONLY. No source, test, CI, workflow, hook, plugin, or agent was created or
modified to produce this document. Every pain point below is drawn directly from this
repository's own history (X.14–X.20.1) and this session's own transcript, cross-checked against
`.claude/settings.local.json`'s existing permission entries where useful as independent
evidence — not imported from another project's playbook.

---

## 1. Current Pain Points

Ranked by how often they actually recurred, not by how they sound:

1. **The verification triad is re-run by hand at every single step.** `tsc -b`, the
   architecture guard suite, and the full test suite were manually invoked, separately, at
   every step of X.16 through X.20.1 — dozens of times. No two invocations across the session
   are guaranteed identical (flags, working directory, output capture method all varied).
2. **`npx prisma validate`'s `execSync` timeout flake recurs at nearly every freeze** — X.14,
   X.15, X.17, X.19, and X.20.1 all hit it, always the same signature (`Test timed out in
   5000ms`, a different file each time under parallel contention), always resolved the same
   way (rerun 2-3 times). This is tribal knowledge, re-explained in prose in every freeze
   report, never codified as a check a script can perform.
3. **`gh` CLI is not on PATH in this environment, and this gets rediscovered repeatedly.**
   `.claude/settings.local.json` already has `Bash(gh auth *)`, `Bash(gh --version)`, and
   `PowerShell(gh *)` pre-approved — someone already tried to make `gh` work before this
   session even started. It still isn't available. X.18, X.19, and X.19's freeze each
   independently fell back to `curl` against the public GitHub Actions API and hand-wrote a
   polling loop from scratch.
4. **`tsc --noEmit` was a pre-approved, habitual command before anyone knew it was broken.**
   `.claude/settings.local.json` contains `PowerShell(cd ...\app; npx tsc --noEmit ...)` —
   proof this exact, silently-no-op invocation was routine practice before X.19's investigation
   found it compiled zero files. A verification step that can silently do nothing and still
   exit 0 is the single most expensive bug class this project has had (an entire investigation
   milestone), and nothing currently prevents a second, different instance of the same class.
5. **The working tree reliably contains unrelated foreign content**, and confirming "only the
   intended files are staged" is done by hand, every commit, by re-deriving a filter. The same
   permission file already has a hand-built regex for this
   (`grep -E "orchestrator|src/memory/|generated/|\.docx$|\.png$|commit_msg"`) — evidence this
   exact problem was hit and manually patched around at least once before this session, and is
   being manually patched around again in this session.
6. **Windows + Git Bash path quirks cost real tool calls.** `git -C .. add <relative-path>`
   silently mis-resolved and doubled a path prefix mid-session (X.19 freeze); Bash's `/tmp` is
   invisible to the Read/Grep tools, requiring files to be copied into the scratchpad directory
   before other tools could inspect them (X.20 planning audit). Both were re-discovered live,
   not documented anywhere beforehand.
7. **`CURRENT_MILESTONE.md` freeze updates are large, hand-composed prose blocks that follow an
   identical template every time** (`scope` / `scope_exclusion` / `files_added` /
   `full_suite_result` / `ci_verification` / `exit_criteria_met` / `frozen_interfaces_touched`)
   — the structure never changes, only the content. Every freeze re-derives the skeleton from
   reading the previous entry.
8. **CLAUDE.md references a skill file that does not exist.** `skills/dau-thau-mua-sam.md` is
   named as the authority for procurement-domain judgment ("Consult... Use this skill for:
   Procurement planning, HSMT, HSYC, Bid evaluation...") but no `skills/` directory exists
   anywhere in the repository. Any procurement-domain review command built on top of it is
   blocked until this is resolved — named here, not silently assumed away.
9. **A recurring governance-exception pattern (GX-001 through GX-004, plus X.19's own frozen-
   file fix) has one root cause, already diagnosed once but never elevated to a standing rule:**
   architecture guards written as exact-literal or exact-count assertions break every time a
   frozen area is additively extended, even when the extension is fully legitimate.
   `ADR_X15_ARCHITECTURE_DECISION.md`'s own Governance Exceptions section already recommends
   "presence-check style, not exact-substring" for future guards — but this is buried in one
   ADR, not a rule every future guard-writer sees by default.
10. **Distinguishing a real regression from the known Prisma-validate flake, and distinguishing
    a `continue-on-error`-masked CI "success" from a genuine pass, are both judgment calls made
    fresh, in prose, every single time** — most recently for the Type-check step's own
    `continue-on-error: true` masking real internal `tsc -b` failures (X.19).

---

## 2. Root Causes

- **No reusable automation layer above raw shell commands.** Every verification, every git
  check, every CI poll is typed by hand from memory each time, so drift (different flags,
  different working directories, different output handling) is inevitable and has already
  caused one real defect (`tsc --noEmit` vs `tsc -b`).
- **No canonical, machine-readable source of truth for "what is frozen."** The `do_not` list in
  `CURRENT_MILESTONE.md` is prose, not a structured list a script could diff staged files
  against — so every frozen-zone check is manual re-reading of a 200+ line block.
- **No persistent memory for known-flaky infrastructure.** The Prisma-validate timeout is
  diagnosed identically five times because nothing records "this is already a known, accepted
  flake with this exact signature" in a place a future check (human or automated) consults
  before re-diagnosing from scratch.
- **Environment gaps (`gh`, path quirks) are discovered live instead of documented once.**
  Nothing captures "this doesn't work here, use this instead" durably — each phase re-learns it.
- **Governance documents are hand-authored prose with a fixed shape**, so the cost of writing
  one scales with its length, not with the amount of genuinely new information it contains.
- **A real architectural insight (guard-writing style) stayed scoped to the ADR that produced
  it**, instead of being promoted to a repository-wide standard everyone is expected to follow
  by default going forward.

---

## 3. Recommended Platform Improvements

### 3.1 Workflow automation

| ID | Recommendation | Why it fits *this* repo |
|---|---|---|
| **W1** | `/verify` — one command running `tsc -b`, the architecture guard suite, and the full test suite (with the documented 3x-rerun-on-Prisma-flake protocol built in), printing one pass/fail summary. | This exact triad was run by hand at every one of ~15 steps across X.16–X.20.1. |
| **W2** | `/freeze` — runs `/verify`, then the git checks (HEAD / `origin/develop` / branch sync / working tree), then polls GitHub Actions (via **W3**), then prints a filled-in freeze-report skeleton for the narrative sections a human still has to write. Does **not** auto-write `CURRENT_MILESTONE.md`'s prose — only the mechanical legwork that precedes it. | Matches the exact sequence performed at every X.16–X.19 freeze; only the narrative judgment (what to say about scope/risk/decisions) stays human. |
| **W3** | A committed CI-status script (`app/scripts/ciStatus.ts` or `.sh`) wrapping the `curl`-against-public-API polling loop. | Hand-written from scratch 4 separate times this session (X.18, X.19, X.19-freeze, X.20.1) — should be typed once. |
| **W4** | A committed git-status-diff script that filters known, already-identified foreign files (mirroring the regex already hand-built once in `.claude/settings.local.json`) and prints only what's actually new/changed. | Directly answers "are only my intended files staged?" — asked and manually re-derived at every commit this session. |

### 3.2 Hook system

Evaluated against the user's own suggested hook points — only the ones with clear, evidenced
value are recommended; the rest are explicitly rejected below with reasons.

| ID | Hook point | Recommendation | Evidence |
|---|---|---|---|
| **H1** | Before commit | **Recommended.** Fail loudly if `tsc -b --listFilesOnly` reports 0 files. | Directly prevents a second instance of the exact bug class X.19 spent a milestone investigating. Cheapest possible check for the most expensive incident on record. |
| **H2** | Before commit | **Recommended.** Diff staged files against a structured (not prose) frozen-path list; require an explicit acknowledgment to proceed if any match. | Every frozen-zone check this session was manual re-reading of `CURRENT_MILESTONE.md`'s `do_not` block — real cognitive load, real error surface. |
| **H3** | Before migration / before modifying schema | **Recommended, lightweight.** A checklist reminder (DB reachability, `prisma validate`, exactly-one-additive-migration) rather than a hard gate — matches the manual dance already performed correctly at X.17/X.19. | Not currently a source of errors, but formalizing it costs little and removes reliance on memory. |
| **H4** | After CI | **Not a true hook** — no webhook receiver exists in this environment. **W3** (a poll-and-report script, run manually after every push) is the practical substitute; do not attempt to build a real post-CI hook without a webhook endpoint, which is out of scope for a local dev tool. | |
| **H5** | Before modifying legal knowledge | **Recommended, narrow.** A grep-based sanity check on any diff under `Legal/` or a knowledge-base path: flag real-looking organization/person names (violates CLAUDE.md's Demo Data Principles) and unfamiliar legal-document numbers not present in CLAUDE.md's Legal Priority list. Advisory only, never blocking — this is a compliance-critical project where a cheap, imperfect check still has value, but false positives must never block real legal work. | CLAUDE.md is explicit and severe about fabricated citations/real names; nothing currently checks this mechanically. |
| — | Before implementation, after deployment | **Not recommended.** "Before implementation" is already served by this project's planning-document discipline (its strongest existing muscle — every phase this session started with an implementation plan). "After deployment" has no deployment automation to hook into yet (`deployment/deploy.sh` is a local script, not a CD pipeline) — premature. | |

### 3.3 Slash commands

Evaluated against the user's own example list — only commands with a *specific, already-
observed* problem behind them are recommended as-is; others are narrowed or deferred.

| Command | Recommendation | Basis |
|---|---|---|
| `/verify` | **Build.** See W1. | Highest-frequency real need. |
| `/freeze` | **Build.** See W2. | Second-highest-frequency real need. |
| `/architecture-review` | **Build, on-demand version of H2.** Lets a frozen-zone check run mid-investigation, before committing to an approach, not only at commit time. | X.20's own planning audit needed exactly this (cross-referencing 177 files against frozen prefixes) and did it by hand with `grep`. |
| `/test-review` | **Build.** Triages a failing test: matches it against the known Prisma-validate flake signature (execSync + 5000ms timeout, `prisma validate` migration test) vs. flags it as a possible real regression needing human attention. | This exact judgment call was made manually 5+ times (X.14, X.15, X.17, X.19, X.20.1). |
| `/ci-review` (renamed from the user's `/Review`, more specific) | **Build.** Interprets a GitHub Actions run: distinguishes a genuine step failure from a `continue-on-error`-masked one, and states plainly which is which. | X.19's Type-check step showing API "success" while genuinely failing internally is exactly the kind of result that needs an explicit interpretation step, not a glance. |
| `/legal-review` | **Design now, build blocked.** Real value (checks a generated dossier against CLAUDE.md's Legal Priority ordering, Demo Data Principles, and risk-severity tagging) but has no domain rules to execute against beyond CLAUDE.md itself until `skills/dau-thau-mua-sam.md` exists (Pain Point 8). | |
| `/procurement-review` | **Same blocker as `/legal-review`.** Do not build until the referenced skill file exists — building this command against nothing would create a second broken reference, not fix the first. | |
| `/kb-update` | **Design now, defer build.** A structured checklist (citation format, expiry tracking, legal-priority placement) for adding to the legal knowledge base — genuinely useful once that knowledge base has real content to govern; today there is little to update, so building the tool ahead of the content it governs is low-value. | |
| `/Plan` | **Not recommended as a new command.** Planning discipline is already this project's best-functioning process (every phase X.16–X.20 started with a written plan, reviewed before implementation). A slash command here would formalize something already working, not fix something broken. | |

### 3.4 Multi-agent workflow (responsibilities only — not implemented, per instruction)

This project already performs every one of these roles, sequentially, inside one continuous
session. The question worth answering is *not* "should these exist" (they already do,
informally) but "would separating them add anything" — the answer is genuinely mixed:

- **Planner** — writes the `XN_IMPLEMENTATION_PLAN.md`, decides staging, sizes against the
  Decision Budget. Already a distinct phase of every milestone; separating it into its own
  agent adds little since the same session already does this well.
- **Explorer** — codebase search/discovery. Already exists as a distinct agent type in this
  environment (`Explore`) and is available today; no new design needed.
- **Architect** — evaluates the ADR-trigger checklist, Decision Budget fit, and frozen-zone
  impact *before* implementation starts. Currently performed inline, informally, at the start
  of implementation. Separating this into an explicit, checklist-driven step (independent of
  whoever implements) has real value in a project this compliance-sensitive — it mirrors
  CLAUDE.md's own stated principle of preserving independence between the Expert Team and the
  Appraisal Team in procurement governance; the same "independent second look" logic applies to
  engineering review.
- **Implementer** — makes the approved edits within budget. What every "Step N" already is.
- **Reviewer** — post-hoc diff review against the frozen-path list and Decision Budget,
  *distinct from* Architect (which reviews the plan before code exists). Catches drift between
  what was planned and what actually landed in the diff — a real, different check than the
  pre-implementation one.
- **Test Reviewer** — flake-vs-regression triage (see `/test-review`, §3.3). Given how often
  this judgment call recurred, this is the single highest-value role to eventually separate.
- **CI Reviewer** — interprets GitHub Actions results, including `continue-on-error` masking
  (see `/ci-review`, §3.3).
- **Legal Reviewer / Knowledge Reviewer** — domain-specific correctness against CLAUDE.md's
  procurement/legal rules. Highest potential value of all the roles listed here, since it's the
  actual business the repository serves — but blocked on the same missing skill file as
  `/legal-review` and `/procurement-review` (§3.3).

**Recommendation:** do not build separate agents now. The commands in §3.3 deliver the same
practical value (a distinct, on-demand check) without the overhead of coordinating multiple
agents in a single-developer session. Revisit agent separation only if/when work is genuinely
parallelized (e.g., a second person or a background task queue), where an independent Reviewer
running concurrently with an Implementer would have real teeth.

### 3.5 Repository governance — rules to make permanent

| ID | Rule | Currently |
|---|---|---|
| **G1** | `tsc -b` is the only acceptable type-check invocation; bare `tsc --noEmit` is banned outright. | Enforced ad hoc since X.19; not written down anywhere durable. |
| **G2** | Architecture guards must assert *presence*, not exact literal content or exact counts, wherever the asserted set is expected to grow additively. | Stated once, as forward-looking guidance, inside `ADR_X15_ARCHITECTURE_DECISION.md`'s Governance Exceptions section — never promoted to a standing, repo-wide rule. |
| **G3** | Any `execSync('npx prisma validate')`-shaped test timeout gets rerun up to 3 times, comparing which file(s) vary, before being treated as a regression. | Tribal knowledge, re-stated in prose in five separate freeze reports. |
| **G4** | Touching a frozen file requires either (a) a newly-approved milestone whose stated purpose covers it, or (b) a GX-style minimal, literal, documented exception. | Followed consistently in practice; never written down as a standing rule independent of precedent. |
| **G5** | Never `git add -A` / `git add .`; always enumerate exact files; always diff `git status --porcelain` against the intended file list before every commit. | Followed rigorously this session; the working tree reliably contains unrelated foreign content, so this isn't optional caution — it's load-bearing. |
| **G6** | After every push: confirm `HEAD == origin/<branch>`, confirm a clean working tree, and poll CI to completion — never assume "pushed" means "verified." | Already done after every push this session; should be named as a standing requirement rather than re-explained per phase. |
| **G7** | Schema changes: live-DB reachability check → `prisma validate` → exactly one additive migration per approved change → applied via `migrate dev` against the real dev DB before commit. | Matches actual X.19 practice; not written down. |
| **G8** | New CI steps default to `continue-on-error: true` whenever pre-existing debt would otherwise immediately redden the pipeline; only flip to blocking once a real zero-error baseline is confirmed. | Established at X.18 (lint), reaffirmed at X.19 (type-check); a real, reusable policy, currently expressed only as two separate one-off decisions. |

### 3.6 Developer productivity — biggest repeated time sinks

Every item below maps directly to a recommendation above; listed here for traceability:

- Re-deriving the verification triad every step → **W1/H1**
- Hand-writing the CI-polling loop every time → **W3**
- Re-deriving the "which files are foreign" filter every commit → **W4/G5**
- Re-discovering `gh`/environment gaps each phase → this document itself, plus **W3** as the
  standing substitute (recommend explicitly documenting "curl + public API is the standard
  fallback here" so it stops being re-investigated)
- Re-discovering Windows/Git-Bash path quirks (`-C ..` duplication, `/tmp` invisibility to
  Read/Grep) → worth a short, permanent "known environment gotchas" note, not a code change
- Hand-composing the `CURRENT_MILESTONE.md` template from scratch each freeze → a lightweight,
  committed skeleton/template file for the seven recurring `milestone_evidence` sub-fields,
  populated by hand each time but no longer re-derived from scratch

---

## 4–9. Priority, Effort, Speedup, Risk, ADR & Decision-Budget Analysis

| ID | Priority | Effort | Expected speedup | Key risk | ADR required? | Decision Budget applies? |
|---|---|---|---|---|---|---|
| W1 `/verify` | **High** | Low (1 script wrapping 3 existing commands) | High — collapses ~15 recurring manual invocations into 1 | Low — purely additive tooling, no runtime code touched | No | Yes — fits easily (1-2 files) |
| W2 `/freeze` | **High** | Low-Medium (depends on W1/W3) | High — the mechanical half of every freeze, currently the most time-consuming step | Low, provided the narrative sections stay explicitly human-authored (must not auto-generate judgment calls) | No | Yes |
| W3 CI-status script | **High** | Low (extract existing, proven bash logic into 1 file) | Medium-High — removes 4-repeats-and-counting of hand-written polling | Low | No | Yes |
| W4 git-status-diff script | **Medium** | Low | Medium — saves manual eyeballing at every commit | Low | No | Yes |
| H1 pre-commit `tsc -b` sanity check | **High** | Very low | High relative to cost — prevents recurrence of the project's most expensive-to-diagnose defect class | Very low | No | Yes |
| H2 frozen-path guard | **Medium** | Medium (needs a structured, machine-readable frozen-path list extracted from `do_not` prose first) | Medium | Medium — a structured list can drift from the prose `do_not` block if not kept in sync; needs an owner | No | Yes, but the structured-list extraction itself should be reviewed once, not assumed correct |
| H3 before-migration checklist | **Low-Medium** | Low | Low-Medium — formalizes something already done correctly | Low | No | Yes |
| H5 legal-knowledge sanity check | **Medium** (high domain value, currently low volume of legal-content commits) | Low-Medium | Currently low (little KB content yet); rises sharply once KB work resumes | Medium — must stay advisory-only; a false-positive block on real legal work would be actively harmful in an audit-first project | No | Yes |
| S `/verify`, `/freeze`, `/architecture-review`, `/test-review`, `/ci-review` (commands) | **High** (the first three), **Medium** (the latter two) | Low each, individually | High cumulative | Low | No | Yes, one command per commit — do not bundle all five into one implementation step |
| S `/legal-review`, `/procurement-review`, `/kb-update` | **Blocked / Low priority until unblocked** | N/A until `skills/dau-thau-mua-sam.md` exists | Potentially the highest of any item here, once unblocked (this is the project's actual business, not just engineering hygiene) | High if built prematurely against a nonexistent skill file (creates a second broken reference) | No | N/A until the blocker is resolved |
| Multi-agent role separation (§3.4) | **Low, for now** | Not scoped (design only) | Unclear until work is actually parallelized | Coordination overhead may exceed benefit in a single-developer, sequential session | No | N/A — not an implementation item yet |
| G1–G8 (governance rules) | **High** (cost is near-zero, value is durable) | Very low — writing down existing practice, not inventing new practice | Indirect but real — reduces re-diagnosis time and onboarding cost for any future contributor or session | Very low | **No**, but recommend one short, standing "Engineering Standards" governance note (distinct from a full ADR) consolidating G1–G8, since G2 in particular changes a default every future guard-writer should follow | Yes — a single small documentation commit |

**Overall risk theme:** the highest risk across this entire set is **automation quietly
encoding a wrong judgment as if it were mechanical** — e.g., a `/freeze` command that
auto-writes narrative prose instead of just gathering evidence, or a frozen-path guard whose
structured list silently drifts from the authoritative prose `do_not` block. Every
recommendation above is scoped specifically to avoid this: automate evidence-gathering and
repetitive verification, never automate the judgment calls this project's governance process
exists to protect.

---

## 10. Suggested Implementation Order

1. **G1–G8** — write down existing practice as one short governance note. Zero code, zero
   risk, immediate value, and everything below benefits from having these named explicitly
   before being built on top of them.
2. **W3** (CI-status script) and **W4** (git-status-diff script) — smallest, most mechanical,
   most already-proven-in-practice (both are extractions of code already hand-written multiple
   times this session).
3. **H1** (pre-commit `tsc -b` sanity check) — very low effort, prevents the single most
   expensive defect class on record; no dependency on anything else.
4. **W1** (`/verify`) — depends on nothing new; wraps existing commands plus the G3 flake
   protocol.
5. **W2** (`/freeze`) — depends on W1 and W3.
6. **`/architecture-review` and H2** (frozen-path guard) together — build the structured
   frozen-path list once, use it for both the on-demand command and the pre-commit hook.
7. **`/test-review`** — depends on G3 being written down first.
8. **`/ci-review`** — depends on W3.
9. **H3** (before-migration checklist) and **H5** (legal-knowledge sanity check) — lower
   urgency, no dependencies on the above; can slot in whenever convenient.
10. **`/legal-review`, `/procurement-review`, `/kb-update`, and the Legal/Knowledge Reviewer
    roles** — deliberately last, and gated on resolving Pain Point 8
    (`skills/dau-thau-mua-sam.md` does not exist) first. Building any of these before that gap
    is closed would create tooling pointed at nothing.

Each numbered item above should be its own commit/approval step, matching this project's
existing discipline — none should be bundled together into one large implementation.

---

*End of design document. Per instruction, nothing was implemented: no source, test, CI,
workflow, plugin, hook, or agent was created or modified. Waiting for explicit approval before
building any item above.*
