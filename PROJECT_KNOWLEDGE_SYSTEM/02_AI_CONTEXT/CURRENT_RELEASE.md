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
as_of: 2026-07-05
status: CURRENT
owner_file: null   # owns: test_file_count, test_count, pass_rate, release_tag, tag_commit, branch

release:
  tag: v1.0-knowledge-platform
  tag_type: annotated
  tag_commit: dad6b3d
  tag_commit_full: dad6b3de11930f71eb3f2a3e8b42cfdbeae4b2df
  branch: develop
  pushed_to_origin: true

test_suite:
  test_files: 395
  tests: 13721
  pass_rate_percent: 100
  regressions: 0
  test_runner: "vitest run --pool=forks --reporter=dot"
  known_issue: "jsdom crashes with 4+ parallel test files without --pool=forks"

frozen_scope:
  business_modules: 13
  infrastructure_modules: 3
  knowledge_platform_providers: "16 of 16"
  phases: "A through N"

not_yet_verified:
  - "Phase M1 (Prisma): implemented, never run against a live PostgreSQL instance"
  - "Docker (M0): docker-compose.yml designed and YAML-valid, never started in this environment"

release_candidate_audit_result: "GO WITH NOTES"
release_readiness_score: "6.2/10"
```

## Related

[`SCHEMA.md`](SCHEMA.md) · [`CURRENT_MILESTONE.md`](CURRENT_MILESTONE.md) ·
[`../04_PROJECT_MEMORY/RELEASE_TIMELINE.md`](../04_PROJECT_MEMORY/RELEASE_TIMELINE.md)
