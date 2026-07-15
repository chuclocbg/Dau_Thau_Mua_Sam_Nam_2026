# Rule Definition Format

Per `ENGINEERING_PLATFORM_PRODUCT_SPEC.md` §6, **with the three enum trims
`ENGINEERING_PLATFORM_REDUCTION_PLAN.md` Part C §6/§7 require applied**: `rollback_behavior` and
`failure_behavior` are each reduced from three values to two (`data-undo` and `flag` removed —
zero real usage evidence for either, across the one rule this platform has ever shipped);
`execution_points` excludes `scheduled` (no scheduler exists or is planned). Every trim is
reversible at a future MAJOR platform version if real need ever demonstrates otherwise — none
removes a capability this platform has actually used.

Every governance rule, in every category, is expressed in this schema. The example below is not
invented — it is this repository's own real, active rule (`governance-rules/REVIEW-3.md`),
reproduced here as the format's worked example rather than a fabricated placeholder.

```yaml
rule_id: REVIEW-3
category: review                       # repository | architecture | adr | budget |
                                        #   documentation | ci | review | release
title: "Post-push verification"
status: active                         # designed | implemented | active | deprecated
version: 1
current_manual_process: "Manually run git rev-parse HEAD and git rev-parse origin/<branch>,
  compare by eye; manually run git status --porcelain and eyeball for uncommitted tracked
  changes; manually poll the GitHub Actions API via a hand-written curl loop."
desired_automated_verification: "A single script performing all three checks -- HEAD/origin
  sync, clean tracked working tree, CI result polled to completion -- reporting pass/fail per
  check and explicitly flagging any continue-on-error-masked step."
execution_points: [command, dogfood]   # command | dogfood | ci | pre-commit | ai-review
                                        #   ("scheduled" removed, see note above)
script: app/scripts/verifyPushState.ts
command_adapter: .claude/commands/ci-review.md
inputs: ["git HEAD", "origin ref", "GitHub Actions API"]
outputs: ["pass/fail per check", "masked-step flags"]
failure_behavior: block                # block | warn ("flag" removed, see note above)
rollback_behavior: revert              # revert | override ("data-undo" removed, see note above)
dependencies: []
complexity: low
value: high
priority: highest
introduced: "Engineering Platform, slice 1, commit be88ecd"
deprecated: null
deprecated_reason: null
superseded_by: null
```

**Required fields:** `rule_id`, `category`, `title`, `status`, `version`,
`current_manual_process`, `desired_automated_verification`, `execution_points`,
`failure_behavior`, `rollback_behavior`, `dependencies`. **Optional fields:** `script`,
`command_adapter` (absent until `status: implemented`), `deprecated`, `deprecated_reason`,
`superseded_by` (required/optional split per `GOVERNANCE_OBJECT_MODEL.md`'s `RuleDefinition`
entry, not Product Spec §6 itself, which shows the schema without separately labeling each
field's requiredness). New optional fields may be added additively across platform versions; a
required field never disappears within a MAJOR version (Product Spec §25, §27).
