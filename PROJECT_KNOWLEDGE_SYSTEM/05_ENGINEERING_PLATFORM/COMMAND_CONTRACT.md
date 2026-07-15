# Command Contract

Per `ENGINEERING_PLATFORM_PRODUCT_SPEC.md` §7 — unmodified by the Reduction Plan, which named no
trim against it.

**The one rule every command follows, without exception:** a command is a **thin adapter**. If a
reviewer can find logic inside a command file that isn't already in the rule's own script, that
is a defect, not a variant. The command exists to invoke and relay — never to duplicate.

```yaml
command_name: string
description: string          # one sentence, shown to whatever invokes it
argument_hint: string | null
invokes: rule_id | workflow_id
```

The example below is this repository's own real, shipped command — `.claude/commands/
ci-review.md` — reproduced here as the format's worked example rather than a fabricated
placeholder:

```yaml
command_name: ci-review
description: "Post-push verification -- HEAD/origin sync, clean working tree, and CI result
  with continue-on-error masking flagged (Governance Engine rule REVIEW-3)"
argument_hint: null          # no arguments
invokes: REVIEW-3
```

**Discovery convention:** one directory the host tooling scans (`.claude/commands/` in this
repository's own instance). The *concept* of a discoverable command directory is Core Platform;
the specific discovery mechanism is host-tool-specific (Product Spec §28).
