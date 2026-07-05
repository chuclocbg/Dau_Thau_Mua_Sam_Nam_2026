/**
 * Factory functions for creating master data repository sets.
 * seedDefaultData() pre-populates Vietnamese public procurement defaults
 * so any downstream code can resolve authority limits, package types, and
 * methods without hardcoding them.
 */

import type {
  ApprovalAuthority, PackageType, ProcurementMethod, FundSource, DocumentTemplate,
} from './masterdataTypes';
import type { MasterDataRepositories } from './masterdataRepository';
import { MemoryMasterDataRepository } from './memoryMasterData';
import { PrismaMasterDataRepository } from './prismaMasterData';

// ─── Factories ────────────────────────────────────────────────────────────────

export function createMemoryMasterDataRepositories(): MasterDataRepositories {
  return {
    departments:           new MemoryMasterDataRepository(),
    employees:             new MemoryMasterDataRepository(),
    approvalAuthorities:   new MemoryMasterDataRepository(),
    fundSources:           new MemoryMasterDataRepository(),
    budgetYears:           new MemoryMasterDataRepository(),
    vendors:               new MemoryMasterDataRepository(),
    procurementCategories: new MemoryMasterDataRepository(),
    packageTypes:          new MemoryMasterDataRepository(),
    procurementMethods:    new MemoryMasterDataRepository(),
    documentTemplates:     new MemoryMasterDataRepository(),
  };
}

export function createPrismaMasterDataRepositories(): MasterDataRepositories {
  return {
    departments:           new PrismaMasterDataRepository('mdDepartment'),
    employees:             new PrismaMasterDataRepository('mdEmployee'),
    approvalAuthorities:   new PrismaMasterDataRepository('mdApprovalAuthority'),
    fundSources:           new PrismaMasterDataRepository('mdFundSource'),
    budgetYears:           new PrismaMasterDataRepository('mdBudgetYear'),
    vendors:               new PrismaMasterDataRepository('mdVendor'),
    procurementCategories: new PrismaMasterDataRepository('mdProcurementCategory'),
    packageTypes:          new PrismaMasterDataRepository('mdPackageType'),
    procurementMethods:    new PrismaMasterDataRepository('mdProcurementMethod'),
    documentTemplates:     new PrismaMasterDataRepository('mdDocumentTemplate'),
  };
}

// ─── Default seed data (Vietnamese public procurement) ────────────────────────

/** Seed repositories with standard Vietnamese procurement master data. */
export async function seedDefaultData(repos: MasterDataRepositories): Promise<void> {
  await Promise.all([
    seedApprovalAuthorities(repos.approvalAuthorities),
    seedPackageTypes(repos.packageTypes),
    seedProcurementMethods(repos.procurementMethods),
    seedFundSources(repos.fundSources),
    seedDocumentTemplates(repos.documentTemplates),
  ]);
}

// Approval authorities — thresholds per NĐ 214/2025 Điều 76
async function seedApprovalAuthorities(
  repo: MasterDataRepositories['approvalAuthorities'],
): Promise<void> {
  const authorities: Array<Omit<ApprovalAuthority, 'id' | 'createdAt' | 'updatedAt'>> = [
    {
      code: 'UNIT_HEAD', name: 'Người đứng đầu đơn vị', level: 1,
      maxValue: 5_000_000_000, isActive: true, isArchived: false,
    },
    {
      code: 'MINISTER', name: 'Bộ trưởng / Thủ trưởng cơ quan ngang Bộ', level: 2,
      maxValue: 50_000_000_000, isActive: true, isArchived: false,
    },
    {
      code: 'PRIME_MINISTER', name: 'Thủ tướng Chính phủ', level: 3,
      maxValue: Number.MAX_SAFE_INTEGER, isActive: true, isArchived: false,
    },
  ];
  for (const a of authorities) await repo.create(a);
}

// Package types — Điều 4 khoản 25 Luật 22/2023
async function seedPackageTypes(
  repo: MasterDataRepositories['packageTypes'],
): Promise<void> {
  const types: Array<Omit<PackageType, 'id' | 'createdAt' | 'updatedAt'>> = [
    { code: 'GOODS',        name: 'Hàng hóa',              category: 'Mua sắm hàng hóa',    isActive: true, isArchived: false },
    { code: 'SERVICE',      name: 'Dịch vụ phi tư vấn',    category: 'Dịch vụ',             isActive: true, isArchived: false },
    { code: 'CONSULTING',   name: 'Dịch vụ tư vấn',        category: 'Tư vấn',              isActive: true, isArchived: false },
    { code: 'CONSTRUCTION', name: 'Xây lắp',               category: 'Xây dựng',            isActive: true, isArchived: false },
    { code: 'MIXED',        name: 'Hỗn hợp',               category: 'Gói thầu hỗn hợp',   isActive: true, isArchived: false },
  ];
  for (const t of types) await repo.create(t);
}

// Procurement methods — Điều 21 Luật 22/2023
async function seedProcurementMethods(
  repo: MasterDataRepositories['procurementMethods'],
): Promise<void> {
  const methods: Array<Omit<ProcurementMethod, 'id' | 'createdAt' | 'updatedAt'>> = [
    { code: 'OPEN_TENDER',        name: 'Đấu thầu rộng rãi',       applicablePackageTypeCodes: ['GOODS','SERVICE','CONSULTING','CONSTRUCTION','MIXED'], isActive: true, isArchived: false },
    { code: 'LIMITED_TENDER',     name: 'Đấu thầu hạn chế',        applicablePackageTypeCodes: ['GOODS','SERVICE','CONSTRUCTION'],                       isActive: true, isArchived: false },
    { code: 'DIRECT_APPOINTMENT', name: 'Chỉ định thầu',            applicablePackageTypeCodes: ['GOODS','SERVICE','CONSULTING','CONSTRUCTION','MIXED'], isActive: true, isArchived: false },
    { code: 'COMPETITIVE_QUOTE',  name: 'Chào hàng cạnh tranh',     applicablePackageTypeCodes: ['GOODS','SERVICE'],                                     isActive: true, isArchived: false },
    { code: 'DIRECT_PROCUREMENT', name: 'Mua sắm trực tiếp',        applicablePackageTypeCodes: ['GOODS','SERVICE'],                                     isActive: true, isArchived: false },
    { code: 'SELF_EXECUTION',     name: 'Tự thực hiện',             applicablePackageTypeCodes: ['CONSTRUCTION','SERVICE'],                              isActive: true, isArchived: false },
    { code: 'COMMUNITY',          name: 'Cộng đồng tham gia thực hiện', applicablePackageTypeCodes: ['CONSTRUCTION'],                                    isActive: true, isArchived: false },
  ];
  for (const m of methods) await repo.create(m);
}

// Fund sources — Điều 4 Luật 22/2023
async function seedFundSources(
  repo: MasterDataRepositories['fundSources'],
): Promise<void> {
  const sources: Array<Omit<FundSource, 'id' | 'createdAt' | 'updatedAt'>> = [
    { code: 'STATE',      name: 'Vốn nhà nước',         type: 'STATE',      isActive: true, isArchived: false },
    { code: 'ODA',        name: 'Vốn ODA',              type: 'ODA',        isActive: true, isArchived: false },
    { code: 'PPP',        name: 'Vốn PPP',              type: 'PPP',        isActive: true, isArchived: false },
    { code: 'ENTERPRISE', name: 'Vốn doanh nghiệp nhà nước', type: 'ENTERPRISE', isActive: true, isArchived: false },
  ];
  for (const s of sources) await repo.create(s);
}

// Document templates — key procurement documents
async function seedDocumentTemplates(
  repo: MasterDataRepositories['documentTemplates'],
): Promise<void> {
  const templates: Array<Omit<DocumentTemplate, 'id' | 'createdAt' | 'updatedAt'>> = [
    {
      code: 'ke-hoach-lua-chon-nha-thau', name: 'Kế hoạch lựa chọn nhà thầu (KHLCNT)',
      templateType: 'KHLCNT', content: '[KHLCNT template — to be populated]',
      applicableStates: ['METHOD_SELECTED'], isActive: true, isArchived: false,
    },
    {
      code: 'ho-so-moi-thau', name: 'Hồ sơ mời thầu (HSMT)',
      templateType: 'HSMT', content: '[HSMT template — to be populated]',
      applicableStates: ['DOCUMENT_PREPARATION'], isActive: true, isArchived: false,
    },
    {
      code: 'bien-ban-danh-gia', name: 'Biên bản đánh giá hồ sơ dự thầu',
      templateType: 'BBDG', content: '[BBDG template — to be populated]',
      applicableStates: ['EVALUATION'], isActive: true, isArchived: false,
    },
    {
      code: 'quyet-dinh-phe-duyet-ket-qua', name: 'Quyết định phê duyệt kết quả LCNT',
      templateType: 'QDPD', content: '[QDPD template — to be populated]',
      applicableStates: ['APPROVAL'], isActive: true, isArchived: false,
    },
    {
      code: 'bien-ban-nghiem-thu', name: 'Biên bản nghiệm thu',
      templateType: 'BBNT', content: '[BBNT template — to be populated]',
      applicableStates: ['ACCEPTANCE'], isActive: true, isArchived: false,
    },
  ];
  for (const t of templates) await repo.create(t);
}
