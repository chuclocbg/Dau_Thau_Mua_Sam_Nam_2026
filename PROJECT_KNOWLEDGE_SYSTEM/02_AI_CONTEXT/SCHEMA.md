# AI Context Schema

**Purpose:** Define the shared vocabulary every file in `02_AI_CONTEXT/` must use, so the
folder can be parsed as one consistent structure rather than 14 independently-invented ones.

**Audience:** Anyone (or anything) writing or parsing a file in `02_AI_CONTEXT/`.

**Status:** Binding convention as of this wave. Retrofitted onto `SYSTEM_CONTEXT.md`,
`FREEZE_STATUS.md`, `REPOSITORY_CONTEXT.md`, `CURRENT_MILESTONE.md`.

---

## Structural convention

Every `02_AI_CONTEXT/` file (except this one and `README.md`) follows this shape:

```markdown
# <Title>

*Machine-readable. <one-line orientation>.*

## Machine Context

```yaml
... the actual payload ...
```

<optional short human-readable elaboration below the fence, kept minimal>
```

The `## Machine Context` heading is the fixed, greppable marker separating human framing from
the parseable payload — any tool extracting "just the data" can reliably find it by that
heading in every file.

## Shared key vocabulary

| Key | Meaning | Used by |
|---|---|---|
| `as_of` | ISO date this file's content was last true | every file |
| `status` | one of: `CURRENT`, `STALE`, `SUPERSEDED` | every file |
| `owner_file` | if this fact has one canonical source elsewhere, name it here instead of repeating the fact | any file referencing a cross-owned fact |
| `related` | list of other file paths, relative to `02_AI_CONTEXT/` or `../` | every file |

## Ownership map (which file owns which fact — do not repeat these elsewhere)

```yaml
owns:
  SYSTEM_CONTEXT.md:            [system_name, tech_stack, repository_layout, git_state]
  REPOSITORY_CONTEXT.md:        [naming_collisions, directory_layout, git_facts]
  FREEZE_STATUS.md:             [frozen_module_list, extension_mechanism_rules]
  CURRENT_MILESTONE.md:         [current_milestone_name, next_milestone_name, milestone_blockers]
  CURRENT_RELEASE.md:           [test_file_count, test_count, pass_rate, release_tag, tag_commit]
  ARCHITECTURE_CONSTRAINTS.md:  [load_bearing_architectural_rulings, constraint_ids_C01_C10]
  CODING_RULES.md:              [naming_conventions, test_location, known_eslint_gap]
  REPOSITORY_RULES.md:          [branching_model, commit_conventions, tagging_format]
  DEPENDENCY_RULES.md:          [layer_order, import_direction_rules]
  DDD_RULES.md:                 [bounded_contexts, aggregate_roots, value_objects]
  TECHNICAL_DEBT.md:            [open_debt_items_snapshot]     # historical narrative lives in
                                                                 # ../04_PROJECT_MEMORY/KNOWN_TECHNICAL_DEBT.md
  KNOWN_RISKS.md:                [current_risk_register]
  NEXT_APPROVED_PHASE.md:        [phase_x_status, approved_scope]
```

*(Completeness check: this map must list all 13 named files in this folder — verified 13/13
present as of this update. Previously incomplete (7/13); found and fixed during the
Documentation Completion Sprint following the Zero-Knowledge Validation audit.)*

Any file that needs one of these facts **links to the owner**, using `owner_file:` in its own
Machine Context block, rather than restating the value.
