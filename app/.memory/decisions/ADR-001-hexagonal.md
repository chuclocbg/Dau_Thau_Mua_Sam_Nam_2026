# ADR-001: Hexagonal Architecture + Integration Bridge Pattern

**Status:** ACTIVE
**Date:** 2026-06-22
**Affects:** All modules

---

## Problem

As the platform grows from ~13 to ~22+ modules, cross-module imports become tangled.
A module built in Phase O that needs data from a Phase A module either:
a) Imports directly, coupling new code to frozen code in both directions
b) Has no clean way to grow the system without modifying frozen files

## Alternatives Considered

1. Monolithic service layer with direct imports — rejects because frozen module modification required
2. Event sourcing — rejected because adds complexity beyond what the domain needs
3. Integration Bridge pattern — accepted

## Decision

Adopt Hexagonal Architecture with Integration Bridges:
- All cross-module imports are mediated by `*Integration.ts` bridge files
- The bridge is owned and maintained by the consuming (newer) module
- Frozen modules never import from bridge files
- Service function signatures in frozen modules are permanently sealed

## Reason

Adding a new module never requires modifying a frozen module.
New capabilities are composed by creating a new bridge, not changing existing code.
This keeps the test suite of frozen modules permanently valid.

## Consequences

Positive:
- Frozen module test suites are permanently stable
- New modules can be developed independently
- Clear ownership: the consumer module owns the bridge

Negative:
- Every cross-module operation requires a bridge file (more files)
- Bridge files must be updated when frozen module APIs change (rare — frozen means frozen)

## Affected Modules

All. Every module has or will have an `*Integration.ts` file.
