/**
 * Unit tests — P1-04: getWinnerSupplier()
 *
 * Before P1-04 there was no such function — Docs 14–17 always hardcoded
 * supplier1Name as the winner regardless of actual prices.
 * These tests verify the selection logic across all rank outcomes.
 */
import { describe, it, expect } from 'vitest';
import { getWinnerSupplier } from '../docTemplates';
import { pkgS1Wins, pkgS2Wins, pkgS3Wins, pkgTie, pkgMultiItemS2Wins } from './fixtures';

describe('getWinnerSupplier — rank 1 wins', () => {
  it('returns supplier1Name when supplier 1 has lowest total', () => {
    const winner = getWinnerSupplier(pkgS1Wins);
    expect(winner.name).toBe(pkgS1Wins.supplier1Name);
    expect(winner.rank).toBe(1);
  });

  it('total equals sum of quantity × supplier1Price', () => {
    const expected = pkgS1Wins.items.reduce((s, i) => s + i.quantity * i.supplier1Price, 0);
    expect(getWinnerSupplier(pkgS1Wins).total).toBe(expected);
  });
});

describe('getWinnerSupplier — rank 2 wins', () => {
  it('returns supplier2Name when supplier 2 has lowest total', () => {
    const winner = getWinnerSupplier(pkgS2Wins);
    expect(winner.name).toBe(pkgS2Wins.supplier2Name);
    expect(winner.rank).toBe(2);
  });

  it('total equals sum of quantity × supplier2Price', () => {
    const expected = pkgS2Wins.items.reduce((s, i) => s + i.quantity * i.supplier2Price, 0);
    expect(getWinnerSupplier(pkgS2Wins).total).toBe(expected);
  });

  it('does NOT return supplier1Name when supplier 2 is cheaper', () => {
    expect(getWinnerSupplier(pkgS2Wins).name).not.toBe(pkgS2Wins.supplier1Name);
  });
});

describe('getWinnerSupplier — rank 3 wins', () => {
  it('returns supplier3Name when supplier 3 has lowest total', () => {
    const winner = getWinnerSupplier(pkgS3Wins);
    expect(winner.name).toBe(pkgS3Wins.supplier3Name);
    expect(winner.rank).toBe(3);
  });

  it('total equals sum of quantity × supplier3Price', () => {
    const expected = pkgS3Wins.items.reduce((s, i) => s + i.quantity * i.supplier3Price, 0);
    expect(getWinnerSupplier(pkgS3Wins).total).toBe(expected);
  });
});

describe('getWinnerSupplier — tie-breaking', () => {
  it('returns rank 1 on a three-way tie (stable first wins)', () => {
    const winner = getWinnerSupplier(pkgTie);
    expect(winner.rank).toBe(1);
    expect(winner.name).toBe(pkgTie.supplier1Name);
  });
});

describe('getWinnerSupplier — multi-item aggregation', () => {
  it('sums across all items before comparing suppliers', () => {
    // S1 total: 5*2,000,000 + 3*1,000,000 = 13,000,000
    // S2 total: 5*1,800,000 + 3*1,000,000 = 12,000,000  ← winner
    // S3 total: 5*2,100,000 + 3*900,000   = 13,200,000
    const winner = getWinnerSupplier(pkgMultiItemS2Wins);
    expect(winner.name).toBe(pkgMultiItemS2Wins.supplier2Name);
    expect(winner.rank).toBe(2);
    expect(winner.total).toBe(12_000_000);
  });
});

describe('getWinnerSupplier — return shape', () => {
  it('always returns an object with name, total, rank', () => {
    const winner = getWinnerSupplier(pkgS1Wins);
    expect(typeof winner.name).toBe('string');
    expect(typeof winner.total).toBe('number');
    expect([1, 2, 3]).toContain(winner.rank);
  });

  it('total is always a positive number', () => {
    for (const pkg of [pkgS1Wins, pkgS2Wins, pkgS3Wins]) {
      expect(getWinnerSupplier(pkg).total).toBeGreaterThan(0);
    }
  });
});
