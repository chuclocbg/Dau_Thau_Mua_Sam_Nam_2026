/**
 * P6-10Y: RoutePanel test suite
 *
 * 56 tests across 12 groups:
 *   RP1  (5) component structure
 *   RP2  (5) GET routes
 *   RP3  (5) POST routes
 *   RP4  (4) PUT and DELETE routes
 *   RP5  (5) mixed method display
 *   RP6  (5) path rendering
 *   RP7  (5) description field
 *   RP8  (5) empty state
 *   RP9  (4) large scenarios
 *   RP10 (4) null and undefined props
 *   RP11 (5) SSR renderToString
 *   RP12 (4) never-throw
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

import { RoutePanel } from '../components/RoutePanel';
import type { RouteDisplayInfo } from '../components/RoutePanel';

// ─── RP1 · Component structure ────────────────────────────────────────────────

describe('RP1 · Component structure', () => {
  it('RP1-01: renders the route-panel wrapper element', () => {
    const html = renderToString(React.createElement(RoutePanel, {}));
    expect(html).toContain('route-panel');
  });

  it('RP1-02: renders default title "API Routes" when no title prop', () => {
    const html = renderToString(React.createElement(RoutePanel, {}));
    expect(html).toContain('API Routes');
  });

  it('RP1-03: renders a custom title', () => {
    const html = renderToString(React.createElement(RoutePanel, { title: 'Server Routes' }));
    expect(html).toContain('Server Routes');
  });

  it('RP1-04: custom title overrides default', () => {
    const html = renderToString(React.createElement(RoutePanel, { title: 'My API' }));
    expect(html).not.toContain('API Routes');
    expect(html).toContain('My API');
  });

  it('RP1-05: renders route list element when routes are provided', () => {
    const routes: RouteDisplayInfo[] = [{ method: 'GET', path: '/health' }];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).toContain('route-item');
  });
});

// ─── RP2 · GET routes ─────────────────────────────────────────────────────────

describe('RP2 · GET routes', () => {
  it('RP2-01: renders GET method badge', () => {
    const routes: RouteDisplayInfo[] = [{ method: 'GET', path: '/health' }];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).toContain('>GET<');
  });

  it('RP2-02: renders GET with method-get CSS class', () => {
    const routes: RouteDisplayInfo[] = [{ method: 'GET', path: '/health' }];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).toContain('method-get');
  });

  it('RP2-03: renders GET route path', () => {
    const routes: RouteDisplayInfo[] = [{ method: 'GET', path: '/models' }];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).toContain('/models');
  });

  it('RP2-04: renders multiple GET routes', () => {
    const routes: RouteDisplayInfo[] = [
      { method: 'GET', path: '/health' },
      { method: 'GET', path: '/models' },
      { method: 'GET', path: '/providers' },
    ];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).toContain('/health');
    expect(html).toContain('/models');
    expect(html).toContain('/providers');
  });

  it('RP2-05: all built-in ApiServer GET routes render correctly', () => {
    const routes: RouteDisplayInfo[] = [
      { method: 'GET', path: '/health',    description: 'liveness probe' },
      { method: 'GET', path: '/models',    description: 'list models' },
      { method: 'GET', path: '/providers', description: 'list providers' },
      { method: 'GET', path: '/sessions',  description: 'list sessions' },
      { method: 'GET', path: '/workflows', description: 'list workflows' },
      { method: 'GET', path: '/agents',    description: 'list agents' },
    ];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).toContain('/health');
    expect(html).toContain('/agents');
    expect((html.match(/method-get/g) ?? []).length).toBe(6);
  });
});

// ─── RP3 · POST routes ────────────────────────────────────────────────────────

describe('RP3 · POST routes', () => {
  it('RP3-01: renders POST method badge', () => {
    const routes: RouteDisplayInfo[] = [{ method: 'POST', path: '/chat' }];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).toContain('>POST<');
  });

  it('RP3-02: renders POST with method-post CSS class', () => {
    const routes: RouteDisplayInfo[] = [{ method: 'POST', path: '/chat' }];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).toContain('method-post');
  });

  it('RP3-03: renders POST route path', () => {
    const routes: RouteDisplayInfo[] = [{ method: 'POST', path: '/sessions/create' }];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).toContain('/sessions/create');
  });

  it('RP3-04: renders multiple POST routes', () => {
    const routes: RouteDisplayInfo[] = [
      { method: 'POST', path: '/chat' },
      { method: 'POST', path: '/workflows/start' },
    ];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).toContain('/chat');
    expect(html).toContain('/workflows/start');
    expect((html.match(/method-post/g) ?? []).length).toBe(2);
  });

  it('RP3-05: POST method CSS class is lowercase', () => {
    const routes: RouteDisplayInfo[] = [{ method: 'POST', path: '/data' }];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).toContain('method-post');
    expect(html).not.toContain('method-POST');
  });
});

// ─── RP4 · PUT and DELETE routes ──────────────────────────────────────────────

describe('RP4 · PUT and DELETE routes', () => {
  it('RP4-01: renders PUT method badge and method-put CSS class', () => {
    const routes: RouteDisplayInfo[] = [{ method: 'PUT', path: '/routes/update' }];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).toContain('>PUT<');
    expect(html).toContain('method-put');
  });

  it('RP4-02: renders DELETE method badge and method-delete CSS class', () => {
    const routes: RouteDisplayInfo[] = [{ method: 'DELETE', path: '/sessions/abc' }];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).toContain('>DELETE<');
    expect(html).toContain('method-delete');
  });

  it('RP4-03: PUT and DELETE render different CSS classes', () => {
    const routes: RouteDisplayInfo[] = [
      { method: 'PUT',    path: '/item/1' },
      { method: 'DELETE', path: '/item/1' },
    ];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).toContain('method-put');
    expect(html).toContain('method-delete');
  });

  it('RP4-04: CRUD pattern — GET POST PUT DELETE all render distinctly', () => {
    const routes: RouteDisplayInfo[] = [
      { method: 'GET',    path: '/item' },
      { method: 'POST',   path: '/item' },
      { method: 'PUT',    path: '/item' },
      { method: 'DELETE', path: '/item' },
    ];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).toContain('method-get');
    expect(html).toContain('method-post');
    expect(html).toContain('method-put');
    expect(html).toContain('method-delete');
  });
});

// ─── RP5 · Mixed method display ───────────────────────────────────────────────

describe('RP5 · Mixed method display', () => {
  const MIXED: RouteDisplayInfo[] = [
    { method: 'GET',    path: '/health',   description: 'liveness probe' },
    { method: 'POST',   path: '/chat',     description: 'send message' },
    { method: 'PUT',    path: '/config',   description: 'update config' },
    { method: 'DELETE', path: '/sessions', description: 'clear sessions' },
  ];

  it('RP5-01: all four methods render in a mixed list', () => {
    const html = renderToString(React.createElement(RoutePanel, { routes: MIXED }));
    expect(html).toContain('>GET<');
    expect(html).toContain('>POST<');
    expect(html).toContain('>PUT<');
    expect(html).toContain('>DELETE<');
  });

  it('RP5-02: all four method CSS classes present', () => {
    const html = renderToString(React.createElement(RoutePanel, { routes: MIXED }));
    expect(html).toContain('method-get');
    expect(html).toContain('method-post');
    expect(html).toContain('method-put');
    expect(html).toContain('method-delete');
  });

  it('RP5-03: all four paths present', () => {
    const html = renderToString(React.createElement(RoutePanel, { routes: MIXED }));
    expect(html).toContain('/health');
    expect(html).toContain('/chat');
    expect(html).toContain('/config');
    expect(html).toContain('/sessions');
  });

  it('RP5-04: all four descriptions present', () => {
    const html = renderToString(React.createElement(RoutePanel, { routes: MIXED }));
    expect(html).toContain('liveness probe');
    expect(html).toContain('send message');
    expect(html).toContain('update config');
    expect(html).toContain('clear sessions');
  });

  it('RP5-05: route count matches number of rendered route-item elements', () => {
    const html = renderToString(React.createElement(RoutePanel, { routes: MIXED }));
    const items = (html.match(/route-item/g) ?? []).length;
    expect(items).toBe(4);
  });
});

// ─── RP6 · Path rendering ─────────────────────────────────────────────────────

describe('RP6 · Path rendering', () => {
  it('RP6-01: renders absolute path with leading slash', () => {
    const routes: RouteDisplayInfo[] = [{ method: 'GET', path: '/health' }];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).toContain('/health');
  });

  it('RP6-02: renders nested path', () => {
    const routes: RouteDisplayInfo[] = [{ method: 'GET', path: '/api/v1/models' }];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).toContain('/api/v1/models');
  });

  it('RP6-03: renders root path "/"', () => {
    const routes: RouteDisplayInfo[] = [{ method: 'GET', path: '/' }];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).toContain('route-path');
  });

  it('RP6-04: route-path class present on each route', () => {
    const routes: RouteDisplayInfo[] = [
      { method: 'GET',  path: '/a' },
      { method: 'POST', path: '/b' },
    ];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    const pathCount = (html.match(/route-path/g) ?? []).length;
    expect(pathCount).toBe(2);
  });

  it('RP6-05: key uses method:path format — same path different method renders both', () => {
    const routes: RouteDisplayInfo[] = [
      { method: 'GET',  path: '/resource' },
      { method: 'POST', path: '/resource' },
    ];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    const pathOccurrences = (html.match(/\/resource/g) ?? []).length;
    expect(pathOccurrences).toBeGreaterThanOrEqual(2);
  });
});

// ─── RP7 · Description field ──────────────────────────────────────────────────

describe('RP7 · Description field', () => {
  it('RP7-01: renders description when supplied', () => {
    const routes: RouteDisplayInfo[] = [{ method: 'GET', path: '/health', description: 'liveness probe' }];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).toContain('liveness probe');
    expect(html).toContain('route-description');
  });

  it('RP7-02: omits description span when description is absent', () => {
    const routes: RouteDisplayInfo[] = [{ method: 'GET', path: '/models' }];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).not.toContain('route-description');
  });

  it('RP7-03: omits description span when description is empty string', () => {
    const routes: RouteDisplayInfo[] = [{ method: 'GET', path: '/models', description: '' }];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).not.toContain('route-description');
  });

  it('RP7-04: renders description content verbatim (React-escaped)', () => {
    const routes: RouteDisplayInfo[] = [
      { method: 'POST', path: '/chat', description: 'Chat with AI assistant' },
    ];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).toContain('Chat with AI assistant');
  });

  it('RP7-05: only routes with descriptions have description spans', () => {
    const routes: RouteDisplayInfo[] = [
      { method: 'GET',  path: '/a', description: 'has description' },
      { method: 'GET',  path: '/b' },
    ];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    const descCount = (html.match(/route-description/g) ?? []).length;
    expect(descCount).toBe(1);
  });
});

// ─── RP8 · Empty state ────────────────────────────────────────────────────────

describe('RP8 · Empty state', () => {
  it('RP8-01: renders empty-state paragraph with no routes', () => {
    const html = renderToString(React.createElement(RoutePanel, {}));
    expect(html).toContain('empty-state');
    expect(html).toContain('No routes registered');
  });

  it('RP8-02: renders empty-state with explicit empty array', () => {
    const html = renderToString(React.createElement(RoutePanel, { routes: [] }));
    expect(html).toContain('No routes registered');
  });

  it('RP8-03: empty state does not contain route-item', () => {
    const html = renderToString(React.createElement(RoutePanel, { routes: [] }));
    expect(html).not.toContain('route-item');
  });

  it('RP8-04: adding a route removes the empty-state', () => {
    const html = renderToString(
      React.createElement(RoutePanel, { routes: [{ method: 'GET', path: '/x' }] }),
    );
    expect(html).not.toContain('No routes registered');
    expect(html).toContain('route-item');
  });

  it('RP8-05: empty state still renders title', () => {
    const html = renderToString(React.createElement(RoutePanel, { title: 'My Routes', routes: [] }));
    expect(html).toContain('My Routes');
    expect(html).toContain('No routes registered');
  });
});

// ─── RP9 · Large scenarios ────────────────────────────────────────────────────

describe('RP9 · Large scenarios', () => {
  it('RP9-01: renders 50 routes without error', () => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE'] as const;
    const routes: RouteDisplayInfo[] = Array.from({ length: 50 }, (_, i) => ({
      method: methods[i % 4],
      path:   `/resource/${i}`,
    }));
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).toContain('/resource/0');
    expect(html).toContain('/resource/49');
    const items = (html.match(/route-item/g) ?? []).length;
    expect(items).toBe(50);
  });

  it('RP9-02: renders 100 routes and spot-checks first and last', () => {
    const routes: RouteDisplayInfo[] = Array.from({ length: 100 }, (_, i) => ({
      method:      'GET',
      path:        `/route/${i}`,
      description: `Route number ${i}`,
    }));
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).toContain('/route/0');
    expect(html).toContain('/route/99');
    expect(html).toContain('Route number 99');
  });

  it('RP9-03: renders the six default ApiServer built-in routes correctly', () => {
    const builtIns: RouteDisplayInfo[] = [
      { method: 'GET', path: '/health',    description: 'liveness probe' },
      { method: 'GET', path: '/models',    description: 'list models' },
      { method: 'GET', path: '/providers', description: 'list providers' },
      { method: 'GET', path: '/sessions',  description: 'list sessions' },
      { method: 'GET', path: '/workflows', description: 'list workflows' },
      { method: 'GET', path: '/agents',    description: 'list agents' },
    ];
    const html = renderToString(React.createElement(RoutePanel, { routes: builtIns }));
    for (const r of builtIns) {
      expect(html).toContain(r.path!);
      expect(html).toContain(r.description!);
    }
  });

  it('RP9-04: same path with all four methods each gets a unique key', () => {
    const routes: RouteDisplayInfo[] = [
      { method: 'GET',    path: '/resource' },
      { method: 'POST',   path: '/resource' },
      { method: 'PUT',    path: '/resource' },
      { method: 'DELETE', path: '/resource' },
    ];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).toContain('method-get');
    expect(html).toContain('method-post');
    expect(html).toContain('method-put');
    expect(html).toContain('method-delete');
    const items = (html.match(/route-item/g) ?? []).length;
    expect(items).toBe(4);
  });
});

// ─── RP10 · Null and undefined props ──────────────────────────────────────────

describe('RP10 · Null and undefined props', () => {
  it('RP10-01: null routes prop renders empty-state', () => {
    const html = renderToString(React.createElement(RoutePanel, { routes: null }));
    expect(html).toContain('No routes registered');
  });

  it('RP10-02: null title prop falls back to default title', () => {
    const html = renderToString(React.createElement(RoutePanel, { title: null }));
    expect(html).toContain('API Routes');
  });

  it('RP10-03: both props null still renders valid HTML', () => {
    const html = renderToString(React.createElement(RoutePanel, { routes: null, title: null }));
    expect(html).toContain('route-panel');
    expect(html).toContain('API Routes');
    expect(html).toContain('No routes registered');
  });

  it('RP10-04: calling with no props renders default state', () => {
    const html = renderToString(React.createElement(RoutePanel, {}));
    expect(html).toContain('API Routes');
    expect(html).toContain('No routes registered');
  });
});

// ─── RP11 · SSR renderToString ────────────────────────────────────────────────

describe('RP11 · SSR renderToString', () => {
  it('RP11-01: renderToString returns a non-empty HTML string', () => {
    const html = renderToString(React.createElement(RoutePanel, {}));
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(0);
  });

  it('RP11-02: output contains no script tags', () => {
    const routes: RouteDisplayInfo[] = [{ method: 'GET', path: '/health', description: 'probe' }];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).not.toContain('<script');
  });

  it('RP11-03: HTML-special characters in path are escaped', () => {
    const routes: RouteDisplayInfo[] = [
      { method: 'GET', path: '/search?q=<script>alert(1)</script>' },
    ];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });

  it('RP11-04: HTML-special characters in description are escaped', () => {
    const routes: RouteDisplayInfo[] = [
      { method: 'POST', path: '/data', description: '<b>bold</b> & "quoted"' },
    ];
    const html = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;b&gt;');
  });

  it('RP11-05: renderToString output is deterministic for the same input', () => {
    const routes: RouteDisplayInfo[] = [{ method: 'GET', path: '/health', description: 'probe' }];
    const html1 = renderToString(React.createElement(RoutePanel, { routes }));
    const html2 = renderToString(React.createElement(RoutePanel, { routes }));
    expect(html1).toBe(html2);
  });
});

// ─── RP12 · Never-throw ───────────────────────────────────────────────────────

describe('RP12 · Never-throw', () => {
  it('RP12-01: never throws with null items inside the routes array', () => {
    const badRoutes = [null, undefined, null] as unknown as RouteDisplayInfo[];
    expect(() =>
      renderToString(React.createElement(RoutePanel, { routes: badRoutes }))
    ).not.toThrow();
  });

  it('RP12-02: never throws with fully malformed route objects', () => {
    const badRoutes = [
      42, '', false, {}, { method: null, path: null }, { method: 123, path: 456 },
    ] as unknown as RouteDisplayInfo[];
    expect(() =>
      renderToString(React.createElement(RoutePanel, { routes: badRoutes }))
    ).not.toThrow();
  });

  it('RP12-03: never throws when method is an unknown string', () => {
    const routes: RouteDisplayInfo[] = [
      { method: 'PATCH' as never, path: '/resource' },
      { method: 'OPTIONS' as never, path: '/resource' },
    ];
    expect(() =>
      renderToString(React.createElement(RoutePanel, { routes }))
    ).not.toThrow();
  });

  it('RP12-04: never throws for any combination of null/undefined/empty props', () => {
    const cases = [
      {},
      { routes: null },
      { title: null },
      { routes: null, title: null },
      { routes: [] },
      { routes: [null as unknown as RouteDisplayInfo] },
    ];
    for (const props of cases) {
      expect(() =>
        renderToString(React.createElement(RoutePanel, props))
      ).not.toThrow();
    }
  });
});
