/**
 * Integration tests — Doc 28 catalog name (PRIORITY2_DOMAIN_AUDIT.md A.3).
 *
 * Before this fix, this document's catalog name was "Biên bản mở thầu
 * (chào hàng cạnh tranh)" -- parenthesizing one specific procurement
 * method -- even though getCategory marks it required for both
 * COMPETITIVE_SHOPPING and OPEN_BIDDING. A method-specific label on a
 * document issued for two different methods is a naming/scope
 * inconsistency a careful reviewer would flag, even though (unlike
 * Document 27) the generated content itself never hardcodes the method
 * name -- only the catalog label was wrong.
 *
 * After this fix, the catalog name is "Biên bản mở thầu" (method-neutral,
 * matching Điều 30 Luật Đấu thầu's own general bid-opening terminology,
 * which this document already cites). Applicability, content, and legal
 * citations are all unchanged.
 */
import { describe, it, expect } from 'vitest';
import { documentTemplates } from '../docTemplates';
import { pkgS1Wins } from './fixtures';

const doc28 = documentTemplates.find(d => d.id === 28)!;

describe('Doc 28 — catalog name (the fix)', () => {
  it('name is method-neutral "Biên bản mở thầu" (was "Biên bản mở thầu (chào hàng cạnh tranh)")', () => {
    expect(doc28.name).toBe('Biên bản mở thầu');
  });
});

describe('Doc 28 — applicability gate unchanged', () => {
  it('is required for COMPETITIVE_SHOPPING', () => {
    expect(doc28.getCategory('COMPETITIVE_SHOPPING')).toBe('required');
  });
  it('is required for OPEN_BIDDING', () => {
    expect(doc28.getCategory('OPEN_BIDDING')).toBe('required');
  });
  it('is not applicable for DIRECT_50 and DIRECT_SELECTION_SIMPLIFIED', () => {
    expect(doc28.getCategory('DIRECT_50')).toBe('not_applicable');
    expect(doc28.getCategory('DIRECT_SELECTION_SIMPLIFIED')).toBe('not_applicable');
  });
});

describe('Doc 28 — content and citation preserved', () => {
  it('HTML still cites Điều 30 Luật Đấu thầu (unrelated citation preserved)', () => {
    const html = doc28.getHtml(pkgS1Wins, 'COMPETITIVE_SHOPPING');
    expect(html).toContain('Điều 30 Luật Đấu thầu số 22/2023/QH15');
  });

  it('HTML renders without throwing for both applicable methods', () => {
    expect(() => doc28.getHtml(pkgS1Wins, 'COMPETITIVE_SHOPPING')).not.toThrow();
    expect(() => doc28.getHtml(pkgS1Wins, 'OPEN_BIDDING')).not.toThrow();
  });
});
