/**
 * P6-10M: Tests for ConversationBuilder.
 *
 * Groups:
 *   CB1 — Basic building: system / history / user message assembly  (10)
 *   CB2 — Template rendering: system/user templates, error cases    (12)
 *   CB3 — Provider-specific formatting: openai / claude / gemini    (10)
 *   CB4 — Immutability / reset / never-throws / edge cases          (10)
 *
 * Total: 42 tests
 */

import { describe, it, expect } from 'vitest';
import { ConversationBuilder }      from '../providers/ConversationBuilder';
import { ConversationMemory }       from '../providers/ConversationMemory';
import { PromptTemplateManager }    from '../providers/PromptTemplateManager';
import type { MemoryMessage }       from '../providers/ConversationMemory';
import type { PromptTemplate }      from '../providers/PromptTemplateManager';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

function makeTmgr(): PromptTemplateManager {
  const m = new PromptTemplateManager();
  m.registerTemplate({
    id: 'sys-static', name: 'System Static',
    template: 'Bạn là trợ lý mua sắm công.',
    variables: [],
  });
  m.registerTemplate({
    id: 'sys-role', name: 'System With Role',
    template: 'Bạn là {{role}} chuyên về {{domain}}.',
    variables: [
      { name: 'role',   required: true },
      { name: 'domain', required: true },
    ],
  });
  m.registerTemplate({
    id: 'user-q', name: 'User Question',
    template: 'Phương thức LCNT nào phù hợp với gói thầu {{value}} VNĐ?',
    variables: [
      { name: 'value', required: true },
    ],
  });
  m.registerTemplate({
    id: 'user-greet', name: 'Greeting',
    template: 'Xin chào {{name}}!',
    variables: [
      { name: 'name', required: false, defaultValue: 'bạn' },
    ],
  });
  m.registerTemplate({
    id: 'sys-missing', name: 'Sys Missing',
    template: 'Vai trò {{role}} yêu cầu {{secret}}.',
    variables: [
      { name: 'role',   required: true },
      { name: 'secret', required: true },
    ],
  });
  return m;
}

function makeHistory(): MemoryMessage[] {
  return [
    { role: 'user',      content: 'Gói thầu A là bao nhiêu?' },
    { role: 'assistant', content: 'Gói thầu A là 200 triệu VNĐ.' },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// CB1: Basic building
// ─────────────────────────────────────────────────────────────────────────────

describe('CB1: Basic building', () => {
  it('CB1-01: setUserMessage + buildConversation returns ok:true', () => {
    const b = new ConversationBuilder();
    b.setUserMessage('Câu hỏi test');
    const r = b.buildConversation();
    expect(r.ok).toBe(true);
  });

  it('CB1-02: no user message returns ok:false with NO_USER_MESSAGE', () => {
    const r = new ConversationBuilder().buildConversation();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NO_USER_MESSAGE');
  });

  it('CB1-03: user message appears last in messages array', () => {
    const b = new ConversationBuilder();
    b.setUserMessage('Câu hỏi của tôi');
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    const msgs = r.conversation.messages;
    expect(msgs[msgs.length - 1]!.content).toBe('Câu hỏi của tôi');
    expect(msgs[msgs.length - 1]!.role).toBe('user');
  });

  it('CB1-04: setSystem sets the system prompt', () => {
    const b = new ConversationBuilder();
    b.setSystem('Bạn là chuyên gia đấu thầu.').setUserMessage('Hỏi');
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    expect(r.conversation.system).toBe('Bạn là chuyên gia đấu thầu.');
  });

  it('CB1-05: no setSystem → conversation.system is undefined', () => {
    const b = new ConversationBuilder();
    b.setUserMessage('Hỏi');
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    expect(r.conversation.system).toBeUndefined();
  });

  it('CB1-06: injectHistory from raw array prepends history before user message', () => {
    const b = new ConversationBuilder();
    b.injectHistory(makeHistory()).setUserMessage('Hỏi tiếp');
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    const msgs = r.conversation.messages;
    expect(msgs).toHaveLength(3);
    expect(msgs[0]!.role).toBe('user');
    expect(msgs[0]!.content).toBe('Gói thầu A là bao nhiêu?');
    expect(msgs[1]!.role).toBe('assistant');
    expect(msgs[2]!.content).toBe('Hỏi tiếp');
  });

  it('CB1-07: injectHistory from ConversationMemory', () => {
    const mem = new ConversationMemory();
    mem.addUser('Câu 1');
    mem.addAssistant('Trả lời 1');
    const b = new ConversationBuilder();
    b.injectHistory(mem).setUserMessage('Câu 2');
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    expect(r.conversation.messages).toHaveLength(3);
    expect(r.conversation.messages[0]!.content).toBe('Câu 1');
    expect(r.conversation.messages[1]!.content).toBe('Trả lời 1');
  });

  it('CB1-08: no history → messages contains only the user message', () => {
    const b = new ConversationBuilder();
    b.setUserMessage('Câu hỏi đơn');
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    expect(r.conversation.messages).toHaveLength(1);
  });

  it('CB1-09: setSystem called twice — last call wins', () => {
    const b = new ConversationBuilder();
    b.setSystem('Hệ thống A').setSystem('Hệ thống B').setUserMessage('X');
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    expect(r.conversation.system).toBe('Hệ thống B');
  });

  it('CB1-10: setUserMessage called twice — last call wins', () => {
    const b = new ConversationBuilder();
    b.setUserMessage('Câu 1').setUserMessage('Câu 2');
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    const msgs = r.conversation.messages;
    expect(msgs[msgs.length - 1]!.content).toBe('Câu 2');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CB2: Template rendering
// ─────────────────────────────────────────────────────────────────────────────

describe('CB2: Template rendering', () => {
  it('CB2-01: setSystemTemplate renders the system prompt on buildConversation()', () => {
    const b = new ConversationBuilder({ templateManager: makeTmgr() });
    b.setSystemTemplate('sys-static').setUserMessage('Hỏi');
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    expect(r.conversation.system).toBe('Bạn là trợ lý mua sắm công.');
  });

  it('CB2-02: setSystemTemplate with variables renders correctly', () => {
    const b = new ConversationBuilder({ templateManager: makeTmgr() });
    b.setSystemTemplate('sys-role', { role: 'chuyên gia', domain: 'đấu thầu' })
     .setUserMessage('Hỏi');
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    expect(r.conversation.system).toBe('Bạn là chuyên gia chuyên về đấu thầu.');
  });

  it('CB2-03: setUserTemplate renders the user message on buildConversation()', () => {
    const b = new ConversationBuilder({ templateManager: makeTmgr() });
    b.setUserTemplate('user-q', { value: '500.000.000' });
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    const msgs = r.conversation.messages;
    expect(msgs[msgs.length - 1]!.content).toContain('500.000.000');
  });

  it('CB2-04: setUserTemplate with default variable uses default', () => {
    const b = new ConversationBuilder({ templateManager: makeTmgr() });
    b.setUserTemplate('user-greet');   // name has defaultValue: 'bạn'
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    expect(r.conversation.messages[0]!.content).toBe('Xin chào bạn!');
  });

  it('CB2-05: missing template manager for system template → NO_TEMPLATE_MANAGER', () => {
    const b = new ConversationBuilder();   // no manager
    b.setSystemTemplate('sys-role').setUserMessage('Hỏi');
    const r = b.buildConversation();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NO_TEMPLATE_MANAGER');
  });

  it('CB2-06: missing template manager for user template → NO_TEMPLATE_MANAGER', () => {
    const b = new ConversationBuilder();   // no manager
    b.setUserTemplate('user-q');
    const r = b.buildConversation();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NO_TEMPLATE_MANAGER');
  });

  it('CB2-07: unknown system template id → SYSTEM_TEMPLATE_NOT_FOUND', () => {
    const b = new ConversationBuilder({ templateManager: makeTmgr() });
    b.setSystemTemplate('no-such-template').setUserMessage('Hỏi');
    const r = b.buildConversation();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('SYSTEM_TEMPLATE_NOT_FOUND');
  });

  it('CB2-08: unknown user template id → USER_TEMPLATE_NOT_FOUND', () => {
    const b = new ConversationBuilder({ templateManager: makeTmgr() });
    b.setUserTemplate('no-such-template');
    const r = b.buildConversation();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('USER_TEMPLATE_NOT_FOUND');
  });

  it('CB2-09: system template with missing required variables → SYSTEM_TEMPLATE_RENDER_FAILED', () => {
    const b = new ConversationBuilder({ templateManager: makeTmgr() });
    // sys-missing requires both 'role' and 'secret'; supply neither
    b.setSystemTemplate('sys-missing').setUserMessage('Hỏi');
    const r = b.buildConversation();
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('SYSTEM_TEMPLATE_RENDER_FAILED');
      expect(r.error.missingVariables).toContain('role');
      expect(r.error.missingVariables).toContain('secret');
    }
  });

  it('CB2-10: user template with missing required variables → USER_TEMPLATE_RENDER_FAILED', () => {
    const b = new ConversationBuilder({ templateManager: makeTmgr() });
    b.setUserTemplate('user-q');   // value is required but not provided
    const r = b.buildConversation();
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('USER_TEMPLATE_RENDER_FAILED');
      expect(r.error.missingVariables).toContain('value');
    }
  });

  it('CB2-11: setTemplateManager() enables template resolution after construction', () => {
    const b = new ConversationBuilder();  // no manager at construction
    b.setTemplateManager(makeTmgr())
     .setSystemTemplate('sys-static')
     .setUserMessage('Hỏi');
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    expect(r.conversation.system).toBe('Bạn là trợ lý mua sắm công.');
  });

  it('CB2-12: setSystemTemplate then setSystem overrides to static prompt', () => {
    const b = new ConversationBuilder({ templateManager: makeTmgr() });
    b.setSystemTemplate('sys-role', { role: 'AI', domain: 'test' })
     .setSystem('Static override')
     .setUserMessage('Hỏi');
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    // setSystem after setSystemTemplate should win
    expect(r.conversation.system).toBe('Static override');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CB3: Provider-specific formatting
// ─────────────────────────────────────────────────────────────────────────────

describe('CB3: Provider-specific formatting', () => {
  it('CB3-01: openai format — system becomes first role:system message', () => {
    const b = new ConversationBuilder();
    b.setSystem('Bạn là AI.').setUserMessage('Câu hỏi');
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    const { messages } = r.conversation.openai;
    expect(messages[0]!.role).toBe('system');
    expect(messages[0]!.content).toBe('Bạn là AI.');
  });

  it('CB3-02: openai format — user message follows system message', () => {
    const b = new ConversationBuilder();
    b.setSystem('S').setUserMessage('U');
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    const { messages } = r.conversation.openai;
    expect(messages).toHaveLength(2);
    expect(messages[1]!.role).toBe('user');
    expect(messages[1]!.content).toBe('U');
  });

  it('CB3-03: openai format — no system → no system message prepended', () => {
    const b = new ConversationBuilder();
    b.setUserMessage('U');
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    const { messages } = r.conversation.openai;
    expect(messages).toHaveLength(1);
    expect(messages[0]!.role).toBe('user');
  });

  it('CB3-04: openai format — history turns are included between system and current user', () => {
    const b = new ConversationBuilder();
    b.setSystem('S').injectHistory(makeHistory()).setUserMessage('Câu mới');
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    const { messages } = r.conversation.openai;
    // system + 2 history + 1 user = 4
    expect(messages).toHaveLength(4);
    expect(messages[0]!.role).toBe('system');
    expect(messages[messages.length - 1]!.content).toBe('Câu mới');
  });

  it('CB3-05: claude format — system is a top-level field, not in messages', () => {
    const b = new ConversationBuilder();
    b.setSystem('Bạn là AI.').setUserMessage('Câu hỏi');
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    const claude = r.conversation.claude;
    expect(claude.system).toBe('Bạn là AI.');
    expect(claude.messages.every(m => m.role !== ('system' as string))).toBe(true);
  });

  it('CB3-06: claude format — no system → system field is absent', () => {
    const b = new ConversationBuilder();
    b.setUserMessage('Câu hỏi');
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    expect(r.conversation.claude.system).toBeUndefined();
  });

  it('CB3-07: gemini format — system becomes systemInstruction field', () => {
    const b = new ConversationBuilder();
    b.setSystem('Hướng dẫn hệ thống.').setUserMessage('Câu hỏi');
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    const gemini = r.conversation.gemini;
    expect(gemini.systemInstruction).toBe('Hướng dẫn hệ thống.');
    expect(gemini.messages.every(m => !('systemInstruction' in m))).toBe(true);
  });

  it('CB3-08: gemini format — no system → systemInstruction is absent', () => {
    const b = new ConversationBuilder();
    b.setUserMessage('Câu hỏi');
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    expect(r.conversation.gemini.systemInstruction).toBeUndefined();
  });

  it('CB3-09: providerManagerRequest has system as top-level field', () => {
    const b = new ConversationBuilder();
    b.setSystem('PM system.').setUserMessage('U');
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    const req = r.conversation.providerManagerRequest;
    expect(req.system).toBe('PM system.');
    expect(req.messages).toHaveLength(1);
    expect(req.messages[0]!.role).toBe('user');
  });

  it('CB3-10: all four formats carry the same messages content', () => {
    const b = new ConversationBuilder();
    b.setSystem('S').injectHistory(makeHistory()).setUserMessage('U');
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    const { claude, gemini, providerManagerRequest, openai } = r.conversation;
    // non-openai formats should have 3 messages (2 history + 1 user)
    expect(claude.messages).toHaveLength(3);
    expect(gemini.messages).toHaveLength(3);
    expect(providerManagerRequest.messages).toHaveLength(3);
    // openai has one extra (system)
    expect(openai.messages).toHaveLength(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CB4: Immutability / reset / never-throws / edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('CB4: Immutability / reset / never-throws / edge cases', () => {
  it('CB4-01: mutating returned messages does not affect subsequent builds', () => {
    const b = new ConversationBuilder();
    b.setUserMessage('Original');
    const r1 = b.buildConversation();
    if (!r1.ok) throw new Error('Expected ok');
    r1.conversation.messages[0]!.content = 'MUTATED';
    // Build again — should still see 'Original'
    const r2 = b.buildConversation();
    if (!r2.ok) throw new Error('Expected ok');
    expect(r2.conversation.messages[0]!.content).toBe('Original');
  });

  it('CB4-02: mutating the injected history array does not affect the builder', () => {
    const history = makeHistory();
    const b = new ConversationBuilder();
    b.injectHistory(history).setUserMessage('U');
    history[0]!.content = 'MUTATED';
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    expect(r.conversation.messages[0]!.content).toBe('Gói thầu A là bao nhiêu?');
  });

  it('CB4-03: mutating ConversationMemory after injectHistory does not affect builder', () => {
    const mem = new ConversationMemory();
    mem.addUser('Turn 1');
    const b = new ConversationBuilder();
    b.injectHistory(mem).setUserMessage('U');
    mem.addUser('Turn 2');  // added after injection
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    // History snapshot was taken at injectHistory() time — only 1 message
    expect(r.conversation.messages).toHaveLength(2);  // 1 history + user
  });

  it('CB4-04: reset clears all state; buildConversation returns NO_USER_MESSAGE', () => {
    const b = new ConversationBuilder();
    b.setSystem('S').setUserMessage('U').injectHistory(makeHistory());
    b.reset();
    const r = b.buildConversation();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NO_USER_MESSAGE');
  });

  it('CB4-05: reset is chainable; builder can be reconfigured afterward', () => {
    const b = new ConversationBuilder();
    b.setSystem('Old').setUserMessage('Old user');
    b.reset().setUserMessage('New user');
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    expect(r.conversation.system).toBeUndefined();
    expect(r.conversation.messages[0]!.content).toBe('New user');
  });

  it('CB4-06: builder never throws for any combination of valid calls', () => {
    expect(() => {
      const b = new ConversationBuilder();
      b.buildConversation();
      b.setUserMessage('U');
      b.buildConversation();
      b.setSystem('S').injectHistory([]).setUserMessage('X').buildConversation();
      b.reset();
      b.buildConversation();
    }).not.toThrow();
  });

  it('CB4-07: builder never throws when template manager is absent and templates used', () => {
    expect(() => {
      const b = new ConversationBuilder();
      b.setSystemTemplate('any', { x: 'y' }).setUserTemplate('any').buildConversation();
    }).not.toThrow();
  });

  it('CB4-08: multiple buildConversation() calls on same builder produce independent objects', () => {
    const b = new ConversationBuilder();
    b.setUserMessage('U');
    const r1 = b.buildConversation();
    const r2 = b.buildConversation();
    if (!r1.ok || !r2.ok) throw new Error('Expected ok');
    expect(r1.conversation).not.toBe(r2.conversation);
    expect(r1.conversation.messages).not.toBe(r2.conversation.messages);
  });

  it('CB4-09: empty string as user message is valid (not an error)', () => {
    const b = new ConversationBuilder();
    b.setUserMessage('');
    const r = b.buildConversation();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.conversation.messages[0]!.content).toBe('');
  });

  it('CB4-10: openai messages contain independent copies (mutation does not leak)', () => {
    const b = new ConversationBuilder();
    b.setSystem('S').setUserMessage('U');
    const r = b.buildConversation();
    if (!r.ok) throw new Error('Expected ok');
    r.conversation.openai.messages[0]!.content = 'HACKED';
    const r2 = b.buildConversation();
    if (!r2.ok) throw new Error('Expected ok');
    expect(r2.conversation.openai.messages[0]!.content).toBe('S');
  });
});
