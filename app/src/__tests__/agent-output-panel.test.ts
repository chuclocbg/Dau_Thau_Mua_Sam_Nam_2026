/**
 * 8-B: AgentOutputPanel — 56 tests
 *
 * Groups:
 *   AO-01  (4)  never-throw — edge inputs that must not throw
 *   AO-02  (5)  structure — required data attributes always present
 *   AO-03  (5)  loading state — loading=true
 *   AO-04  (5)  agent count — exactly 4 specialist agents rendered
 *   AO-05  (5)  planner agent — data-section, name, capabilities
 *   AO-06  (5)  spec agent — data-section, name, capabilities
 *   AO-07  (5)  legal reviewer agent — data-section, name, capabilities
 *   AO-08  (5)  risk agent — data-section, name, capabilities
 *   AO-09  (4)  capabilities display — data-field="capabilities" ul present
 *   AO-10  (4)  data-capability attributes — specific capability keys
 *   AO-11  (4)  data attribute consistency across states
 *   AO-12  (5)  createAgentSystem bundle — planner/spec/legal/risk exposed
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

import AgentOutputPanel from '../components/AgentOutputPanel';
import { createAgentSystem } from '../components/AgentProviderPanel';
import {
  AgentRegistry,
  PlannerAgent,
  SpecificationAgent,
  LegalReviewerAgent,
  RiskAgent,
} from '../agents';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeAgents() {
  const registry = new AgentRegistry();
  return {
    planner: new PlannerAgent(registry),
    spec:    new SpecificationAgent(registry),
    legal:   new LegalReviewerAgent(registry),
    risk:    new RiskAgent(registry),
  };
}

function render(props: React.ComponentProps<typeof AgentOutputPanel>): string {
  return renderToString(React.createElement(AgentOutputPanel, props));
}

// ─── AO-01 · never-throw ─────────────────────────────────────────────────────

describe('AO-01 · never-throw — edge inputs', () => {
  it('AO-01-01: renders without throwing with all 4 agents', () => {
    expect(() => render(makeAgents())).not.toThrow();
  });

  it('AO-01-02: renders without throwing when loading=true', () => {
    expect(() => render({ ...makeAgents(), loading: true })).not.toThrow();
  });

  it('AO-01-03: renders without throwing when loading=false', () => {
    expect(() => render({ ...makeAgents(), loading: false })).not.toThrow();
  });

  it('AO-01-04: renders without throwing when loading omitted (default false)', () => {
    const { planner, spec, legal, risk } = makeAgents();
    expect(() => render({ planner, spec, legal, risk })).not.toThrow();
  });
});

// ─── AO-02 · structure ────────────────────────────────────────────────────────

describe('AO-02 · structure — required data attributes', () => {
  const html = render(makeAgents());

  it('AO-02-01: has data-panel="agent-output"', () => {
    expect(html).toContain('data-panel="agent-output"');
  });

  it('AO-02-02: has data-state="ready" in default render', () => {
    expect(html).toContain('data-state="ready"');
  });

  it('AO-02-03: has data-field="title"', () => {
    expect(html).toContain('data-field="title"');
  });

  it('AO-02-04: has data-field="agent-list"', () => {
    expect(html).toContain('data-field="agent-list"');
  });

  it('AO-02-05: title element is an h2', () => {
    expect(html).toMatch(/<h2[^>]*data-field="title"[^>]*>/);
  });
});

// ─── AO-03 · loading state ────────────────────────────────────────────────────

describe('AO-03 · loading state — loading=true', () => {
  const html = render({ ...makeAgents(), loading: true });

  it('AO-03-01: data-state="loading" present', () => {
    expect(html).toContain('data-state="loading"');
  });

  it('AO-03-02: Vietnamese loading message visible', () => {
    expect(html).toContain('Đang tải tác nhân chuyên biệt');
  });

  it('AO-03-03: no data-state="ready" in loading', () => {
    expect(html).not.toContain('data-state="ready"');
  });

  it('AO-03-04: no data-field="agent-list" in loading', () => {
    expect(html).not.toContain('data-field="agent-list"');
  });

  it('AO-03-05: data-panel="agent-output" still present in loading', () => {
    expect(html).toContain('data-panel="agent-output"');
  });
});

// ─── AO-04 · agent count ─────────────────────────────────────────────────────

describe('AO-04 · agent count — exactly 4 specialist agents rendered', () => {
  const html = render(makeAgents());

  it('AO-04-01: data-agent-count="4" present', () => {
    expect(html).toContain('data-agent-count="4"');
  });

  it('AO-04-02: exactly 4 data-agent-id attributes in output', () => {
    const count = (html.match(/data-agent-id=/g) ?? []).length;
    expect(count).toBe(4);
  });

  it('AO-04-03: exactly 4 data-section attributes in output', () => {
    const count = (html.match(/data-section=/g) ?? []).length;
    expect(count).toBe(4);
  });

  it('AO-04-04: data-field="capability-count" appears 4 times (once per agent)', () => {
    const count = (html.match(/data-field="capability-count"/g) ?? []).length;
    expect(count).toBe(4);
  });

  it('AO-04-05: data-field="capabilities" ul appears 4 times (once per agent)', () => {
    const count = (html.match(/data-field="capabilities"/g) ?? []).length;
    expect(count).toBe(4);
  });
});

// ─── AO-05 · planner agent ────────────────────────────────────────────────────

describe('AO-05 · planner agent', () => {
  const html = render(makeAgents());

  it('AO-05-01: data-section="planner" present', () => {
    expect(html).toContain('data-section="planner"');
  });

  it('AO-05-02: data-agent-id="planner" present', () => {
    expect(html).toContain('data-agent-id="planner"');
  });

  it('AO-05-03: "Procurement Planner Agent" text visible', () => {
    expect(html).toContain('Procurement Planner Agent');
  });

  it('AO-05-04: "annual-procurement-planning" capability present', () => {
    expect(html).toContain('annual-procurement-planning');
  });

  it('AO-05-05: "package-split-detection" capability present', () => {
    expect(html).toContain('package-split-detection');
  });
});

// ─── AO-06 · spec agent ──────────────────────────────────────────────────────

describe('AO-06 · specification agent', () => {
  const html = render(makeAgents());

  it('AO-06-01: data-section="specification" present', () => {
    expect(html).toContain('data-section="specification"');
  });

  it('AO-06-02: data-agent-id="specification" present', () => {
    expect(html).toContain('data-agent-id="specification"');
  });

  it('AO-06-03: "Specification Agent" text visible', () => {
    expect(html).toContain('Specification Agent');
  });

  it('AO-06-04: "spec-generation" capability present', () => {
    expect(html).toContain('spec-generation');
  });

  it('AO-06-05: "brand-detection" capability present', () => {
    expect(html).toContain('brand-detection');
  });
});

// ─── AO-07 · legal reviewer agent ────────────────────────────────────────────

describe('AO-07 · legal reviewer agent', () => {
  const html = render(makeAgents());

  it('AO-07-01: data-section="legal-reviewer" present', () => {
    expect(html).toContain('data-section="legal-reviewer"');
  });

  it('AO-07-02: data-agent-id="legal-reviewer" present', () => {
    expect(html).toContain('data-agent-id="legal-reviewer"');
  });

  it('AO-07-03: "Legal Reviewer Agent" text visible', () => {
    expect(html).toContain('Legal Reviewer Agent');
  });

  it('AO-07-04: "package-legal-review" capability present', () => {
    expect(html).toContain('package-legal-review');
  });

  it('AO-07-05: "compliance-scoring" capability present', () => {
    expect(html).toContain('compliance-scoring');
  });
});

// ─── AO-08 · risk agent ──────────────────────────────────────────────────────

describe('AO-08 · risk agent', () => {
  const html = render(makeAgents());

  it('AO-08-01: data-section="risk" present', () => {
    expect(html).toContain('data-section="risk"');
  });

  it('AO-08-02: data-agent-id="risk" present', () => {
    expect(html).toContain('data-agent-id="risk"');
  });

  it('AO-08-03: "Risk Agent" text visible', () => {
    expect(html).toContain('Risk Agent');
  });

  it('AO-08-04: "risk-assessment" capability present', () => {
    expect(html).toContain('risk-assessment');
  });

  it('AO-08-05: "mitigation-planning" capability present', () => {
    expect(html).toContain('mitigation-planning');
  });
});

// ─── AO-09 · capabilities display ────────────────────────────────────────────

describe('AO-09 · capabilities display', () => {
  const html = render(makeAgents());

  it('AO-09-01: data-field="capabilities" ul present in output', () => {
    expect(html).toContain('data-field="capabilities"');
  });

  it('AO-09-02: data-capability attributes present in output', () => {
    expect(html).toContain('data-capability=');
  });

  it('AO-09-03: total data-capability attributes = 18 (4+4+5+5)', () => {
    const count = (html.match(/data-capability=/g) ?? []).length;
    expect(count).toBe(18);
  });

  it('AO-09-04: "audit-readiness-assessment" capability (legal) present', () => {
    expect(html).toContain('audit-readiness-assessment');
  });
});

// ─── AO-10 · data-capability attributes ──────────────────────────────────────

describe('AO-10 · data-capability attribute values', () => {
  const html = render(makeAgents());

  it('AO-10-01: data-capability="authority-validation" present (planner)', () => {
    expect(html).toContain('data-capability="authority-validation"');
  });

  it('AO-10-02: data-capability="alternative-suggestion" present (spec)', () => {
    expect(html).toContain('data-capability="alternative-suggestion"');
  });

  it('AO-10-03: data-capability="dossier-legal-review" present (legal)', () => {
    expect(html).toContain('data-capability="dossier-legal-review"');
  });

  it('AO-10-04: data-capability="audit-exposure-estimation" present (risk)', () => {
    expect(html).toContain('data-capability="audit-exposure-estimation"');
  });
});

// ─── AO-11 · data attribute consistency ──────────────────────────────────────

describe('AO-11 · data attribute consistency across states', () => {
  it('AO-11-01: data-panel="agent-output" present in loading state', () => {
    expect(render({ ...makeAgents(), loading: true })).toContain('data-panel="agent-output"');
  });

  it('AO-11-02: data-panel="agent-output" present in ready state', () => {
    expect(render(makeAgents())).toContain('data-panel="agent-output"');
  });

  it('AO-11-03: no data-state="ready" when loading=true', () => {
    expect(render({ ...makeAgents(), loading: true })).not.toContain('data-state="ready"');
  });

  it('AO-11-04: no data-state="loading" when loading=false', () => {
    expect(render({ ...makeAgents(), loading: false })).not.toContain('data-state="loading"');
  });
});

// ─── AO-12 · createAgentSystem bundle ────────────────────────────────────────

describe('AO-12 · createAgentSystem bundle — specialist agents exposed', () => {
  const bundle = createAgentSystem();

  it('AO-12-01: bundle has "planner" property', () => {
    expect(bundle).toHaveProperty('planner');
  });

  it('AO-12-02: bundle.planner is a PlannerAgent instance', () => {
    expect(bundle.planner).toBeInstanceOf(PlannerAgent);
  });

  it('AO-12-03: bundle has "spec" property and is a SpecificationAgent instance', () => {
    expect(bundle).toHaveProperty('spec');
    expect(bundle.spec).toBeInstanceOf(SpecificationAgent);
  });

  it('AO-12-04: bundle has "legal" property and is a LegalReviewerAgent instance', () => {
    expect(bundle).toHaveProperty('legal');
    expect(bundle.legal).toBeInstanceOf(LegalReviewerAgent);
  });

  it('AO-12-05: bundle has "risk" property and is a RiskAgent instance', () => {
    expect(bundle).toHaveProperty('risk');
    expect(bundle.risk).toBeInstanceOf(RiskAgent);
  });
});
