# Project Memory Runtime — Phase O

## Overview

`src/memory/` is the runtime engine that consumes `.memory/` data files and exposes structured
project knowledge to AI layers and developer tooling. It never parses source code directly.

```
.memory/   ← data only  (markdown, never touched by business modules)
src/memory/ ← runtime engine  (TypeScript, loads .memory/ and serves MemoryContext)
```

## Folder Tree

```
src/memory/
├── index.ts                    public API + recoverProject()
├── types/
│   └── memoryTypes.ts          all interfaces and types (read-only)
├── loader/
│   ├── memoryLoader.ts         MemoryLoader — parses .memory/ markdown files
│   └── nodeFileSystem.ts       NodeFileSystem (node:fs, never imported in tests)
├── indexer/
│   └── memoryIndexer.ts        MemoryIndexer — builds lookup maps from raw data
├── graph/
│   └── memoryGraph.ts          MemoryGraph — BFS, path-finding, edge queries
├── registry/
│   └── memoryRegistry.ts       MemoryRegistry — single entry point, wires subsystems
├── retriever/
│   └── memoryRetriever.ts      MemoryRetriever — relevance-scored natural language lookup
├── context/
│   └── memoryContextBuilder.ts MemoryContextBuilder — builds token-budgeted MemoryContext
├── snapshot/
│   └── memorySnapshot.ts       MemorySnapshotManager — take/diff/replay snapshots
├── search/
│   └── memorySearch.ts         MemorySearch — keyword search across all entity types
└── metrics/
    └── memoryMetrics.ts        MemoryMetrics — computes MemoryStatistics
```

## Core Classes

| Class | Responsibility |
|-------|---------------|
| `MemoryLoader` | Parse `.memory/` markdown files → `MemoryRawData` |
| `MemoryIndexer` | Build `MemoryIndex` (lookup Maps) from `MemoryRawData` |
| `MemoryGraph` | Graph traversal: getDependencies, findPath, getReachable |
| `MemoryRegistry` | Wire all subsystems; single `register()` call |
| `MemoryRetriever` | Natural language → ranked modules/decisions/bridges/legal |
| `MemoryContextBuilder` | Build `MemoryContext` within token budget |
| `MemorySnapshotManager` | Snapshot and diff `MemoryRawData` over time |
| `MemorySearch` | Keyword search returning `MemorySearchResult[]` |
| `MemoryMetrics` | Compute `MemoryStatistics` from `MemoryRawData` |

## Public API

```typescript
import { recoverProject, buildContext, searchMemory } from 'src/memory/index.ts'

// Full project recovery (< 5 seconds target)
const { registry, snapshot, stats, recoveryTimeMs } = await recoverProject(
  '/path/to/.memory',
  new NodeFileSystem(),        // or MockFileSystem in tests
)

// Build a MemoryContext for an AI consumer
const ctx = await buildContext('/path/to/.memory', fs, 'legal basis query', {
  maxTokens: 8000,
  maxModules: 10,
  includeDecisions: true,
})

// Search the memory
const results = await searchMemory('/path/to/.memory', fs, {
  text: 'payment module',
  types: ['MODULE', 'DECISION'],
  maxResults: 10,
})
```

## Recovery Pipeline

```
load()  → MemoryLoader parses all .memory/ index files in parallel
          (modules, decisions, bridges, legal, phases, sessions, graph, architecture)
register() → MemoryIndexer builds Maps
           → MemoryGraph builds adjacency lists
           → MemoryRetriever initialised with index
           → MemoryContextBuilder initialised with retriever
           → MemorySearch initialised
           → MemoryMetrics initialised
take()   → MemorySnapshotManager captures baseline
ready    → RecoveryResult returned
```

## Memory Graph

Nodes: MODULE, DECISION, LAW, PROVIDER, BRIDGE, PHASE, SPEC

Edges: DEPENDS_ON, BRIDGES_TO, CONSUMED_BY, IMPLEMENTS, ENFORCES, FROZEN_BEFORE, AFFECTS, SUPERSEDES, PART_OF, PLANNED_AFTER

```typescript
const { graph } = registry.get()

graph.getDependencies('planning')        // → ['legal', 'masterdata']
graph.getConsumers('legal')             // → ['planning'] (legal CONSUMED_BY planning)
graph.findPath('auth', 'legal')         // → ['auth', 'planning', 'legal'] or null
graph.getReachable('planning')          // → all transitively reachable node ids
graph.getFrozenModules(data)            // → MemoryModule[] with status FROZEN
```

## Context Builder

`MemoryContextBuilder.build(query, opts)` returns a `MemoryContext` — the ONLY object that
future AI layers (Phase X Advisory, Agent Router, Code Assistant) may consume. They MUST NOT
import `MemoryRawData`, markdown content, or source code directly.

Token budget compression trims sessions → phases → bridges in order when `tokenEstimate > maxTokens`.

## Search Architecture

`MemorySearch.search(query)` scores all entities against the query text with a simple
relevance function: exact match = 1.0, prefix = 0.9, substring = 0.7, word overlap = 0.5×.
Results sorted descending by score, capped at `maxResults` (default 20).

## Snapshot / Diff

```typescript
const mgr = new MemorySnapshotManager()
const snap1 = mgr.take(data1)
const snap2 = mgr.take(data2)
const diff = mgr.diff(snap1.snapshotId, snap2.snapshotId)
// diff.addedModules, removedModules, changedModuleStatuses, addedDecisions, testDelta
```

## DI for Testing

`IMemoryFileSystem` allows test code to inject a `MockFileSystem` with fixture markdown,
preventing `node:fs/promises` from being imported in the jsdom test environment.

```typescript
// Production
import { NodeFileSystem } from 'src/memory/loader/nodeFileSystem.ts'
const result = await recoverProject('.memory', new NodeFileSystem())

// Tests — inline mock
const fs: IMemoryFileSystem = {
  readFile: async () => '| Module | Status |\n|--------|--------|\n| legal | FROZEN |',
  listFiles: async () => [],
  exists: async () => true,
}
```

## Future AI Integration

Any AI component that needs project context MUST implement `IMemoryContextConsumer`:

```typescript
interface IMemoryContextConsumer {
  readonly consumerId: string
  consumeContext(ctx: MemoryContext): Promise<void>
}
```

It receives a `MemoryContext` and may NOT access `MemoryRawData`, the registry, the graph,
or any `.memory/` files directly. This boundary is enforced by architecture (ADR-009).

## Performance Expectations

| Operation | Target | Typical |
|-----------|--------|---------|
| recoverProject() | < 5000 ms | < 100 ms (mock FS) |
| build MemoryIndex | < 10 ms | < 1 ms |
| MemorySearch.search() | < 5 ms | < 1 ms |
| MemoryContextBuilder.build() | < 5 ms | < 1 ms |
| MemoryGraph.findPath() | < 50 ms | < 1 ms |

## Tests

297 tests across 11 files in `src/__tests__/memory-*.test.ts`. All use `MockFileSystem`
(no filesystem I/O, no node:fs). Tests cover unit, integration, and public API export paths.
