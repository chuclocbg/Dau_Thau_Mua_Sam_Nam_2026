/**
 * Tests — P1-06: HTML sanitization via DOMPurify.
 *
 * App.tsx wraps every getHtml() call with DOMPurify.sanitize() before passing
 * the result to dangerouslySetInnerHTML. These tests verify:
 *
 * 1. DOMPurify is installed and functional in jsdom.
 * 2. Known XSS vectors in document HTML output are neutralised.
 * 3. Legitimate Vietnamese text content is preserved after sanitization.
 *
 * Tests operate at the same layer as App.tsx: call getHtml() then sanitize().
 * This is an end-to-end test of the sanitization chain, not just a unit test
 * of DOMPurify itself.
 */
import { describe, it, expect } from 'vitest';
import DOMPurify from 'dompurify';
import { documentTemplates } from '../docTemplates';
import { pkgXss, pkgS1Wins, pkgS2Wins } from './fixtures';

// ---------------------------------------------------------------------------
// DOMPurify baseline — confirms jsdom environment is set up correctly
// ---------------------------------------------------------------------------
describe('DOMPurify — baseline sanitization in jsdom', () => {
  it('strips <script> tags', () => {
    const dirty = '<p>Hello</p><script>alert(1)</script>';
    expect(DOMPurify.sanitize(dirty)).not.toContain('<script>');
  });

  it('strips onerror event handlers', () => {
    const dirty = '<img src=x onerror="alert(1)">';
    const clean = DOMPurify.sanitize(dirty);
    expect(clean).not.toContain('onerror');
  });

  it('strips javascript: href', () => {
    const dirty = '<a href="javascript:alert(1)">click</a>';
    const clean = DOMPurify.sanitize(dirty);
    expect(clean).not.toContain('javascript:');
  });

  it('preserves safe HTML elements and attributes', () => {
    const safe = '<p class="doc-content"><b>Tên gói thầu:</b> Mua sắm máy tính</p>';
    const clean = DOMPurify.sanitize(safe);
    expect(clean).toContain('Mua sắm máy tính');
    expect(clean).toContain('<b>');
  });
});

// ---------------------------------------------------------------------------
// Document templates — XSS in package fields is neutralized
// ---------------------------------------------------------------------------
describe('Document templates — XSS payloads in package fields are neutralized', () => {
  const docsToTest = [1, 6, 14, 15, 16, 17, 25];

  for (const docId of docsToTest) {
    it(`Doc ${docId}: <script> tag injected via supplier1Name is stripped`, () => {
      const doc = documentTemplates.find(d => d.id === docId)!;
      const rawHtml = doc.getHtml(pkgXss, 'COMPETITIVE_SHOPPING');
      const sanitized = DOMPurify.sanitize(rawHtml);
      // The <script> element itself must be gone
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</script>');
      // NOTE: "javascript:alert(1)" as plain TEXT CONTENT is not an XSS vector —
      // DOMPurify correctly leaves it as visible text. Only attribute-based
      // javascript: URIs are dangerous and stripped.
    });

    it(`Doc ${docId}: onerror event handler injected via supplier2Name is stripped`, () => {
      const doc = documentTemplates.find(d => d.id === docId)!;
      const rawHtml = doc.getHtml(pkgXss, 'COMPETITIVE_SHOPPING');
      const sanitized = DOMPurify.sanitize(rawHtml);
      expect(sanitized).not.toContain('onerror');
    });
  }
});

// ---------------------------------------------------------------------------
// Sanitization does not strip legitimate content
// ---------------------------------------------------------------------------
describe('Sanitization — legitimate Vietnamese content is preserved', () => {
  it('package name survives sanitization', () => {
    const doc1 = documentTemplates.find(d => d.id === 1)!;
    const rawHtml = doc1.getHtml(pkgS1Wins, 'COMPETITIVE_SHOPPING');
    const sanitized = DOMPurify.sanitize(rawHtml);
    expect(sanitized).toContain(pkgS1Wins.packageName);
  });

  it('supplier names survive sanitization when they contain no scripts', () => {
    const doc6 = documentTemplates.find(d => d.id === 6)!;
    const rawHtml = doc6.getHtml(pkgS1Wins, 'COMPETITIVE_SHOPPING');
    const sanitized = DOMPurify.sanitize(rawHtml);
    expect(sanitized).toContain(pkgS1Wins.supplier1Name);
    expect(sanitized).toContain(pkgS1Wins.supplier2Name);
    expect(sanitized).toContain(pkgS1Wins.supplier3Name);
  });

  it('winner name from getWinnerSupplier survives sanitization', () => {
    const doc17 = documentTemplates.find(d => d.id === 17)!;
    const rawHtml = doc17.getHtml(pkgS2Wins, 'COMPETITIVE_SHOPPING');
    const sanitized = DOMPurify.sanitize(rawHtml);
    expect(sanitized).toContain(pkgS2Wins.supplier2Name);
  });

  it('all 24 existing documents produce non-empty HTML after sanitization', () => {
    for (const doc of documentTemplates) {
      const rawHtml = doc.getHtml(pkgS1Wins, 'COMPETITIVE_SHOPPING');
      const sanitized = DOMPurify.sanitize(rawHtml);
      expect(sanitized.trim().length, `Doc ${doc.id} produced empty HTML after sanitize`).toBeGreaterThan(0);
    }
  });
});
