import { describe, it, expect } from 'vitest'
import type {
  MemoryModule,
  MemoryDecision,
  MemoryBridge,
  MemoryLegalInstrument,
  MemoryPhase,
  MemorySession,
  MemoryArchitecture,
  MemoryRawData,
  MemorySearchQuery,
  MemorySearchResult,
  MemoryContext,
  MemoryContextOptions,
  MemoryDiff,
  MemoryStatistics,
  MemoryGraphNode,
  MemoryGraphEdge,
  IMemoryFileSystem,
  IMemoryContextConsumer,
  MarkdownRow,
  ModuleStatus,
  DecisionStatus,
  NodeType,
  EdgeType,
  SearchResultType,
} from '../memory/types/memoryTypes.ts'

const makeModule = (overrides: Partial<MemoryModule> = {}): MemoryModule => ({
  name: 'legal',
  directory: 'src/legal',
  status: 'FROZEN',
  tests: 312,
  ...overrides,
})

const makeDecision = (overrides: Partial<MemoryDecision> = {}): MemoryDecision => ({
  id: 'ADR-001',
  title: 'Hexagonal Architecture',
  status: 'ACTIVE',
  date: '2026-07-01',
  file: '.memory/decisions/ADR-001.md',
  affectedModules: [],
  ...overrides,
})

describe('ModuleStatus type', () => {
  it('accepts FROZEN', () => {
    const s: ModuleStatus = 'FROZEN'
    expect(s).toBe('FROZEN')
  })
  it('accepts PLANNED', () => {
    const s: ModuleStatus = 'PLANNED'
    expect(s).toBe('PLANNED')
  })
  it('accepts IN_PROGRESS', () => {
    const s: ModuleStatus = 'IN_PROGRESS'
    expect(s).toBe('IN_PROGRESS')
  })
  it('accepts ACTIVE', () => {
    const s: ModuleStatus = 'ACTIVE'
    expect(s).toBe('ACTIVE')
  })
})

describe('DecisionStatus type', () => {
  it('accepts ACTIVE', () => {
    const s: DecisionStatus = 'ACTIVE'
    expect(s).toBe('ACTIVE')
  })
  it('accepts SUPERSEDED', () => {
    const s: DecisionStatus = 'SUPERSEDED'
    expect(s).toBe('SUPERSEDED')
  })
  it('accepts DEPRECATED', () => {
    const s: DecisionStatus = 'DEPRECATED'
    expect(s).toBe('DEPRECATED')
  })
})

describe('NodeType', () => {
  const types: NodeType[] = ['MODULE', 'DECISION', 'LAW', 'PROVIDER', 'BRIDGE', 'PHASE', 'SPEC']
  it.each(types)('accepts %s', t => {
    const v: NodeType = t
    expect(v).toBe(t)
  })
})

describe('EdgeType', () => {
  const types: EdgeType[] = [
    'DEPENDS_ON', 'BRIDGES_TO', 'CONSUMED_BY', 'IMPLEMENTS',
    'ENFORCES', 'FROZEN_BEFORE', 'AFFECTS', 'SUPERSEDES', 'PART_OF', 'PLANNED_AFTER',
  ]
  it.each(types)('accepts %s', t => {
    const v: EdgeType = t
    expect(v).toBe(t)
  })
})

describe('SearchResultType', () => {
  const types: SearchResultType[] = ['MODULE', 'DECISION', 'BRIDGE', 'LAW', 'SESSION', 'ROADMAP', 'ARCHITECTURE']
  it.each(types)('accepts %s', t => {
    const v: SearchResultType = t
    expect(v).toBe(t)
  })
})

describe('MemoryModule', () => {
  it('builds with required fields', () => {
    const m = makeModule()
    expect(m.name).toBe('legal')
    expect(m.directory).toBe('src/legal')
    expect(m.status).toBe('FROZEN')
    expect(m.tests).toBe(312)
  })
  it('accepts optional frozenAt', () => {
    const m = makeModule({ frozenAt: '2026-07-02' })
    expect(m.frozenAt).toBe('2026-07-02')
  })
  it('accepts optional version', () => {
    const m = makeModule({ version: '1.0' })
    expect(m.version).toBe('1.0')
  })
  it('allows zero tests', () => {
    const m = makeModule({ tests: 0 })
    expect(m.tests).toBe(0)
  })
})

describe('MemoryDecision', () => {
  it('builds correctly', () => {
    const d = makeDecision()
    expect(d.id).toBe('ADR-001')
    expect(d.status).toBe('ACTIVE')
    expect(d.affectedModules).toEqual([])
  })
  it('accepts affected modules list', () => {
    const d = makeDecision({ affectedModules: ['legal', 'payment'] })
    expect(d.affectedModules).toHaveLength(2)
  })
})

describe('MemoryBridge', () => {
  it('builds correctly', () => {
    const b: MemoryBridge = {
      file: 'src/planning/bridges/legalBridge.ts',
      ownedBy: 'planning',
      importsFrom: ['legal'],
      direction: 'one-way →',
    }
    expect(b.file).toContain('bridge')
    expect(b.importsFrom).toHaveLength(1)
  })
})

describe('MemoryLegalInstrument', () => {
  it('builds correctly', () => {
    const l: MemoryLegalInstrument = {
      symbol: '22/2023/QH15',
      name: 'Luật Đấu thầu',
      type: 'Law',
      effectiveFrom: '2024-01-01',
      appliesTo: 'All procurement',
    }
    expect(l.symbol).toBe('22/2023/QH15')
    expect(l.effectiveFrom).toBe('2024-01-01')
  })
})

describe('MemoryPhase', () => {
  it('builds correctly', () => {
    const p: MemoryPhase = {
      id: 'J',
      name: 'Authentication',
      status: 'PLANNED',
      sourceFiles: 10,
      tests: 390,
      complexity: 'HIGH',
      dependsOn: [],
    }
    expect(p.id).toBe('J')
    expect(p.status).toBe('PLANNED')
  })
  it('accepts COMPLETED status', () => {
    const p: MemoryPhase = { id: 'A', name: 'Legal', status: 'COMPLETED', sourceFiles: 6, tests: 117, complexity: 'LOW', dependsOn: [] }
    expect(p.status).toBe('COMPLETED')
  })
  it('accepts NEXT status', () => {
    const p: MemoryPhase = { id: 'J', name: 'Auth', status: 'NEXT', sourceFiles: 10, tests: 390, complexity: 'HIGH', dependsOn: [] }
    expect(p.status).toBe('NEXT')
  })
})

describe('MemorySession', () => {
  it('builds correctly', () => {
    const s: MemorySession = {
      date: '2026-07-03',
      name: 'Phase N2 Reasoning',
      testDelta: 78,
      cumulativeTests: 12254,
      file: '.memory/sessions/2026-07-03.md',
    }
    expect(s.testDelta).toBe(78)
    expect(s.cumulativeTests).toBe(12254)
  })
})

describe('MemoryArchitecture', () => {
  it('builds correctly', () => {
    const a: MemoryArchitecture = {
      version: '1.1',
      lastUpdated: '2026-07-03',
      frozenModuleCount: 13,
      architectureScore: 9,
      productionReadiness: 55,
    }
    expect(a.frozenModuleCount).toBe(13)
    expect(a.version).toBe('1.1')
  })
})

describe('MemoryGraphNode', () => {
  it('builds correctly', () => {
    const n: MemoryGraphNode = {
      id: 'legal',
      type: 'MODULE',
      label: 'Legal Module',
      status: 'FROZEN',
      location: 'src/legal',
    }
    expect(n.type).toBe('MODULE')
    expect(n.location).toBe('src/legal')
  })
  it('location is optional', () => {
    const n: MemoryGraphNode = { id: 'adr001', type: 'DECISION', label: 'ADR-001', status: 'ACTIVE' }
    expect(n.location).toBeUndefined()
  })
})

describe('MemoryGraphEdge', () => {
  it('builds correctly', () => {
    const e: MemoryGraphEdge = {
      fromId: 'planning',
      edgeType: 'DEPENDS_ON',
      toId: 'legal',
      notes: 'inherits LegalBasis',
    }
    expect(e.edgeType).toBe('DEPENDS_ON')
    expect(e.notes).toBe('inherits LegalBasis')
  })
  it('notes is optional', () => {
    const e: MemoryGraphEdge = { fromId: 'a', edgeType: 'DEPENDS_ON', toId: 'b' }
    expect(e.notes).toBeUndefined()
  })
})

describe('MemoryRawData', () => {
  it('has all required collections', () => {
    const d: MemoryRawData = {
      modules: [],
      decisions: [],
      bridges: [],
      legalInstruments: [],
      phases: [],
      sessions: [],
      graphNodes: [],
      graphEdges: [],
      architecture: {
        version: '1.0', lastUpdated: '', frozenModuleCount: 0,
        architectureScore: 0, productionReadiness: 0,
      },
      loadedAt: new Date().toISOString(),
    }
    expect(d.modules).toEqual([])
    expect(d.loadedAt).toBeTruthy()
  })
})

describe('MemorySearchQuery', () => {
  it('requires text field', () => {
    const q: MemorySearchQuery = { text: 'legal' }
    expect(q.text).toBe('legal')
    expect(q.types).toBeUndefined()
  })
  it('accepts optional types and maxResults', () => {
    const q: MemorySearchQuery = { text: 'approval', types: ['MODULE'], maxResults: 5 }
    expect(q.maxResults).toBe(5)
  })
})

describe('MemorySearchResult', () => {
  it('has all required fields', () => {
    const r: MemorySearchResult = {
      type: 'MODULE',
      id: 'legal',
      title: 'Legal Module',
      relevanceScore: 0.9,
      excerpt: 'FROZEN | src/legal | 312 tests',
      source: 'src/legal',
    }
    expect(r.relevanceScore).toBe(0.9)
    expect(r.type).toBe('MODULE')
  })
})

describe('MemoryContextOptions', () => {
  it('all fields optional', () => {
    const o: MemoryContextOptions = {}
    expect(o.maxTokens).toBeUndefined()
    expect(o.includeModules).toBeUndefined()
  })
  it('accepts all fields', () => {
    const o: MemoryContextOptions = {
      maxTokens: 8000,
      maxModules: 10,
      maxDecisions: 8,
      maxSessions: 5,
      includeModules: true,
      includeDecisions: true,
      includeBridges: false,
      includeLegal: true,
      includeSessions: true,
      includePhases: false,
    }
    expect(o.maxTokens).toBe(8000)
    expect(o.includeBridges).toBe(false)
  })
})

describe('MemoryContext', () => {
  it('has all required fields', () => {
    const ctx: MemoryContext = {
      query: 'legal basis',
      modules: [],
      decisions: [],
      bridges: [],
      legalInstruments: [],
      sessions: [],
      phases: [],
      tokenEstimate: 100,
      compressionApplied: false,
      builtAt: new Date().toISOString(),
    }
    expect(ctx.query).toBe('legal basis')
    expect(ctx.compressionApplied).toBe(false)
  })
})

describe('MemoryStatistics', () => {
  it('has all required numeric fields', () => {
    const s: MemoryStatistics = {
      totalModules: 13,
      frozenModules: 13,
      plannedModules: 5,
      totalDecisions: 15,
      activeDecisions: 15,
      totalBridges: 8,
      totalLaws: 5,
      totalSessions: 10,
      totalTests: 12254,
      avgDependencyDepth: 2.3,
      architectureScore: 9,
      productionReadiness: 55,
      recoveryTimeMs: 420,
      lastIndexedAt: '2026-07-04T00:00:00.000Z',
    }
    expect(s.totalTests).toBe(12254)
    expect(s.avgDependencyDepth).toBe(2.3)
  })
})

describe('MemoryDiff', () => {
  it('has required fields', () => {
    const diff: MemoryDiff = {
      fromSnapshotId: 'snap-1',
      toSnapshotId: 'snap-2',
      addedModules: [],
      removedModules: [],
      changedModuleStatuses: [],
      addedDecisions: [],
      testDelta: 78,
    }
    expect(diff.testDelta).toBe(78)
  })
})

describe('IMemoryFileSystem', () => {
  it('can be implemented inline', async () => {
    const fs: IMemoryFileSystem = {
      readFile: async () => 'content',
      listFiles: async () => ['file.md'],
      exists: async () => true,
    }
    expect(await fs.readFile('any')).toBe('content')
    expect(await fs.exists('any')).toBe(true)
  })
})

describe('IMemoryContextConsumer', () => {
  it('can be implemented inline', async () => {
    let received: MemoryContext | null = null
    const consumer: IMemoryContextConsumer = {
      consumerId: 'test-consumer',
      consumeContext: async (ctx) => { received = ctx },
    }
    const ctx: MemoryContext = {
      query: 'q', modules: [], decisions: [], bridges: [],
      legalInstruments: [], sessions: [], phases: [],
      tokenEstimate: 0, compressionApplied: false, builtAt: '',
    }
    await consumer.consumeContext(ctx)
    expect(received).toBe(ctx)
  })
})

describe('MarkdownRow', () => {
  it('is a Record<string, string>', () => {
    const row: MarkdownRow = { Module: 'legal', Status: 'FROZEN', Tests: '312' }
    expect(row['Module']).toBe('legal')
    expect(row['Status']).toBe('FROZEN')
  })
})
