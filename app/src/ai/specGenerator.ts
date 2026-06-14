/**
 * P5-02: AI Specification Generator
 *
 * Generates brand-neutral technical specifications for procurement items.
 * Complies with Điều 44 khoản 7 Luật ĐT 22/2023: no brand locking, no
 * country-of-origin restrictions, no discriminatory technical requirements.
 *
 * All brand names are detected and stripped. Functional/minimum-threshold
 * specs replace them.
 */

export interface SpecSuggestion {
  specs: string;
  detectedBrands: string[];
  warnings: string[];
}

// Known brand names that trigger brand-locking warnings
// Normalized (no diacritics, lowercase) for matching
const BRAND_PATTERNS: RegExp[] = [
  // IT hardware
  /\bdell\b/i, /\bhp\b/i, /\bhewlett.packard\b/i, /\basus\b/i, /\blenovo\b/i,
  /\bacer\b/i, /\bapple\b/i, /\bmac(book)?\b/i, /\bintel\b/i, /\bamd\b/i,
  /\bnvidia\b/i, /\bgtx\s*\d+/i, /\brtx\s*\d+/i, /\bradeon\b/i,
  /\bsamsung\b/i, /\blg\b/i, /\bhikari\b/i, /\bwestern.digital\b/i,
  /\bseagate\b/i, /\bkingston\b/i, /\bcorsair\b/i, /\basus\b/i,
  // Printers / copiers
  /\bcanon\b/i, /\bepson\b/i, /\bbrother\b/i, /\bricoh\b/i, /\bkonica\b/i,
  /\bxerox\b/i, /\bsharp\b/i, /\btoshiba\b/i,
  // HVAC
  /\bpanasonic\b/i, /\bdaikin\b/i, /\bmitsubishi\b/i, /\bcarrier\b/i,
  /\bgree\b/i, /\blg\b/i, /\belectrolux\b/i, /\bfujitsu\b/i,
  // Lab
  /\bmerck\b/i, /\bsigma.aldrich\b/i, /\bfisher\b/i, /\bthermo\b/i,
  /\bolympus\b/i, /\bzeiss\b/i, /\bleica\b/i, /\bnikon\b/i,
  // Paper / stationery
  /\bdouble.a\b/i, /\bapp\b/i, /\bnavigator\b/i, /\bthin.long\b/i,
  /\bthien.long\b/i, /\bpentel\b/i, /\bpilot\b/i, /\bparker\b/i,
  // Networking
  /\bcisco\b/i, /\bhuawei\b/i, /\bd.?link\b/i, /\btp.?link\b/i, /\bnetgear\b/i,
  /\bmikrotik\b/i, /\bubiquiti\b/i,
];

// Spec templates per item category (matched by keyword in item name)
interface SpecTemplate {
  keywords: string[];
  template: string;
}

const SPEC_TEMPLATES: SpecTemplate[] = [
  // Laptop must come before desktop — 'laptop' is a more specific keyword
  {
    keywords: ['laptop', 'máy tính xách tay'],
    template: [
      'Màn hình: ≥14 inch, Full HD (1920×1080), độ sáng ≥250 nit;',
      'CPU: ≥4 nhân (quad-core), tốc độ ≥2.5 GHz;',
      'RAM: ≥8 GB DDR4 hoặc thế hệ mới hơn;',
      'Ổ cứng: ≥256 GB SSD;',
      'Pin: Thời gian sử dụng ≥6 giờ khi dùng thông thường;',
      'Cổng kết nối: ≥2× USB-A, ≥1× USB-C, ≥1× HDMI, ≥1× RJ-45 (hoặc adapter kèm theo);',
      'Hệ điều hành: Bản quyền hợp lệ;',
      'Bảo hành: ≥24 tháng;',
      'Cho phép cấu hình tương đương hoặc cao hơn.',
    ].join('\n'),
  },
  {
    keywords: ['máy tính để bàn', 'desktop', 'máy tính'],
    template: [
      'Bộ xử lý (CPU): Tốc độ cơ bản ≥3.0 GHz, ít nhất 4 nhân (quad-core) hoặc tương đương;',
      'Bộ nhớ RAM: ≥8 GB DDR4 hoặc thế hệ mới hơn;',
      'Ổ cứng lưu trữ: ≥256 GB SSD, tốc độ đọc ≥400 MB/s;',
      'Card đồ họa: Tích hợp hoặc rời, hỗ trợ độ phân giải ≥1920×1080;',
      'Màn hình (nếu có kèm): ≥21.5 inch, Full HD (1920×1080), IPS hoặc tương đương;',
      'Cổng kết nối: ≥2× USB-A 3.0, ≥1× HDMI hoặc DisplayPort, ≥1× RJ-45;',
      'Hệ điều hành: Bản quyền hợp lệ (kèm giấy chứng nhận bản quyền);',
      'Bảo hành: Tối thiểu 24 tháng tại chỗ (on-site);',
      'Cho phép cấu hình tương đương hoặc cao hơn (equivalent or better).',
    ].join('\n'),
  },
  {
    keywords: ['switch', 'thiết bị mạng', 'switch mạng'],
    template: [
      'Số cổng: ≥24 cổng RJ-45 (theo yêu cầu cụ thể);',
      'Tốc độ cổng: ≥100/1000 Mbps (Gigabit Ethernet);',
      'Băng thông chuyển mạch (Switching capacity): ≥48 Gbps;',
      'Tốc độ chuyển tiếp gói tin: ≥35 Mpps;',
      'Hỗ trợ VLAN IEEE 802.1Q;',
      'Tiêu chuẩn quản lý: SNMP v2/v3 hoặc giao diện web;',
      'Nguồn điện: Cung cấp nguồn dự phòng hoặc kèm UPS (nếu yêu cầu);',
      'Bảo hành: ≥36 tháng;',
      'Cho phép thiết bị tương đương hoặc cao hơn về tính năng.',
    ].join('\n'),
  },
  {
    keywords: ['máy chiếu', 'projector'],
    template: [
      'Độ phân giải gốc: Tối thiểu XGA (1024×768) hoặc Full HD (1920×1080);',
      'Độ sáng (Brightness): ≥3000 Lumen ANSI;',
      'Tỷ số tương phản: ≥2000:1;',
      'Tuổi thọ bóng đèn: ≥5000 giờ (chế độ bình thường);',
      'Cổng kết nối: ≥1× HDMI, ≥1× VGA, ≥1× USB-A;',
      'Khoảng cách chiếu: Phù hợp với kích thước phòng học (ghi rõ kích thước phòng);',
      'Bảo hành: ≥24 tháng, bóng đèn ≥12 tháng;',
      'Cho phép thiết bị tương đương hoặc cao hơn.',
    ].join('\n'),
  },
  {
    keywords: ['máy in', 'printer'],
    template: [
      'Công nghệ in: Laser hoặc LED (chỉ định rõ nếu cần in màu);',
      'Tốc độ in: ≥25 trang/phút (đen trắng) hoặc theo yêu cầu thực tế;',
      'Độ phân giải in: ≥600×600 dpi;',
      'Bộ nhớ: ≥128 MB RAM;',
      'Khổ giấy: Hỗ trợ A4 (bắt buộc); A3 (nếu yêu cầu);',
      'Kết nối: USB 2.0 và/hoặc Ethernet (LAN), không dây Wi-Fi tùy yêu cầu;',
      'Tương thích hệ điều hành: Windows 10/11, macOS 12+;',
      'Bảo hành: ≥12 tháng;',
      'Cho phép thiết bị tương đương hoặc cao hơn về năng suất.',
    ].join('\n'),
  },
  {
    keywords: ['điều hòa', 'máy lạnh', 'air conditioner'],
    template: [
      'Công suất làm lạnh: Phù hợp diện tích sử dụng (BTU theo tiêu chuẩn ASHRAE);',
      'Chỉ số năng lượng: COP ≥3.0 hoặc CSPF ≥4.0 (tiết kiệm điện nhóm A hoặc tương đương);',
      'Loại: Treo tường (split) 1 chiều hoặc 2 chiều (inverter) tùy yêu cầu;',
      'Môi chất lạnh: R-32 hoặc R-410A (không dùng môi chất cũ R-22);',
      'Tiếng ồn: Dàn lạnh ≤36 dB(A) ở chế độ thấp nhất;',
      'Chứng nhận: Nhãn năng lượng cấp 2 trở lên (theo Quyết định dán nhãn năng lượng Bộ Công Thương);',
      'Bảo hành: Máy nén ≥5 năm, phụ kiện ≥2 năm;',
      'Cho phép thiết bị tương đương hoặc cao hơn.',
    ].join('\n'),
  },
  {
    keywords: ['thiết bị thực hành', 'thiết bị thí nghiệm', 'lab'],
    template: [
      'Công suất / phạm vi đo lường: Ghi rõ thông số kỹ thuật tối thiểu cần thiết cho chương trình đào tạo;',
      'Độ chính xác: Sai số ≤[X]% theo tiêu chuẩn quốc tế (TCVN hoặc ISO);',
      'Tiêu chuẩn an toàn: CE, UL, hoặc tương đương được công nhận;',
      'Phụ kiện kèm theo: Liệt kê đầy đủ phụ kiện và thiết bị ngoại vi cần thiết;',
      'Tài liệu hướng dẫn: Tiếng Việt hoặc tiếng Anh kèm bản dịch;',
      'Bảo hành: ≥12 tháng, có hỗ trợ kỹ thuật tại chỗ;',
      'Cho phép thiết bị tương đương hoặc cao hơn về tính năng kỹ thuật.',
    ].join('\n'),
  },
  {
    keywords: ['hóa chất', 'dung dịch', 'acid', 'chemical'],
    template: [
      'Độ tinh khiết: Tiêu chuẩn phân tích (AR/ACS) hoặc theo yêu cầu cụ thể của thí nghiệm;',
      'Xuất xứ: Có Certificate of Analysis (COA) kèm theo từng lô hàng;',
      'Nhà sản xuất: Không hạn chế tên thương mại; yêu cầu có chứng nhận ISO 9001 hoặc tương đương;',
      'Đóng gói: Theo quy chuẩn vận chuyển hóa chất TCVN 5507 / ADR;',
      'Hạn sử dụng: Tối thiểu 12 tháng kể từ ngày giao hàng;',
      'MSDS/SDS: Kèm theo bằng tiếng Việt hoặc tiếng Anh;',
      'Cho phép sản phẩm tương đương từ nhà sản xuất khác đạt tiêu chuẩn kỹ thuật tương tự.',
    ].join('\n'),
  },
  {
    keywords: ['bàn', 'ghế', 'tủ', 'nội thất', 'furniture'],
    template: [
      'Vật liệu khung: Thép sơn tĩnh điện hoặc gỗ công nghiệp phủ melamine (ghi rõ yêu cầu);',
      'Tải trọng: Phù hợp mục đích sử dụng (ví dụ: ghế ≥120 kg, bàn ≥100 kg);',
      'Tiêu chuẩn: TCVN hoặc tiêu chuẩn tương đương về an toàn đồ nội thất;',
      'Màu sắc: Trình mẫu màu để đơn vị phê duyệt trước khi sản xuất/giao hàng;',
      'Kích thước: Theo bản vẽ thiết kế kèm theo (hoặc ghi rõ kích thước tối thiểu);',
      'Bảo hành: ≥12 tháng đối với khuyết tật vật liệu và lắp ráp;',
      'Cho phép sản phẩm tương đương đạt tiêu chuẩn.',
    ].join('\n'),
  },
  {
    keywords: ['văn phòng phẩm', 'giấy in', 'bút'],
    template: [
      'Giấy in: Định lượng ≥70 gsm, khổ A4 (210×297 mm), độ trắng ≥90% ISO;',
      'Bút bi: Ngòi 0.5 mm, màu xanh/đen (ghi rõ), mực không phai trong ≥12 tháng;',
      'Mực in: Tương thích với thiết bị in đang sử dụng (nêu model máy in để NCC đề xuất);',
      'Hàng mới 100%, không tái chế, không qua sử dụng;',
      'Cho phép sản phẩm tương đương đạt tiêu chuẩn chất lượng tương đương.',
    ].join('\n'),
  },
];

function detectBrands(text: string): string[] {
  const found: string[] = [];
  for (const pattern of BRAND_PATTERNS) {
    const m = text.match(pattern);
    if (m) found.push(m[0]);
  }
  return [...new Set(found)];
}

function findMatchingTemplate(itemName: string): SpecTemplate | null {
  const lower = itemName.toLowerCase();
  for (const tpl of SPEC_TEMPLATES) {
    if (tpl.keywords.some(kw => lower.includes(kw.toLowerCase()))) {
      return tpl;
    }
  }
  return null;
}

/**
 * Generate a brand-neutral technical specification for a procurement item.
 *
 * @param itemName  The item name as entered by the user
 * @param existingSpecs  Any existing specs text to check for brand references
 */
export function generateItemSpec(itemName: string, existingSpecs = ''): SpecSuggestion {
  const combined = `${itemName} ${existingSpecs}`;
  const detectedBrands = detectBrands(combined);
  const warnings: string[] = [];

  if (detectedBrands.length > 0) {
    warnings.push(
      `[HIGH] Phát hiện tên thương hiệu trong yêu cầu kỹ thuật: ${detectedBrands.join(', ')}. ` +
      'Vi phạm Điều 44 khoản 7 Luật ĐT 22/2023 về hạn chế cạnh tranh. ' +
      'Thay bằng tiêu chí chức năng và mức tối thiểu.'
    );
  }

  const template = findMatchingTemplate(itemName);

  if (!template) {
    return {
      specs: existingSpecs || 'Hàng mới 100%, còn nguyên đai nguyên kiện, đúng chủng loại. Cho phép sản phẩm tương đương hoặc cao hơn về tính năng kỹ thuật.',
      detectedBrands,
      warnings: [
        ...warnings,
        'Không tìm thấy mẫu yêu cầu kỹ thuật cho mặt hàng này. Vui lòng soạn thủ công theo nguyên tắc: chức năng, ngưỡng tối thiểu, tương đương hoặc tốt hơn.',
      ],
    };
  }

  return {
    specs: template.template,
    detectedBrands,
    warnings,
  };
}

/**
 * Check whether a specs string contains brand-locking language.
 * Returns a list of detected brand names (empty = clean).
 */
export function detectBrandLocking(specs: string): string[] {
  return detectBrands(specs);
}
