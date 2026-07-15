# Rule: REVIEW-3

**Category:** Review Rules (`GOVERNANCE_ENGINE_DESIGN.md` §7).

## Machine Context

```yaml
rule_id: REVIEW-3
category: review
title: "Post-push verification"
status: active
version: 1
current_manual_process: "Manually run `git rev-parse HEAD` and `git rev-parse origin/<branch>`,
  compare by eye; manually run `git status --porcelain` and eyeball for uncommitted tracked
  changes; manually poll the GitHub Actions API via a hand-written curl loop and manually
  cross-reference which CI steps carry `continue-on-error: true` to judge whether a reported
  'success' is genuine or masked."
desired_automated_verification: "A single script performing all three checks -- HEAD/origin
  sync, clean tracked working tree, CI result polled to completion -- reporting pass/fail per
  check and explicitly flagging any continue-on-error-masked step rather than treating it as a
  guaranteed pass."
execution_points: [command, dogfood]
script: app/scripts/verifyPushState.ts
command_adapter: .claude/commands/ci-review.md
inputs: ["git HEAD", "origin ref", "GitHub Actions API"]
outputs: ["pass/fail per check", "masked-step flags"]
failure_behavior: block
rollback_behavior: revert
dependencies: []
complexity: low
value: high
priority: highest
introduced: "Engineering Platform, slice 1, commit be88ecd"
deprecated: null
deprecated_reason: null
superseded_by: null
```

**Source documents:** `GOVERNANCE_ENGINE_DESIGN.md` (original rule design and ROI ranking),
`GOVERNANCE_ENGINE_RUNTIME.md` §1 (the schema this file follows), `GOVERNANCE_VERTICAL_SLICE_
TEMPLATE.md` (the implementation process that shipped this rule as commit `be88ecd`), `GOVERNANCE_
ARCHITECTURE_FREEZE.md` (v1.0, frozen 2026-07-14, the architecture this file implements against).
