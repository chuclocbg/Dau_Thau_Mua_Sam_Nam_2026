/**
 * P6-10V: MultiAgentCoordinator test suite
 *
 * 56 tests across 12 groups:
 *   MA1  (5) CRUD lifecycle
 *   MA2  (5) dependency graph validation
 *   MA3  (5) topological ordering
 *   MA4  (4) concurrent tasks
 *   MA5  (5) executeTask
 *   MA6  (5) executeTasks
 *   MA7  (4) handoff
 *   MA8  (5) runtime integration
 *   MA9  (4) memory integration
 *   MA10 (5) edge cases
 *   MA11 (4) immutability
 *   MA12 (5) never-throw
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MultiAgentCoordinator,
  type AgentDefinition,
  type AgentTask,
} from '../providers/MultiAgentCoordinator';
import type { AgentRuntime }      from '../providers/AgentRuntime';
import type { ConversationMemory } from '../providers/ConversationMemory';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeMockRuntime(content = 'agent response'): AgentRuntime {
  return {
    run: vi.fn().mockResolvedValue({ ok: true, content }),
  } as unknown as AgentRuntime;
}

function makeFailingRuntime(message = 'provider error'): AgentRuntime {
  return {
    run: vi.fn().mockResolvedValue({
      ok:    false,
      error: { code: 'PROVIDER_ERROR', message },
    }),
  } as unknown as AgentRuntime;
}

function makeAgent(
  id:       string,
  content?: string,
  runtime?: AgentRuntime,
): AgentDefinition {
  return {
    id,
    name:    `Agent-${id}`,
    runtime: runtime ?? makeMockRuntime(content ?? `response from ${id}`),
  };
}

function makeTask(
  id:         string,
  agentId:    string,
  dependsOn?: string[],
  prompt?:    string,
): AgentTask {
  const task: AgentTask = {
    id,
    agentId,
    prompt: prompt ?? `Prompt for ${id}`,
  };
  if (dependsOn) task.dependsOn = dependsOn;
  return task;
}

function makeMockMemory(): ConversationMemory {
  return {
    addUser:      vi.fn(),
    addAssistant: vi.fn(),
    getMessages:  vi.fn().mockReturnValue([]),
    clear:        vi.fn(),
  } as unknown as ConversationMemory;
}

// ─── MA1: CRUD lifecycle ──────────────────────────────────────────────────────

describe('MA1 · CRUD lifecycle', () => {
  let coord: MultiAgentCoordinator;
  beforeEach(() => { coord = new MultiAgentCoordinator(); });

  it('MA1-01: registerAgent returns ok:true with the agent id', () => {
    const def    = makeAgent('alpha');
    const result = coord.registerAgent(def);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('alpha');
  });

  it('MA1-02: getAgent returns the stored definition after registration', () => {
    const def = makeAgent('beta');
    coord.registerAgent(def);
    const result = coord.getAgent('beta');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('beta');
      expect(result.value.name).toBe('Agent-beta');
    }
  });

  it('MA1-03: removeAgent returns ok:true for a registered agent', () => {
    coord.registerAgent(makeAgent('gamma'));
    const result = coord.removeAgent('gamma');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(true);
  });

  it('MA1-04: listAgents includes all registered agents', () => {
    coord.registerAgent(makeAgent('x'));
    coord.registerAgent(makeAgent('y'));
    const list = coord.listAgents();
    expect(list.map(a => a.id)).toContain('x');
    expect(list.map(a => a.id)).toContain('y');
    expect(list).toHaveLength(2);
  });

  it('MA1-05: listAgents returns an empty array on a new coordinator', () => {
    expect(coord.listAgents()).toEqual([]);
  });
});

// ─── MA2: dependency graph validation ─────────────────────────────────────────

describe('MA2 · dependency graph validation', () => {
  let coord: MultiAgentCoordinator;
  beforeEach(() => {
    coord = new MultiAgentCoordinator();
    coord.registerAgent(makeAgent('a1'));
    coord.registerAgent(makeAgent('a2'));
  });

  it('MA2-01: duplicate task ids in the batch returns DUPLICATE_TASK', async () => {
    const tasks = [
      makeTask('t1', 'a1'),
      makeTask('t1', 'a2'),    // same id as above
    ];
    const result = await coord.executeTasks(tasks);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DUPLICATE_TASK');
  });

  it('MA2-02: task referencing unregistered agentId returns AGENT_NOT_FOUND', async () => {
    const result = await coord.executeTasks([makeTask('t1', 'ghost')]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('AGENT_NOT_FOUND');
  });

  it('MA2-03: dependsOn referencing a task absent from the batch returns TASK_NOT_FOUND', async () => {
    // t2 depends on "ghost" which is not in the batch
    const result = await coord.executeTasks([
      makeTask('t2', 'a1', ['ghost']),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TASK_NOT_FOUND');
  });

  it('MA2-04: A→B→A cycle returns CIRCULAR_DEPENDENCY', async () => {
    coord.registerAgent(makeAgent('a3'));
    const tasks = [
      makeTask('tA', 'a1', ['tB']),
      makeTask('tB', 'a2', ['tA']),
    ];
    const result = await coord.executeTasks(tasks);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CIRCULAR_DEPENDENCY');
  });

  it('MA2-05: valid dependency graph (B depends on A) returns ok:true', async () => {
    const tasks = [
      makeTask('tA', 'a1'),
      makeTask('tB', 'a2', ['tA']),
    ];
    const result = await coord.executeTasks(tasks);
    expect(result.ok).toBe(true);
  });
});

// ─── MA3: topological ordering ────────────────────────────────────────────────

describe('MA3 · topological ordering', () => {
  let coord: MultiAgentCoordinator;
  beforeEach(() => { coord = new MultiAgentCoordinator(); });

  it('MA3-01: B\'s runtime receives A\'s content injected into its prompt', async () => {
    const rtA = makeMockRuntime('result-of-A');
    const rtB = makeMockRuntime('result-of-B');
    coord.registerAgent({ id: 'agA', name: 'Agent A', runtime: rtA });
    coord.registerAgent({ id: 'agB', name: 'Agent B', runtime: rtB });

    await coord.executeTasks([
      makeTask('tA', 'agA'),
      makeTask('tB', 'agB', ['tA'], 'Do something'),
    ]);

    const callArg = (rtB.run as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(callArg).toContain("Result from 'tA'");
    expect(callArg).toContain('result-of-A');
  });

  it('MA3-02: three-step chain A→B→C all complete', async () => {
    ['ag1', 'ag2', 'ag3'].forEach(id => coord.registerAgent(makeAgent(id)));
    const result = await coord.executeTasks([
      makeTask('t1', 'ag1'),
      makeTask('t2', 'ag2', ['t1']),
      makeTask('t3', 'ag3', ['t2']),
    ]);
    expect(result.ok).toBe(true);
  });

  it('MA3-03: completedTasks contains all task ids after A→B→C', async () => {
    ['ag1', 'ag2', 'ag3'].forEach(id => coord.registerAgent(makeAgent(id)));
    const result = await coord.executeTasks([
      makeTask('t1', 'ag1'),
      makeTask('t2', 'ag2', ['t1']),
      makeTask('t3', 'ag3', ['t2']),
    ]);
    if (result.ok) {
      expect(result.value.completedTasks).toContain('t1');
      expect(result.value.completedTasks).toContain('t2');
      expect(result.value.completedTasks).toContain('t3');
      expect(result.value.completedTasks).toHaveLength(3);
    }
  });

  it('MA3-04: diamond dependency (A→B, A→C, B→D, C→D) all four complete', async () => {
    ['agA', 'agB', 'agC', 'agD'].forEach(id => coord.registerAgent(makeAgent(id)));
    const result = await coord.executeTasks([
      makeTask('tA', 'agA'),
      makeTask('tB', 'agB', ['tA']),
      makeTask('tC', 'agC', ['tA']),
      makeTask('tD', 'agD', ['tB', 'tC']),
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.completedTasks).toHaveLength(4);
    }
  });

  it('MA3-05: B\'s effective prompt includes the keyword "Task:" separator', async () => {
    const rtB = makeMockRuntime('ok');
    coord.registerAgent(makeAgent('agA', 'A-output'));
    coord.registerAgent({ id: 'agB', name: 'B', runtime: rtB });

    await coord.executeTasks([
      makeTask('tA', 'agA'),
      makeTask('tB', 'agB', ['tA'], 'original prompt'),
    ]);

    const callArg = (rtB.run as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(callArg).toContain('Task:');
    expect(callArg).toContain('original prompt');
  });
});

// ─── MA4: concurrent tasks ────────────────────────────────────────────────────

describe('MA4 · concurrent tasks', () => {
  let coord: MultiAgentCoordinator;
  beforeEach(() => { coord = new MultiAgentCoordinator(); });

  it('MA4-01: two independent tasks both produce ok:true execution', async () => {
    coord.registerAgent(makeAgent('ag1'));
    coord.registerAgent(makeAgent('ag2'));
    const result = await coord.executeTasks([
      makeTask('t1', 'ag1'),
      makeTask('t2', 'ag2'),
    ]);
    expect(result.ok).toBe(true);
  });

  it('MA4-02: both independent tasks appear in completedTasks', async () => {
    coord.registerAgent(makeAgent('ag1'));
    coord.registerAgent(makeAgent('ag2'));
    const result = await coord.executeTasks([
      makeTask('t1', 'ag1'),
      makeTask('t2', 'ag2'),
    ]);
    if (result.ok) {
      expect(result.value.completedTasks).toContain('t1');
      expect(result.value.completedTasks).toContain('t2');
    }
  });

  it('MA4-03: each independent task calls its agent runtime once', async () => {
    const rt1 = makeMockRuntime('resp-1');
    const rt2 = makeMockRuntime('resp-2');
    coord.registerAgent({ id: 'ag1', name: 'A1', runtime: rt1 });
    coord.registerAgent({ id: 'ag2', name: 'A2', runtime: rt2 });

    await coord.executeTasks([
      makeTask('t1', 'ag1'),
      makeTask('t2', 'ag2'),
    ]);

    expect((rt1.run as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    expect((rt2.run as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it('MA4-04: independent tasks\' prompts are not modified by handoff injection', async () => {
    const rt = makeMockRuntime('ok');
    coord.registerAgent({ id: 'ag', name: 'Ag', runtime: rt });

    await coord.executeTasks([
      makeTask('t1', 'ag', undefined, 'exact prompt'),
    ]);

    const callArg = (rt.run as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(callArg).toBe('exact prompt');
  });
});

// ─── MA5: executeTask ─────────────────────────────────────────────────────────

describe('MA5 · executeTask', () => {
  let coord: MultiAgentCoordinator;
  beforeEach(() => { coord = new MultiAgentCoordinator(); });

  it('MA5-01: returns ok:true with the agent\'s content', async () => {
    coord.registerAgent(makeAgent('ag', 'hello world'));
    const result = await coord.executeTask(makeTask('t', 'ag'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('hello world');
  });

  it('MA5-02: returns AGENT_NOT_FOUND when agentId is not registered', async () => {
    const result = await coord.executeTask(makeTask('t', 'ghost'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('AGENT_NOT_FOUND');
  });

  it('MA5-03: returns INVALID_INPUT for an empty prompt', async () => {
    coord.registerAgent(makeAgent('ag'));
    const result = await coord.executeTask(makeTask('t', 'ag', undefined, '   '));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_INPUT');
  });

  it('MA5-04: returns EXECUTION_FAILED when agent has no runtime', async () => {
    coord.registerAgent({ id: 'ag', name: 'Ag' });  // no runtime
    const result = await coord.executeTask(makeTask('t', 'ag'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('EXECUTION_FAILED');
  });

  it('MA5-05: returns EXECUTION_FAILED when runtime returns ok:false', async () => {
    coord.registerAgent(makeAgent('ag', undefined, makeFailingRuntime()));
    const result = await coord.executeTask(makeTask('t', 'ag'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('EXECUTION_FAILED');
  });
});

// ─── MA6: executeTasks ────────────────────────────────────────────────────────

describe('MA6 · executeTasks', () => {
  let coord: MultiAgentCoordinator;
  beforeEach(() => { coord = new MultiAgentCoordinator(); });

  it('MA6-01: returns ok:true with an AgentExecution object on success', async () => {
    coord.registerAgent(makeAgent('ag'));
    const result = await coord.executeTasks([makeTask('t1', 'ag')]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.value.executionId).toBe('string');
      expect(result.value.executionId.length).toBeGreaterThan(0);
    }
  });

  it('MA6-02: execution status is COMPLETED on success', async () => {
    coord.registerAgent(makeAgent('ag'));
    const result = await coord.executeTasks([makeTask('t1', 'ag')]);
    if (result.ok) expect(result.value.status).toBe('COMPLETED');
  });

  it('MA6-03: completedTasks includes all task ids', async () => {
    coord.registerAgent(makeAgent('ag'));
    const result = await coord.executeTasks([
      makeTask('t1', 'ag'),
      makeTask('t2', 'ag'),
    ]);
    if (result.ok) {
      expect(result.value.completedTasks).toContain('t1');
      expect(result.value.completedTasks).toContain('t2');
    }
  });

  it('MA6-04: startedAt is a positive Unix-ms timestamp', async () => {
    coord.registerAgent(makeAgent('ag'));
    const before = Date.now();
    const result = await coord.executeTasks([makeTask('t1', 'ag')]);
    if (result.ok) {
      expect(result.value.startedAt).toBeGreaterThanOrEqual(before);
      expect(result.value.startedAt).toBeLessThanOrEqual(Date.now());
    }
  });

  it('MA6-05: returns EXECUTION_FAILED when a task\'s runtime fails', async () => {
    coord.registerAgent(makeAgent('ok-agent'));
    coord.registerAgent(makeAgent('bad-agent', undefined, makeFailingRuntime()));
    const result = await coord.executeTasks([
      makeTask('t1', 'ok-agent'),
      makeTask('t2', 'bad-agent'),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('EXECUTION_FAILED');
  });
});

// ─── MA7: handoff ─────────────────────────────────────────────────────────────

describe('MA7 · handoff', () => {
  let coord: MultiAgentCoordinator;
  beforeEach(() => { coord = new MultiAgentCoordinator(); });

  it('MA7-01: returns a new AgentTask (not the same object reference)', () => {
    const original = makeTask('t1', 'ag', undefined, 'original prompt');
    const result   = coord.handoff('prior result', original);
    expect(result).not.toBe(original);
  });

  it('MA7-02: preserves the original task id', () => {
    const original = makeTask('task-xyz', 'ag');
    const result   = coord.handoff('some content', original);
    expect(result.id).toBe('task-xyz');
  });

  it('MA7-03: new prompt includes the fromContent', () => {
    const original = makeTask('t1', 'ag', undefined, 'my task');
    const result   = coord.handoff('the previous result', original);
    expect(result.prompt).toContain('the previous result');
  });

  it('MA7-04: original task prompt is not modified after handoff', () => {
    const original  = makeTask('t1', 'ag', undefined, 'immutable prompt');
    coord.handoff('anything', original);
    expect(original.prompt).toBe('immutable prompt');
  });
});

// ─── MA8: runtime integration ─────────────────────────────────────────────────

describe('MA8 · runtime integration', () => {
  let coord: MultiAgentCoordinator;
  beforeEach(() => { coord = new MultiAgentCoordinator(); });

  it('MA8-01: runtime.run() is called with the task prompt', async () => {
    const rt = makeMockRuntime('ok');
    coord.registerAgent({ id: 'ag', name: 'Ag', runtime: rt });

    await coord.executeTask(makeTask('t', 'ag', undefined, 'execute this'));

    const spy = rt.run as ReturnType<typeof vi.fn>;
    expect(spy).toHaveBeenCalledWith('execute this');
  });

  it('MA8-02: different agents use different runtime instances', async () => {
    const rt1 = makeMockRuntime('from-1');
    const rt2 = makeMockRuntime('from-2');
    coord.registerAgent({ id: 'ag1', name: 'A1', runtime: rt1 });
    coord.registerAgent({ id: 'ag2', name: 'A2', runtime: rt2 });

    await coord.executeTasks([
      makeTask('t1', 'ag1'),
      makeTask('t2', 'ag2'),
    ]);

    expect((rt1.run as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    expect((rt2.run as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it('MA8-03: runtime.run() call count matches number of tasks', async () => {
    const rt = makeMockRuntime('ok');
    coord.registerAgent({ id: 'ag', name: 'Ag', runtime: rt });

    await coord.executeTasks([
      makeTask('t1', 'ag'),
      makeTask('t2', 'ag'),
      makeTask('t3', 'ag'),
    ]);

    expect((rt.run as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(3);
  });

  it('MA8-04: executeTasks passes predecessor content to dependent task\'s runtime', async () => {
    const rtA = makeMockRuntime('content-from-A');
    const rtB = makeMockRuntime('content-from-B');
    coord.registerAgent({ id: 'agA', name: 'A', runtime: rtA });
    coord.registerAgent({ id: 'agB', name: 'B', runtime: rtB });

    await coord.executeTasks([
      makeTask('tA', 'agA'),
      makeTask('tB', 'agB', ['tA']),
    ]);

    const bCallArg = (rtB.run as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(bCallArg).toContain('content-from-A');
  });

  it('MA8-05: EXECUTION_FAILED error includes a cause when runtime errors', async () => {
    coord.registerAgent(makeAgent('ag', undefined, makeFailingRuntime('boom')));
    const result = await coord.executeTask(makeTask('t', 'ag'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('EXECUTION_FAILED');
      expect(result.error.cause).toBeDefined();
    }
  });
});

// ─── MA9: memory integration ──────────────────────────────────────────────────

describe('MA9 · memory integration', () => {
  let coord: MultiAgentCoordinator;
  beforeEach(() => { coord = new MultiAgentCoordinator(); });

  it('MA9-01: agent with a memory field executes successfully', async () => {
    const mem = makeMockMemory();
    const def: AgentDefinition = {
      id:      'ag',
      name:    'Ag',
      runtime: makeMockRuntime('ok'),
      memory:  mem,
    };
    coord.registerAgent(def);
    const result = await coord.executeTask(makeTask('t', 'ag'));
    expect(result.ok).toBe(true);
  });

  it('MA9-02: stored agent definition retains the memory reference', () => {
    const mem = makeMockMemory();
    const def: AgentDefinition = {
      id:      'ag',
      name:    'Ag',
      runtime: makeMockRuntime('ok'),
      memory:  mem,
    };
    coord.registerAgent(def);
    const retrieved = coord.getAgent('ag');
    if (retrieved.ok) {
      expect(retrieved.value.memory).toBe(mem);
    }
  });

  it('MA9-03: two agents can carry independent memory instances', () => {
    const mem1 = makeMockMemory();
    const mem2 = makeMockMemory();
    coord.registerAgent({ id: 'ag1', name: 'A1', runtime: makeMockRuntime(), memory: mem1 });
    coord.registerAgent({ id: 'ag2', name: 'A2', runtime: makeMockRuntime(), memory: mem2 });

    const r1 = coord.getAgent('ag1');
    const r2 = coord.getAgent('ag2');
    expect(r1.ok && r2.ok && r1.value.memory !== r2.value.memory).toBe(true);
  });

  it('MA9-04: execution completes without a memory field on the agent', async () => {
    coord.registerAgent({ id: 'ag', name: 'Ag', runtime: makeMockRuntime('ok') });
    const result = await coord.executeTasks([makeTask('t', 'ag')]);
    expect(result.ok).toBe(true);
  });
});

// ─── MA10: edge cases ─────────────────────────────────────────────────────────

describe('MA10 · edge cases', () => {
  let coord: MultiAgentCoordinator;
  beforeEach(() => { coord = new MultiAgentCoordinator(); });

  it('MA10-01: registering the same agent id twice returns DUPLICATE_AGENT', () => {
    coord.registerAgent(makeAgent('ag'));
    const result = coord.registerAgent(makeAgent('ag'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DUPLICATE_AGENT');
  });

  it('MA10-02: removeAgent on an unknown id returns AGENT_NOT_FOUND', () => {
    const result = coord.removeAgent('ghost');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('AGENT_NOT_FOUND');
  });

  it('MA10-03: empty task array returns a COMPLETED execution', async () => {
    const result = await coord.executeTasks([]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('COMPLETED');
      expect(result.value.completedTasks).toHaveLength(0);
    }
  });

  it('MA10-04: registerAgent with an empty id returns INVALID_INPUT', () => {
    const result = coord.registerAgent({ id: '', name: 'Ag' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_INPUT');
  });

  it('MA10-05: self-referential task (id depends on itself) returns CIRCULAR_DEPENDENCY', async () => {
    coord.registerAgent(makeAgent('ag'));
    const result = await coord.executeTasks([
      makeTask('self', 'ag', ['self']),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CIRCULAR_DEPENDENCY');
  });
});

// ─── MA11: immutability ───────────────────────────────────────────────────────

describe('MA11 · immutability', () => {
  let coord: MultiAgentCoordinator;
  beforeEach(() => { coord = new MultiAgentCoordinator(); });

  it('MA11-01: mutating the getAgent result does not affect the stored definition', () => {
    coord.registerAgent(makeAgent('ag'));
    const r = coord.getAgent('ag');
    if (r.ok) {
      (r.value as AgentDefinition).name = 'mutated name';
    }
    const r2 = coord.getAgent('ag');
    if (r2.ok) expect(r2.value.name).toBe('Agent-ag');
  });

  it('MA11-02: mutating the input definition after registerAgent does not corrupt stored', () => {
    const def = makeAgent('ag');
    coord.registerAgent(def);
    (def as AgentDefinition).name = 'mutated';
    const retrieved = coord.getAgent('ag');
    if (retrieved.ok) expect(retrieved.value.name).toBe('Agent-ag');
  });

  it('MA11-03: mutating the listAgents result does not affect the stored definitions', () => {
    coord.registerAgent(makeAgent('ag'));
    const list = coord.listAgents();
    list[0].name = 'tampered';
    const list2 = coord.listAgents();
    expect(list2[0].name).toBe('Agent-ag');
  });

  it('MA11-04: completedTasks in the returned AgentExecution is an independent copy', async () => {
    coord.registerAgent(makeAgent('ag'));
    const result = await coord.executeTasks([makeTask('t1', 'ag')]);
    if (result.ok) {
      result.value.completedTasks.push('injected');
      // Running again should still return only the real tasks
      const result2 = await coord.executeTasks([makeTask('t2', 'ag')]);
      if (result2.ok) {
        expect(result2.value.completedTasks).not.toContain('injected');
      }
    }
  });
});

// ─── MA12: never-throw ────────────────────────────────────────────────────────

describe('MA12 · never-throw', () => {
  let coord: MultiAgentCoordinator;
  beforeEach(() => { coord = new MultiAgentCoordinator(); });

  it('MA12-01: registerAgent(null) returns error instead of throwing', () => {
    let result: unknown;
    expect(() => { result = coord.registerAgent(null as any); }).not.toThrow();
    expect((result as any)?.ok).toBe(false);
  });

  it('MA12-02: executeTask(null) resolves with error instead of rejecting', async () => {
    let result: unknown;
    await expect(
      (async () => { result = await coord.executeTask(null as any); })()
    ).resolves.not.toThrow();
    expect((result as any)?.ok).toBe(false);
  });

  it('MA12-03: executeTasks(null) resolves with error instead of rejecting', async () => {
    let result: unknown;
    await expect(
      (async () => { result = await coord.executeTasks(null as any); })()
    ).resolves.not.toThrow();
    expect((result as any)?.ok).toBe(false);
  });

  it('MA12-04: CRUD operations with null/undefined id do not throw', () => {
    expect(() => coord.removeAgent(null as any)).not.toThrow();
    expect(() => coord.getAgent(undefined as any)).not.toThrow();
    expect(() => coord.listAgents()).not.toThrow();
  });

  it('MA12-05: handoff with unexpected inputs does not throw', () => {
    expect(() => coord.handoff('content', null as any)).not.toThrow();
    expect(() => coord.handoff(undefined as any, makeTask('t', 'ag'))).not.toThrow();
  });
});
