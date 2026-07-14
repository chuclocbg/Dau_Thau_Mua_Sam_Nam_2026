---
description: Post-push verification -- HEAD/origin sync, clean working tree, and CI result with continue-on-error masking flagged (Governance Engine rule REVIEW-3)
argument-hint: (no arguments)
---

Run the post-push verification script and report its result plainly. Do not re-implement any
of this check by hand (no manual `git rev-parse`/`curl` loops) -- the script exists specifically
to replace that.

```bash
npx tsx app/scripts/verifyPushState.ts
```

Relay the script's own output to the user. If it reports a masked `continue-on-error` success
(e.g. the Type-check or Lint step), state plainly that the step's "success" does not guarantee
the underlying command passed, and offer to reproduce it locally if the user needs certainty --
do not silently treat a masked success as equivalent to a genuine one.

If any check fails (HEAD out of sync, dirty tracked working tree, or a genuine CI failure), stop
and report the specific failure before proceeding with anything else in the current task -- this
command exists to catch exactly the class of "I assumed the push succeeded" mistake this
project's governance design (`GOVERNANCE_ENGINE_DESIGN.md`, rule REVIEW-3) was written to close.
