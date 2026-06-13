/**
 * Shared test fixtures — minimal but type-complete ProcurementPackage instances.
 * Use these across all test files to avoid duplication.
 */
import type { ProcurementPackage, ProcurementItem } from '../demoData';

const baseItem = (id: string, quantity: number, unitPrice: number, s1: number, s2: number, s3: number): ProcurementItem => ({
  id,
  name: `Item ${id}`,
  unit: 'Cái',
  quantity,
  unitPrice,
  specs: 'Test spec',
  supplier1Price: s1,
  supplier2Price: s2,
  supplier3Price: s3,
});

const baseDates = {
  dateProposal: '2026-01-02',
  dateSurvey: '2026-01-05',
  dateQuotes: '2026-01-07',
  dateCompare: '2026-01-09',
  dateKhlcnt: '2026-01-12',
  dateKhlcntApprove: '2026-01-14',
  dateExpertEstablish: '2026-01-16',
  dateDocIssue: '2026-01-19',
  dateBidClose: '2026-01-26',
  dateEvaluate: '2026-01-28',
  dateAppraise: '2026-01-30',
  dateResultProposal: '2026-02-02',
  dateResultApprove: '2026-02-04',
  dateContractSign: '2026-02-06',
  dateDelivery: '2026-02-20',
  dateAcceptance: '2026-02-25',
  dateLiquidation: '2026-02-27',
  dateAssetIncrease: '2026-03-02',
};

const baseIdentity = {
  rectorName: 'TS. Nguyễn Hồng Giang',
  departmentName: 'Phòng Quản trị đời sống',
  departmentCode: 'QTDS',
  expertTeamLeader: 'Ông Trần Văn Nam (Trưởng phòng QTDS - Tổ trưởng)',
  expertTeamMember1: 'Bà Nguyễn Thị Mai (Chuyên viên - Thành viên)',
  expertTeamMember2: 'Ông Lê Hoàng Hải (Giảng viên - Thành viên)',
  appraisalLeader: 'Bà Phạm Thị Dung (Trưởng phòng TC-KH - Tổ trưởng)',
  appraisalMember: 'Ông Vũ Minh Tuấn (Chuyên viên TC-KH - Thành viên)',
  supplier1Address: 'Số 1, Đường A, Bắc Giang',
  supplier1TaxCode: '2400000001',
  supplier1Representative: 'Ông Nguyễn Văn A',
  supplier1Position: 'Giám đốc',
  supplier2Address: 'Số 2, Đường B, Hà Nội',
  supplier3Address: 'Số 3, Đường C, Hà Nội',
};

/** Supplier 1 is cheapest — winner = supplier1Name. */
export const pkgS1Wins: ProcurementPackage = {
  id: 'test-s1',
  packageName: 'Gói test S1 rẻ nhất',
  packageCode: 'TEST-S1',
  fundingSource: 'autonomy_fund',
  fundingSourceName: 'Quỹ phát triển sự nghiệp',
  budgetYear: 2026,
  ...baseIdentity,
  supplier1Name: 'Công ty Alpha',
  supplier2Name: 'Công ty Beta',
  supplier3Name: 'Công ty Gamma',
  contractDurationDays: 15,
  ...baseDates,
  items: [baseItem('i1', 10, 1_000_000, 1_000_000, 1_200_000, 1_300_000)],
};

/** Supplier 2 is cheapest — winner = supplier2Name.
 *  unitPrice (1,100,000) differs from supplier2Price (1,000,000) intentionally
 *  so that the budget total ≠ winner quoted total in Doc 17 price tests. */
export const pkgS2Wins: ProcurementPackage = {
  ...pkgS1Wins,
  id: 'test-s2',
  packageName: 'Gói test S2 rẻ nhất',
  packageCode: 'TEST-S2',
  items: [baseItem('i2', 10, 1_100_000, 1_200_000, 1_000_000, 1_300_000)],
};

/** Supplier 3 is cheapest — winner = supplier3Name. */
export const pkgS3Wins: ProcurementPackage = {
  ...pkgS1Wins,
  id: 'test-s3',
  packageName: 'Gói test S3 rẻ nhất',
  packageCode: 'TEST-S3',
  items: [baseItem('i3', 10, 1_000_000, 1_300_000, 1_200_000, 1_000_000)],
};

/** All suppliers have equal prices — tie resolved by rank 1. */
export const pkgTie: ProcurementPackage = {
  ...pkgS1Wins,
  id: 'test-tie',
  packageName: 'Gói test hòa giá',
  packageCode: 'TEST-TIE',
  items: [baseItem('i4', 10, 1_000_000, 1_000_000, 1_000_000, 1_000_000)],
};

/** Multi-item package where supplier 2 wins on aggregate. */
export const pkgMultiItemS2Wins: ProcurementPackage = {
  ...pkgS1Wins,
  id: 'test-multi-s2',
  packageName: 'Gói test nhiều mục S2 thắng',
  packageCode: 'TEST-MULTI-S2',
  items: [
    baseItem('m1', 5, 2_000_000, 2_000_000, 1_800_000, 2_100_000),
    baseItem('m2', 3, 1_000_000, 1_000_000, 1_000_000, 900_000),
    // S1 total: 5*2M + 3*1M = 13M; S2 total: 5*1.8M + 3*1M = 12M; S3 total: 5*2.1M + 3*0.9M = 13.2M
    // Winner: S2
  ],
};

/** Builds a package whose items sum to `targetTotal` via unitPrice (1 item × quantity). */
export const makePkgWithTotal = (targetTotal: number): ProcurementPackage => ({
  ...pkgS1Wins,
  id: `test-total-${targetTotal}`,
  packageName: `Gói test giá ${targetTotal}`,
  packageCode: `TEST-${targetTotal}`,
  items: [baseItem('x', 1, targetTotal, targetTotal, targetTotal + 1, targetTotal + 2)],
});

/** Package with XSS payload embedded in supplier names. */
export const pkgXss: ProcurementPackage = {
  ...pkgS1Wins,
  id: 'test-xss',
  packageName: '<script>alert("xss-package")</script>Gói thầu',
  packageCode: 'TEST-XSS',
  supplier1Name: '<script>alert("xss-s1")</script>Công ty XSS',
  supplier2Name: '<img src=x onerror="alert(1)">Công ty Ảnh',
  supplier3Name: 'javascript:alert(1)',
};
