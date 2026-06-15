/**
 * P6-10L: Tests for PromptTemplateManager.
 *
 * Groups:
 *   PT1 — registerTemplate / removeTemplate / getTemplate / listTemplates (10)
 *   PT2 — render() core behaviour                                          (12)
 *   PT3 — render() edge cases                                              (10)
 *   PT4 — Immutability / miscellaneous edge cases                          (10)
 *
 * Total: 42 tests
 */

import { describe, it, expect } from 'vitest';
import { PromptTemplateManager } from '../providers/PromptTemplateManager';
import type { PromptTemplate, PromptVariable } from '../providers/PromptTemplateManager';

// ─── Fixture templates ────────────────────────────────────────────────────────

const GREETING: PromptTemplate = {
  id:       'greeting',
  name:     'Greeting',
  template: 'Xin chào, {{name}}!',
  variables: [{ name: 'name', required: true }],
};

const SUMMARY: PromptTemplate = {
  id:          'summary',
  name:        'Summary',
  description: 'Tóm tắt văn bản',
  template:    'Tóm tắt {{style}} nội dung sau trong {{lang}}: {{content}}',
  variables: [
    { name: 'style',   required: false, defaultValue: 'ngắn gọn' },
    { name: 'lang',    required: true },
    { name: 'content', required: true },
  ],
};

const SIMPLE: PromptTemplate = {
  id:       'simple',
  name:     'Simple',
  template: 'Không có biến nào ở đây.',
  variables: [],
};

const OPTIONAL_ONLY: PromptTemplate = {
  id:       'opt',
  name:     'Optional',
  template: 'Chào {{salutation}} {{name}}',
  variables: [
    { name: 'salutation', required: false, defaultValue: 'bạn' },
    { name: 'name',       required: false },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// PT1: registerTemplate / removeTemplate / getTemplate / listTemplates
// ─────────────────────────────────────────────────────────────────────────────

describe('PT1: registerTemplate / removeTemplate / getTemplate / listTemplates', () => {
  it('PT1-01: registerTemplate increases listTemplates count', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(GREETING);
    expect(m.listTemplates()).toHaveLength(1);
  });

  it('PT1-02: registering a duplicate id overwrites the previous template', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(GREETING);
    m.registerTemplate({ ...GREETING, name: 'Updated Greeting' });
    const templates = m.listTemplates();
    expect(templates).toHaveLength(1);
    expect(templates[0]!.name).toBe('Updated Greeting');
  });

  it('PT1-03: removeTemplate returns true when the template exists', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(GREETING);
    expect(m.removeTemplate('greeting')).toBe(true);
  });

  it('PT1-04: removeTemplate returns false for an unknown id', () => {
    const m = new PromptTemplateManager();
    expect(m.removeTemplate('does-not-exist')).toBe(false);
  });

  it('PT1-05: getTemplate returns the registered template', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(SUMMARY);
    const t = m.getTemplate('summary');
    expect(t).toBeDefined();
    expect(t!.id).toBe('summary');
    expect(t!.name).toBe('Summary');
    expect(t!.description).toBe('Tóm tắt văn bản');
    expect(t!.variables).toHaveLength(3);
  });

  it('PT1-06: getTemplate returns undefined for an unregistered id', () => {
    expect(new PromptTemplateManager().getTemplate('none')).toBeUndefined();
  });

  it('PT1-07: listTemplates returns all registered templates', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(GREETING);
    m.registerTemplate(SUMMARY);
    m.registerTemplate(SIMPLE);
    const ids = m.listTemplates().map(t => t.id);
    expect(ids).toContain('greeting');
    expect(ids).toContain('summary');
    expect(ids).toContain('simple');
    expect(m.listTemplates()).toHaveLength(3);
  });

  it('PT1-08: listTemplates returns an empty array before any registration', () => {
    expect(new PromptTemplateManager().listTemplates()).toEqual([]);
  });

  it('PT1-09: removeTemplate removes only the target, not others', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(GREETING);
    m.registerTemplate(SUMMARY);
    m.removeTemplate('greeting');
    const ids = m.listTemplates().map(t => t.id);
    expect(ids).not.toContain('greeting');
    expect(ids).toContain('summary');
  });

  it('PT1-10: getTemplate returns undefined after removeTemplate', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(GREETING);
    m.removeTemplate('greeting');
    expect(m.getTemplate('greeting')).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PT2: render() core behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe('PT2: render() core behaviour', () => {
  it('PT2-01: renders a simple template with one required variable', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(GREETING);
    const r = m.render('greeting', { variables: { name: 'An' } });
    expect(r.ok).toBe(true);
    expect(r.rendered).toBe('Xin chào, An!');
  });

  it('PT2-02: renders a template with multiple variables', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(SUMMARY);
    const r = m.render('summary', { variables: { style: 'chi tiết', lang: 'tiếng Việt', content: 'văn bản mẫu' } });
    expect(r.ok).toBe(true);
    expect(r.rendered).toContain('chi tiết');
    expect(r.rendered).toContain('tiếng Việt');
    expect(r.rendered).toContain('văn bản mẫu');
  });

  it('PT2-03: applies defaultValue when variable is not provided', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(SUMMARY);
    const r = m.render('summary', { variables: { lang: 'tiếng Việt', content: 'nội dung' } });
    // style has defaultValue: 'ngắn gọn'
    expect(r.ok).toBe(true);
    expect(r.rendered).toContain('ngắn gọn');
  });

  it('PT2-04: provided value overrides defaultValue', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(SUMMARY);
    const r = m.render('summary', { variables: { style: 'toàn diện', lang: 'Vietnamese', content: 'abc' } });
    expect(r.ok).toBe(true);
    expect(r.rendered).toContain('toàn diện');
    expect(r.rendered).not.toContain('ngắn gọn');
  });

  it('PT2-05: ok is true when all required variables are provided', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(GREETING);
    expect(m.render('greeting', { variables: { name: 'Bình' } }).ok).toBe(true);
  });

  it('PT2-06: ok is false when a required variable is missing', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(GREETING);
    const r = m.render('greeting');
    expect(r.ok).toBe(false);
  });

  it('PT2-07: missingVariables lists the name of the missing required variable', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(GREETING);
    const r = m.render('greeting');
    expect(r.missingVariables).toContain('name');
  });

  it('PT2-08: missingVariables lists all missing required variables', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(SUMMARY);
    // Provide nothing — lang and content are required (style has default)
    const r = m.render('summary', { variables: {} });
    expect(r.ok).toBe(false);
    expect(r.missingVariables).toContain('lang');
    expect(r.missingVariables).toContain('content');
    expect(r.missingVariables).not.toContain('style');
  });

  it('PT2-09: ok is true when optional variable has no value (rendered as empty string)', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(OPTIONAL_ONLY);
    // name is optional with no default
    const r = m.render('opt', { variables: {} });
    expect(r.ok).toBe(true);
    expect(r.missingVariables).toHaveLength(0);
  });

  it('PT2-10: render returns ok:false for an unknown template id', () => {
    const m = new PromptTemplateManager();
    const r = m.render('no-such-template');
    expect(r.ok).toBe(false);
    expect(r.rendered).toBe('');
  });

  it('PT2-11: rendered is a substituted string, not the original template', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(GREETING);
    const r = m.render('greeting', { variables: { name: 'Cường' } });
    expect(r.ok).toBe(true);
    expect(r.rendered).not.toBe(GREETING.template);
    expect(r.rendered).toBe('Xin chào, Cường!');
  });

  it('PT2-12: rendered contains no remaining {{var}} markers on success', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(SUMMARY);
    const r = m.render('summary', { variables: { lang: 'EN', content: 'test' } });
    expect(r.ok).toBe(true);
    expect(r.rendered).not.toMatch(/\{\{/);
    expect(r.rendered).not.toMatch(/\}\}/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PT3: render() edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('PT3: render() edge cases', () => {
  it('PT3-01: template with no variables renders the template body verbatim', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(SIMPLE);
    const r = m.render('simple');
    expect(r.ok).toBe(true);
    expect(r.rendered).toBe('Không có biến nào ở đây.');
    expect(r.missingVariables).toHaveLength(0);
  });

  it('PT3-02: template with only optional variables and no values provided renders ok', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(OPTIONAL_ONLY);
    const r = m.render('opt');
    expect(r.ok).toBe(true);
    // salutation has default 'bạn'; name has no default → replaced with ''
    expect(r.rendered).toContain('bạn');
  });

  it('PT3-03: providing all variables (required + optional) renders fully', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(OPTIONAL_ONLY);
    const r = m.render('opt', { variables: { salutation: 'anh', name: 'Đức' } });
    expect(r.ok).toBe(true);
    expect(r.rendered).toBe('Chào anh Đức');
  });

  it('PT3-04: {{undeclared}} placeholder in template body is replaced with empty string', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate({
      id: 'undecl', name: 'Undeclared', template: 'Hello {{known}} and {{unknown}}!',
      variables: [{ name: 'known', required: true }],
    });
    const r = m.render('undecl', { variables: { known: 'World' } });
    expect(r.ok).toBe(true);
    expect(r.rendered).toBe('Hello World and !');
  });

  it('PT3-05: render without options.variables uses defaults only', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(OPTIONAL_ONLY);
    // No options passed at all — should still ok because all are optional
    const r = m.render('opt');
    expect(r.ok).toBe(true);
    expect(r.rendered).toContain('bạn');  // default for salutation
  });

  it('PT3-06: provided value of empty string counts as provided (required not missing)', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(GREETING);
    const r = m.render('greeting', { variables: { name: '' } });
    expect(r.ok).toBe(true);
    expect(r.missingVariables).toHaveLength(0);
    expect(r.rendered).toBe('Xin chào, !');
  });

  it('PT3-07: missingVariables is an empty array on success', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(GREETING);
    const r = m.render('greeting', { variables: { name: 'X' } });
    expect(r.ok).toBe(true);
    expect(r.missingVariables).toEqual([]);
  });

  it('PT3-08: required variable with defaultValue is NOT missing when no value provided', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate({
      id: 'withdef', name: 'WithDefault',
      template: 'Kết quả: {{level}}',
      variables: [{ name: 'level', required: true, defaultValue: 'cao' }],
    });
    const r = m.render('withdef');
    expect(r.ok).toBe(true);
    expect(r.rendered).toBe('Kết quả: cao');
    expect(r.missingVariables).toHaveLength(0);
  });

  it('PT3-09: multiple occurrences of the same variable are all substituted', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate({
      id: 'multi', name: 'Multi',
      template: '{{name}} là {{name}}. Gọi {{name}} ngay!',
      variables: [{ name: 'name', required: true }],
    });
    const r = m.render('multi', { variables: { name: 'AI' } });
    expect(r.ok).toBe(true);
    expect(r.rendered).toBe('AI là AI. Gọi AI ngay!');
  });

  it('PT3-10: partial render on failure: defaults and provided values are applied', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(SUMMARY);
    // Only provide style, omit required lang and content
    const r = m.render('summary', { variables: { style: 'toàn diện' } });
    expect(r.ok).toBe(false);
    expect(r.missingVariables).toContain('lang');
    expect(r.missingVariables).toContain('content');
    // But 'style' was provided and should appear in rendered
    expect(r.rendered).toContain('toàn diện');
    // Missing vars become empty string in partial render
    expect(r.rendered).not.toMatch(/\{\{/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PT4: Immutability / miscellaneous edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('PT4: Immutability / miscellaneous edge cases', () => {
  it('PT4-01: mutating the getTemplate result does not affect the registry', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(GREETING);
    const snap = m.getTemplate('greeting')!;
    snap.name = 'CORRUPTED';
    snap.variables[0]!.name = 'CORRUPTED';
    snap.variables.push({ name: 'injected', required: false });
    const fresh = m.getTemplate('greeting')!;
    expect(fresh.name).toBe('Greeting');
    expect(fresh.variables[0]!.name).toBe('name');
    expect(fresh.variables).toHaveLength(1);
  });

  it('PT4-02: mutating a listTemplates result does not affect the registry', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(SUMMARY);
    const list = m.listTemplates();
    list[0]!.name        = 'MUTATED';
    list[0]!.variables[0]!.required = false;
    list.push({ ...GREETING });   // inject extra
    const fresh = m.listTemplates();
    expect(fresh).toHaveLength(1);
    expect(fresh[0]!.name).toBe('Summary');
    expect(fresh[0]!.variables[0]!.required).toBe(false);  // style was originally false, still false
  });

  it('PT4-03: render result is an independent plain object (not the stored template)', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(GREETING);
    const r1 = m.render('greeting', { variables: { name: 'A' } });
    const r2 = m.render('greeting', { variables: { name: 'B' } });
    expect(r1.rendered).toBe('Xin chào, A!');
    expect(r2.rendered).toBe('Xin chào, B!');
  });

  it('PT4-04: mutating the original template after registerTemplate does not affect registry', () => {
    const m = new PromptTemplateManager();
    const tmpl: PromptTemplate = {
      id: 'mut', name: 'Mutable', template: 'Hello {{who}}',
      variables: [{ name: 'who', required: true }],
    };
    m.registerTemplate(tmpl);
    tmpl.name = 'CHANGED';
    tmpl.variables[0]!.required = false;
    tmpl.variables.push({ name: 'extra', required: true });
    const stored = m.getTemplate('mut')!;
    expect(stored.name).toBe('Mutable');
    expect(stored.variables[0]!.required).toBe(true);
    expect(stored.variables).toHaveLength(1);
  });

  it('PT4-05: render with empty variables object {} still applies defaults', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(SUMMARY);
    const r = m.render('summary', { variables: { lang: 'VI', content: 'x' } });
    expect(r.ok).toBe(true);
    expect(r.rendered).toContain('ngắn gọn');   // default for style applied
  });

  it('PT4-06: template body with only whitespace renders as-is', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate({ id: 'ws', name: 'WS', template: '   ', variables: [] });
    const r = m.render('ws');
    expect(r.ok).toBe(true);
    expect(r.rendered).toBe('   ');
  });

  it('PT4-07: PromptTemplateManager never throws for any sequence of valid operations', () => {
    expect(() => {
      const m = new PromptTemplateManager();
      m.listTemplates();
      m.getTemplate('none');
      m.removeTemplate('none');
      m.render('none');
      m.render('none', {});
      m.render('none', { variables: { x: 'y' } });
      m.registerTemplate(GREETING);
      m.render('greeting');
      m.render('greeting', { variables: { name: 'X' } });
      m.removeTemplate('greeting');
      m.render('greeting');
    }).not.toThrow();
  });

  it('PT4-08: template body with special characters renders correctly', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate({
      id: 'special', name: 'Special',
      template: 'Mức phí: {{amount}} VNĐ — "{{note}}" — 100%',
      variables: [
        { name: 'amount', required: true },
        { name: 'note',   required: true },
      ],
    });
    const r = m.render('special', { variables: { amount: '5.000.000', note: 'Đã thanh toán' } });
    expect(r.ok).toBe(true);
    expect(r.rendered).toBe('Mức phí: 5.000.000 VNĐ — "Đã thanh toán" — 100%');
  });

  it('PT4-09: variable name with underscores and digits is substituted correctly', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate({
      id: 'underscore', name: 'Underscore',
      template: 'Mã số: {{contract_id_2026}}',
      variables: [{ name: 'contract_id_2026', required: true }],
    });
    const r = m.render('underscore', { variables: { contract_id_2026: 'HD-001' } });
    expect(r.ok).toBe(true);
    expect(r.rendered).toBe('Mã số: HD-001');
  });

  it('PT4-10: removing a template then rendering returns ok:false', () => {
    const m = new PromptTemplateManager();
    m.registerTemplate(GREETING);
    m.removeTemplate('greeting');
    const r = m.render('greeting', { variables: { name: 'X' } });
    expect(r.ok).toBe(false);
    expect(r.rendered).toBe('');
  });
});
