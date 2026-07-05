# Repository Rules

**Purpose:** Git and commit conventions actually practiced in this repository — not aspirational,
derived directly from the `v1.0-knowledge-platform` release preparation.

## Machine Context

```yaml
as_of: 2026-07-05
status: CURRENT
related: [../04_PROJECT_MEMORY/RELEASE_TIMELINE.md, CURRENT_RELEASE.md]

branching:
  default_branch: develop
  main_branch_for_prs: master
  observed_release_branches: ["release/v3", "release/v3.1"]  # pre-existing, unrelated to this project's work

commit_conventions:
  style: "conventional-commit-like: feat(<module>): <summary>, docs: <summary>"
  granularity: "one logical module/phase per commit — e.g. 'feat(payment): add payment module'
                covers an entire frozen module's source + tests as one atomic commit"
  message_body: "explains WHY, not a file listing — the diff already shows what changed"
  co_author_trailer: "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com> when AI-assisted"

tagging:
  format: "vMAJOR.MINOR-<milestone-name>, e.g. v1.0-knowledge-platform"
  type: "always annotated (git tag -a), never lightweight, for real releases"
  message: "full narrative: what's frozen, test counts, outstanding notes, current/next milestone"

safety_rules_observed:
  - "Never amend a commit — always a new commit, even to fix a mistake made moments earlier"
  - "Never force-push"
  - "Never rebase to rewrite already-tagged commit hashes"
  - "Verify git status clean and unexpected-file-free after every commit in a release sequence"
  - "Run git fsck before any push to confirm no corruption"

known_repository_quirk:
  description: "37 pre-existing, unrelated commits (an earlier 'Phase 8-21' numbered track —
                agent pipeline, governance workspace, capability framework) sit between
                origin/develop and this project's first commit. They do not conflict at the
                file level with Phases A-N (verified) but they DO mean 'git diff origin/develop'
                is never scoped to only this project's own work."
  full_detail: ../04_PROJECT_MEMORY/ARCHITECTURE_EVOLUTION.md
```
