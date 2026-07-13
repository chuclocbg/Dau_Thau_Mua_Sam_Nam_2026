# Release Timeline

**Purpose:** Every past release, archived here **before** [`../02_AI_CONTEXT/CURRENT_RELEASE.md`](../02_AI_CONTEXT/CURRENT_RELEASE.md)
is overwritten for the next one. See that file's archival rule.

**Related:** [`../01_PROJECT_DOCS/RELEASE_HISTORY.md`](../01_PROJECT_DOCS/RELEASE_HISTORY.md) (catalog view) · [Milestone History](MILESTONE_HISTORY.md)

## Release Log (most recent first)

### x14-frozen — tagged 2026-07-13 (CURRENT — see `../02_AI_CONTEXT/CURRENT_RELEASE.md`)

Not yet archived — this is the live release. When superseded, its full summary (final test
counts, commit hash, what shipped, what was deliberately excluded) moves here, above this
note, before `CURRENT_RELEASE.md` is overwritten.

**Preview of what will be archived when this release is superseded:** commit `d1708ff`, 546
test files, 14,806 tests (14,803 passed, 3 skipped — `TEST_DATABASE_URL`-gated, Docker/Postgres
unavailable in this environment), 0 failures, Phases X.3 through X.14 frozen (Knowledge
Resolution through Authentication/Authorization/Identity Infrastructure), no formal Release
Candidate audit performed for this checkpoint (unlike v1.0's GO WITH NOTES audit below).

---

### v1.0-knowledge-platform — tagged 2026-07-05 (superseded by x14-frozen)

**Summary:** commit `dad6b3d`, 395 test files, 13,721 tests, 100% passing, Phases A-N frozen,
Release Candidate audit result GO WITH NOTES, 17-commit release preparation sequence, one
unplanned supplementary commit for two files missed in initial discovery, final release audit
passed 5 of 6 checks (one informational finding about the diff scope including 37 pre-existing
unrelated commits, not a defect).

---

*This is the first release this project itself tagged — no prior entries exist. The
repository does contain earlier tags (`v1.0.0`, `v1.1.0-phase1`, `v3.0`, etc.) but these
belong to the unrelated, pre-existing commit history — see
[`../04_PROJECT_MEMORY/ARCHITECTURE_EVOLUTION.md`](ARCHITECTURE_EVOLUTION.md) — and are not
this project's own release history.*
