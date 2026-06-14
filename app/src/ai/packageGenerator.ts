import type { ProcurementPackage } from '../demoData';

export interface AISuggestion {
  packageName: string;
  packageCode: string;
  fundingSource: ProcurementPackage['fundingSource'];
  fundingSourceName: string;
  packageType: NonNullable<ProcurementPackage['packageType']>;
  contractType: NonNullable<ProcurementPackage['contractType']>;
  estimatedTotal: number;
  contractDurationDays: number;
  procurementMethodHint: string;
  detectedCategory: string;
  confidence: 'high' | 'medium' | 'low';
  notes: string[];
}

// Strip Vietnamese diacritics for keyword matching
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')   // đ → d (NFD decomposed form)
    .replace(/Đ/g, 'D')   // Đ → D
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/\s+/g, ' ')
    .trim();
}

// Digits removed so "bảo trì 80 điều hòa" → "bao tri  dieu hoa" still matches "bao tri dieu hoa"
function normalizeForKeywords(text: string): string {
  return normalize(text).replace(/\d+/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractQuantity(text: string): number {
  const m = text.match(/\b(\d+)\b/);
  return m ? parseInt(m[1], 10) : 1;
}

interface CategoryRule {
  id: string;
  nameVi: string;
  // Already-normalized keywords for fast matching
  keywords: string[];
  packageType: NonNullable<ProcurementPackage['packageType']>;
  contractType: NonNullable<ProcurementPackage['contractType']>;
  estimatedUnitPrice: number;
  defaultDurationDays: number;
  // {qty} replaced by detected quantity
  packageNameTemplate: string;
  codePrefix: string;
}

// All keywords are pre-normalized (no diacritics)
const CATEGORY_RULES: CategoryRule[] = [
  {
    id: 'computer',
    nameVi: 'Máy tính và thiết bị tin học',
    keywords: ['may tinh de ban', 'may tinh', 'laptop', 'may chu', 'server', 'man hinh', 'monitor', 'desktop', 'computer', 'pc'],
    packageType: 'goods_fixed_asset',
    contractType: 'lump_sum',
    estimatedUnitPrice: 20_000_000,
    defaultDurationDays: 30,
    packageNameTemplate: 'Mua sắm {qty} máy tính phục vụ đào tạo thực hành',
    codePrefix: 'MT',
  },
  {
    id: 'networking',
    nameVi: 'Thiết bị mạng',
    keywords: ['switch mang', 'switch', 'router', 'thiet bi mang', 'network', 'wifi', 'access point', 'bo dinh tuyen'],
    packageType: 'goods_fixed_asset',
    contractType: 'lump_sum',
    estimatedUnitPrice: 12_000_000,
    defaultDurationDays: 21,
    packageNameTemplate: 'Mua sắm {qty} thiết bị mạng phục vụ thực hành',
    codePrefix: 'TBM',
  },
  {
    id: 'projector',
    nameVi: 'Máy chiếu và màn chiếu',
    keywords: ['may chieu', 'projector', 'man chieu', 'screen projector'],
    packageType: 'goods_fixed_asset',
    contractType: 'lump_sum',
    estimatedUnitPrice: 22_000_000,
    defaultDurationDays: 21,
    packageNameTemplate: 'Mua sắm {qty} máy chiếu phục vụ giảng dạy',
    codePrefix: 'MC',
  },
  {
    id: 'printer',
    nameVi: 'Máy in, photocopy',
    keywords: ['may in', 'printer', 'may photocopy', 'photocopy', 'may scan', 'scanner', 'may in laser', 'may in phun'],
    packageType: 'goods_fixed_asset',
    contractType: 'lump_sum',
    estimatedUnitPrice: 8_000_000,
    defaultDurationDays: 14,
    packageNameTemplate: 'Mua sắm {qty} máy in văn phòng',
    codePrefix: 'MI',
  },
  {
    id: 'ups',
    nameVi: 'Bộ lưu điện UPS',
    keywords: ['ups', 'luu dien', 'bo luu dien', 'uninterruptible'],
    packageType: 'goods_fixed_asset',
    contractType: 'lump_sum',
    estimatedUnitPrice: 5_000_000,
    defaultDurationDays: 14,
    packageNameTemplate: 'Mua sắm {qty} bộ lưu điện UPS',
    codePrefix: 'UPS',
  },
  {
    id: 'hvac_service',
    nameVi: 'Dịch vụ bảo trì, sửa chữa điều hòa',
    keywords: [
      'bao tri dieu hoa', 'sua chua dieu hoa', 'bao duong dieu hoa',
      've sinh dieu hoa', 'nap gas', 'kiem tra dieu hoa',
      'maintenance air', 'bao tri may lanh', 'sua may lanh',
    ],
    packageType: 'service',
    contractType: 'unit_price',
    estimatedUnitPrice: 600_000,
    defaultDurationDays: 60,
    packageNameTemplate: 'Dịch vụ bảo trì, bảo dưỡng {qty} điều hòa không khí',
    codePrefix: 'DV',
  },
  {
    id: 'hvac_new',
    nameVi: 'Điều hòa không khí (mua mới)',
    keywords: ['dieu hoa', 'may lanh', 'air conditioner', 'airconditioner'],
    packageType: 'goods_fixed_asset',
    contractType: 'lump_sum',
    estimatedUnitPrice: 18_000_000,
    defaultDurationDays: 30,
    packageNameTemplate: 'Mua sắm và lắp đặt {qty} điều hòa không khí',
    codePrefix: 'DH',
  },
  {
    id: 'lab_equipment',
    nameVi: 'Thiết bị phòng thí nghiệm / thực hành nghề',
    keywords: [
      'thiet bi thi nghiem', 'may chung cat', 'kinh hien vi', 'microscope',
      'ph meter', 'may ly tam', 'centrifuge', 'may do', 'may phan tich',
      'thiet bi co khi', 'may cnc', 'may tien', 'may phay', 'may han',
      'thiet bi thuc hanh', 'thiet bi phong thuc hanh', 'lab equipment',
    ],
    packageType: 'goods_fixed_asset',
    contractType: 'lump_sum',
    estimatedUnitPrice: 80_000_000,
    defaultDurationDays: 45,
    packageNameTemplate: 'Mua sắm {qty} thiết bị thực hành nghề',
    codePrefix: 'TB',
  },
  {
    id: 'chemical',
    nameVi: 'Hóa chất và vật tư tiêu hao phòng thí nghiệm',
    keywords: [
      'hoa chat', 'dung dich', 'acid', 'axit', 'bazo', 'base', 'ethanol',
      'methanol', 'chemical', 'reagent', 'vat tu thi nghiem', 'chat thu',
    ],
    packageType: 'goods_consumable',
    contractType: 'lump_sum',
    estimatedUnitPrice: 2_000_000,
    defaultDurationDays: 14,
    packageNameTemplate: 'Mua sắm hóa chất, vật tư tiêu hao phục vụ thực hành',
    codePrefix: 'HC',
  },
  {
    id: 'furniture',
    nameVi: 'Nội thất, bàn ghế văn phòng',
    keywords: [
      'ban lam viec', 'ban ghe', 'ghe van phong', 'tu tai lieu', 'ke sach',
      'noi that', 'ban giang day', 'ghe giang day', 'desk', 'chair', 'cabinet',
      'shelving', 'locker', 'tu dung do', 'ban hoc sinh',
    ],
    packageType: 'goods_fixed_asset',
    contractType: 'lump_sum',
    estimatedUnitPrice: 8_000_000,
    defaultDurationDays: 21,
    packageNameTemplate: 'Mua sắm {qty} bộ bàn ghế văn phòng',
    codePrefix: 'NT',
  },
  {
    id: 'stationery',
    nameVi: 'Văn phòng phẩm và đồ dùng tiêu hao',
    keywords: [
      'van phong pham', 'giay in', 'but bi', 'muc in', 'but', 'giay a4',
      'stationery', 'office supply', 'bang dich', 'kep tai lieu', 'hop dung but',
    ],
    packageType: 'goods_consumable',
    contractType: 'lump_sum',
    estimatedUnitPrice: 150_000,
    defaultDurationDays: 14,
    packageNameTemplate: 'Mua sắm văn phòng phẩm phục vụ hoạt động',
    codePrefix: 'VPP',
  },
  {
    id: 'software',
    nameVi: 'Phần mềm và bản quyền sử dụng',
    keywords: [
      'phan mem', 'ban quyen phan mem', 'license', 'software', 'application',
      'phan mem quan ly', 'phan mem ke toan', 'phan mem thiet ke',
    ],
    packageType: 'service',
    contractType: 'lump_sum',
    estimatedUnitPrice: 15_000_000,
    defaultDurationDays: 14,
    packageNameTemplate: 'Mua bản quyền phần mềm phục vụ đào tạo',
    codePrefix: 'PM',
  },
  {
    id: 'repair_service',
    nameVi: 'Dịch vụ sửa chữa và bảo trì thiết bị',
    keywords: [
      'sua chua', 'bao tri', 'bao duong thiet bi', 'repair', 'maintenance',
      'kiem tra dinh ky', 'kiem tra thiet bi', 'hieu chinh thiet bi',
    ],
    packageType: 'service',
    contractType: 'unit_price',
    estimatedUnitPrice: 5_000_000,
    defaultDurationDays: 30,
    packageNameTemplate: 'Dịch vụ sửa chữa, bảo trì trang thiết bị',
    codePrefix: 'DV',
  },
  {
    id: 'cleaning',
    nameVi: 'Dịch vụ vệ sinh môi trường',
    keywords: ['ve sinh moi truong', 've sinh', 'cleaning service', 'dich vu ve sinh'],
    packageType: 'service',
    contractType: 'unit_price',
    estimatedUnitPrice: 50_000_000,
    defaultDurationDays: 365,
    packageNameTemplate: 'Dịch vụ vệ sinh môi trường khuôn viên',
    codePrefix: 'DV',
  },
];

function detectCategory(text: string): { rule: CategoryRule; score: number } | null {
  const forKw = normalizeForKeywords(text);
  let best: { rule: CategoryRule; score: number } | null = null;
  for (const rule of CATEGORY_RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (forKw.includes(kw)) {
        score += kw.length;
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { rule, score };
    }
  }
  return best;
}

function inferFundingSource(normalized: string): {
  source: ProcurementPackage['fundingSource'];
  name: string;
} {
  if (
    normalized.includes('ngan sach nha nuoc') ||
    normalized.includes('von ngan sach') ||
    normalized.includes('kinh phi ngan sach')
  ) {
    return { source: 'state_budget', name: 'Ngân sách nhà nước cấp' };
  }
  if (
    normalized.includes('tai tro') ||
    normalized.includes('du an') ||
    normalized.includes('hop tac quoc te') ||
    normalized.includes('phi va le phi')
  ) {
    return { source: 'other_revenue', name: 'Nguồn thu hợp pháp khác của đơn vị' };
  }
  return {
    source: 'autonomy_fund',
    name: 'Quỹ phát triển hoạt động sự nghiệp của nhà trường',
  };
}

function getProcurementMethodHint(total: number): string {
  if (total <= 50_000_000)
    return 'Mua sắm trực tiếp — DIRECT_50 (≤50 triệu VND)';
  if (total <= 500_000_000)
    return 'Chỉ định thầu rút gọn — DIRECT_SELECTION_SIMPLIFIED (50 triệu – 500 triệu VND)';
  if (total <= 5_000_000_000)
    return 'Chào hàng cạnh tranh — COMPETITIVE_SHOPPING (500 triệu – 5 tỷ VND)';
  return 'Đấu thầu rộng rãi — OPEN_BIDDING (>5 tỷ VND)';
}

function buildNotes(
  rule: CategoryRule,
  qty: number,
  estimatedTotal: number,
): string[] {
  const notes: string[] = [];

  if (rule.id === 'furniture' && rule.estimatedUnitPrice * qty < 10_000_000) {
    notes.push(
      '[MEDIUM] Nội thất có đơn giá ước tính <10 triệu VND/đơn vị: hạch toán là công cụ dụng cụ, ' +
      'không phải tài sản cố định (TT 45/2018/TT-BTC Điều 3).'
    );
  }

  if (rule.packageType === 'goods_consumable') {
    notes.push(
      'Vật tư tiêu hao / hàng tiêu dùng: không ghi tăng tài sản cố định. ' +
      'Hạch toán vào chi phí thực hành trong kỳ (TT 45/2018/TT-BTC).'
    );
  }

  if (rule.packageType === 'service' && rule.contractType === 'unit_price') {
    notes.push(
      'Gói dịch vụ có khối lượng biến động: đề xuất hợp đồng đơn giá (unit_price) ' +
      'theo Điều 62 Luật ĐT 22/2023. Không dùng hợp đồng trọn gói.'
    );
  }

  if (estimatedTotal > 5_000_000_000) {
    notes.push(
      '[CRITICAL] Tổng ước tính >5 tỷ VND → bắt buộc đấu thầu rộng rãi. ' +
      'KHLCNT phải trình Bộ Công Thương phê duyệt trước khi tổ chức (TT 13/2026/TT-BCT).'
    );
  } else if (estimatedTotal > 500_000_000) {
    notes.push(
      '[HIGH] Tổng ước tính >500 triệu VND → phải chào hàng cạnh tranh. ' +
      'KHLCNT cần trình Bộ Công Thương theo TT 13/2026/TT-BCT.'
    );
  }

  return notes;
}

export function generatePackageSuggestion(
  input: string,
  budgetYear = 2026,
): AISuggestion {
  if (!input.trim()) {
    return {
      packageName: '',
      packageCode: '',
      fundingSource: 'autonomy_fund',
      fundingSourceName: 'Quỹ phát triển hoạt động sự nghiệp của nhà trường',
      packageType: 'goods_fixed_asset',
      contractType: 'lump_sum',
      estimatedTotal: 0,
      contractDurationDays: 30,
      procurementMethodHint: 'Chưa xác định — vui lòng nhập mô tả yêu cầu.',
      detectedCategory: '',
      confidence: 'low',
      notes: [],
    };
  }

  const normalized = normalize(input);
  const qty = extractQuantity(input);
  const match = detectCategory(input);
  const funding = inferFundingSource(normalized);

  if (!match) {
    return {
      packageName: `Mua sắm ${input}`,
      packageCode: `MS-${budgetYear}-001`,
      fundingSource: funding.source,
      fundingSourceName: funding.name,
      packageType: 'goods_fixed_asset',
      contractType: 'lump_sum',
      estimatedTotal: 0,
      contractDurationDays: 30,
      procurementMethodHint: 'Không xác định được — nhập tổng giá trị ước tính thủ công.',
      detectedCategory: 'Không xác định',
      confidence: 'low',
      notes: ['Không nhận diện được loại hàng hóa/dịch vụ. Vui lòng điền thủ công hoặc mô tả cụ thể hơn.'],
    };
  }

  const { rule } = match;
  const estimatedTotal = qty * rule.estimatedUnitPrice;
  const forKw = normalizeForKeywords(input);
  const matchedKwCount = rule.keywords.filter(kw => forKw.includes(kw)).length;
  const confidence: AISuggestion['confidence'] =
    matchedKwCount >= 2 ? 'high' : matchedKwCount === 1 ? 'medium' : 'low';

  const packageName = rule.packageNameTemplate.replace('{qty}', String(qty));
  const packageCode = `MS-${budgetYear}-${rule.codePrefix}01`;

  return {
    packageName,
    packageCode,
    fundingSource: funding.source,
    fundingSourceName: funding.name,
    packageType: rule.packageType,
    contractType: rule.contractType,
    estimatedTotal,
    contractDurationDays: rule.defaultDurationDays,
    procurementMethodHint: getProcurementMethodHint(estimatedTotal),
    detectedCategory: rule.nameVi,
    confidence,
    notes: buildNotes(rule, qty, estimatedTotal),
  };
}
