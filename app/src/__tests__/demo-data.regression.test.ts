/**
 * Regression tests — P1-07 (Gói 4 date clustering) + P1-08 (delivery/acceptance gap).
 *
 * P1-07: Demo Gói 4 previously had 5 sequential approval milestones all on the
 *        same Saturday 2026-06-13, a textbook backdated-document pattern that
 *        would trigger an immediate audit finding. Dates are now spread realistically.
 *
 * P1-08: Demo Gói 1 (computers/networking) and Gói 3 (lab equipment) previously
 *        had dateDelivery === dateAcceptance, which is physically impossible for
 *        complex equipment requiring installation, configuration, and calibration.
 *        Gói 2 (AC maintenance service) is a legitimate exception where same-day
 *        delivery and acceptance is acceptable.
 */
import { describe, it, expect } from 'vitest';
import { demoPackages } from '../demoData';

const pkg1 = demoPackages.find(p => p.id === 'pkg-1')!;
const pkg2 = demoPackages.find(p => p.id === 'pkg-2')!;
const pkg3 = demoPackages.find(p => p.id === 'pkg-3')!;
const pkg4 = demoPackages.find(p => p.id === 'pkg-4')!;

const daysBetween = (a: string, b: string) =>
  (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24);

// ---------------------------------------------------------------------------
// P1-07: Gói 4 — no date clustering on a single calendar day
// ---------------------------------------------------------------------------
describe('P1-07 — Gói 4: date sequence is realistic (not backdated)', () => {
  it('all 4 demo packages are present', () => {
    expect(pkg1).toBeDefined();
    expect(pkg2).toBeDefined();
    expect(pkg3).toBeDefined();
    expect(pkg4).toBeDefined();
  });

  it('dateDocIssue is before dateBidClose', () => {
    expect(daysBetween(pkg4.dateDocIssue, pkg4.dateBidClose)).toBeGreaterThan(0);
  });

  it('bid period (docIssue → bidClose) is at least 5 calendar days', () => {
    expect(daysBetween(pkg4.dateDocIssue, pkg4.dateBidClose)).toBeGreaterThanOrEqual(5);
  });

  it('dateEvaluate is after dateBidClose', () => {
    expect(daysBetween(pkg4.dateBidClose, pkg4.dateEvaluate)).toBeGreaterThan(0);
  });

  it('dateAppraise is after dateEvaluate', () => {
    expect(daysBetween(pkg4.dateEvaluate, pkg4.dateAppraise)).toBeGreaterThanOrEqual(0);
  });

  it('dateResultProposal is after dateAppraise', () => {
    expect(daysBetween(pkg4.dateAppraise, pkg4.dateResultProposal)).toBeGreaterThanOrEqual(0);
  });

  it('dateResultApprove is after dateResultProposal', () => {
    expect(daysBetween(pkg4.dateResultProposal, pkg4.dateResultApprove)).toBeGreaterThanOrEqual(0);
  });

  it('dateContractSign is after dateResultApprove', () => {
    expect(daysBetween(pkg4.dateResultApprove, pkg4.dateContractSign)).toBeGreaterThanOrEqual(0);
  });

  it('not all of evaluate/appraise/proposal/approve on the same day', () => {
    const cluster = new Set([
      pkg4.dateEvaluate,
      pkg4.dateAppraise,
      pkg4.dateResultProposal,
      pkg4.dateResultApprove,
    ]);
    // If all 4 are the same date that is the backdating pattern we fixed
    expect(cluster.size).toBeGreaterThan(1);
  });

  it('full date sequence is non-decreasing', () => {
    const sequence = [
      pkg4.dateProposal,
      pkg4.dateSurvey,
      pkg4.dateQuotes,
      pkg4.dateCompare,
      pkg4.dateKhlcnt,
      pkg4.dateKhlcntApprove,
      pkg4.dateExpertEstablish,
      pkg4.dateDocIssue,
      pkg4.dateBidClose,
      pkg4.dateEvaluate,
      pkg4.dateAppraise,
      pkg4.dateResultProposal,
      pkg4.dateResultApprove,
      pkg4.dateContractSign,
      pkg4.dateDelivery,
      pkg4.dateAcceptance,
      pkg4.dateLiquidation,
      pkg4.dateAssetIncrease,
    ];
    for (let i = 1; i < sequence.length; i++) {
      expect(
        daysBetween(sequence[i - 1], sequence[i]),
        `Date ${i - 1} (${sequence[i - 1]}) must not be after date ${i} (${sequence[i]})`
      ).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// P1-08: Delivery / acceptance gaps for complex equipment
// ---------------------------------------------------------------------------
describe('P1-08 — Gói 1: computers+networking need ≥5 days for install/config', () => {
  it('dateAcceptance is strictly after dateDelivery', () => {
    expect(daysBetween(pkg1.dateDelivery, pkg1.dateAcceptance)).toBeGreaterThan(0);
  });

  it('acceptance gap is at least 5 calendar days', () => {
    expect(daysBetween(pkg1.dateDelivery, pkg1.dateAcceptance)).toBeGreaterThanOrEqual(5);
  });

  it('dateLiquidation is after dateAcceptance', () => {
    expect(daysBetween(pkg1.dateAcceptance, pkg1.dateLiquidation)).toBeGreaterThan(0);
  });

  it('dateAssetIncrease is after dateLiquidation', () => {
    expect(daysBetween(pkg1.dateLiquidation, pkg1.dateAssetIncrease)).toBeGreaterThanOrEqual(0);
  });
});

describe('P1-08 — Gói 3: lab equipment needs ≥7 days for install/calibration', () => {
  it('dateAcceptance is strictly after dateDelivery', () => {
    expect(daysBetween(pkg3.dateDelivery, pkg3.dateAcceptance)).toBeGreaterThan(0);
  });

  it('acceptance gap is at least 7 calendar days', () => {
    expect(daysBetween(pkg3.dateDelivery, pkg3.dateAcceptance)).toBeGreaterThanOrEqual(7);
  });

  it('dateLiquidation is after dateAcceptance', () => {
    expect(daysBetween(pkg3.dateAcceptance, pkg3.dateLiquidation)).toBeGreaterThan(0);
  });
});

describe('P1-08 — Gói 2: AC maintenance service may have same-day acceptance', () => {
  it('dateAcceptance is on or after dateDelivery (service — no gap required)', () => {
    expect(daysBetween(pkg2.dateDelivery, pkg2.dateAcceptance)).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// All packages: full date sequence must be non-decreasing
// ---------------------------------------------------------------------------
describe('All demo packages — full date sequences are non-decreasing', () => {
  const packages = [pkg1, pkg2, pkg3, pkg4];

  for (const pkg of packages) {
    it(`${pkg.id}: date sequence is non-decreasing`, () => {
      const sequence = [
        pkg.dateProposal,
        pkg.dateSurvey,
        pkg.dateQuotes,
        pkg.dateCompare,
        pkg.dateKhlcnt,
        pkg.dateKhlcntApprove,
        pkg.dateExpertEstablish,
        pkg.dateDocIssue,
        pkg.dateBidClose,
        pkg.dateEvaluate,
        pkg.dateAppraise,
        pkg.dateResultProposal,
        pkg.dateResultApprove,
        pkg.dateContractSign,
        pkg.dateDelivery,
        pkg.dateAcceptance,
        pkg.dateLiquidation,
        pkg.dateAssetIncrease,
      ];
      for (let i = 1; i < sequence.length; i++) {
        expect(
          daysBetween(sequence[i - 1], sequence[i]),
          `${pkg.id}: sequence[${i - 1}]=${sequence[i - 1]} must not be after sequence[${i}]=${sequence[i]}`
        ).toBeGreaterThanOrEqual(0);
      }
    });
  }
});
