import { 
  Document, Paragraph, TextRun, Table, TableRow, TableCell, 
  AlignmentType, WidthType, BorderStyle, UnderlineType, Packer 
} from 'docx';
import { ProcurementPackage, ProcurementItem } from './demoData';

// Format currency helper
export const formatVND = (value: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
};

// Convert number to words — full Vietnamese implementation
// Handles 0 to 999,999,999,999 VND.
// Verified outputs (matches previous hardcoded values):
//   320,000,000 → "Ba trăm hai mươi triệu đồng chẵn"
//   80,000,000  → "Tám mươi triệu đồng chẵn"
//   45,000,000  → "Bốn mươi lăm triệu đồng chẵn"
export const numberToWords = (total: number): string => {
  if (total === 0) return 'Không đồng';
  if (!Number.isFinite(total) || total < 0) return 'Giá trị không hợp lệ';

  const digits = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

  // Reads a 3-digit group (0–999) and returns Vietnamese text, or '' when n === 0.
  const readGroup = (n: number): string => {
    if (n === 0) return '';
    const hundreds = Math.floor(n / 100);
    const tens     = Math.floor((n % 100) / 10);
    const ones     = n % 10;
    let result = '';

    if (hundreds > 0) {
      result += digits[hundreds] + ' trăm';
      // "linh" bridges hundreds to a lone ones digit when tens is zero
      if (tens === 0 && ones > 0) result += ' linh';
    }

    if (tens > 0) {
      if (result) result += ' ';
      result += tens === 1 ? 'mười' : digits[tens] + ' mươi';
      if      (ones === 1 && tens > 1) result += ' mốt';  // 21, 31, … (not 11)
      else if (ones === 5 && tens >= 1) result += ' lăm'; // 15, 25, …
      else if (ones > 0)               result += ' ' + digits[ones];
    } else if (ones > 0) {
      if (result) result += ' ';
      result += digits[ones];
    }

    return result;
  };

  const ty     = Math.floor(total / 1_000_000_000);
  const trieu  = Math.floor((total % 1_000_000_000) / 1_000_000);
  const nghin  = Math.floor((total % 1_000_000) / 1_000);
  const donvi  = total % 1_000;

  const parts: string[] = [];
  if (ty    > 0) parts.push(readGroup(ty)    + ' tỷ');
  if (trieu > 0) parts.push(readGroup(trieu) + ' triệu');
  if (nghin > 0) parts.push(readGroup(nghin) + ' nghìn');
  if (donvi > 0) parts.push(readGroup(donvi));

  const text = parts.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1) + ' đồng chẵn';
};

// Date formatter
export const formatDateVietnamese = (dateStr: string) => {
  if (!dateStr) return 'ngày... tháng... năm 2026';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `ngày ${parts[2]} tháng ${parts[1]} năm ${parts[0]}`;
  }
  return dateStr;
};

// Dynamic evaluation of procurement method
export function getProcurementMethod(pkg: ProcurementPackage): {
  code: 'DIRECT_50' | 'DIRECT_SELECTION_SIMPLIFIED' | 'COMPETITIVE_SHOPPING' | 'OPEN_BIDDING';
  name: string;
  basis: string[];
} {
  const total = pkg.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  
  if (total <= 50000000) {
    return {
      code: 'DIRECT_50',
      name: 'Quyết định mua sắm trực tiếp (Không qua quy trình thầu)',
      basis: [
        'Khoản 4 Điều 80 Nghị định số 214/2025/NĐ-CP của Chính phủ',
        'Điểm m Khoản 1 Điều 23 Luật Đấu thầu số 22/2023/QH15',
        'Thông tư số 13/2026/TT-BCT của Bộ Công Thương về phân cấp quản lý ngân sách, tài sản công'
      ]
    };
  } else if (total <= 500000000) {
    return {
      code: 'DIRECT_SELECTION_SIMPLIFIED',
      name: 'Chỉ định thầu rút gọn',
      basis: [
        'Điểm m Khoản 1 Điều 23 Luật Đấu thầu số 22/2023/QH15 (sửa đổi bởi Luật số 90/2025/QH15)',
        'Khoản 2 và Khoản 3 Điều 80 Nghị định số 214/2025/NĐ-CP của Chính phủ',
        'Thông tư số 13/2026/TT-BCT của Bộ Công Thương về phân cấp quản lý ngân sách, tài sản công'
      ]
    };
  } else if (total <= 5000000000) {
    return {
      code: 'COMPETITIVE_SHOPPING',
      name: 'Chào hàng cạnh tranh',
      basis: [
        'Điều 24 Luật Đấu thầu số 22/2023/QH15 (sửa đổi bởi Luật số 90/2025/QH15)',
        'Điều 81 Nghị định số 214/2025/NĐ-CP của Chính phủ',
        'Thông tư số 79/2025/TT-BTC hướng dẫn đăng tải thông tin và mẫu hồ sơ đấu thầu qua mạng'
      ]
    };
  } else {
    return {
      code: 'OPEN_BIDDING',
      name: 'Đấu thầu rộng rãi qua mạng (E-LCNT)',
      basis: [
        'Luật Đấu thầu số 22/2023/QH15 (sửa đổi bởi Luật số 90/2025/QH15)',
        'Nghị định số 214/2025/NĐ-CP của Chính phủ hướng dẫn thi hành Luật Đấu thầu',
        'Thông tư số 79/2025/TT-BTC và Thông tư số 80/2025/TT-BTC của Bộ Tài chính'
      ]
    };
  }
}

// Returns the supplier with the lowest quoted total across all items.
// Docs 6, 14, 15, 16, 17 use this to declare the actual winner instead of
// always defaulting to supplier 1.
export const getWinnerSupplier = (pkg: ProcurementPackage): { name: string; total: number; rank: 1 | 2 | 3 } => {
  const s1 = pkg.items.reduce((s, i) => s + i.quantity * i.supplier1Price, 0);
  const s2 = pkg.items.reduce((s, i) => s + i.quantity * i.supplier2Price, 0);
  const s3 = pkg.items.reduce((s, i) => s + i.quantity * i.supplier3Price, 0);
  const min = Math.min(s1, s2, s3);
  if (min === s1) return { name: pkg.supplier1Name, total: s1, rank: 1 };
  if (min === s2) return { name: pkg.supplier2Name, total: s2, rank: 2 };
  return { name: pkg.supplier3Name, total: s3, rank: 3 };
};

// ----------------------------------------------------
// DOCX BUILDER HELPERS
// ----------------------------------------------------
const docxParagraph = (text: string, options?: { bold?: boolean, italic?: boolean, size?: number, align?: any, before?: number, after?: number, lineSpacing?: number, indent?: number }) => {
  return new Paragraph({
    alignment: options?.align ?? AlignmentType.JUSTIFIED,
    spacing: {
      before: options?.before ?? 0,
      after: options?.after ?? 120,
      line: options?.lineSpacing ?? 276, // 1.15 line spacing
    },
    indent: options?.indent ? { firstLine: options.indent } : undefined,
    children: [
      new TextRun({
        text: text,
        bold: options?.bold ?? false,
        italics: options?.italic ?? false,
        size: options?.size ?? 26, // 13pt
        font: "Times New Roman"
      })
    ]
  });
};

const docxHeaderTable = (pkg: ProcurementPackage, leftSymbol: string, dateStr: string) => {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "auto" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
      left: { style: BorderStyle.NONE, size: 0, color: "auto" },
      right: { style: BorderStyle.NONE, size: 0, color: "auto" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 40 },
                children: [
                  new TextRun({ text: "BỘ CÔNG THƯƠNG\n", size: 24, font: "Times New Roman" }),
                  new TextRun({ text: "TRƯỜNG CAO ĐẲNG KỸ THUẬT\nCÔNG NGHIỆP\n", bold: true, size: 22, font: "Times New Roman" }),
                  new TextRun({ text: `Số: ${leftSymbol}\n`, size: 24, font: "Times New Roman" }),
                  new TextRun({ text: "-------", bold: true, size: 24, font: "Times New Roman" }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 40 },
                children: [
                  new TextRun({ text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\n", bold: true, size: 22, font: "Times New Roman" }),
                  new TextRun({ text: "Độc lập - Tự do - Hạnh phúc\n", bold: true, size: 24, font: "Times New Roman" }),
                  new TextRun({ text: `Bắc Giang, ${formatDateVietnamese(dateStr)}\n`, italics: true, size: 24, font: "Times New Roman" }),
                  new TextRun({ text: "_________________", bold: true, size: 24, font: "Times New Roman" }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
};

const docxSignatureTable = (leftTitle: string, leftName: string, rightTitle: string, rightName: string) => {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "auto" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
      left: { style: BorderStyle.NONE, size: 0, color: "auto" },
      right: { style: BorderStyle.NONE, size: 0, color: "auto" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 100 },
                children: [
                  new TextRun({ text: leftTitle ? `${leftTitle.toUpperCase()}\n` : "", bold: true, size: 24, font: "Times New Roman" }),
                  new TextRun({ text: leftTitle ? "(Ký, ghi rõ họ tên)\n\n\n\n\n\n" : "", italics: true, size: 22, font: "Times New Roman" }),
                  new TextRun({ text: leftName, bold: true, size: 24, font: "Times New Roman" }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 100 },
                children: [
                  new TextRun({ text: `${rightTitle.toUpperCase()}\n`, bold: true, size: 24, font: "Times New Roman" }),
                  new TextRun({ text: "(Ký, họ tên, đóng dấu)\n\n\n\n\n\n", italics: true, size: 22, font: "Times New Roman" }),
                  new TextRun({ text: rightName, bold: true, size: 24, font: "Times New Roman" }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
};

const docxItemTable = (items: ProcurementItem[]) => {
  const headerRow = new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "STT", bold: true })] })] }),
      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Tên thiết bị, vật tư", bold: true })] })] }),
      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Quy cách kỹ thuật", bold: true })] })] }),
      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ĐVT", bold: true })] })] }),
      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "SL", bold: true })] })] }),
      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Đơn giá dự kiến (VND)", bold: true })] })] }),
      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Thành tiền (VND)", bold: true })] })] }),
    ],
  });

  const itemRows = items.map((item, idx) => {
    return new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: (idx + 1).toString(), alignment: AlignmentType.CENTER })] }),
        new TableCell({ children: [new Paragraph({ text: item.name })] }),
        new TableCell({ children: [new Paragraph({ text: item.specs })] }),
        new TableCell({ children: [new Paragraph({ text: item.unit, alignment: AlignmentType.CENTER })] }),
        new TableCell({ children: [new Paragraph({ text: item.quantity.toString(), alignment: AlignmentType.CENTER })] }),
        new TableCell({ children: [new Paragraph({ text: formatVND(item.unitPrice), alignment: AlignmentType.RIGHT })] }),
        new TableCell({ children: [new Paragraph({ text: formatVND(item.quantity * item.unitPrice), alignment: AlignmentType.RIGHT })] }),
      ],
    });
  });

  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  const totalRow = new TableRow({
    children: [
      new TableCell({ columnSpan: 6, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "TỔNG CỘNG (Đã bao gồm VAT)", bold: true })] })] }),
      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatVND(total), bold: true })] })] }),
    ],
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...itemRows, totalRow],
  });
};

const docxCompareTable = (pkg: ProcurementPackage) => {
  const headerRow = new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "STT", bold: true })] })] }),
      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Danh mục hàng hóa", bold: true })] })] }),
      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ĐVT", bold: true })] })] }),
      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "SL", bold: true })] })] }),
      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${pkg.supplier1Name} (Đơn giá/Thành tiền)`, bold: true })] })] }),
      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${pkg.supplier2Name} (Đơn giá/Thành tiền)`, bold: true })] })] }),
      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${pkg.supplier3Name} (Đơn giá/Thành tiền)`, bold: true })] })] }),
    ],
  });

  const itemRows = pkg.items.map((item, idx) => {
    return new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: (idx + 1).toString(), alignment: AlignmentType.CENTER })] }),
        new TableCell({ children: [new Paragraph({ text: item.name })] }),
        new TableCell({ children: [new Paragraph({ text: item.unit, alignment: AlignmentType.CENTER })] }),
        new TableCell({ children: [new Paragraph({ text: item.quantity.toString(), alignment: AlignmentType.CENTER })] }),
        new TableCell({ children: [new Paragraph({ text: `${formatVND(item.supplier1Price)}\n/ ${formatVND(item.quantity * item.supplier1Price)}`, alignment: AlignmentType.RIGHT })] }),
        new TableCell({ children: [new Paragraph({ text: `${formatVND(item.supplier2Price)}\n/ ${formatVND(item.quantity * item.supplier2Price)}`, alignment: AlignmentType.RIGHT })] }),
        new TableCell({ children: [new Paragraph({ text: `${formatVND(item.supplier3Price)}\n/ ${formatVND(item.quantity * item.supplier3Price)}`, alignment: AlignmentType.RIGHT })] }),
      ],
    });
  });

  const totalS1 = pkg.items.reduce((sum, item) => sum + item.quantity * item.supplier1Price, 0);
  const totalS2 = pkg.items.reduce((sum, item) => sum + item.quantity * item.supplier2Price, 0);
  const totalS3 = pkg.items.reduce((sum, item) => sum + item.quantity * item.supplier3Price, 0);

  const totalRow = new TableRow({
    children: [
      new TableCell({ columnSpan: 4, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "TỔNG CỘNG", bold: true })] })] }),
      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatVND(totalS1), bold: true })] })] }),
      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatVND(totalS2), bold: true })] })] }),
      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatVND(totalS3), bold: true })] })] }),
    ],
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...itemRows, totalRow],
  });
};

// ----------------------------------------------------
// 24 DOCUMENT DEFINITIONS
// ----------------------------------------------------
export interface DocumentConfig {
  id: number;
  name: string;
  getCategory: (method: string) => 'required' | 'recommended' | 'not_applicable';
  getCategoryLabel: (method: string) => string;
  getSigner: (pkg: ProcurementPackage) => string;
  getSignDate: (pkg: ProcurementPackage) => string;
  getAuditRisk: (pkg: ProcurementPackage) => string;
  getHtml: (pkg: ProcurementPackage, methodCode: string) => string;
  getDocx: (pkg: ProcurementPackage, methodCode: string) => Document;
}

export const documentTemplates: DocumentConfig[] = [
  // Document 1: Tờ trình đề nghị mua sắm
  {
    id: 1,
    name: "Tờ trình đề nghị mua sắm",
    getCategory: () => 'required',
    getCategoryLabel: () => 'Bắt buộc',
    getSigner: (pkg) => `Trưởng khoa/Trưởng phòng chuyên môn`,
    getSignDate: (pkg) => pkg.dateProposal,
    getAuditRisk: (pkg) => "Không có căn cứ kế hoạch đào tạo hoặc nhu cầu công việc thực tế được phê duyệt từ trước.",
    getHtml: (pkg, methodCode) => {
      const total = pkg.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      return `
        <div class="doc-header">
          <div class="doc-header-left">
            BỘ CÔNG THƯƠNG<br>
            <b>TRƯỜNG CĐ KỸ THUẬT CÔNG NGHIỆP</b><br>
            Số: .../TTr-${pkg.departmentCode}
          </div>
          <div class="doc-header-right">
            <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>
            <b>Độc lập - Tự do - Hạnh phúc</b><br>
            <i>Bắc Giang, ngày ${formatDateVietnamese(pkg.dateProposal)}</i>
          </div>
        </div>
        <div class="doc-title">
          TỜ TRÌNH<br>
          <span style="font-size: 14px; font-weight: normal;">V/v Đề nghị mua sắm thiết bị, vật tư phục vụ hoạt động của đơn vị</span>
        </div>
        <div class="doc-content">
          <p>Kính gửi: Hiệu trưởng Trường Cao đẳng Kỹ thuật Công nghiệp</p>
          <p>Căn cứ Quy chế chi tiêu nội bộ và quản lý tài sản công của Trường Cao đẳng Kỹ thuật Công nghiệp;</p>
          <p>Căn cứ vào kế hoạch công tác và nhu cầu thực tế phục vụ nhiệm vụ chuyên môn, đào tạo của đơn vị: ${pkg.departmentName};</p>
          <p>${pkg.departmentName} kính trình Hiệu trưởng xem xét, phê duyệt chủ trương thực hiện mua sắm gói thầu: <b>"${pkg.packageName}"</b>.</p>
          <p><b>1. Mục đích mua sắm:</b> Phục vụ trực tiếp hoạt động đào tạo thực hành và thực hiện các chỉ tiêu chuyên môn được giao năm ${pkg.budgetYear}.</p>
          <p><b>2. Tổng kinh phí dự kiến:</b> ${formatVND(total)} (Bằng chữ: ${numberToWords(total)}).</p>
          <p><b>3. Nguồn vốn đề xuất:</b> ${pkg.fundingSourceName}.</p>
          <p>Kính đề nghị Hiệu trưởng xem xét phê duyệt./.</p>
        </div>
        <div class="doc-signatures">
          <div></div>
          <div style="text-align: center;">
            <b>TRƯỞNG PHÒNG/KHOA</b><br>
            <i>(Ký, ghi rõ họ tên)</i><br><br><br>
            <b>${pkg.expertTeamLeader.split(' (')[0]}</b>
          </div>
        </div>
      `;
    },
    getDocx: (pkg, methodCode) => {
      const total = pkg.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
      return new Document({
        sections: [{
          properties: {
            page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } }
          },
          children: [
            docxHeaderTable(pkg, `.../TTr-${pkg.departmentCode}`, pkg.dateProposal),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [
                new TextRun({ text: "TỜ TRÌNH\n", bold: true, size: 28, font: "Times New Roman" }),
                new TextRun({ text: "V/v Đề nghị mua sắm thiết bị, vật tư phục vụ hoạt động của đơn vị", italics: true, size: 24, font: "Times New Roman" })
              ]
            }),
            docxParagraph("Kính gửi: Hiệu trưởng Trường Cao đẳng Kỹ thuật Công nghiệp", { bold: true, align: AlignmentType.CENTER, before: 100, after: 150 }),
            docxParagraph("Căn cứ Quy chế chi tiêu nội bộ và quản lý tài sản công của Trường Cao đẳng Kỹ thuật Công nghiệp;", { indent: 500 }),
            docxParagraph(`Căn cứ vào kế hoạch công tác và nhu cầu thực tế phục vụ nhiệm vụ chuyên môn, đào tạo của đơn vị: ${pkg.departmentName};`, { indent: 500 }),
            docxParagraph(`${pkg.departmentName} kính trình Hiệu trưởng xem xét, phê duyệt chủ trương thực hiện mua sắm gói thầu: "${pkg.packageName}".`, { indent: 500 }),
            docxParagraph("1. Mục đích mua sắm: Phục vụ trực tiếp hoạt động đào tạo thực hành và thực hiện các chỉ tiêu chuyên môn được giao năm " + pkg.budgetYear, { indent: 500 }),
            docxParagraph(`2. Tổng kinh phí dự kiến: ${formatVND(total)} (Bằng chữ: ${numberToWords(total)})`, { indent: 500 }),
            docxParagraph(`3. Nguồn vốn đề xuất: ${pkg.fundingSourceName}.`, { indent: 500 }),
            docxParagraph("Kính đề nghị Hiệu trưởng xem xét phê duyệt./.", { indent: 500, before: 100, after: 200 }),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            docxSignatureTable("", "", "TRƯỞNG PHÒNG/KHOA", pkg.expertTeamLeader.split(' (')[0])
          ]
        }]
      });
    }
  },

  // Document 2: Bảng tổng hợp nhu cầu
  {
    id: 2,
    name: "Bảng tổng hợp nhu cầu",
    getCategory: () => 'required',
    getCategoryLabel: () => 'Bắt buộc',
    getSigner: (pkg) => `Trưởng khoa/Phòng chuyên môn`,
    getSignDate: (pkg) => pkg.dateProposal,
    getAuditRisk: (pkg) => "Không liệt kê rõ quy cách, thông số kỹ thuật tối thiểu dẫn tới lãng phí hoặc mua sắm không đúng chất lượng.",
    getHtml: (pkg, methodCode) => {
      const itemsHtml = pkg.items.map((item, idx) => `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td>${item.name}</td>
          <td>${item.specs}</td>
          <td style="text-align: center;">${item.unit}</td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: right;">${formatVND(item.unitPrice)}</td>
          <td style="text-align: right;">${formatVND(item.quantity * item.unitPrice)}</td>
        </tr>
      `).join('');
      const total = pkg.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

      return `
        <div class="doc-header">
          <div class="doc-header-left">
            BỘ CÔNG THƯƠNG<br>
            <b>TRƯỜNG CĐ KỸ THUẬT CÔNG NGHIỆP</b>
          </div>
          <div class="doc-header-right">
            <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>
            <b>Độc lập - Tự do - Hạnh phúc</b>
          </div>
        </div>
        <div class="doc-title" style="margin-top: 15px;">
          BẢNG TỔNG HỢP NHU CẦU THIẾT BỊ, VẬT TƯ ĐỀ XUẤT MUA SẮM<br>
          <span style="font-size: 13px; font-weight: normal; font-style: italic;">(Kèm theo Tờ trình ngày ${formatDateVietnamese(pkg.dateProposal)})</span>
        </div>
        <table class="doc-table">
          <thead>
            <tr>
              <th style="width: 5%;">STT</th>
              <th style="width: 30%;">Tên thiết bị, vật tư</th>
              <th style="width: 30%;">Yêu cầu quy cách, tính năng kỹ thuật</th>
              <th style="width: 8%;">ĐVT</th>
              <th style="width: 7%;">SL</th>
              <th style="width: 10%;">Đơn giá dự kiến (VND)</th>
              <th style="width: 10%;">Thành tiền (VND)</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
            <tr>
              <td colspan="6" style="text-align: right; font-weight: bold;">TỔNG CỘNG:</td>
              <td style="text-align: right; font-weight: bold;">${formatVND(total)}</td>
            </tr>
          </tbody>
        </table>
        <div class="doc-signatures" style="margin-top: 20px;">
          <div style="text-align: center;">
            <b>Người lập biểu</b><br>
            <i>(Ký, ghi rõ họ tên)</i>
          </div>
          <div style="text-align: center;">
            <b>TRƯỞNG PHÒNG/KHOA</b><br>
            <i>(Ký, ghi rõ họ tên)</i>
          </div>
        </div>
      `;
    },
    getDocx: (pkg, methodCode) => {
      return new Document({
        sections: [{
          properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
          children: [
            docxHeaderTable(pkg, `${pkg.departmentCode}`, pkg.dateProposal),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [
                new TextRun({ text: "BẢNG TỔNG HỢP NHU CẦU THIẾT BỊ, VẬT TƯ ĐỀ XUẤT\n", bold: true, size: 26, font: "Times New Roman" }),
                new TextRun({ text: `(Kèm theo Tờ trình ngày ${formatDateVietnamese(pkg.dateProposal)})`, italics: true, size: 22, font: "Times New Roman" })
              ]
            }),
            docxItemTable(pkg.items),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            docxSignatureTable("Người lập biểu", "", "TRƯỞNG PHÒNG/KHOA", pkg.expertTeamLeader.split(' (')[0])
          ]
        }]
      });
    }
  },

  // Document 3: Thuyết minh sự cần thiết
  {
    id: 3,
    name: "Thuyết minh sự cần thiết",
    getCategory: () => 'required',
    getCategoryLabel: () => 'Bắt buộc',
    getSigner: (pkg) => `Trưởng khoa/Phòng chuyên môn`,
    getSignDate: (pkg) => pkg.dateProposal,
    getAuditRisk: (pkg) => "Thuyết minh sơ sài, mang tính đối phó, không chỉ ra được lý do thực tế của việc mua sắm dẫn đến kết luận đầu tư lãng phí của Kiểm toán Nhà nước.",
    getHtml: (pkg, methodCode) => {
      return `
        <div class="doc-header">
          <div class="doc-header-left">
            BỘ CÔNG THƯƠNG<br>
            <b>TRƯỜNG CĐ KỸ THUẬT CÔNG NGHIỆP</b>
          </div>
          <div class="doc-header-right">
            <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>
            <b>Độc lập - Tự do - Hạnh phúc</b>
          </div>
        </div>
        <div class="doc-title" style="margin-top: 15px;">
          BẢN THUYẾT MINH SỰ CẦN THIẾT VÀ HIỆU QUẢ CỦA GÓI THẦU MUA SẮM<br>
          <span style="font-size: 13px; font-weight: normal; font-style: italic;">(Gói thầu: ${pkg.packageName})</span>
        </div>
        <div class="doc-content">
          <p><b>I. Thực trạng trang thiết bị của đơn vị hiện tại:</b></p>
          <p>Hiện nay, trang thiết bị tại các phòng thực hành, phòng làm việc của đơn vị đã xuống cấp nghiêm trọng hoặc không còn phù hợp với công nghệ đào tạo thực tế hiện hành. Số lượng thiết bị hiện có không đáp ứng đủ quy mô học sinh, sinh viên tuyển sinh thực tế hàng năm.</p>
          
          <p><b>II. Sự cần thiết đầu tư mua sắm:</b></p>
          <p>1. Đáp ứng yêu cầu chuyển đổi số trong giáo dục nghề nghiệp của Bộ Công Thương và chiến lược phát triển trường.</p>
          <p>2. Nâng cao chất lượng thực hành, gắn kết thực tế doanh nghiệp để sinh viên ra trường làm chủ được công nghệ mới.</p>
          <p>3. Thay thế các thiết bị cũ, hỏng hóc, chi phí sửa chữa bảo trì hàng năm quá lớn, không còn hiệu quả kinh tế.</p>
          
          <p><b>III. Hiệu quả kinh tế - xã hội mang lại:</b></p>
          <p>- Tăng tỷ lệ hài lòng của người học và doanh nghiệp liên kết đào tạo.</p>
          <p>- Đảm bảo thiết bị chạy ổn định, giảm tối đa thời gian gián đoạn dạy và học.</p>
          <p>- Tăng doanh thu dịch vụ đào tạo thông qua nâng cao năng lực tuyển sinh.</p>
        </div>
        <div class="doc-signatures" style="margin-top: 30px;">
          <div></div>
          <div style="text-align: center;">
            <b>TRƯỞNG PHÒNG/KHOA</b><br>
            <i>(Ký, ghi rõ họ tên)</i><br><br><br>
            <b>${pkg.expertTeamLeader.split(' (')[0]}</b>
          </div>
        </div>
      `;
    },
    getDocx: (pkg, methodCode) => {
      return new Document({
        sections: [{
          properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
          children: [
            docxHeaderTable(pkg, `${pkg.departmentCode}/TM`, pkg.dateProposal),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [
                new TextRun({ text: "BẢN THUYẾT MINH SỰ CẦN THIẾT VÀ HIỆU QUẢ CỦA GÓI THẦU MUA SẮM\n", bold: true, size: 26, font: "Times New Roman" }),
                new TextRun({ text: `(Gói thầu: ${pkg.packageName})`, italics: true, size: 22, font: "Times New Roman" })
              ]
            }),
            docxParagraph("I. Thực trạng trang thiết bị của đơn vị hiện tại:", { bold: true }),
            docxParagraph("Hiện nay, các thiết bị dạy học và phục vụ công việc tại đơn vị đã cũ kỹ, cấu hình lạc hậu so với công nghệ thực tế tại doanh nghiệp, thường xuyên hư hỏng hoặc không đồng bộ, không đáp ứng đủ quy mô thực hành cho học sinh sinh viên dạy và học thực hành.", { indent: 500 }),
            docxParagraph("II. Sự cần thiết đầu tư mua sắm:", { bold: true }),
            docxParagraph("1. Đồng bộ cơ sở vật chất theo chương trình đào tạo chất lượng cao, phục vụ công tác đánh giá kiểm định trường nghề chất lượng cao.", { indent: 500 }),
            docxParagraph("2. Đảm bảo an toàn lao động, an toàn thiết bị công nghệ thông tin và mạng nội bộ của nhà trường.", { indent: 500 }),
            docxParagraph("3. Thay thế các thiết bị hỏng hoàn toàn đã lập biên bản thanh lý tài sản cũ.", { indent: 500 }),
            docxParagraph("III. Hiệu quả kinh tế - xã hội mang lại:", { bold: true }),
            docxParagraph("Đầu tư giúp nâng cao chất lượng dạy và học trực quan sinh động, tối ưu hóa công suất khai thác trang thiết bị phục vụ công việc chung. Hỗ trợ trường khẳng định thương hiệu đào tạo của Bộ Công Thương.", { indent: 500 }),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            docxSignatureTable("", "", "TRƯỞNG PHÒNG/KHOA", pkg.expertTeamLeader.split(' (')[0])
          ]
        }]
      });
    }
  },

  // Document 4: Dự toán kinh phí
  {
    id: 4,
    name: "Dự toán kinh phí",
    getCategory: () => 'required',
    getCategoryLabel: () => 'Bắt buộc',
    getSigner: (pkg) => `Hiệu trưởng`,
    getSignDate: (pkg) => pkg.dateProposal,
    getAuditRisk: (pkg) => "Phê duyệt dự toán không căn cứ trên báo giá thị trường thực tế hoặc dự toán bị chia nhỏ để tránh đấu thầu rộng rãi.",
    getHtml: (pkg, methodCode) => {
      const total = pkg.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      return `
        <div class="doc-header">
          <div class="doc-header-left">
            BỘ CÔNG THƯƠNG<br>
            <b>TRƯỜNG CĐ KỸ THUẬT CÔNG NGHIỆP</b>
          </div>
          <div class="doc-header-right">
            <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>
            <b>Độc lập - Tự do - Hạnh phúc</b>
          </div>
        </div>
        <div class="doc-title" style="margin-top: 15px;">
          QUYẾT ĐỊNH<br>
          <span style="font-size: 13px; font-weight: normal; font-style: italic;">V/v Phê duyệt dự toán mua sắm thiết bị, vật tư của Trường</span>
        </div>
        <div class="doc-content">
          <p><b>HIỆU TRƯỞNG TRƯỜNG CAO ĐẲNG KỸ THUẬT CÔNG NGHIỆP</b></p>
          <p>Căn cứ Luật Quản lý, sử dụng tài sản công năm 2017 (sửa đổi bởi Luật số 90/2025/QH15);</p>
          <p>Căn cứ Quyết định số 541/QĐ-BCT ngày 25/3/2026 của Bộ Công Thương về giao quyền tự chủ tài chính giai đoạn 2026-2030;</p>
          <p>Căn cứ Thông tư số 13/2026/TT-BCT ngày 20/3/2026 của Bộ Công Thương về phân cấp thẩm quyền quản lý ngân sách, tài sản công;</p>
          <p>Xét đề nghị của Trưởng phòng Tài chính - Kế hoạch và Trưởng phòng Quản trị đời sống,</p>
          <p style="text-align: center; font-weight: bold;">QUYẾT ĐỊNH:</p>
          <p><b>Điều 1.</b> Phê duyệt dự toán gói thầu: <b>"${pkg.packageName}"</b>.</p>
          <p>- Tổng kinh phí dự toán: <b>${formatVND(total)}</b> (Bằng chữ: ${numberToWords(total)}).</p>
          <p>- Nguồn kinh phí: ${pkg.fundingSourceName}.</p>
          <p><b>Điều 2.</b> Giao Phòng Quản trị đời sống chủ trì, phối hợp với các đơn vị liên quan triển khai các bước mua sắm tiếp theo đúng quy định hiện hành.</p>
        </div>
        <div class="doc-signatures" style="margin-top: 20px;">
          <div style="text-align: left;">
            <b><i>Nơi nhận:</i></b><br>
            - Như Điều 2;<br>
            - Lưu VT, TC-KH.
          </div>
          <div style="text-align: center;">
            <b>HIỆU TRƯỞNG</b><br>
            <i>(Ký, ghi rõ họ tên, đóng dấu)</i><br><br><br>
            <b>${pkg.rectorName}</b>
          </div>
        </div>
      `;
    },
    getDocx: (pkg, methodCode) => {
      const total = pkg.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
      return new Document({
        sections: [{
          properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
          children: [
            docxHeaderTable(pkg, `.../QĐ-CĐKTCN`, pkg.dateProposal),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [
                new TextRun({ text: "QUYẾT ĐỊNH\n", bold: true, size: 28, font: "Times New Roman" }),
                new TextRun({ text: "V/v Phê duyệt dự toán mua sắm thiết bị, vật tư của Trường", bold: true, size: 24, font: "Times New Roman" })
              ]
            }),
            docxParagraph("HIỆU TRƯỞNG TRƯỜNG CAO ĐẲNG KỸ THUẬT CÔNG NGHIỆP", { bold: true, align: AlignmentType.CENTER }),
            docxParagraph("Căn cứ Luật Quản lý, sử dụng tài sản công năm 2017 (sửa đổi bởi Luật số 90/2025/QH15);", { indent: 500 }),
            docxParagraph("Căn cứ Quyết định số 541/QĐ-BCT ngày 25/3/2026 của Bộ Công Thương về giao quyền tự chủ tài chính giai đoạn 2026-2030 cho trường;", { indent: 500 }),
            docxParagraph("Căn cứ Thông tư số 13/2026/TT-BCT ngày 20/3/2026 của Bộ Công Thương về phân cấp quản lý ngân sách, tài sản công của Bộ Công Thương;", { indent: 500 }),
            docxParagraph("Xét đề nghị của Trưởng phòng Tài chính - Kế hoạch và Trưởng phòng Quản trị đời sống,", { indent: 500 }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 100, after: 100 },
              children: [new TextRun({ text: "QUYẾT ĐỊNH:", bold: true, size: 26, font: "Times New Roman" })]
            }),
            docxParagraph(`Điều 1. Phê duyệt dự toán gói thầu: "${pkg.packageName}".`, { bold: true }),
            docxParagraph(`- Tổng kinh phí dự toán: ${formatVND(total)} (Bằng chữ: ${numberToWords(total)}).`, { indent: 500 }),
            docxParagraph(`- Nguồn kinh phí: ${pkg.fundingSourceName}.`, { indent: 500 }),
            docxParagraph("Điều 2. Giao các phòng ban nghiệp vụ triển khai các bước mua sắm tiếp theo đúng quy định hiện hành.", { bold: true }),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            docxSignatureTable("Nơi nhận:\n- Như Điều 2;\n- Lưu VT, TC-KH.", "", "HIỆU TRƯỞNG", pkg.rectorName)
          ]
        }]
      });
    }
  },

  // Document 5: Biên bản khảo sát giá
  {
    id: 5,
    name: "Biên bản khảo sát giá",
    getCategory: () => 'required',
    getCategoryLabel: () => 'Bắt buộc',
    getSigner: (pkg) => `Tổ khảo sát giá (Phòng chuyên môn & Tài chính)`,
    getSignDate: (pkg) => pkg.dateSurvey,
    getAuditRisk: (pkg) => "Khảo sát giá chỉ mang tính hình thức, ghi khống thông tin khảo sát hoặc báo giá ảo từ các doanh nghiệp thân hữu.",
    getHtml: (pkg, methodCode) => {
      return `
        <div class="doc-header">
          <div class="doc-header-left">
            BỘ CÔNG THƯƠNG<br>
            <b>TRƯỜNG CĐ KỸ THUẬT CÔNG NGHIỆP</b>
          </div>
          <div class="doc-header-right">
            <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>
            <b>Độc lập - Tự do - Hạnh phúc</b>
          </div>
        </div>
        <div class="doc-title" style="margin-top: 15px;">
          BIÊN BẢN KHẢO SÁT GIÁ THỊ TRƯỜNG<br>
          <span style="font-size: 13px; font-weight: normal; font-style: italic;">(V/v Lập dự toán mua sắm tài sản, thiết bị)</span>
        </div>
        <div class="doc-content">
          <p>Hôm nay, ngày ${formatDateVietnamese(pkg.dateSurvey)}, tại Trường Cao đẳng Kỹ thuật Công nghiệp, Tổ khảo sát giá gồm:</p>
          <p>1. ${pkg.expertTeamLeader.split(' (')[0]} - Trưởng phòng QTDS - Tổ trưởng.</p>
          <p>2. ${pkg.appraisalLeader.split(' (')[0]} - Trưởng phòng TC-KH - Thành viên.</p>
          <p>Đã tiến hành khảo sát giá thị trường của các trang thiết bị phục vụ gói thầu: <b>"${pkg.packageName}"</b>.</p>
          <p><b>Hình thức khảo sát:</b> Gửi thư yêu cầu báo giá đến các đơn vị cung ứng uy tín trên thị trường, tra cứu giá trúng thầu của các đơn vị tương tự trên Hệ thống mạng đấu thầu quốc gia.</p>
          <p><b>Kết quả thu nhận:</b> Thu thập được 03 báo giá hợp lệ từ 03 nhà cung cấp có đủ năng lực pháp lý hoạt động trong lĩnh vực cung cấp hàng hóa/dịch vụ này.</p>
        </div>
        <div class="doc-signatures" style="margin-top: 35px;">
          <div style="text-align: center;">
            <b>Đại diện phòng Tài chính</b><br><br><br>
            <b>${pkg.appraisalLeader.split(' (')[0]}</b>
          </div>
          <div style="text-align: center;">
            <b>Tổ trưởng tổ khảo sát</b><br><br><br>
            <b>${pkg.expertTeamLeader.split(' (')[0]}</b>
          </div>
        </div>
      `;
    },
    getDocx: (pkg, methodCode) => {
      return new Document({
        sections: [{
          properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
          children: [
            docxHeaderTable(pkg, `${pkg.departmentCode}/BBKS`, pkg.dateSurvey),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [
                new TextRun({ text: "BIÊN BẢN KHẢO SÁT GIÁ THỊ TRƯỜNG\n", bold: true, size: 26, font: "Times New Roman" }),
                new TextRun({ text: "(V/v Lập dự toán mua sắm tài sản, thiết bị)", italics: true, size: 22, font: "Times New Roman" })
              ]
            }),
            docxParagraph(`Hôm nay, ngày ${formatDateVietnamese(pkg.dateSurvey)}, tại phòng họp Trường Cao đẳng Kỹ thuật Công nghiệp, Tổ khảo sát giá gồm:`, { indent: 500 }),
            docxParagraph(`1. ${pkg.expertTeamLeader.split(' (')[0]} - Tổ trưởng.`, { indent: 500 }),
            docxParagraph(`2. ${pkg.appraisalLeader.split(' (')[0]} - Thành viên.`, { indent: 500 }),
            docxParagraph(`Đã tiến hành khảo sát giá thị trường của các trang thiết bị phục vụ gói thầu: "${pkg.packageName}".`, { indent: 500 }),
            docxParagraph("Tổ khảo sát tiến hành tra cứu giá qua các nguồn thông tin đại chúng và thu thập 03 báo giá trực tiếp từ các đơn vị kinh doanh cung cấp thiết bị.", { indent: 500 }),
            docxParagraph("Các báo giá thu thập được bảo đảm tính cạnh tranh, minh bạch và phù hợp với giá giao dịch trên thị trường.", { indent: 500 }),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            docxSignatureTable("Đại diện phòng Tài chính", pkg.appraisalLeader.split(' (')[0], "Tổ trưởng tổ khảo sát", pkg.expertTeamLeader.split(' (')[0])
          ]
        }]
      });
    }
  },

  // Document 6: Bảng so sánh tối thiểu 3 báo giá
  {
    id: 6,
    name: "Bảng so sánh tối thiểu 3 báo giá",
    getCategory: () => 'required',
    getCategoryLabel: () => 'Bắt buộc',
    getSigner: (pkg) => `Tổ khảo sát giá`,
    getSignDate: (pkg) => pkg.dateCompare,
    getAuditRisk: (pkg) => "Ba báo giá do các công ty có chung chủ sở hữu hoặc mối quan hệ mật thiết ký phát hành nhằm thông thầu, đẩy giá gói thầu lên cao.",
    getHtml: (pkg, methodCode) => {
      return `
        <div class="doc-header">
          <div class="doc-header-left">
            BỘ CÔNG THƯƠNG<br>
            <b>TRƯỜNG CĐ KỸ THUẬT CÔNG NGHIỆP</b>
          </div>
          <div class="doc-header-right">
            <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>
            <b>Độc lập - Tự do - Hạnh phúc</b>
          </div>
        </div>
        <div class="doc-title" style="margin-top: 15px;">
          BẢNG SO SÁNH CÁC BÁO GIÁ THIẾT BỊ, VẬT TƯ THAM KHẢO<br>
          <span style="font-size: 13px; font-weight: normal; font-style: italic;">(Làm cơ sở xây dựng giá gói thầu đề xuất)</span>
        </div>
        <div style="font-size:13px; margin-bottom: 10px;">
          <b>Đơn vị báo giá:</b><br>
          1. Báo giá số 1: ${pkg.supplier1Name}<br>
          2. Báo giá số 2: ${pkg.supplier2Name}<br>
          3. Báo giá số 3: ${pkg.supplier3Name}
        </div>
        Bảng so sánh:
        <table class="doc-table">
          <thead>
            <tr>
              <th rowspan="2">STT</th>
              <th rowspan="2">Tên hàng hóa</th>
              <th rowspan="2">SL</th>
              <th colspan="2">Báo giá 1 (${pkg.supplier1Name})</th>
              <th colspan="2">Báo giá 2 (${pkg.supplier2Name})</th>
              <th colspan="2">Báo giá 3 (${pkg.supplier3Name})</th>
            </tr>
            <tr>
              <th>Đơn giá</th>
              <th>Thành tiền</th>
              <th>Đơn giá</th>
              <th>Thành tiền</th>
              <th>Đơn giá</th>
              <th>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${pkg.items.map((item, idx) => `
              <tr>
                <td style="text-align: center;">${idx+1}</td>
                <td>${item.name}</td>
                <td style="text-align: center;">${item.quantity}</td>
                <td style="text-align: right;">${formatVND(item.supplier1Price)}</td>
                <td style="text-align: right;">${formatVND(item.quantity * item.supplier1Price)}</td>
                <td style="text-align: right;">${formatVND(item.supplier2Price)}</td>
                <td style="text-align: right;">${formatVND(item.quantity * item.supplier2Price)}</td>
                <td style="text-align: right;">${formatVND(item.supplier3Price)}</td>
                <td style="text-align: right;">${formatVND(item.quantity * item.supplier3Price)}</td>
              </tr>
            `).join('')}
            <tr style="font-weight: bold; background: rgba(0,0,0,0.02)">
              <td colspan="3" style="text-align: right;">TỔNG CỘNG:</td>
              <td colspan="2" style="text-align: right;">${formatVND(pkg.items.reduce((sum, item) => sum + item.quantity * item.supplier1Price, 0))}</td>
              <td colspan="2" style="text-align: right;">${formatVND(pkg.items.reduce((sum, item) => sum + item.quantity * item.supplier2Price, 0))}</td>
              <td colspan="2" style="text-align: right;">${formatVND(pkg.items.reduce((sum, item) => sum + item.quantity * item.supplier3Price, 0))}</td>
            </tr>
          </tbody>
        </table>
        <p style="font-size: 13px; margin-top: 10px;"><b>Kết luận:</b> Đề xuất lựa chọn giá của đơn vị có giá thấp nhất là <b>${getWinnerSupplier(pkg).name}</b> làm cơ sở lập kế hoạch lựa chọn nhà thầu.</p>
        <div class="doc-signatures" style="margin-top: 20px;">
          <div style="text-align: center;">
            <b>Người so sánh</b><br><br><br>
            <b>${pkg.appraisalLeader.split(' (')[0]}</b>
          </div>
          <div style="text-align: center;">
            <b>Tổ trưởng tổ khảo sát</b><br><br><br>
            <b>${pkg.expertTeamLeader.split(' (')[0]}</b>
          </div>
        </div>
      `;
    },
    getDocx: (pkg, methodCode) => {
      const winner = getWinnerSupplier(pkg);
      return new Document({
        sections: [{
          properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
          children: [
            docxHeaderTable(pkg, `${pkg.departmentCode}/SSBG`, pkg.dateCompare),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [
                new TextRun({ text: "BẢNG SO SÁNH CÁC BÁO GIÁ THIẾT BỊ, VẬT TƯ THAM KHẢO\n", bold: true, size: 26, font: "Times New Roman" }),
                new TextRun({ text: "(Làm cơ sở xây dựng giá gói thầu đề xuất)", italics: true, size: 22, font: "Times New Roman" })
              ]
            }),
            docxParagraph(`Bảng tổng hợp đối chiếu báo giá của 03 nhà cung cấp khác nhau trên thị trường:`, { indent: 500 }),
            docxCompareTable(pkg),
            new Paragraph({ text: "\n", spacing: { after: 50 } }),
            docxParagraph(`Kết luận: Tổ khảo sát đề xuất lựa chọn đơn giá của đơn vị có tổng giá trị thấp nhất là: ${winner.name} với tổng giá trị ${formatVND(winner.total)} để làm giá trúng thầu dự kiến.`, { bold: true }),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            docxSignatureTable("Người lập biểu", pkg.appraisalLeader.split(' (')[0], "Tổ trưởng tổ khảo sát", pkg.expertTeamLeader.split(' (')[0])
          ]
        }]
      });
    }
  },

  // Document 7: Danh mục hàng hóa
  {
    id: 7,
    name: "Danh mục hàng hóa",
    getCategory: () => 'required',
    getCategoryLabel: () => 'Bắt buộc',
    getSigner: (pkg) => `Hiệu trưởng / Tổ chuyên gia`,
    getSignDate: (pkg) => pkg.dateKhlcnt,
    getAuditRisk: (pkg) => "Không liệt kê rõ danh mục dẫn đến bàn giao hàng hóa sai nhãn hiệu hoặc hàng giả, hàng kém chất lượng.",
    getHtml: (pkg, methodCode) => {
      return `
        <div class="doc-header">
          <div class="doc-header-left">
            BỘ CÔNG THƯƠNG<br>
            <b>TRƯỜNG CĐ KỸ THUẬT CÔNG NGHIỆP</b>
          </div>
          <div class="doc-header-right">
            <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>
            <b>Độc lập - Tự do - Hạnh phúc</b>
          </div>
        </div>
        <div class="doc-title" style="margin-top: 15px;">
          DANH MỤC HÀNG HÓA, THIẾT BỊ MUA SẮM CHI TIẾT<br>
          <span style="font-size: 13px; font-weight: normal; font-style: italic;">(Kèm theo Kế hoạch lựa chọn nhà thầu)</span>
        </div>
        <table class="doc-table">
          <thead>
            <tr>
              <th>STT</th>
              <th>Tên thiết bị</th>
              <th>ĐVT</th>
              <th>SL</th>
              <th>Mục đích sử dụng</th>
              <th>Xuất xứ dự kiến</th>
            </tr>
          </thead>
          <tbody>
            ${pkg.items.map((item, idx) => `
              <tr>
                <td style="text-align: center;">${idx+1}</td>
                <td>${item.name}</td>
                <td style="text-align: center;">${item.unit}</td>
                <td style="text-align: center;">${item.quantity}</td>
                <td>Phục vụ đào tạo thực hành của trường</td>
                <td>Việt Nam/Châu Á</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="doc-signatures" style="margin-top: 30px;">
          <div></div>
          <div style="text-align: center;">
            <b>TỔ TRƯỞNG TỔ CHUYÊN GIA</b><br><br><br>
            <b>${pkg.expertTeamLeader.split(' (')[0]}</b>
          </div>
        </div>
      `;
    },
    getDocx: (pkg, methodCode) => {
      const rows = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "STT", bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Tên hàng hóa", bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ĐVT", bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Số lượng", bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Xuất xứ", bold: true })] })] }),
          ]
        }),
        ...pkg.items.map((item, idx) => new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: (idx + 1).toString(), alignment: AlignmentType.CENTER })] }),
            new TableCell({ children: [new Paragraph({ text: item.name })] }),
            new TableCell({ children: [new Paragraph({ text: item.unit, alignment: AlignmentType.CENTER })] }),
            new TableCell({ children: [new Paragraph({ text: item.quantity.toString(), alignment: AlignmentType.CENTER })] }),
            new TableCell({ children: [new Paragraph({ text: "Chính hãng", alignment: AlignmentType.CENTER })] }),
          ]
        }))
      ];
      return new Document({
        sections: [{
          properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
          children: [
            docxHeaderTable(pkg, `${pkg.departmentCode}/DMHH`, pkg.dateKhlcnt),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [
                new TextRun({ text: "DANH MỤC HÀNG HÓA MUA SẮM CHI TIẾT\n", bold: true, size: 26, font: "Times New Roman" })
              ]
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: rows
            }),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            docxSignatureTable("", "", "TỔ TRƯỞNG TỔ CHUYÊN GIA", pkg.expertTeamLeader.split(' (')[0])
          ]
        }]
      });
    }
  },

  // Document 8: Yêu cầu kỹ thuật
  {
    id: 8,
    name: "Yêu cầu kỹ thuật",
    getCategory: () => 'required',
    getCategoryLabel: () => 'Bắt buộc',
    getSigner: (pkg) => `Hiệu trưởng / Tổ chuyên gia`,
    getSignDate: (pkg) => pkg.dateKhlcnt,
    getAuditRisk: (pkg) => "Cố tình ghi tên hãng cụ thể hoặc các thông số kỹ thuật mang tính 'độc quyền' để khóa hãng, cản trở các nhà thầu khác tham gia đấu thầu.",
    getHtml: (pkg, methodCode) => {
      return `
        <div class="doc-header">
          <div class="doc-header-left">
            BỘ CÔNG THƯƠNG<br>
            <b>TRƯỜNG CĐ KỸ THUẬT CÔNG NGHIỆP</b>
          </div>
          <div class="doc-header-right">
            <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>
            <b>Độc lập - Tự do - Hạnh phúc</b>
          </div>
        </div>
        <div class="doc-title" style="margin-top: 15px;">
          BẢN YÊU CẦU KỸ THUẬT CỦA THIẾT BỊ MUA SẮM<br>
          <span style="font-size: 13px; font-weight: normal; font-style: italic;">(Gói thầu: ${pkg.packageName})</span>
        </div>
        <div class="doc-content">
          <p>Yêu cầu kỹ thuật chi tiết của hàng hóa/dịch vụ:</p>
          <ul>
            ${pkg.items.map(item => `
              <li><b>${item.name}:</b>
                <br>- Thông số tối thiểu: ${item.specs}
                <br>- Yêu cầu chất lượng: Hàng mới 100%, có chứng nhận xuất xứ (CO), chứng nhận chất lượng (CQ) đầy đủ.
              </li>
            `).join('')}
          </ul>
          <p><b>Yêu cầu chung:</b> Bảo hành tối thiểu theo quy định của hãng. Giao hàng và lắp đặt bàn giao chạy thử tại địa điểm do nhà trường chỉ định.</p>
        </div>
        <div class="doc-signatures" style="margin-top: 30px;">
          <div></div>
          <div style="text-align: center;">
            <b>TỔ TRƯỞNG TỔ CHUYÊN GIA</b><br><br><br>
            <b>${pkg.expertTeamLeader.split(' (')[0]}</b>
          </div>
        </div>
      `;
    },
    getDocx: (pkg, methodCode) => {
      const content: Paragraph[] = [];
      pkg.items.forEach(item => {
        content.push(docxParagraph(`- ${item.name}:`, { bold: true }));
        content.push(docxParagraph(`  + Yêu cầu quy cách, cấu hình: ${item.specs}`, { indent: 200 }));
        content.push(docxParagraph("  + Yêu cầu tình trạng: Hàng mới 100%, bảo hành chính hãng từ nhà sản xuất.", { indent: 200 }));
      });
      return new Document({
        sections: [{
          properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
          children: [
            docxHeaderTable(pkg, `${pkg.departmentCode}/YCKT`, pkg.dateKhlcnt),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [
                new TextRun({ text: "YÊU CẦU KỸ THUẬT TIÊU CHUẨN CỦA HÀNG HÓA\n", bold: true, size: 26, font: "Times New Roman" })
              ]
            }),
            ...content,
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            docxSignatureTable("", "", "TỔ TRƯỞNG TỔ CHUYÊN GIA", pkg.expertTeamLeader.split(' (')[0])
          ]
        }]
      });
    }
  },

  // Document 9: Tiêu chuẩn đánh giá
  {
    id: 9,
    name: "Tiêu chuẩn đánh giá",
    getCategory: (m) => m === 'DIRECT_50' ? 'not_applicable' : 'required',
    getCategoryLabel: (m) => m === 'DIRECT_50' ? 'Không áp dụng' : 'Bắt buộc',
    getSigner: (pkg) => `Hiệu trưởng / Tổ chuyên gia`,
    getSignDate: (pkg) => pkg.dateKhlcnt,
    getAuditRisk: (pkg) => "Quy định các tiêu chí đánh giá năng lực, kinh nghiệm bất hợp lý nhằm mục đích loại bỏ các nhà thầu khác.",
    getHtml: (pkg, methodCode) => {
      return `
        <div class="doc-header">
          <div class="doc-header-left">
            BỘ CÔNG THƯƠNG<br>
            <b>TRƯỜNG CĐ KỸ THUẬT CÔNG NGHIỆP</b>
          </div>
          <div class="doc-header-right">
            <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>
            <b>Độc lập - Tự do - Hạnh phúc</b>
          </div>
        </div>
        <div class="doc-title" style="margin-top: 15px;">
          TIÊU CHUẨN ĐÁNH GIÁ HỒ SƠ ĐỀ XUẤT/DỰ THẦU<br>
          <span style="font-size: 13px; font-weight: normal; font-style: italic;">(Gói thầu: ${pkg.packageName})</span>
        </div>
        <div class="doc-content">
          <p><b>1. Đánh giá về tư cách hợp lệ và năng lực pháp lý:</b></p>
          <p>- Có giấy đăng ký doanh nghiệp hoạt động kinh doanh hợp pháp phù hợp với gói thầu.</p>
          <p>- Không trong quá trình giải thể, không bị kết luận phá sản, không bị cấm tham gia thầu.</p>
          
          <p><b>2. Đánh giá về mặt kỹ thuật (Đạt/Không đạt):</b></p>
          <p>- Toàn bộ thiết bị cung cấp đáp ứng đúng cấu hình kỹ thuật tối thiểu quy định tại Yêu cầu kỹ thuật.</p>
          <p>- Thời gian giao hàng và chính sách bảo hành đáp ứng yêu cầu của nhà trường.</p>
          
          <p><b>3. Đánh giá về mặt tài chính/giá:</b></p>
          <p>- Áp dụng phương pháp giá thấp nhất (đối với nhà thầu đáp ứng yêu cầu kỹ thuật).</p>
        </div>
        <div class="doc-signatures" style="margin-top: 30px;">
          <div></div>
          <div style="text-align: center;">
            <b>TỔ TRƯỞNG TỔ CHUYÊN GIA</b><br><br><br>
            <b>${pkg.expertTeamLeader.split(' (')[0]}</b>
          </div>
        </div>
      `;
    },
    getDocx: (pkg, methodCode) => {
      return new Document({
        sections: [{
          properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
          children: [
            docxHeaderTable(pkg, `${pkg.departmentCode}/TCĐG`, pkg.dateKhlcnt),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [
                new TextRun({ text: "TIÊU CHUẨN ĐÁNH GIÁ HỒ SƠ LỰA CHỌN NHÀ THẦU\n", bold: true, size: 26, font: "Times New Roman" })
              ]
            }),
            docxParagraph("1. Tiêu chuẩn đánh giá năng lực, kinh nghiệm (Đạt/Không đạt):", { bold: true }),
            docxParagraph("- Đăng ký kinh doanh hợp pháp, có ngành nghề phù hợp.", { indent: 500 }),
            docxParagraph("- Hoàn thành nghĩa vụ nộp thuế năm gần nhất.", { indent: 500 }),
            docxParagraph("2. Tiêu chuẩn đánh giá kỹ thuật (Đạt/Không đạt):", { bold: true }),
            docxParagraph("- Đáp ứng 100% thông số kỹ thuật tối thiểu theo yêu cầu.", { indent: 500 }),
            docxParagraph("- Thời gian bảo hành đáp ứng đúng quy định.", { indent: 500 }),
            docxParagraph("3. Tiêu chuẩn đánh giá giá:", { bold: true }),
            docxParagraph("- Lựa chọn nhà thầu có giá đề nghị trúng thầu thấp nhất sau khi sửa lỗi và hiệu chỉnh sai lệch.", { indent: 500 }),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            docxSignatureTable("", "", "TỔ TRƯỞNG TỔ CHUYÊN GIA", pkg.expertTeamLeader.split(' (')[0])
          ]
        }]
      });
    }
  },

  // Document 10: Kế hoạch lựa chọn nhà thầu (KHLCNT)
  {
    id: 10,
    name: "Kế hoạch lựa chọn nhà thầu",
    getCategory: (m) => m === 'DIRECT_50' ? 'not_applicable' : 'required',
    getCategoryLabel: (m) => m === 'DIRECT_50' ? 'Không áp dụng' : 'Bắt buộc',
    getSigner: (pkg) => `Phòng TC-KH trình Hiệu trưởng`,
    getSignDate: (pkg) => pkg.dateKhlcnt,
    getAuditRisk: (pkg) => "Giá gói thầu không ghi rõ căn cứ pháp lý phê duyệt hoặc phân chia gói thầu sai quy định để áp dụng chỉ định thầu.",
    getHtml: (pkg, methodCode) => {
      const total = pkg.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const pm = getProcurementMethod(pkg);
      return `
        <div class="doc-header">
          <div class="doc-header-left">
            BỘ CÔNG THƯƠNG<br>
            <b>TRƯỜNG CĐ KỸ THUẬT CÔNG NGHIỆP</b>
          </div>
          <div class="doc-header-right">
            <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>
            <b>Độc lập - Tự do - Hạnh phúc</b>
          </div>
        </div>
        <div class="doc-title" style="margin-top: 15px;">
          TỜ TRÌNH<br>
          <span style="font-size: 13px; font-weight: normal; font-style: italic;">V/v Phê duyệt Kế hoạch lựa chọn nhà thầu gói thầu mua sắm</span>
        </div>
        <div class="doc-content">
          <p>Kính gửi: Hiệu trưởng Trường Cao đẳng Kỹ thuật Công nghiệp</p>
          <p>Căn cứ Luật Đấu thầu số 22/2023/QH15 và Nghị định số 214/2025/NĐ-CP của Chính phủ;</p>
          <p>Căn cứ Quyết định phê duyệt dự toán kinh phí số .../QĐ-CĐKTCN ngày ${formatDateVietnamese(pkg.dateProposal)} của Hiệu trưởng;</p>
          <p>Phòng Tài chính - Kế hoạch trình Hiệu trưởng xem xét, phê duyệt KHLCNT gói thầu với các nội dung sau:</p>
          <table class="doc-table">
            <thead>
              <tr>
                <th>Nội dung</th>
                <th>Thông tin chi tiết</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><b>Tên gói thầu</b></td>
                <td>${pkg.packageName}</td>
              </tr>
              <tr>
                <td><b>Giá gói thầu</b></td>
                <td>${formatVND(total)} (Bằng chữ: ${numberToWords(total)})</td>
              </tr>
              <tr>
                <td><b>Nguồn vốn</b></td>
                <td>${pkg.fundingSourceName}</td>
              </tr>
              <tr>
                <td><b>Hình thức LCNT</b></td>
                <td>${pm.name}</td>
              </tr>
              <tr>
                <td><b>Phương thức LCNT</b></td>
                <td>Một giai đoạn một túi hồ sơ</td>
              </tr>
              <tr>
                <td><b>Thời gian bắt đầu</b></td>
                <td>Quý II/2026</td>
              </tr>
              <tr>
                <td><b>Loại hợp đồng</b></td>
                <td>Hợp đồng trọn gói</td>
              </tr>
              <tr>
                <td><b>Thời gian thực hiện</b></td>
                <td>${pkg.contractDurationDays} ngày kể từ ngày hợp đồng có hiệu lực</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="doc-signatures" style="margin-top: 20px;">
          <div></div>
          <div style="text-align: center;">
            <b>TRƯỞNG PHÒNG TÀI CHÍNH - KẾ HOẠCH</b><br><br><br>
            <b>${pkg.appraisalLeader.split(' (')[0]}</b>
          </div>
        </div>
      `;
    },
    getDocx: (pkg, methodCode) => {
      const total = pkg.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const pm = getProcurementMethod(pkg);
      const rows = [
        ["Tên gói thầu", pkg.packageName],
        ["Giá gói thầu", `${formatVND(total)} (Bằng chữ: ${numberToWords(total)})`],
        ["Nguồn vốn", pkg.fundingSourceName],
        ["Hình thức LCNT", pm.name],
        ["Phương thức LCNT", "Một giai đoạn một túi hồ sơ"],
        ["Thời gian bắt đầu thực hiện", "Quý II/2026"],
        ["Loại hợp đồng", "Hợp đồng trọn gói"],
        ["Thời gian thực hiện hợp đồng", `${pkg.contractDurationDays} ngày`]
      ].map(([k, v]) => new TableRow({
        children: [
          new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: k, bold: true })] })] }),
          new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: v })] }),
        ]
      }));

      return new Document({
        sections: [{
          properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
          children: [
            docxHeaderTable(pkg, `.../TTr-TCKH`, pkg.dateKhlcnt),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [
                new TextRun({ text: "TỜ TRÌNH\n", bold: true, size: 28, font: "Times New Roman" }),
                new TextRun({ text: "V/v Phê duyệt Kế hoạch lựa chọn nhà thầu gói thầu mua sắm", bold: true, size: 24, font: "Times New Roman" })
              ]
            }),
            docxParagraph("Kính gửi: Hiệu trưởng Trường Cao đẳng Kỹ thuật Công nghiệp", { bold: true, align: AlignmentType.CENTER }),
            docxParagraph("Phòng Tài chính - Kế hoạch kính trình Hiệu trưởng xem xét, phê duyệt Kế hoạch lựa chọn nhà thầu với các thông tin chi tiết như sau:", { indent: 500 }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: rows
            }),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            docxSignatureTable("", "", "TRƯỞNG PHÒNG TÀI CHÍNH - KẾ HOẠCH", pkg.appraisalLeader.split(' (')[0])
          ]
        }]
      });
    }
  },

  // Document 11: Quyết định phê duyệt KHLCNT
  {
    id: 11,
    name: "Quyết định phê duyệt KHLCNT",
    getCategory: (m) => m === 'DIRECT_50' ? 'not_applicable' : 'required',
    getCategoryLabel: (m) => m === 'DIRECT_50' ? 'Không áp dụng' : 'Bắt buộc',
    getSigner: (pkg) => `Hiệu trưởng`,
    getSignDate: (pkg) => pkg.dateKhlcntApprove,
    getAuditRisk: (pkg) => "Quyết định phê duyệt KHLCNT vượt hạn mức phân cấp của Bộ hoặc không nêu rõ trách nhiệm tổ chức đấu thầu.",
    getHtml: (pkg, methodCode) => {
      const total = pkg.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const pm = getProcurementMethod(pkg);
      return `
        <div class="doc-header">
          <div class="doc-header-left">
            BỘ CÔNG THƯƠNG<br>
            <b>TRƯỜNG CĐ KỸ THUẬT CÔNG NGHIỆP</b><br>
            Số: .../QĐ-CĐKTCN
          </div>
          <div class="doc-header-right">
            <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>
            <b>Độc lập - Tự do - Hạnh phúc</b><br>
            <i>Bắc Giang, ngày ${formatDateVietnamese(pkg.dateKhlcntApprove)}</i>
          </div>
        </div>
        <div class="doc-title" style="margin-top: 15px;">
          QUYẾT ĐỊNH<br>
          <span style="font-size: 13px; font-weight: normal; font-style: italic;">V/v Phê duyệt Kế hoạch lựa chọn nhà thầu gói thầu mua sắm</span>
        </div>
        <div class="doc-content">
          <p><b>HIỆU TRƯỞNG TRƯỜNG CAO ĐẲNG KỸ THUẬT CÔNG NGHIỆP</b></p>
          <p>Căn cứ các Luật Đấu thầu hiện hành và Nghị định số 214/2025/NĐ-CP của Chính phủ;</p>
          <p>Căn cứ Quyết định phân cấp thẩm quyền của Bộ Công Thương;</p>
          <p>Xét đề nghị của Trưởng phòng Tài chính - Kế hoạch,</p>
          <p style="text-align: center; font-weight: bold;">QUYẾT ĐỊNH:</p>
          <p><b>Điều 1.</b> Phê duyệt Kế hoạch lựa chọn nhà thầu gói thầu: <b>"${pkg.packageName}"</b> với tổng giá trị gói thầu là <b>${formatVND(total)}</b>.</p>
          <p>- Hình thức lựa chọn nhà thầu: ${pm.name}.</p>
          <p>- Phương thức: Một giai đoạn một túi hồ sơ.</p>
          <p>- Thời gian bắt đầu: Quý II/2026.</p>
          <p>- Loại hợp đồng: Hợp đồng trọn gói.</p>
          <p><b>Điều 2.</b> Quyết định này có hiệu lực kể từ ngày ký. Các đơn vị liên quan chịu trách nhiệm thi hành.</p>
        </div>
        <div class="doc-signatures" style="margin-top: 20px;">
          <div style="text-align: left;">
            <b><i>Nơi nhận:</i></b><br>
            - Phòng QTDS, TC-KH;<br>
            - Lưu VT.
          </div>
          <div style="text-align: center;">
            <b>HIỆU TRƯỞNG</b><br><br><br>
            <b>${pkg.rectorName}</b>
          </div>
        </div>
      `;
    },
    getDocx: (pkg, methodCode) => {
      const total = pkg.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const pm = getProcurementMethod(pkg);
      return new Document({
        sections: [{
          properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
          children: [
            docxHeaderTable(pkg, `.../QĐ-CĐKTCN`, pkg.dateKhlcntApprove),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [
                new TextRun({ text: "QUYẾT ĐỊNH\n", bold: true, size: 28, font: "Times New Roman" }),
                new TextRun({ text: "V/v Phê duyệt Kế hoạch lựa chọn nhà thầu gói thầu mua sắm", bold: true, size: 24, font: "Times New Roman" })
              ]
            }),
            docxParagraph("HIỆU TRƯỞNG TRƯỜNG CAO ĐẲNG KỸ THUẬT CÔNG NGHIỆP", { bold: true, align: AlignmentType.CENTER }),
            docxParagraph("Căn cứ Luật Đấu thầu số 22/2023/QH15 và Luật số 90/2025/QH15 sửa đổi bổ sung;", { indent: 500 }),
            docxParagraph("Căn cứ Nghị định số 214/2025/NĐ-CP của Chính phủ hướng dẫn Luật Đấu thầu;", { indent: 500 }),
            docxParagraph(`Xét đề nghị của Trưởng phòng Tài chính - Kế hoạch trình ngày ${formatDateVietnamese(pkg.dateKhlcnt)},`, { indent: 500 }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 100, after: 100 },
              children: [new TextRun({ text: "QUYẾT ĐỊNH:", bold: true, size: 26, font: "Times New Roman" })]
            }),
            docxParagraph(`Điều 1. Phê duyệt Kế hoạch lựa chọn nhà thầu gói thầu: "${pkg.packageName}" với tổng giá trị ${formatVND(total)}.`, { bold: true }),
            docxParagraph(`- Hình thức lựa chọn nhà thầu: ${pm.name}.`, { indent: 500 }),
            docxParagraph(`- Phương thức: Một giai đoạn một túi hồ sơ.`, { indent: 500 }),
            docxParagraph(`- Thời gian thực hiện: ${pkg.contractDurationDays} ngày.`, { indent: 500 }),
            docxParagraph("Điều 2. Giao các đơn vị chức năng chịu trách nhiệm tổ chức thực hiện quyết định này theo đúng trình tự thủ tục của pháp luật.", { bold: true }),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            docxSignatureTable("Nơi nhận:\n- Như Điều 2;\n- Lưu VT.", "", "HIỆU TRƯỞNG", pkg.rectorName)
          ]
        }]
      });
    }
  },

  // Document 12: Hồ sơ mời thầu hoặc hồ sơ yêu cầu
  {
    id: 12,
    name: "Hồ sơ mời thầu hoặc hồ sơ yêu cầu",
    getCategory: (m) => m === 'DIRECT_50' ? 'not_applicable' : 'required',
    getCategoryLabel: (m) => m === 'DIRECT_50' ? 'Không áp dụng' : 'Bắt buộc',
    getSigner: (pkg) => `Hiệu trưởng phê duyệt phát hành`,
    getSignDate: (pkg) => pkg.dateDocIssue,
    getAuditRisk: (pkg) => "Hồ sơ yêu cầu hoặc hồ sơ mời thầu lồng ghép các điều kiện địa phương, giấy phép con trái quy định nhằm ngăn chặn nhà thầu ở địa phương khác.",
    getHtml: (pkg, methodCode) => {
      return `
        <div class="doc-header">
          <div class="doc-header-left">
            BỘ CÔNG THƯƠNG<br>
            <b>TRƯỜNG CĐ KỸ THUẬT CÔNG NGHIỆP</b>
          </div>
          <div class="doc-header-right">
            <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>
            <b>Độc lập - Tự do - Hạnh phúc</b>
          </div>
        </div>
        <div class="doc-title" style="margin-top: 15px;">
          HỒ SƠ YÊU CẦU / HỒ SƠ MỜI THẦU (BẢN TÓM TẮT PHÁT HÀNH)<br>
          <span style="font-size: 13px; font-weight: normal; font-style: italic;">(Ban hành kèm theo Quyết định số .../QĐ-CĐKTCN)</span>
        </div>
        <div class="doc-content">
          <p><b>Chương I. Chỉ dẫn nhà thầu:</b> Hướng dẫn chuẩn bị hồ sơ đề xuất, thời hạn nộp hồ sơ, yêu cầu về bảo đảm dự thầu (nếu có).</p>
          <p><b>Chương II. Bảng dữ liệu đấu thầu:</b> Quy định cụ thể địa chỉ nhận hồ sơ, thời điểm đóng thầu ngày <b>${formatDateVietnamese(pkg.dateBidClose)}</b>.</p>
          <p><b>Chương III. Tiêu chuẩn đánh giá:</b> Tiêu chuẩn năng lực, kỹ thuật và đánh giá giá thấp nhất.</p>
          <p><b>Chương IV. Yêu cầu về kỹ thuật:</b> Danh mục, thông số chi tiết của hàng hóa/dịch vụ cần mua sắm.</p>
          <p><b>Chương V. Dự thảo Hợp đồng:</b> Các điều khoản về giao hàng, thanh toán, bảo hành và phạt vi phạm.</p>
        </div>
        <div class="doc-signatures" style="margin-top: 30px;">
          <div></div>
          <div style="text-align: center;">
            <b>HIỆU TRƯỞNG</b><br><br><br>
            <b>${pkg.rectorName}</b>
          </div>
        </div>
      `;
    },
    getDocx: (pkg, methodCode) => {
      return new Document({
        sections: [{
          properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
          children: [
            docxHeaderTable(pkg, `${pkg.departmentCode}/HSYC`, pkg.dateDocIssue),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [
                new TextRun({ text: "HỒ SƠ YÊU CẦU MUA SẮM HÀNG HÓA\n", bold: true, size: 26, font: "Times New Roman" }),
                new TextRun({ text: `(Gói thầu: ${pkg.packageName})`, italics: true, size: 22, font: "Times New Roman" })
              ]
            }),
            docxParagraph("Hồ sơ yêu cầu bao gồm các nội dung chính:", { bold: true }),
            docxParagraph("1. Phần chỉ dẫn nhà thầu: Yêu cầu về tư cách hợp lệ của nhà thầu, chuẩn bị hồ sơ đề xuất.", { indent: 500 }),
            docxParagraph(`2. Yêu cầu về kỹ thuật: Cấu hình và chất lượng thiết bị theo bảng danh mục chi tiết kèm theo.`, { indent: 500 }),
            docxParagraph(`3. Dự thảo Hợp đồng: Hình thức hợp đồng trọn gói, thời gian thực hiện ${pkg.contractDurationDays} ngày.`, { indent: 500 }),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            docxSignatureTable("", "", "HIỆU TRƯỞNG", pkg.rectorName)
          ]
        }]
      });
    }
  },

  // Document 13: Quyết định thành lập tổ chuyên gia
  {
    id: 13,
    name: "Quyết định thành lập tổ chuyên gia",
    getCategory: (m) => m === 'DIRECT_50' ? 'not_applicable' : (m === 'DIRECT_SELECTION_SIMPLIFIED' ? 'recommended' : 'required'),
    getCategoryLabel: (m) => m === 'DIRECT_50' ? 'Không áp dụng' : (m === 'DIRECT_SELECTION_SIMPLIFIED' ? 'Khuyến nghị' : 'Bắt buộc'),
    getSigner: (pkg) => `Hiệu trưởng`,
    getSignDate: (pkg) => pkg.dateExpertEstablish,
    getAuditRisk: (pkg) => "Thành viên tổ chuyên gia không có chứng chỉ đào tạo đấu thầu hoặc có mối quan hệ gia đình/lợi ích với nhà thầu tham dự.",
    getHtml: (pkg, methodCode) => {
      return `
        <div class="doc-header">
          <div class="doc-header-left">
            BỘ CÔNG THƯƠNG<br>
            <b>TRƯỜNG CĐ KỸ THUẬT CÔNG NGHIỆP</b><br>
            Số: .../QĐ-CĐKTCN
          </div>
          <div class="doc-header-right">
            <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>
            <b>Độc lập - Tự do - Hạnh phúc</b><br>
            <i>Bắc Giang, ngày ${formatDateVietnamese(pkg.dateExpertEstablish)}</i>
          </div>
        </div>
        <div class="doc-title" style="margin-top: 15px;">
          QUYẾT ĐỊNH<br>
          <span style="font-size: 13px; font-weight: normal; font-style: italic;">V/v Thành lập Tổ chuyên gia lựa chọn nhà thầu gói thầu</span>
        </div>
        <div class="doc-content">
          <p><b>HIỆU TRƯỞNG TRƯỜNG CAO ĐẲNG KỸ THUẬT CÔNG NGHIỆP</b></p>
          <p>Căn cứ các Luật Đấu thầu hiện hành và Nghị định số 214/2025/NĐ-CP;</p>
          <p>Xét nhu cầu công việc và năng lực cán bộ,</p>
          <p style="text-align: center; font-weight: bold;">QUYẾT ĐỊNH:</p>
          <p><b>Điều 1.</b> Thành lập Tổ chuyên gia lựa chọn nhà thầu gói thầu: <b>"${pkg.packageName}"</b> gồm các ông (bà):</p>
          <p>1. ${pkg.expertTeamLeader} - Tổ trưởng.</p>
          <p>2. ${pkg.expertTeamMember1} - Thành viên.</p>
          <p>3. ${pkg.expertTeamMember2} - Thành viên.</p>
          <p><b>Điều 2.</b> Tổ chuyên gia có trách nhiệm đánh giá hồ sơ dự thầu/hồ sơ đề xuất của các nhà thầu trung thực, khách quan và lập báo cáo đánh giá trình Hiệu trưởng.</p>
        </div>
        <div class="doc-signatures" style="margin-top: 20px;">
          <div style="text-align: left;">
            <b><i>Nơi nhận:</i></b><br>
            - Tổ chuyên gia;<br>
            - Lưu VT.
          </div>
          <div style="text-align: center;">
            <b>HIỆU TRƯỞNG</b><br><br><br>
            <b>${pkg.rectorName}</b>
          </div>
        </div>
      `;
    },
    getDocx: (pkg, methodCode) => {
      return new Document({
        sections: [{
          properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
          children: [
            docxHeaderTable(pkg, `.../QĐ-CĐKTCN`, pkg.dateExpertEstablish),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [
                new TextRun({ text: "QUYẾT ĐỊNH\n", bold: true, size: 28, font: "Times New Roman" }),
                new TextRun({ text: "V/v Thành lập Tổ chuyên gia lựa chọn nhà thầu gói thầu", bold: true, size: 24, font: "Times New Roman" })
              ]
            }),
            docxParagraph("HIỆU TRƯỞNG TRƯỜNG CAO ĐẲNG KỸ THUẬT CÔNG NGHIỆP", { bold: true, align: AlignmentType.CENTER }),
            docxParagraph("Căn cứ Luật Đấu thầu số 22/2023/QH15;", { indent: 500 }),
            docxParagraph("Xét năng lực chuyên môn của cán bộ nhà trường,", { indent: 500 }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 100, after: 100 },
              children: [new TextRun({ text: "QUYẾT ĐỊNH:", bold: true, size: 26, font: "Times New Roman" })]
            }),
            docxParagraph(`Điều 1. Thành lập Tổ chuyên gia lựa chọn nhà thầu gói thầu: "${pkg.packageName}" gồm các ông (bà):`, { bold: true }),
            docxParagraph(`1. ${pkg.expertTeamLeader}.`, { indent: 500 }),
            docxParagraph(`2. ${pkg.expertTeamMember1}.`, { indent: 500 }),
            docxParagraph(`3. ${pkg.expertTeamMember2}.`, { indent: 500 }),
            docxParagraph("Điều 2. Tổ chuyên gia thực hiện nhiệm vụ đánh giá hồ sơ và báo cáo kết quả theo đúng quy định hiện hành.", { bold: true }),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            docxSignatureTable("Nơi nhận:\n- Như Điều 1;\n- Lưu VT.", "", "HIỆU TRƯỞNG", pkg.rectorName)
          ]
        }]
      });
    }
  },

  // Document 14: Báo cáo đánh giá
  {
    id: 14,
    name: "Báo cáo đánh giá",
    getCategory: (m) => m === 'DIRECT_50' ? 'not_applicable' : (m === 'DIRECT_SELECTION_SIMPLIFIED' ? 'recommended' : 'required'),
    getCategoryLabel: (m) => m === 'DIRECT_50' ? 'Không áp dụng' : (m === 'DIRECT_SELECTION_SIMPLIFIED' ? 'Khuyến nghị' : 'Bắt buộc'),
    getSigner: (pkg) => `Tổ chuyên gia`,
    getSignDate: (pkg) => pkg.dateEvaluate,
    getAuditRisk: (pkg) => "Bỏ qua các lỗi nghiêm trọng của hồ sơ nhà thầu được chỉ định hoặc đánh giá thiếu khách quan.",
    getHtml: (pkg, methodCode) => {
      const winner = getWinnerSupplier(pkg);
      return `
        <div class="doc-header">
          <div class="doc-header-left">
            BỘ CÔNG THƯƠNG<br>
            <b>TRƯỜNG CĐ KỸ THUẬT CÔNG NGHIỆP</b>
          </div>
          <div class="doc-header-right">
            <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>
            <b>Độc lập - Tự do - Hạnh phúc</b>
          </div>
        </div>
        <div class="doc-title" style="margin-top: 15px;">
          BÁO CÁO ĐÁNH GIÁ HỒ SƠ ĐỀ XUẤT/DỰ THẦU<br>
          <span style="font-size: 13px; font-weight: normal; font-style: italic;">(Gói thầu: ${pkg.packageName})</span>
        </div>
        <div class="doc-content">
          <p>Kính gửi: Hiệu trưởng Trường Cao đẳng Kỹ thuật Công nghiệp</p>
          <p>Tổ chuyên gia đã tiến hành đánh giá hồ sơ đề xuất của nhà thầu: <b>"${winner.name}"</b>.</p>
          <p><b>1. Kết quả đánh giá về tư cách hợp lệ và năng lực pháp lý:</b> ĐẠT (Nhà thầu có đầy đủ giấy phép, hoạt động bình thường, không vi phạm pháp luật).</p>
          <p><b>2. Kết quả đánh giá về mặt kỹ thuật:</b> ĐẠT (Đáp ứng 100% các yêu cầu kỹ thuật tối thiểu quy định trong Hồ sơ yêu cầu).</p>
          <p><b>3. Kết quả đánh giá về tài chính/giá:</b> Thấp nhất và nằm trong giá gói thầu được duyệt.</p>
          <p><b>Đề nghị:</b> Phê duyệt nhà thầu <b>"${winner.name}"</b> là đơn vị trúng thầu.</p>
        </div>
        <div class="doc-signatures" style="margin-top: 30px;">
          <div style="text-align: center;">
            <b>Thành viên tổ chuyên gia</b><br><br><br>
            <b>${pkg.expertTeamMember1.split(' (')[0]}</b>
          </div>
          <div style="text-align: center;">
            <b>Tổ trưởng tổ chuyên gia</b><br><br><br>
            <b>${pkg.expertTeamLeader.split(' (')[0]}</b>
          </div>
        </div>
      `;
    },
    getDocx: (pkg, methodCode) => {
      const winner = getWinnerSupplier(pkg);
      return new Document({
        sections: [{
          properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
          children: [
            docxHeaderTable(pkg, `${pkg.departmentCode}/BCĐG`, pkg.dateEvaluate),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [
                new TextRun({ text: "BÁO CÁO ĐÁNH GIÁ HỒ SƠ DỰ THẦU\n", bold: true, size: 26, font: "Times New Roman" })
              ]
            }),
            docxParagraph("Kính gửi: Hiệu trưởng Trường Cao đẳng Kỹ thuật Công nghiệp", { bold: true, align: AlignmentType.CENTER }),
            docxParagraph(`Tổ chuyên gia báo cáo kết quả đánh giá hồ sơ đề xuất của nhà thầu: ${winner.name}`, { indent: 500 }),
            docxParagraph("1. Đánh giá tư cách hợp lệ: Đạt.", { indent: 500 }),
            docxParagraph("2. Đánh giá kỹ thuật: Đạt. Thiết bị cung cấp đáp ứng đúng cấu hình kỹ thuật yêu cầu.", { indent: 500 }),
            docxParagraph(`3. Đề xuất: Lựa chọn nhà thầu ${winner.name} trúng thầu gói thầu.`, { indent: 500, bold: true }),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            docxSignatureTable("Thành viên", pkg.expertTeamMember1.split(' (')[0], "Tổ trưởng", pkg.expertTeamLeader.split(' (')[0])
          ]
        }]
      });
    }
  },

  // Document 15: Báo cáo thẩm định
  {
    id: 15,
    name: "Báo cáo thẩm định",
    getCategory: (m) => m === 'DIRECT_50' ? 'not_applicable' : (m === 'DIRECT_SELECTION_SIMPLIFIED' ? 'recommended' : 'required'),
    getCategoryLabel: (m) => m === 'DIRECT_50' ? 'Không áp dụng' : (m === 'DIRECT_SELECTION_SIMPLIFIED' ? 'Khuyến nghị' : 'Bắt buộc'),
    getSigner: (pkg) => `Tổ thẩm định độc lập (Phòng TC-KH)`,
    getSignDate: (pkg) => pkg.dateAppraise,
    getAuditRisk: (pkg) => "Không thực hiện thẩm định hoặc báo cáo thẩm định sao chép nguyên văn báo cáo đánh giá của tổ chuyên gia.",
    getHtml: (pkg, methodCode) => {
      const winner = getWinnerSupplier(pkg);
      return `
        <div class="doc-header">
          <div class="doc-header-left">
            BỘ CÔNG THƯƠNG<br>
            <b>TRƯỜNG CĐ KỸ THUẬT CÔNG NGHIỆP</b>
          </div>
          <div class="doc-header-right">
            <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>
            <b>Độc lập - Tự do - Hạnh phúc</b>
          </div>
        </div>
        <div class="doc-title" style="margin-top: 15px;">
          BÁO CÁO THẨM ĐỊNH KẾT QUẢ LỰA CHỌN NHÀ THẦU<br>
          <span style="font-size: 13px; font-weight: normal; font-style: italic;">(Gói thầu: ${pkg.packageName})</span>
        </div>
        <div class="doc-content">
          <p>Kính gửi: Hiệu trưởng Trường Cao đẳng Kỹ thuật Công nghiệp</p>
          <p>Phòng Tài chính - Kế hoạch (Bộ phận thẩm định) đã tiến hành thẩm định độc lập quá trình đánh giá của Tổ chuyên gia.</p>
          <p><b>Kết quả thẩm định:</b></p>
          <p>- Quy trình thực hiện: Tuân thủ đầy đủ các quy định của Luật Đấu thầu 2023 và Nghị định số 214/2025/NĐ-CP.</p>
          <p>- Hồ sơ pháp lý: Đầy đủ tờ trình, quyết định phê duyệt KHLCNT, biên bản khảo sát giá thị trường.</p>
          <p>- Ý kiến thẩm định: Thống nhất với Báo cáo đánh giá của Tổ chuyên gia đề xuất lựa chọn nhà thầu: <b>"${winner.name}"</b>.</p>
        </div>
        <div class="doc-signatures" style="margin-top: 30px;">
          <div></div>
          <div style="text-align: center;">
            <b>TRƯỞNG PHÒNG TÀI CHÍNH - KẾ HOẠCH</b><br><br><br>
            <b>${pkg.appraisalLeader.split(' (')[0]}</b>
          </div>
        </div>
      `;
    },
    getDocx: (pkg, methodCode) => {
      const winner = getWinnerSupplier(pkg);
      return new Document({
        sections: [{
          properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
          children: [
            docxHeaderTable(pkg, `${pkg.departmentCode}/BCTĐ`, pkg.dateAppraise),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [
                new TextRun({ text: "BÁO CÁO THẨM ĐỊNH KẾT QUẢ LỰA CHỌN NHÀ THẦU\n", bold: true, size: 26, font: "Times New Roman" })
              ]
            }),
            docxParagraph("Kính gửi: Hiệu trưởng Trường Cao đẳng Kỹ thuật Công nghiệp", { bold: true, align: AlignmentType.CENTER }),
            docxParagraph(`Tổ thẩm định (Phòng Tài chính - Kế hoạch) báo cáo thẩm định hồ sơ kết quả lựa chọn nhà thầu:`, { indent: 500 }),
            docxParagraph("1. Về quy trình và hồ sơ: Thực hiện đầy đủ trình tự theo quy định pháp lý hiện hành.", { indent: 500 }),
            docxParagraph(`2. Về kết quả: Đề xuất phê duyệt kết quả trúng thầu đối với nhà thầu ${winner.name} là đúng quy định.`, { indent: 500 }),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            docxSignatureTable("", "", "TRƯỞNG PHÒNG TÀI CHÍNH - KẾ HOẠCH", pkg.appraisalLeader.split(' (')[0])
          ]
        }]
      });
    }
  },

  // Document 16: Tờ trình phê duyệt kết quả
  {
    id: 16,
    name: "Tờ trình phê duyệt kết quả",
    getCategory: (m) => m === 'DIRECT_50' ? 'not_applicable' : (m === 'DIRECT_SELECTION_SIMPLIFIED' ? 'recommended' : 'required'),
    getCategoryLabel: (m) => m === 'DIRECT_50' ? 'Không áp dụng' : (m === 'DIRECT_SELECTION_SIMPLIFIED' ? 'Khuyến nghị' : 'Bắt buộc'),
    getSigner: (pkg) => `Phòng chuyên môn trình Hiệu trưởng`,
    getSignDate: (pkg) => pkg.dateResultProposal,
    getAuditRisk: (pkg) => "Không lập tờ trình kết quả hoặc tờ trình không ghi cụ thể thông tin giá trúng thầu dự kiến và hình thức hợp đồng.",
    getHtml: (pkg, methodCode) => {
      const winner = getWinnerSupplier(pkg);
      return `
        <div class="doc-header">
          <div class="doc-header-left">
            BỘ CÔNG THƯƠNG<br>
            <b>TRƯỜNG CĐ KỸ THUẬT CÔNG NGHIỆP</b>
          </div>
          <div class="doc-header-right">
            <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>
            <b>Độc lập - Tự do - Hạnh phúc</b>
          </div>
        </div>
        <div class="doc-title" style="margin-top: 15px;">
          TỜ TRÌNH<br>
          <span style="font-size: 13px; font-weight: normal; font-style: italic;">V/v Phê duyệt kết quả lựa chọn nhà thầu gói thầu mua sắm</span>
        </div>
        <div class="doc-content">
          <p>Kính gửi: Hiệu trưởng Trường Cao đẳng Kỹ thuật Công nghiệp</p>
          <p>Căn cứ Báo cáo đánh giá của Tổ chuyên gia và Báo cáo thẩm định của Phòng Tài chính - Kế hoạch;</p>
          <p>Phòng Quản trị đời sống đề xuất Hiệu trưởng phê duyệt kết quả lựa chọn nhà thầu gói thầu với nội dung sau:</p>
          <p>- Tên nhà thầu trúng thầu: <b>${winner.name}</b>.</p>
          <p>- Giá đề nghị trúng thầu: <b>${formatVND(winner.total)}</b>.</p>
          <p>- Loại hợp đồng: Hợp đồng trọn gói.</p>
          <p>- Thời gian thực hiện: ${pkg.contractDurationDays} ngày.</p>
        </div>
        <div class="doc-signatures" style="margin-top: 20px;">
          <div></div>
          <div style="text-align: center;">
            <b>TRƯỞNG PHÒNG QUẢN TRỊ ĐỜI SỐNG</b><br><br><br>
            <b>${pkg.expertTeamLeader.split(' (')[0]}</b>
          </div>
        </div>
      `;
    },
    getDocx: (pkg, methodCode) => {
      const winner = getWinnerSupplier(pkg);
      return new Document({
        sections: [{
          properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
          children: [
            docxHeaderTable(pkg, `.../TTr-QTDS`, pkg.dateResultProposal),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [
                new TextRun({ text: "TỜ TRÌNH\n", bold: true, size: 28, font: "Times New Roman" }),
                new TextRun({ text: "V/v Phê duyệt kết quả lựa chọn nhà thầu gói thầu mua sắm", bold: true, size: 24, font: "Times New Roman" })
              ]
            }),
            docxParagraph("Kính gửi: Hiệu trưởng Trường Cao đẳng Kỹ thuật Công nghiệp", { bold: true, align: AlignmentType.CENTER }),
            docxParagraph("Căn cứ báo cáo đánh giá của tổ chuyên gia và thẩm định kết quả,", { indent: 500 }),
            docxParagraph(`Kính trình Hiệu trưởng xem xét quyết định lựa chọn nhà thầu: ${winner.name} trúng thầu gói thầu: "${pkg.packageName}" với giá trúng thầu là ${formatVND(winner.total)}.`, { indent: 500 }),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            docxSignatureTable("", "", "TRƯỞNG PHÒNG QUẢN TRỊ ĐỜI SỐNG", pkg.expertTeamLeader.split(' (')[0])
          ]
        }]
      });
    }
  },

  // Document 17: Quyết định phê duyệt kết quả lựa chọn nhà thầu
  {
    id: 17,
    name: "Quyết định phê duyệt kết quả lựa chọn nhà thầu",
    getCategory: (m) => m === 'DIRECT_50' ? 'not_applicable' : 'required',
    getCategoryLabel: (m) => m === 'DIRECT_50' ? 'Không áp dụng' : 'Bắt buộc',
    getSigner: (pkg) => `Hiệu trưởng`,
    getSignDate: (pkg) => pkg.dateResultApprove,
    getAuditRisk: (pkg) => "Phê duyệt kết quả trúng thầu không trùng khớp với báo giá đề nghị của nhà thầu hoặc sai lệch thông tin nhà thầu.",
    getHtml: (pkg, methodCode) => {
      const winner = getWinnerSupplier(pkg);
      return `
        <div class="doc-header">
          <div class="doc-header-left">
            BỘ CÔNG THƯƠNG<br>
            <b>TRƯỜNG CĐ KỸ THUẬT CÔNG NGHIỆP</b><br>
            Số: .../QĐ-CĐKTCN
          </div>
          <div class="doc-header-right">
            <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>
            <b>Độc lập - Tự do - Hạnh phúc</b><br>
            <i>Bắc Giang, ngày ${formatDateVietnamese(pkg.dateResultApprove)}</i>
          </div>
        </div>
        <div class="doc-title" style="margin-top: 15px;">
          QUYẾT ĐỊNH<br>
          <span style="font-size: 13px; font-weight: normal; font-style: italic;">V/v Phê duyệt kết quả lựa chọn nhà thầu gói thầu mua sắm</span>
        </div>
        <div class="doc-content">
          <p><b>HIỆU TRƯỞNG TRƯỜNG CAO ĐẲNG KỸ THUẬT CÔNG NGHIỆP</b></p>
          <p>Căn cứ các Luật Đấu thầu hiện hành và Nghị định số 214/2025/NĐ-CP;</p>
          <p>Xét đề nghị của Trưởng phòng Quản trị đời sống và Báo cáo thẩm định của Trưởng phòng Tài chính - Kế hoạch,</p>
          <p style="text-align: center; font-weight: bold;">QUYẾT ĐỊNH:</p>
          <p><b>Điều 1.</b> Phê duyệt kết quả lựa chọn nhà thầu gói thầu: <b>"${pkg.packageName}"</b> với thông tin sau:</p>
          <p>- Đơn vị trúng thầu: <b>${winner.name}</b>.</p>
          <p>- Giá trúng thầu: <b>${formatVND(winner.total)}</b> (Bằng chữ: ${numberToWords(winner.total)}).</p>
          <p>- Loại hợp đồng: Hợp đồng trọn gói.</p>
          <p>- Thời gian thực hiện: ${pkg.contractDurationDays} ngày.</p>
          <p><b>Điều 2.</b> Phòng Quản trị đời sống tiến hành ký kết hợp đồng và giám sát thực hiện theo đúng quy định pháp luật.</p>
        </div>
        <div class="doc-signatures" style="margin-top: 20px;">
          <div style="text-align: left;">
            <b><i>Nơi nhận:</i></b><br>
            - Đơn vị trúng thầu;<br>
            - Lưu VT, TC-KH.
          </div>
          <div style="text-align: center;">
            <b>HIỆU TRƯỞNG</b><br><br><br>
            <b>${pkg.rectorName}</b>
          </div>
        </div>
      `;
    },
    getDocx: (pkg, methodCode) => {
      const winner = getWinnerSupplier(pkg);
      return new Document({
        sections: [{
          properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
          children: [
            docxHeaderTable(pkg, `.../QĐ-CĐKTCN`, pkg.dateResultApprove),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [
                new TextRun({ text: "QUYẾT ĐỊNH\n", bold: true, size: 28, font: "Times New Roman" }),
                new TextRun({ text: "V/v Phê duyệt kết quả lựa chọn nhà thầu gói thầu mua sắm", bold: true, size: 24, font: "Times New Roman" })
              ]
            }),
            docxParagraph("HIỆU TRƯỞNG TRƯỜNG CAO ĐẲNG KỸ THUẬT CÔNG NGHIỆP", { bold: true, align: AlignmentType.CENTER }),
            docxParagraph("Căn cứ Luật Đấu thầu và đề nghị của bộ phận nghiệp vụ,", { indent: 500 }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 100, after: 100 },
              children: [new TextRun({ text: "QUYẾT ĐỊNH:", bold: true, size: 26, font: "Times New Roman" })]
            }),
            docxParagraph(`Điều 1. Phê duyệt nhà thầu trúng thầu: ${winner.name} thực hiện gói thầu "${pkg.packageName}" với giá trúng thầu là ${formatVND(winner.total)}.`, { bold: true }),
            docxParagraph("Điều 2. Các phòng ban nghiệp vụ căn cứ chức năng tiến hành ký kết hợp đồng và thực hiện.", { bold: true }),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            docxSignatureTable("Nơi nhận:\n- Như Điều 2;\n- Lưu VT.", "", "HIỆU TRƯỞNG", pkg.rectorName)
          ]
        }]
      });
    }
  },

  // Document 18: Hợp đồng
  {
    id: 18,
    name: "Hợp đồng kinh tế",
    getCategory: (m) => m === 'DIRECT_50' ? 'recommended' : 'required',
    getCategoryLabel: (m) => m === 'DIRECT_50' ? 'Khuyến nghị' : 'Bắt buộc',
    getSigner: (pkg) => `Hiệu trưởng & Đại diện Nhà thầu`,
    getSignDate: (pkg) => pkg.dateContractSign,
    getAuditRisk: (pkg) => "Không quy định rõ điều khoản phạt vi phạm hợp đồng hoặc bảo hành làm thất thoát ngân sách khi xảy ra sự cố kỹ thuật.",
    getHtml: (pkg, methodCode) => {
      const total = pkg.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      return `
        <div class="doc-header">
          <div class="doc-header-left">
            <b>TRƯỜNG CĐ KỸ THUẬT CÔNG NGHIỆP</b><br>
            Số: .../HĐ-CĐKTCN
          </div>
          <div class="doc-header-right">
            <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>
            <b>Độc lập - Tự do - Hạnh phúc</b><br>
            <i>Bắc Giang, ngày ${formatDateVietnamese(pkg.dateContractSign)}</i>
          </div>
        </div>
        <div class="doc-title" style="margin-top: 15px;">
          HỢP ĐỒNG MUA BÁN HÀNG HÓA/CUNG CẤP DỊCH VỤ<br>
          <span style="font-size: 13px; font-weight: normal; font-style: italic;">(Gói thầu: ${pkg.packageName})</span>
        </div>
        <div class="doc-content">
          <p>Căn cứ Bộ luật Dân sự năm 2015 và các văn bản đấu thầu hiện hành;</p>
          <p>Hôm nay, hai bên gồm:</p>
          <p><b>BÊN A: TRƯỜNG CAO ĐẲNG KỸ THUẬT CÔNG NGHIỆP</b></p>
          <p>- Đại diện: <b>${pkg.rectorName}</b> - Chức vụ: Hiệu trưởng.</p>
          <p>- Địa chỉ: Số 202, Đường Trần Nguyên Hãn, Thành phố Bắc Giang, Tỉnh Bắc Giang.</p>
          <p><b>BÊN B: ${pkg.supplier1Name}</b></p>
          <p>- Đại diện: <b>${pkg.supplier1Representative}</b> - Chức vụ: ${pkg.supplier1Position}.</p>
          <p>- Địa chỉ: ${pkg.supplier1Address}.</p>
          <p>Hai bên thống nhất ký kết hợp đồng với các điều khoản sau:</p>
          <p><b>Điều 1. Nội dung hàng hóa:</b> Bên B cung cấp đúng danh mục thiết bị đã cam kết.</p>
          <p><b>Điều 2. Giá trị hợp đồng:</b> <b>${formatVND(total)}</b> (Bằng chữ: ${numberToWords(total)}).</p>
          <p><b>Điều 3. Thời gian thực hiện:</b> ${pkg.contractDurationDays} ngày.</p>
        </div>
        <div class="doc-signatures" style="margin-top: 20px;">
          <div style="text-align: center;">
            <b>ĐẠI DIỆN BÊN B</b><br><br><br>
            <b>${pkg.supplier1Representative}</b>
          </div>
          <div style="text-align: center;">
            <b>ĐẠI DIỆN BÊN A</b><br><br><br>
            <b>${pkg.rectorName}</b>
          </div>
        </div>
      `;
    },
    getDocx: (pkg, methodCode) => {
      const total = pkg.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      return new Document({
        sections: [{
          properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
          children: [
            docxHeaderTable(pkg, `.../HĐ-CĐKTCN`, pkg.dateContractSign),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [
                new TextRun({ text: "HỢP ĐỒNG KINH TẾ MUA BÁN HÀNG HÓA\n", bold: true, size: 28, font: "Times New Roman" }),
                new TextRun({ text: `(Gói thầu: ${pkg.packageName})`, italics: true, size: 22, font: "Times New Roman" })
              ]
            }),
            docxParagraph("Căn cứ Bộ Luật Dân sự nước CHXHCN Việt Nam năm 2015;", { indent: 500 }),
            docxParagraph("BÊN A: TRƯỜNG CAO ĐẲNG KỸ THUẬT CÔNG NGHIỆP", { bold: true }),
            docxParagraph(`- Đại diện: ${pkg.rectorName} - Chức vụ: Hiệu trưởng.`, { indent: 200 }),
            docxParagraph("BÊN B: " + pkg.supplier1Name, { bold: true }),
            docxParagraph(`- Đại diện: ${pkg.supplier1Representative} - Chức vụ: ${pkg.supplier1Position}.`, { indent: 200 }),
            docxParagraph(`- Địa chỉ: ${pkg.supplier1Address}.`, { indent: 200 }),
            docxParagraph("Điều 1. Nội dung công việc:", { bold: true }),
            docxParagraph(`Bên B cam kết cung cấp lắp đặt toàn bộ thiết bị theo đúng yêu cầu chất lượng của gói thầu.`, { indent: 500 }),
            docxParagraph("Điều 2. Giá trị hợp đồng:", { bold: true }),
            docxParagraph(`Tổng giá trị hợp đồng trọn gói: ${formatVND(total)} (Bằng chữ: ${numberToWords(total)}).`, { indent: 500 }),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            docxSignatureTable(`ĐẠI DIỆN BÊN B\n(${pkg.supplier1Position})`, pkg.supplier1Representative, "ĐẠI DIỆN BÊN A\n(Hiệu trưởng)", pkg.rectorName)
          ]
        }]
      });
    }
  },

  // Document 19: Biên bản bàn giao
  {
    id: 19,
    name: "Biên bản bàn giao thiết bị",
    getCategory: (m) => m === 'DIRECT_50' ? 'recommended' : 'required',
    getCategoryLabel: (m) => m === 'DIRECT_50' ? 'Khuyến nghị' : 'Bắt buộc',
    getSigner: (pkg) => `Đại diện hai bên và Cán bộ kỹ thuật`,
    getSignDate: (pkg) => pkg.dateDelivery,
    getAuditRisk: (pkg) => "Không kiểm tra số serial, model thực tế dẫn đến việc nhà thầu tráo đổi linh kiện hoặc giao hàng cũ tân trang.",
    getHtml: (pkg, methodCode) => {
      return `
        <div class="doc-header">
          <div class="doc-header-left">
            BỘ CÔNG THƯƠNG<br>
            <b>TRƯỜNG CĐ KỸ THUẬT CÔNG NGHIỆP</b>
          </div>
          <div class="doc-header-right">
            <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>
            <b>Độc lập - Tự do - Hạnh phúc</b>
          </div>
        </div>
        <div class="doc-title" style="margin-top: 15px;">
          BIÊN BẢN BÀN GIAO TIẾP NHẬN TÀI SẢN, THIẾT BỊ<br>
          <span style="font-size: 13px; font-weight: normal; font-style: italic;">(Thực hiện hợp đồng số .../HĐ-CĐKTCN)</span>
        </div>
        <div class="doc-content">
          <p>Hôm nay, ngày ${formatDateVietnamese(pkg.dateDelivery)}, tại Trường Cao đẳng Kỹ thuật Công nghiệp, hai bên tiến hành bàn giao thiết bị:</p>
          <p><b>Đại diện tiếp nhận (Bên A):</b> Ông Trần Văn Nam - Trưởng phòng Quản trị đời sống.</p>
          <p><b>Đại diện bàn giao (Bên B):</b> Ông ${pkg.supplier1Representative} - Giám đốc.</p>
          <p><b>Nội dung bàn giao:</b> Bên B bàn giao đầy đủ số lượng và chủng loại thiết bị theo hợp đồng, kèm theo tài liệu kỹ thuật và phiếu bảo hành chính hãng.</p>
        </div>
        <div class="doc-signatures" style="margin-top: 30px;">
          <div style="text-align: center;">
            <b>ĐẠI DIỆN BÊN B</b><br><br><br>
            <b>${pkg.supplier1Representative}</b>
          </div>
          <div style="text-align: center;">
            <b>ĐẠI DIỆN BÊN A</b><br><br><br>
            <b>${pkg.expertTeamLeader.split(' (')[0]}</b>
          </div>
        </div>
      `;
    },
    getDocx: (pkg, methodCode) => {
      return new Document({
        sections: [{
          properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
          children: [
            docxHeaderTable(pkg, `${pkg.departmentCode}/BBBG`, pkg.dateDelivery),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [
                new TextRun({ text: "BIÊN BẢN BÀN GIAO THIẾT BỊ\n", bold: true, size: 26, font: "Times New Roman" })
              ]
            }),
            docxParagraph(`Hôm nay, ngày ${formatDateVietnamese(pkg.dateDelivery)}, hai bên tiến hành bàn giao thiết bị:`, { indent: 500 }),
            docxParagraph("Đại diện Bên A: " + pkg.expertTeamLeader.split(' (')[0] + " - Đại diện trường tiếp nhận.", { indent: 200 }),
            docxParagraph("Đại diện Bên B: " + pkg.supplier1Representative + " - Đại diện nhà thầu bàn giao.", { indent: 200 }),
            docxParagraph("Hai bên tiến hành kiểm tra số lượng và bàn giao đưa vào kho để chuẩn bị lắp đặt chạy thử.", { indent: 500 }),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            docxSignatureTable("ĐẠI DIỆN BÊN B", pkg.supplier1Representative, "ĐẠI DIỆN BÊN A", pkg.expertTeamLeader.split(' (')[0])
          ]
        }]
      });
    }
  },

  // Document 20: Biên bản nghiệm thu
  {
    id: 20,
    name: "Biên bản nghiệm thu",
    getCategory: () => 'required',
    getCategoryLabel: () => 'Bắt buộc',
    getSigner: (pkg) => `Đại diện hai bên và Tổ chuyên môn kiểm định`,
    getSignDate: (pkg) => pkg.dateAcceptance,
    getAuditRisk: (pkg) => "Nghiệm thu khống khi thiết bị chưa được lắp đặt hoàn thiện hoặc chưa chạy thử nghiệm đạt yêu cầu chất lượng kỹ thuật.",
    getHtml: (pkg, methodCode) => {
      return `
        <div class="doc-header">
          <div class="doc-header-left">
            BỘ CÔNG THƯƠNG<br>
            <b>TRƯỜNG CĐ KỸ THUẬT CÔNG NGHIỆP</b>
          </div>
          <div class="doc-header-right">
            <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>
            <b>Độc lập - Tự do - Hạnh phúc</b>
          </div>
        </div>
        <div class="doc-title" style="margin-top: 15px;">
          BIÊN BẢN NGHIỆM THU ĐƯA VÀO SỬ DỤNG<br>
          <span style="font-size: 13px; font-weight: normal; font-style: italic;">(Gói thầu: ${pkg.packageName})</span>
        </div>
        <div class="doc-content">
          <p>Hôm nay, ngày ${formatDateVietnamese(pkg.dateAcceptance)}, Hội đồng nghiệm thu tiến hành kiểm tra chạy thử và nghiệm thu:</p>
          <p><b>Đại diện nhà trường (Bên A):</b> Ông Trần Văn Nam (Trưởng phòng QTDS) và đại diện bộ phận chuyên môn sử dụng.</p>
          <p><b>Đại diện đơn vị cung cấp (Bên B):</b> Ông ${pkg.supplier1Representative}.</p>
          <p><b>Đánh giá kết quả:</b></p>
          <p>- Số lượng, thông số kỹ thuật: Đạt yêu cầu theo đúng hợp đồng đã ký kết.</p>
          <p>- Tình trạng hoạt động: Thiết bị chạy ổn định, không phát sinh lỗi kỹ thuật.</p>
          <p><b>Kết luận:</b> Thống nhất nghiệm thu bàn giao đưa vào khai thác sử dụng chính thức.</p>
        </div>
        <div class="doc-signatures" style="margin-top: 30px;">
          <div style="text-align: center;">
            <b>ĐẠI DIỆN BÊN B</b><br><br><br>
            <b>${pkg.supplier1Representative}</b>
          </div>
          <div style="text-align: center;">
            <b>ĐẠI DIỆN BÊN A</b><br><br><br>
            <b>${pkg.expertTeamLeader.split(' (')[0]}</b>
          </div>
        </div>
      `;
    },
    getDocx: (pkg, methodCode) => {
      return new Document({
        sections: [{
          properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
          children: [
            docxHeaderTable(pkg, `${pkg.departmentCode}/BBNT`, pkg.dateAcceptance),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [
                new TextRun({ text: "BIÊN BẢN NGHIỆM THU ĐƯA VÀO SỬ DỤNG\n", bold: true, size: 26, font: "Times New Roman" })
              ]
            }),
            docxParagraph(`Hôm nay, ngày ${formatDateVietnamese(pkg.dateAcceptance)}, đại diện hai bên tiến hành nghiệm thu:`, { indent: 500 }),
            docxParagraph("- Thiết bị lắp đặt hoàn thiện, chạy thử đạt các chỉ tiêu kỹ thuật chính.", { indent: 500 }),
            docxParagraph("- Đầy đủ các linh phụ kiện đi kèm theo hãng.", { indent: 500 }),
            docxParagraph("Kết luận: Đồng ý nghiệm thu đưa vào bàn giao cho đơn vị thụ hưởng sử dụng dạy học.", { bold: true, indent: 500 }),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            docxSignatureTable("ĐẠI DIỆN BÊN B", pkg.supplier1Representative, "ĐẠI DIỆN BÊN A", pkg.expertTeamLeader.split(' (')[0])
          ]
        }]
      });
    }
  },

  // Document 21: Thanh lý hợp đồng
  {
    id: 21,
    name: "Thanh lý hợp đồng",
    getCategory: (m) => m === 'DIRECT_50' ? 'not_applicable' : 'required',
    getCategoryLabel: (m) => m === 'DIRECT_50' ? 'Không áp dụng' : 'Bắt buộc',
    getSigner: (pkg) => `Hiệu trưởng & Đại diện Nhà thầu`,
    getSignDate: (pkg) => pkg.dateLiquidation,
    getAuditRisk: (pkg) => "Thanh lý hợp đồng khi chưa hoàn tất nghĩa vụ bảo hành, thanh toán hoặc thiếu hóa đơn VAT kèm theo hồ sơ thanh quyết toán.",
    getHtml: (pkg, methodCode) => {
      const total = pkg.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      return `
        <div class="doc-header">
          <div class="doc-header-left">
            <b>TRƯỜNG CĐ KỸ THUẬT CÔNG NGHIỆP</b>
          </div>
          <div class="doc-header-right">
            <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>
            <b>Độc lập - Tự do - Hạnh phúc</b><br>
            <i>Bắc Giang, ngày ${formatDateVietnamese(pkg.dateLiquidation)}</i>
          </div>
        </div>
        <div class="doc-title" style="margin-top: 15px;">
          BIÊN BẢN THANH LÝ HỢP ĐỒNG KINH TẾ<br>
          <span style="font-size: 13px; font-weight: normal; font-style: italic;">(Hợp đồng số: .../HĐ-CĐKTCN)</span>
        </div>
        <div class="doc-content">
          <p>Hai bên gồm Trường Cao đẳng Kỹ thuật Công nghiệp (Bên A) và ${pkg.supplier1Name} (Bên B) thống nhất:</p>
          <p><b>1. Hoàn thành công việc:</b> Bên B đã giao đầy đủ thiết bị và Bên A đã ký biên bản nghiệm thu đạt yêu cầu.</p>
          <p><b>2. Thanh toán:</b> Bên A thanh toán đầy đủ số tiền <b>${formatVND(total)}</b> cho Bên B.</p>
          <p><b>3. Cam kết:</b> Hợp đồng chính thức hết hiệu lực, hai bên không còn bất kỳ tranh chấp hay khiếu nại nào.</p>
        </div>
        <div class="doc-signatures" style="margin-top: 20px;">
          <div style="text-align: center;">
            <b>ĐẠI DIỆN BÊN B</b><br><br><br>
            <b>${pkg.supplier1Representative}</b>
          </div>
          <div style="text-align: center;">
            <b>ĐẠI DIỆN BÊN A</b><br><br><br>
            <b>${pkg.rectorName}</b>
          </div>
        </div>
      `;
    },
    getDocx: (pkg, methodCode) => {
      const total = pkg.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      return new Document({
        sections: [{
          properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
          children: [
            docxHeaderTable(pkg, `.../TLHĐ`, pkg.dateLiquidation),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [
                new TextRun({ text: "BIÊN BẢN THANH LÝ HỢP ĐỒNG\n", bold: true, size: 28, font: "Times New Roman" })
              ]
            }),
            docxParagraph(`Hai bên thống nhất thanh lý hợp đồng đã thực hiện:`, { indent: 500 }),
            docxParagraph(`1. Bên B đã hoàn thành bàn giao toàn bộ thiết bị trị giá ${formatVND(total)}.`, { indent: 500 }),
            docxParagraph("2. Bên A đã thanh toán toàn bộ giá trị hợp đồng.", { indent: 500 }),
            docxParagraph("Hai bên thống nhất ký biên bản giải phóng toàn bộ nghĩa vụ ràng buộc của hợp đồng ngoại trừ trách nhiệm bảo hành.", { indent: 500 }),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            docxSignatureTable("ĐẠI DIỆN BÊN B", pkg.supplier1Representative, "ĐẠI DIỆN BÊN A", pkg.rectorName)
          ]
        }]
      });
    }
  },

  // Document 22: Hồ sơ ghi tăng tài sản
  {
    id: 22,
    name: "Hồ sơ ghi tăng tài sản",
    getCategory: () => 'recommended',
    getCategoryLabel: () => 'Khuyến nghị',
    getSigner: (pkg) => `Hiệu trưởng / Kế toán trưởng`,
    getSignDate: (pkg) => pkg.dateAssetIncrease,
    getAuditRisk: (pkg) => "Không ghi chép tăng tài sản kịp thời vào phần mềm quản lý tài sản công MISA hoặc sổ sách kế toán của đơn vị.",
    getHtml: (pkg, methodCode) => {
      return `
        <div class="doc-header">
          <div class="doc-header-left">
            BỘ CÔNG THƯƠNG<br>
            <b>TRƯỜNG CĐ KỸ THUẬT CÔNG NGHIỆP</b>
          </div>
          <div class="doc-header-right">
            <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>
            <b>Độc lập - Tự do - Hạnh phúc</b>
          </div>
        </div>
        <div class="doc-title" style="margin-top: 15px;">
          PHIẾU ĐỀ NGHỊ GHI TĂNG TÀI SẢN CÔNG<br>
          <span style="font-size: 13px; font-weight: normal; font-style: italic;">(Kính gửi Bộ phận Kế toán tài sản - Phòng TC-KH)</span>
        </div>
        <div class="doc-content">
          <p>Căn cứ Luật Quản lý, sử dụng tài sản công năm 2017 và Nghị định số 186/2025/NĐ-CP của Chính phủ;</p>
          <p>Căn cứ Biên bản nghiệm thu đưa vào sử dụng ngày ${formatDateVietnamese(pkg.dateAcceptance)};</p>
          <p>Phòng Quản trị đời sống đề nghị Phòng Tài chính - Kế hoạch ghi tăng tài sản công đối với danh mục hàng hóa thuộc gói thầu <b>"${pkg.packageName}"</b> vào hệ thống sổ sách theo dõi tài sản của trường.</p>
        </div>
        <div class="doc-signatures" style="margin-top: 30px;">
          <div style="text-align: center;">
            <b>Kế toán trưởng</b><br><br><br>
            <b>${pkg.appraisalLeader.split(' (')[0]}</b>
          </div>
          <div style="text-align: center;">
            <b>Đại diện phòng QTDS</b><br><br><br>
            <b>${pkg.expertTeamLeader.split(' (')[0]}</b>
          </div>
        </div>
      `;
    },
    getDocx: (pkg, methodCode) => {
      return new Document({
        sections: [{
          properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
          children: [
            docxHeaderTable(pkg, `${pkg.departmentCode}/GTTS`, pkg.dateAssetIncrease),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [
                new TextRun({ text: "PHIẾU ĐỀ NGHỊ GHI TĂNG TÀI SẢN CÔNG\n", bold: true, size: 26, font: "Times New Roman" })
              ]
            }),
            docxParagraph("Căn cứ Luật Quản lý sử dụng tài sản công 2017 (sửa đổi bởi Luật 90/2025) và các Nghị định hướng dẫn;", { indent: 500 }),
            docxParagraph(`Phòng Quản trị đời sống bàn giao và đề nghị ghi tăng tài sản công phục vụ gói thầu: "${pkg.packageName}" vào sổ sách kế toán kể từ ngày ${formatDateVietnamese(pkg.dateAssetIncrease)}.`, { indent: 500 }),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            docxSignatureTable("Kế toán trưởng", pkg.appraisalLeader.split(' (')[0], "Đại diện bộ phận sử dụng", pkg.expertTeamLeader.split(' (')[0])
          ]
        }]
      });
    }
  },

  // Document 23: Checklist kiểm toán
  {
    id: 23,
    name: "Checklist kiểm toán",
    getCategory: () => 'required',
    getCategoryLabel: () => 'Bắt buộc',
    getSigner: (pkg) => `Cán bộ tự kiểm tra pháp lý`,
    getSignDate: (pkg) => pkg.dateAssetIncrease,
    getAuditRisk: (pkg) => "Thiếu một trong các văn bản cấu thành bộ hồ sơ pháp lý dẫn đến việc bị xuất toán chi phí khi thanh tra kiểm toán.",
    getHtml: (pkg, methodCode) => {
      return `
        <div class="doc-header">
          <div class="doc-header-left">
            <b>TRƯỜNG CĐ KỸ THUẬT CÔNG NGHIỆP</b>
          </div>
          <div class="doc-header-right">
            <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>
            <b>Độc lập - Tự do - Hạnh phúc</b>
          </div>
        </div>
        <div class="doc-title" style="margin-top: 15px;">
          DANH MỤC KIỂM TRA HỒ SƠ PHỤC VỤ THANH TRA, KIỂM TOÁN (CHECKLIST)<br>
          <span style="font-size: 13px; font-weight: normal; font-style: italic;">(Áp dụng cho gói thầu: ${pkg.packageName})</span>
        </div>
        <div class="doc-content" style="font-size: 13px;">
          <p><b>[⚠ AUDIT RISK] Cần rà soát kỹ các đầu hồ sơ sau trước khi tiếp đón đoàn kiểm tra:</b></p>
          <input type="checkbox" checked readonly> Tờ trình đề nghị phê duyệt chủ trương mua sắm.<br>
          <input type="checkbox" checked readonly> Bản thuyết minh sự cần thiết lập chi tiết.<br>
          <input type="checkbox" checked readonly> Biên bản khảo sát giá thị trường thực tế.<br>
          <input type="checkbox" checked readonly> Tối thiểu 03 báo giá còn hiệu lực của 03 nhà cung cấp.<br>
          <input type="checkbox" checked readonly> Quyết định phê duyệt dự toán gói thầu của Hiệu trưởng.<br>
          <input type="checkbox" checked readonly> Kế hoạch lựa chọn nhà thầu được duyệt.<br>
          <input type="checkbox" checked readonly> Quyết định phê duyệt kết quả lựa chọn nhà thầu.<br>
          <input type="checkbox" checked readonly> Hợp đồng kinh tế kèm Biên bản nghiệm thu bàn giao và Thanh lý hợp đồng.<br>
          <input type="checkbox" checked readonly> Chứng từ kế toán thanh toán đầy đủ hóa đơn GTGT điện tử hợp pháp.<br>
          <input type="checkbox" checked readonly> Chứng từ ghi tăng tài sản trên hệ thống phần mềm quản lý tài sản công.
        </div>
      `;
    },
    getDocx: (pkg, methodCode) => {
      return new Document({
        sections: [{
          properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
          children: [
            docxHeaderTable(pkg, `${pkg.departmentCode}/CKLT`, pkg.dateAssetIncrease),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [
                new TextRun({ text: "DANH MỤC HỒ SƠ PHỤC VỤ KIỂM TOÁN NHÀ NƯỚC (CHECKLIST)\n", bold: true, size: 26, font: "Times New Roman" })
              ]
            }),
            docxParagraph("[⚠ AUDIT RISK] Cần lưu trữ đầy đủ hồ sơ pháp lý gồm:", { bold: true }),
            docxParagraph("[x] Tờ trình chủ trương mua sắm của khoa chuyên môn.", { indent: 500 }),
            docxParagraph("[x] Quyết định phê duyệt dự toán mua sắm của Hiệu trưởng.", { indent: 500 }),
            docxParagraph("[x] Biên bản khảo sát giá thị trường kèm 3 báo giá gốc đối chiếu.", { indent: 500 }),
            docxParagraph("[x] Hồ sơ lựa chọn nhà thầu (Quyết định phê duyệt KHLCNT, hồ sơ yêu cầu, quyết định kết quả).", { indent: 500 }),
            docxParagraph("[x] Hợp đồng, Biên bản bàn giao lắp đặt, Biên bản nghiệm thu sử dụng, Thanh lý hợp đồng.", { indent: 500 }),
            docxParagraph("[x] Hóa đơn điện tử VAT của nhà cung cấp và chứng từ chuyển khoản kho bạc/ngân hàng.", { indent: 500 }),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            docxSignatureTable("", "", "CÁN BỘ KIỂM TRA PHÁP LÝ", pkg.appraisalLeader.split(' (')[0])
          ]
        }]
      });
    }
  },

  // Document 24: Checklist đăng tải trên Hệ thống mạng đấu thầu quốc gia
  {
    id: 24,
    name: "Checklist đăng tải trên Hệ thống mạng đấu thầu quốc gia",
    getCategory: (m) => m === 'DIRECT_50' ? 'not_applicable' : 'required',
    getCategoryLabel: (m) => m === 'DIRECT_50' ? 'Không áp dụng' : 'Bắt buộc',
    getSigner: (pkg) => `Cán bộ đăng tải thông tin`,
    getSignDate: (pkg) => pkg.dateAssetIncrease,
    getAuditRisk: (pkg) => "Không đăng tải thông tin hoặc đăng tải chậm trễ quá thời hạn 05 ngày làm việc theo Thông tư 79/2025/TT-BTC dẫn tới bị xử phạt vi phạm hành chính về đấu thầu.",
    getHtml: (pkg, methodCode) => {
      return `
        <div class="doc-header">
          <div class="doc-header-left">
            <b>TRƯỜNG CĐ KỸ THUẬT CÔNG NGHIỆP</b>
          </div>
          <div class="doc-header-right">
            <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>
            <b>Độc lập - Tự do - Hạnh phúc</b>
          </div>
        </div>
        <div class="doc-title" style="margin-top: 15px;">
          DANH MỤC CÁC TÀI LIỆU CẦN ĐĂNG TẢI TRÊN HỆ THỐNG MẠNG ĐẤU THẦU QUỐC GIA<br>
          <span style="font-size: 13px; font-weight: normal; font-style: italic;">(Thực hiện theo Thông tư số 79/2025/TT-BTC của Bộ Tài chính)</span>
        </div>
        <div class="doc-content" style="font-size: 13px;">
          <p><b>[⚠ AUDIT RISK] Cần lưu ý thời hạn đăng tải trên Hệ thống mạng đấu thầu quốc gia:</b></p>
          <table class="doc-table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Tài liệu cần đăng tải</th>
                <th>Thời hạn đăng tải quy định</th>
                <th>Trách nhiệm</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="text-align:center;">1</td>
                <td>Kế hoạch lựa chọn nhà thầu được duyệt</td>
                <td>Trong vòng <b>05 ngày làm việc</b> kể từ ngày ban hành quyết định phê duyệt</td>
                <td>Cán bộ Phòng TC-KH</td>
              </tr>
              <tr>
                <td style="text-align:center;">2</td>
                <td>Hồ sơ mời thầu / Hồ sơ yêu cầu phát hành</td>
                <td>Cùng ngày với thông báo mời thầu/mời chào hàng</td>
                <td>Tổ chuyên gia</td>
              </tr>
              <tr>
                <td style="text-align:center;">3</td>
                <td>Kết quả lựa chọn nhà thầu trúng thầu</td>
                <td>Trong vòng <b>05 ngày làm việc</b> kể từ ngày ban hành quyết định phê duyệt trúng thầu</td>
                <td>Cán bộ Phòng QTDS</td>
              </tr>
              <tr>
                <td style="text-align:center;">4</td>
                <td>Thông tin về thực hiện hợp đồng chủ chốt</td>
                <td>Định kỳ hàng quý hoặc khi hoàn thành thanh lý hợp đồng</td>
                <td>Cán bộ Phòng QTDS</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    },
    getDocx: (pkg, methodCode) => {
      const rows = [
        ["STT", "Nội dung thông tin cần đăng tải", "Thời hạn đăng tải", "Ngày đăng tải thực tế (điền sau khi thực hiện)"],
        ["1", "Kế hoạch lựa chọn nhà thầu", "Tối đa 05 ngày làm việc kể từ ngày phê duyệt", "Ngày ..... tháng ..... năm ....."],
        ["2", "Hồ sơ mời thầu / Hồ sơ yêu cầu", "Đăng tải cùng thông báo mời thầu", "Ngày ..... tháng ..... năm ....."],
        ["3", "Kết quả lựa chọn nhà thầu", "Tối đa 05 ngày làm việc kể từ ngày ban hành quyết định", "Ngày ..... tháng ..... năm ....."],
        ["4", "Thông tin về kết quả thực hiện hợp đồng", "Trong vòng 30 ngày kể từ ngày thanh lý hợp đồng", "Ngày ..... tháng ..... năm ....."]
      ].map((arr, idx) => new TableRow({
        children: arr.map(cellText => new TableCell({
          children: [new Paragraph({ alignment: idx === 0 ? AlignmentType.CENTER : AlignmentType.LEFT, children: [new TextRun({ text: cellText, bold: idx === 0 })] })]
        }))
      }));

      return new Document({
        sections: [{
          properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
          children: [
            docxHeaderTable(pkg, `${pkg.departmentCode}/CKDT`, pkg.dateAssetIncrease),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [
                new TextRun({ text: "CHECKLIST ĐĂNG TẢI THÔNG TIN LÊN HỆ THỐNG MẠNG ĐẤU THẦU QUỐC GIA\n", bold: true, size: 26, font: "Times New Roman" })
              ]
            }),
            docxParagraph("Theo quy định của Luật Đấu thầu và Thông tư số 79/2025/TT-BTC, chủ đầu tư bắt buộc phải thực hiện đăng tải thông tin lựa chọn nhà thầu lên Hệ thống mạng đấu thầu quốc gia:", { indent: 500 }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: rows
            }),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            docxSignatureTable("", "", "CÁN BỘ ĐĂNG TẢI THÔNG TIN", pkg.expertTeamMember1.split(' (')[0])
          ]
        }]
      });
    }
  },

  // Document 25: Bản cam kết không xung đột lợi ích
  {
    id: 25,
    name: "Bản cam kết không xung đột lợi ích",
    getCategory: (m) => m === 'DIRECT_50' ? 'not_applicable' : (m === 'DIRECT_SELECTION_SIMPLIFIED' ? 'recommended' : 'required'),
    getCategoryLabel: (m) => m === 'DIRECT_50' ? 'Không áp dụng' : (m === 'DIRECT_SELECTION_SIMPLIFIED' ? 'Khuyến nghị' : 'Bắt buộc'),
    getSigner: (pkg) => `Tổ chuyên gia (Tổ trưởng + Thành viên)`,
    getSignDate: (pkg) => pkg.dateEvaluate,
    getAuditRisk: (pkg) => "Tổ chuyên gia không lập cam kết độc lập khi đánh giá hồ sơ yêu cầu — vi phạm Điều 16 Luật Đấu thầu số 22/2023/QH15 về đảm bảo cạnh tranh trong đấu thầu.",
    getHtml: (pkg, methodCode) => {
      const members = [pkg.expertTeamLeader, pkg.expertTeamMember1, pkg.expertTeamMember2].filter(Boolean);
      const bidders = [pkg.supplier1Name, pkg.supplier2Name, pkg.supplier3Name].filter(Boolean);
      return `
        <div class="doc-header">
          <div class="doc-header-left">
            BỘ CÔNG THƯƠNG<br>
            <b>TRƯỜNG CĐ KỸ THUẬT CÔNG NGHIỆP</b>
          </div>
          <div class="doc-header-right">
            <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>
            <b>Độc lập - Tự do - Hạnh phúc</b><br>
            <i>Bắc Giang, ${formatDateVietnamese(pkg.dateEvaluate)}</i>
          </div>
        </div>
        <div class="doc-title" style="margin-top: 15px;">
          BẢN CAM KẾT KHÔNG XUNG ĐỘT LỢI ÍCH<br>
          <span style="font-size: 13px; font-weight: normal; font-style: italic;">
            (Áp dụng cho thành viên Tổ chuyên gia đánh giá hồ sơ yêu cầu/dự thầu)
          </span>
        </div>
        <div class="doc-content">
          <p><b>Gói thầu:</b> ${pkg.packageName}</p>
          <p><b>Căn cứ pháp lý:</b> Điều 16 Luật Đấu thầu số 22/2023/QH15 (được sửa đổi bởi Luật số 90/2025/QH15) về đảm bảo cạnh tranh trong đấu thầu; Điều 82 Nghị định số 214/2025/NĐ-CP.</p>
          <p>Chúng tôi, các thành viên Tổ chuyên gia đánh giá hồ sơ yêu cầu gói thầu nêu trên, gồm:</p>
          <ol>
            ${members.map((m, i) => `<li>${m} — ${i === 0 ? 'Tổ trưởng' : 'Thành viên'}</li>`).join('\n            ')}
          </ol>
          <p>Cam kết:</p>
          <p><b>1.</b> Chúng tôi không có quan hệ lợi ích (trực tiếp hoặc gián tiếp) với các nhà thầu tham gia: <b>${bidders.join(', ')}</b>.</p>
          <p><b>2.</b> Chúng tôi không là người thân (vợ/chồng, cha mẹ, con, anh chị em) của người đại diện pháp lý, người có thẩm quyền ký kết hợp đồng của các nhà thầu nêu trên.</p>
          <p><b>3.</b> Chúng tôi không có cổ phần, vốn góp hoặc quyền lợi tài chính tại bất kỳ nhà thầu nào tham dự gói thầu này.</p>
          <p><b>4.</b> Chúng tôi cam kết đánh giá khách quan, trung thực và tuân thủ đúng Hồ sơ yêu cầu đã được phê duyệt.</p>
          <p><b>5.</b> Nếu phát sinh xung đột lợi ích trong quá trình đánh giá, chúng tôi cam kết báo cáo ngay cho Chủ đầu tư để có biện pháp xử lý kịp thời.</p>
          <p style="margin-top: 10px;"><i>Chúng tôi chịu trách nhiệm trước pháp luật về tính trung thực của bản cam kết này.</i></p>
        </div>
        <div class="doc-signatures" style="margin-top: 30px; display: flex; justify-content: space-around; flex-wrap: wrap; gap: 10px;">
          ${members.map((m, i) => `
          <div style="text-align: center; min-width: 150px;">
            <b>${i === 0 ? 'TỔ TRƯỞNG' : `THÀNH VIÊN ${i}`}</b><br><br><br>
            <b>${m.split(' (')[0]}</b>
          </div>`).join('\n          ')}
        </div>
      `;
    },
    getDocx: (pkg, methodCode) => {
      const members = [pkg.expertTeamLeader, pkg.expertTeamMember1, pkg.expertTeamMember2].filter(Boolean);
      const bidders = [pkg.supplier1Name, pkg.supplier2Name, pkg.supplier3Name].filter(Boolean);
      return new Document({
        sections: [{
          properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
          children: [
            docxHeaderTable(pkg, `${pkg.departmentCode}/CKXĐLI`, pkg.dateEvaluate),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 100 },
              children: [
                new TextRun({ text: "BẢN CAM KẾT KHÔNG XUNG ĐỘT LỢI ÍCH\n", bold: true, size: 26, font: "Times New Roman" }),
                new TextRun({ text: "(Áp dụng cho thành viên Tổ chuyên gia đánh giá hồ sơ yêu cầu/dự thầu)", italics: true, size: 22, font: "Times New Roman" })
              ]
            }),
            docxParagraph(`Gói thầu: ${pkg.packageName}`, { bold: true, indent: 500 }),
            docxParagraph("Căn cứ pháp lý: Điều 16 Luật Đấu thầu số 22/2023/QH15 (sửa đổi bởi Luật số 90/2025/QH15); Điều 82 Nghị định số 214/2025/NĐ-CP.", { indent: 500 }),
            docxParagraph("Chúng tôi, các thành viên Tổ chuyên gia đánh giá hồ sơ yêu cầu gói thầu nêu trên, gồm:", { indent: 500 }),
            ...members.map((m, i) => docxParagraph(`${i + 1}. ${m} — ${i === 0 ? 'Tổ trưởng' : 'Thành viên'}`, { indent: 720 })),
            docxParagraph("Cam kết:", { bold: true, indent: 500 }),
            docxParagraph(`1. Chúng tôi không có quan hệ lợi ích (trực tiếp hoặc gián tiếp) với các nhà thầu tham gia: ${bidders.join(', ')}.`, { indent: 500 }),
            docxParagraph("2. Chúng tôi không là người thân của người đại diện pháp lý, người có thẩm quyền ký kết hợp đồng của các nhà thầu nêu trên.", { indent: 500 }),
            docxParagraph("3. Chúng tôi không có cổ phần, vốn góp hoặc quyền lợi tài chính tại bất kỳ nhà thầu nào tham dự gói thầu này.", { indent: 500 }),
            docxParagraph("4. Chúng tôi cam kết đánh giá khách quan, trung thực và tuân thủ đúng Hồ sơ yêu cầu đã được phê duyệt.", { indent: 500 }),
            docxParagraph("5. Nếu phát sinh xung đột lợi ích, chúng tôi cam kết báo cáo ngay cho Chủ đầu tư để có biện pháp xử lý kịp thời.", { indent: 500 }),
            docxParagraph("Chúng tôi chịu trách nhiệm trước pháp luật về tính trung thực của bản cam kết này.", { italic: true, indent: 500 }),
            new Paragraph({ text: "\n", spacing: { after: 100 } }),
            docxSignatureTable(
              `THÀNH VIÊN`,
              members[1]?.split(' (')[0] ?? '',
              `TỔ TRƯỞNG`,
              members[0]?.split(' (')[0] ?? ''
            ),
            new Paragraph({ text: "\n", spacing: { after: 50 } }),
            docxSignatureTable(
              `THÀNH VIÊN`,
              members[2]?.split(' (')[0] ?? '',
              ``,
              ``
            )
          ]
        }]
      });
    }
  }
];

// Helper to trigger direct DOCX file download
export async function downloadDocx(config: DocumentConfig, pkg: ProcurementPackage, methodCode: string) {
  const doc = config.getDocx(pkg, methodCode);
  const blob = await Packer.toBlob(doc);
  const { saveAs } = await import('file-saver');
  
  // Format filename cleanly
  const indexStr = config.id.toString().padStart(2, '0');
  const sanitizedName = config.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]/g, '_');
  
  saveAs(blob, `${indexStr}_HSMS_${sanitizedName}.docx`);
}
