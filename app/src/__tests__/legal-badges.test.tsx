/**
 * Phase 10.0 — LegalBadges tests
 *
 * All rendering via react-dom/server renderToString (no jsdom, no hooks).
 *
 * Groups:
 *   SB-01  (3)  LegalStatusBadge — renders without throwing for all codes
 *   SB-02  (3)  LegalStatusBadge — data-badge attribute always present
 *   SB-03  (3)  LegalStatusBadge — data-code attribute matches input code
 *   SB-04  (3)  LegalStatusBadge — correct labels for key codes
 *   SB-05  (3)  LegalStatusBadge — className passthrough
 *   SB-06  (3)  LegalActionBadge — hasActions true/false rendering
 *   SB-07  (3)  LegalCountBadge — count and default label
 *   SB-08  (3)  labelForCode helper + LegalCountBadge custom label
 */

import { describe, it, expect } from 'vitest';
import { renderToString }       from 'react-dom/server';
import React                    from 'react';

import {
  LegalStatusBadge,
  LegalActionBadge,
  LegalCountBadge,
  labelForCode,
  type LegalStatusBadgeProps,
} from '../components/LegalBadges';
import type { RecommendationCode } from '../agents/RecommendationEngine';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ALL_CODES: RecommendationCode[] = [
  'NO_ACTION', 'NAMED_FOCUS', 'PREPARE_ALL', 'FOCUS_REQUIRED', 'CONSIDER_OPTIONAL',
];

function renderBadge(props: LegalStatusBadgeProps): string {
  return renderToString(<LegalStatusBadge {...props} />);
}

// ── SB-01 LegalStatusBadge — renders without throwing ────────────────────────

describe('SB-01 LegalStatusBadge — renders without throwing for all codes', () => {
  it('SB-01-01 NO_ACTION renders without throwing', () => {
    expect(() => renderBadge({ code: 'NO_ACTION' })).not.toThrow();
  });

  it('SB-01-02 PREPARE_ALL renders without throwing', () => {
    expect(() => renderBadge({ code: 'PREPARE_ALL' })).not.toThrow();
  });

  it('SB-01-03 all 5 codes render without throwing', () => {
    expect(() => ALL_CODES.forEach(code => renderBadge({ code }))).not.toThrow();
  });
});

// ── SB-02 LegalStatusBadge — data-badge attribute ────────────────────────────

describe('SB-02 LegalStatusBadge — data-badge attribute always present', () => {
  it('SB-02-01 NO_ACTION output contains data-badge="legal-status"', () => {
    expect(renderBadge({ code: 'NO_ACTION' })).toContain('data-badge="legal-status"');
  });

  it('SB-02-02 PREPARE_ALL output contains data-badge="legal-status"', () => {
    expect(renderBadge({ code: 'PREPARE_ALL' })).toContain('data-badge="legal-status"');
  });

  it('SB-02-03 all 5 codes include data-badge="legal-status"', () => {
    expect(ALL_CODES.every(code =>
      renderBadge({ code }).includes('data-badge="legal-status"'),
    )).toBe(true);
  });
});

// ── SB-03 LegalStatusBadge — data-code attribute ─────────────────────────────

describe('SB-03 LegalStatusBadge — data-code attribute matches input', () => {
  it('SB-03-01 NO_ACTION output contains data-code="NO_ACTION"', () => {
    expect(renderBadge({ code: 'NO_ACTION' })).toContain('data-code="NO_ACTION"');
  });

  it('SB-03-02 FOCUS_REQUIRED output contains data-code="FOCUS_REQUIRED"', () => {
    expect(renderBadge({ code: 'FOCUS_REQUIRED' })).toContain('data-code="FOCUS_REQUIRED"');
  });

  it('SB-03-03 each code renders with its own data-code value', () => {
    expect(ALL_CODES.every(code =>
      renderBadge({ code }).includes(`data-code="${code}"`),
    )).toBe(true);
  });
});

// ── SB-04 LegalStatusBadge — correct labels ───────────────────────────────────

describe('SB-04 LegalStatusBadge — correct labels for key codes', () => {
  it('SB-04-01 NO_ACTION renders "Không cần thao tác"', () => {
    expect(renderBadge({ code: 'NO_ACTION' })).toContain('Không cần thao tác');
  });

  it('SB-04-02 PREPARE_ALL renders "Chuẩn bị tài liệu"', () => {
    expect(renderBadge({ code: 'PREPARE_ALL' })).toContain('Chuẩn bị tài liệu');
  });

  it('SB-04-03 CONSIDER_OPTIONAL renders "Xem xét thêm"', () => {
    expect(renderBadge({ code: 'CONSIDER_OPTIONAL' })).toContain('Xem xét thêm');
  });
});

// ── SB-05 LegalStatusBadge — className passthrough ───────────────────────────

describe('SB-05 LegalStatusBadge — className passthrough', () => {
  it('SB-05-01 className prop is included in output', () => {
    expect(renderBadge({ code: 'PREPARE_ALL', className: 'badge-primary' }))
      .toContain('badge-primary');
  });

  it('SB-05-02 no className renders without class attribute in output', () => {
    const html = renderBadge({ code: 'PREPARE_ALL' });
    expect(html).not.toContain('class=');
  });

  it('SB-05-03 className does not affect data-code output', () => {
    const html = renderBadge({ code: 'NAMED_FOCUS', className: 'some-class' });
    expect(html).toContain('data-code="NAMED_FOCUS"');
    expect(html).toContain('some-class');
  });
});

// ── SB-06 LegalActionBadge — hasActions true/false ───────────────────────────

describe('SB-06 LegalActionBadge — hasActions true/false rendering', () => {
  it('SB-06-01 hasActions=true renders "Cần thực hiện"', () => {
    const html = renderToString(<LegalActionBadge hasActions />);
    expect(html).toContain('Cần thực hiện');
  });

  it('SB-06-02 hasActions=false renders "Không có hành động"', () => {
    const html = renderToString(<LegalActionBadge hasActions={false} />);
    expect(html).toContain('Không có hành động');
  });

  it('SB-06-03 data-badge="legal-action" and data-active attribute present', () => {
    const trueHtml  = renderToString(<LegalActionBadge hasActions />);
    const falseHtml = renderToString(<LegalActionBadge hasActions={false} />);
    expect(trueHtml).toContain('data-badge="legal-action"');
    expect(trueHtml).toContain('data-active="true"');
    expect(falseHtml).toContain('data-active="false"');
  });
});

// ── SB-07 LegalCountBadge — count and default label ──────────────────────────

describe('SB-07 LegalCountBadge — count and default label', () => {
  it('SB-07-01 renders the count as a number', () => {
    const html = renderToString(<LegalCountBadge count={10} />);
    expect(html).toContain('10');
  });

  it('SB-07-02 default label is "tài liệu"', () => {
    const html = renderToString(<LegalCountBadge count={3} />);
    expect(html).toContain('tài liệu');
  });

  it('SB-07-03 data-badge="legal-count" is present', () => {
    const html = renderToString(<LegalCountBadge count={5} />);
    expect(html).toContain('data-badge="legal-count"');
  });
});

// ── SB-08 labelForCode helper + LegalCountBadge custom label ─────────────────

describe('SB-08 labelForCode helper and LegalCountBadge custom label', () => {
  it('SB-08-01 labelForCode("PREPARE_ALL") returns "Chuẩn bị tài liệu"', () => {
    expect(labelForCode('PREPARE_ALL')).toBe('Chuẩn bị tài liệu');
  });

  it('SB-08-02 labelForCode output matches LegalStatusBadge rendered label', () => {
    const code = 'FOCUS_REQUIRED' as RecommendationCode;
    expect(renderBadge({ code })).toContain(labelForCode(code));
  });

  it('SB-08-03 LegalCountBadge renders custom label instead of default', () => {
    const html = renderToString(<LegalCountBadge count={4} label="khuyến nghị" />);
    expect(html).toContain('khuyến nghị');
    expect(html).not.toContain('tài liệu');
  });
});
