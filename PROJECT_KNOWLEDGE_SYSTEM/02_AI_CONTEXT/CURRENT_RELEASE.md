# Current Release

**Purpose:** The **sole owner** of the project's numeric release snapshot (test counts, tag,
commit, pass rate). Every other document in this system links here instead of restating these
numbers — see [`SCHEMA.md`](SCHEMA.md)'s ownership map.

**Audience:** Anyone who needs the exact current numbers.

**Status:** Update this file, and only this file, whenever the test suite or release tag
changes. Before overwriting for a new release, append the outgoing release's summary to
[`../04_PROJECT_MEMORY/RELEASE_TIMELINE.md`](../04_PROJECT_MEMORY/RELEASE_TIMELINE.md) first —
same archival discipline as `CURRENT_MILESTONE.md`.

## Machine Context

```yaml
as_of: 2026-07-13
status: CURRENT
owner_file: null   # owns: test_file_count, test_count, pass_rate, release_tag, tag_commit, branch

release:
  tag: x14-frozen
  tag_type: annotated
  tag_commit: d1708ff
  tag_commit_full: d1708ff8b9784e8b4fc649f99943920304242fdd
  branch: develop
  pushed_to_origin: true

test_suite:
  test_files: 546
  tests: 14806
  tests_passed: 14803
  tests_skipped: 3
  tests_failed: 0
  pass_rate_percent: "N/A (3 skipped tests)"
  regressions: 0
  test_runner: "vitest run --pool=forks --reporter=dot"
  known_issue: "jsdom crashes with 4+ parallel test files without --pool=forks"

frozen_scope:
  business_modules: 13
  infrastructure_modules: 3
  knowledge_platform_providers: "16 of 16"
  phases: "A through N"
  phase_x_track: "X.3 through X.14 (Knowledge Resolution through Authentication/Authorization/Identity Infrastructure) — see ../01_PROJECT_DOCS/RELEASE_NOTES_X14.md for the full milestone list"

not_yet_verified:
  - "Phase M1 (Prisma): implemented, never run against a live PostgreSQL instance"
  - "Docker (M0): docker-compose.yml designed and YAML-valid, never started in this environment"

release_candidate_audit_result: "N/A (no formal release audit performed for X.14)"
release_readiness_score: "N/A (no formal release audit performed for X.14)"
```

## Related

[`SCHEMA.md`](SCHEMA.md) · [`CURRENT_MILESTONE.md`](CURRENT_MILESTONE.md) ·
[`../04_PROJECT_MEMORY/RELEASE_TIMELINE.md`](../04_PROJECT_MEMORY/RELEASE_TIMELINE.md)
