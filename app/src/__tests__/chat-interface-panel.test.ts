/**
 * P7-03: ChatInterfacePanel + AgentSystemBundle.chat — 56 tests
 *
 * Groups:
 *   CI-01  (4)  never-throw — edge inputs that must not throw
 *   CI-02  (5)  structure — required data attributes always present
 *   CI-03  (5)  loading state — initialLoading=true
 *   CI-04  (5)  error state — initialError set
 *   CI-05  (4)  empty state — no messages, no loading, no error
 *   CI-06  (5)  ready state — initialMessages provided
 *   CI-07  (4)  input field — value and disabled
 *   CI-08  (4)  send button — disabled logic and label
 *   CI-09  (5)  message attributes — data-message-id, data-role, data-confidence
 *   CI-10  (4)  message content — rendered fields
 *   CI-11  (5)  data attribute consistency across states
 *   CI-12  (6)  createAgentSystem bundle — chat agent shape
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

import ChatInterfacePanel from '../components/ChatInterfacePanel';
import { createAgentSystem } from '../components/AgentProviderPanel';
import { AgentRegistry, ChatAgent } from '../agents';
import type { ChatMessage as ChatMessageRecord } from '../agents/ChatAgent';
import type { ProcurementPackage } from '../demoData';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeAgent(): ChatAgent {
  return new ChatAgent(new AgentRegistry());
}

function makeMsg(overrides?: Partial<ChatMessageRecord>): ChatMessageRecord {
  return {
    id:         'msg-1',
    role:       'user',
    content:    'Câu hỏi mua sắm mẫu',
    sources:    [],
    confidence: 'high',
    timestamp:  1_000_000_000,
    ...overrides,
  };
}

const USER_MSG  = makeMsg({ id: 'u1', role: 'user',  content: 'Hỏi về thủ tục' });
const AGENT_MSG = makeMsg({ id: 'a1', role: 'agent', content: 'Trả lời từ agent', sources: ['Luật 22/2023/QH15'], confidence: 'medium' });

function render(
  props: Omit<React.ComponentProps<typeof ChatInterfacePanel>, 'agent'> & { agent?: ChatAgent },
): string {
  const agent = props.agent ?? makeAgent();
  return renderToString(React.createElement(ChatInterfacePanel, { ...props, agent }));
}

// ─── CI-01 · never-throw ─────────────────────────────────────────────────────

describe('CI-01 · never-throw — edge inputs', () => {
  it('CI-01-01: renders without throwing with minimal props (agent only)', () => {
    expect(() => render({})).not.toThrow();
  });

  it('CI-01-02: renders without throwing when initialMessages=[]', () => {
    expect(() => render({ initialMessages: [] })).not.toThrow();
  });

  it('CI-01-03: renders without throwing when initialMessages has 1 user msg', () => {
    expect(() => render({ initialMessages: [USER_MSG] })).not.toThrow();
  });

  it('CI-01-04: renders without throwing when initialError set and loading=false', () => {
    expect(() => render({ initialError: 'Lỗi thử nghiệm', initialLoading: false })).not.toThrow();
  });
});

// ─── CI-02 · structure ────────────────────────────────────────────────────────

describe('CI-02 · structure — required data attributes', () => {
  it('CI-02-01: has data-panel="chat-interface"', () => {
    expect(render({})).toContain('data-panel="chat-interface"');
  });

  it('CI-02-02: has data-field="controls"', () => {
    expect(render({})).toContain('data-field="controls"');
  });

  it('CI-02-03: has data-field="chat-input" on input element', () => {
    expect(render({})).toContain('data-field="chat-input"');
  });

  it('CI-02-04: has data-action="send" on button', () => {
    expect(render({})).toContain('data-action="send"');
  });

  it('CI-02-05: has data-field="chat-area" wrapping the chat panel', () => {
    expect(render({})).toContain('data-field="chat-area"');
  });
});

// ─── CI-03 · loading state ────────────────────────────────────────────────────

describe('CI-03 · loading state — initialLoading=true', () => {
  const html = render({ initialLoading: true });

  it('CI-03-01: data-state="loading" visible in chat-area', () => {
    expect(html).toContain('data-state="loading"');
  });

  it('CI-03-02: input element has disabled attribute', () => {
    expect(html).toMatch(/data-field="chat-input"[^>]*disabled/);
  });

  it('CI-03-03: send button has disabled attribute', () => {
    expect(html).toMatch(/data-action="send"[^>]*disabled/);
  });

  it('CI-03-04: button text is "Đang gửi..."', () => {
    expect(html).toContain('Đang gửi...');
  });

  it('CI-03-05: no data-state="ready" when loading with no messages', () => {
    expect(html).not.toContain('data-state="ready"');
  });
});

// ─── CI-04 · error state ─────────────────────────────────────────────────────

describe('CI-04 · error state — initialError set', () => {
  const html = render({ initialError: 'Lỗi thử nghiệm' });

  it('CI-04-01: data-state="error" visible in output', () => {
    expect(html).toContain('data-state="error"');
  });

  it('CI-04-02: error message text appears in output', () => {
    expect(html).toContain('Lỗi thử nghiệm');
  });

  it('CI-04-03: no data-state="ready" when only error is set (no messages)', () => {
    expect(html).not.toContain('data-state="ready"');
  });

  it('CI-04-04: no data-state="loading" when loading=false', () => {
    expect(html).not.toContain('data-state="loading"');
  });

  it('CI-04-05: input is NOT disabled when loading=false', () => {
    expect(html).not.toMatch(/data-field="chat-input"[^>]*disabled/);
  });
});

// ─── CI-05 · empty state ──────────────────────────────────────────────────────

describe('CI-05 · empty state — no messages, no loading, no error', () => {
  const html = render({ initialMessages: [] });

  it('CI-05-01: data-state="empty" present', () => {
    expect(html).toContain('data-state="empty"');
  });

  it('CI-05-02: Vietnamese empty message visible', () => {
    expect(html).toContain('Chưa có tin nhắn nào');
  });

  it('CI-05-03: no data-state="ready" when empty', () => {
    expect(html).not.toContain('data-state="ready"');
  });

  it('CI-05-04: send button disabled when input is empty (default)', () => {
    expect(html).toMatch(/data-action="send"[^>]*disabled/);
  });
});

// ─── CI-06 · ready state — messages ──────────────────────────────────────────

describe('CI-06 · ready state — initialMessages provided', () => {
  const msgs = [USER_MSG, AGENT_MSG];
  const html = render({ initialMessages: msgs });

  it('CI-06-01: data-state="ready" present in chat-area', () => {
    expect(html).toContain('data-state="ready"');
  });

  it('CI-06-02: user message content appears in output', () => {
    expect(html).toContain('Hỏi về thủ tục');
  });

  it('CI-06-03: agent message content appears in output', () => {
    expect(html).toContain('Trả lời từ agent');
  });

  it('CI-06-04: number of message divs matches initialMessages.length', () => {
    const count = (html.match(/data-message-id=/g) ?? []).length;
    expect(count).toBe(msgs.length);
  });

  it('CI-06-05: data-role="user" attribute present', () => {
    expect(html).toContain('data-role="user"');
  });
});

// ─── CI-07 · input field ──────────────────────────────────────────────────────

describe('CI-07 · input field — value and disabled', () => {
  it('CI-07-01: default initialInput is empty (value="")', () => {
    const html = render({});
    expect(html).toContain('value=""');
  });

  it('CI-07-02: custom initialInput value appears in rendered attribute', () => {
    const html = render({ initialInput: 'Câu hỏi đặc biệt' });
    expect(html).toContain('value="Câu hỏi đặc biệt"');
  });

  it('CI-07-03: input is disabled when initialLoading=true', () => {
    const html = render({ initialLoading: true });
    expect(html).toMatch(/data-field="chat-input"[^>]*disabled/);
  });

  it('CI-07-04: input is NOT disabled when initialLoading=false', () => {
    const html = render({ initialLoading: false });
    expect(html).not.toMatch(/data-field="chat-input"[^>]*disabled/);
  });
});

// ─── CI-08 · send button ──────────────────────────────────────────────────────

describe('CI-08 · send button — disabled logic and label', () => {
  it('CI-08-01: button disabled when input="" and loading=false', () => {
    const html = render({ initialInput: '', initialLoading: false });
    expect(html).toMatch(/data-action="send"[^>]*disabled/);
  });

  it('CI-08-02: button disabled when initialLoading=true', () => {
    const html = render({ initialInput: 'Câu hỏi', initialLoading: true });
    expect(html).toMatch(/data-action="send"[^>]*disabled/);
  });

  it('CI-08-03: button text "Gửi" when not loading', () => {
    const html = render({ initialLoading: false });
    expect(html).toContain('>Gửi<');
  });

  it('CI-08-04: button text "Đang gửi..." when loading=true', () => {
    const html = render({ initialLoading: true });
    expect(html).toContain('Đang gửi...');
  });
});

// ─── CI-09 · message attributes ──────────────────────────────────────────────

describe('CI-09 · message attributes', () => {
  const html = render({ initialMessages: [USER_MSG, AGENT_MSG] });

  it('CI-09-01: data-message-id attribute on each message', () => {
    expect(html).toContain('data-message-id="u1"');
  });

  it('CI-09-02: data-role="user" on user message', () => {
    expect(html).toContain('data-role="user"');
  });

  it('CI-09-03: data-role="agent" on agent message', () => {
    expect(html).toContain('data-role="agent"');
  });

  it('CI-09-04: data-confidence attribute present', () => {
    expect(html).toContain('data-confidence=');
  });

  it('CI-09-05: data-field="sources-count" span present', () => {
    expect(html).toContain('data-field="sources-count"');
  });
});

// ─── CI-10 · message content fields ──────────────────────────────────────────

describe('CI-10 · message content — rendered fields', () => {
  const html = render({ initialMessages: [makeMsg()] });

  it('CI-10-01: content appears inside data-field="content" span', () => {
    expect(html).toContain('data-field="content"');
    expect(html).toContain('Câu hỏi mua sắm mẫu');
  });

  it('CI-10-02: role appears inside data-field="role" span', () => {
    expect(html).toContain('data-field="role"');
  });

  it('CI-10-03: data-field="timestamp" span present', () => {
    expect(html).toContain('data-field="timestamp"');
  });

  it('CI-10-04: data-field="findings-count" span present', () => {
    expect(html).toContain('data-field="findings-count"');
  });
});

// ─── CI-11 · data attribute consistency ──────────────────────────────────────

describe('CI-11 · data attribute consistency across states', () => {
  it('CI-11-01: data-panel="chat-interface" present in loading state', () => {
    expect(render({ initialLoading: true })).toContain('data-panel="chat-interface"');
  });

  it('CI-11-02: data-panel="chat-interface" present in empty state', () => {
    expect(render({ initialMessages: [] })).toContain('data-panel="chat-interface"');
  });

  it('CI-11-03: data-field="chat-area" present in loading state', () => {
    expect(render({ initialLoading: true })).toContain('data-field="chat-area"');
  });

  it('CI-11-04: data-field="chat-area" present in empty state', () => {
    expect(render({ initialMessages: [] })).toContain('data-field="chat-area"');
  });

  it('CI-11-05: data-field="controls" present in error state', () => {
    expect(render({ initialError: 'Lỗi' })).toContain('data-field="controls"');
  });
});

// ─── CI-12 · createAgentSystem — chat agent ───────────────────────────────────

describe('CI-12 · createAgentSystem bundle — chat agent', () => {
  const bundle = createAgentSystem();

  it('CI-12-01: bundle has chat property', () => {
    expect(bundle).toHaveProperty('chat');
  });

  it('CI-12-02: bundle.chat.id is "chat"', () => {
    expect(bundle.chat.id).toBe('chat');
  });

  it('CI-12-03: bundle.chat.name is "Chat Agent"', () => {
    expect(bundle.chat.name).toBe('Chat Agent');
  });

  it('CI-12-04: bundle.chat is a ChatAgent instance', () => {
    expect(bundle.chat).toBeInstanceOf(ChatAgent);
  });

  it('CI-12-05: capabilities includes "procurement-law-qa"', () => {
    expect(bundle.chat.getCapabilities()).toContain('procurement-law-qa');
  });

  it('CI-12-06: capabilities list has at least 5 entries', () => {
    expect(bundle.chat.getCapabilities().length).toBeGreaterThanOrEqual(5);
  });
});

// ─── CI-13 · packageContext prop ─────────────────────────────────────────────

function makePkg(overrides?: Partial<ProcurementPackage>): ProcurementPackage {
  return {
    id: 'pkg-test',
    packageName: 'Gói thầu thử nghiệm 8-A',
    packageCode: 'TEST-8A',
    fundingSource: 'autonomy_fund',
    fundingSourceName: 'Quỹ phát triển hoạt động sự nghiệp',
    budgetYear: 2026,
    rectorName: '[Hiệu trưởng]',
    departmentName: '[Phòng đề xuất]',
    departmentCode: 'PĐX',
    expertTeamLeader: '[Tổ trưởng tổ chuyên gia]',
    expertTeamMember1: '[Thành viên tổ chuyên gia 1]',
    expertTeamMember2: '[Thành viên tổ chuyên gia 2]',
    appraisalLeader: '[Tổ trưởng thẩm định độc lập]',
    appraisalMember: '[Thành viên thẩm định độc lập]',
    supplier1Name: '[Nhà cung cấp số 1]',
    supplier1Address: '',
    supplier1TaxCode: '',
    supplier1Representative: '',
    supplier1Position: '',
    supplier2Name: '[Nhà cung cấp số 2]',
    supplier2Address: '',
    supplier3Name: '[Nhà cung cấp số 3]',
    supplier3Address: '',
    dateProposal: '2026-01-01',
    dateSurvey: '2026-01-02',
    dateQuotes: '2026-01-03',
    dateCompare: '2026-01-04',
    dateKhlcnt: '2026-01-05',
    dateKhlcntApprove: '2026-01-06',
    dateExpertEstablish: '2026-01-07',
    dateDocIssue: '2026-01-08',
    dateBidClose: '2026-01-15',
    dateEvaluate: '2026-01-16',
    dateAppraise: '2026-01-17',
    dateResultProposal: '2026-01-18',
    dateResultApprove: '2026-01-19',
    dateContractSign: '2026-01-20',
    dateDelivery: '2026-02-01',
    dateAcceptance: '2026-02-05',
    dateLiquidation: '2026-03-01',
    dateAssetIncrease: '2026-03-02',
    contractDurationDays: 30,
    items: [],
    ...overrides,
  };
}

describe('CI-13 · packageContext prop', () => {
  it('CI-13-01: renders without throwing when packageContext is provided', () => {
    expect(() => render({ packageContext: makePkg() })).not.toThrow();
  });

  it('CI-13-02: data-field="package-context" present when packageContext is provided', () => {
    const html = render({ packageContext: makePkg() });
    expect(html).toContain('data-field="package-context"');
  });

  it('CI-13-03: packageContext.packageName appears inside data-field="package-name"', () => {
    const html = render({ packageContext: makePkg() });
    expect(html).toContain('data-field="package-name"');
    expect(html).toContain('Gói thầu thử nghiệm 8-A');
  });

  it('CI-13-04: no data-field="package-context" when packageContext is undefined', () => {
    const html = render({});
    expect(html).not.toContain('data-field="package-context"');
  });
});
