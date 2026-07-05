/**
 * Workflow state definitions — all 17 procurement lifecycle states.
 * Each state declares its required documents, legal basis, responsible role,
 * allowed outgoing transitions, validation rules, and generated outputs.
 */

import { WORKFLOW_STATE_IDS } from './workflowContext';
import type { WorkflowStateId, WorkflowLegalRef } from './workflowContext';

export interface StateDefinition {
  readonly id:                 WorkflowStateId;
  readonly displayName:        string;
  readonly description:        string;
  readonly requiredInputs:     readonly string[];
  readonly requiredDocuments:  readonly string[];
  readonly responsibleRole:    string;
  readonly legalBasis:         readonly WorkflowLegalRef[];
  readonly allowedTransitions: readonly WorkflowStateId[];
  readonly validationRules:    readonly string[];
  readonly generatedOutputs:   readonly string[];
}

// ─── Legal document shorthand constants ──────────────────────────────────────

const L   = '22/2023/QH15';    // Luật Đấu thầu
const D   = '214/2025/NĐ-CP';  // Nghị định (trước 2026-06-01)
const D2  = '104/2026/NĐ-CP';  // Nghị định (từ 2026-06-01)
const F   = '79/2025/TT-BTC';  // Thông tư tài chính
const T   = '13/2026/TT-BCT';  // Thông tư thương mại

function nextOf(id: WorkflowStateId): readonly WorkflowStateId[] {
  const i = WORKFLOW_STATE_IDS.indexOf(id);
  return i >= 0 && i < WORKFLOW_STATE_IDS.length - 1 ? [WORKFLOW_STATE_IDS[i + 1]!] : [];
}

// ─── State definitions ────────────────────────────────────────────────────────

const STATES_LIST: StateDefinition[] = [
  {
    id: 'DRAFT',
    displayName: 'Dự thảo gói thầu',
    description: 'Lập dự thảo hồ sơ mô tả gói thầu, xác định nhu cầu mua sắm ban đầu.',
    requiredInputs: ['Tên gói thầu', 'Loại gói thầu', 'Giá trị dự kiến (VNĐ)', 'Nguồn vốn'],
    requiredDocuments: [],
    responsibleRole: 'Cán bộ lập hồ sơ',
    legalBasis: [
      { document: L, article: 'Điều 4', clause: 'khoản 25' },
      { document: L, article: 'Điều 49' },
    ],
    allowedTransitions: nextOf('DRAFT'),
    validationRules: [
      'Phải xác định rõ loại gói thầu (hàng hóa, dịch vụ tư vấn, xây lắp, hỗn hợp)',
      'Giá trị dự kiến phải lớn hơn 0',
      'Nguồn vốn phải được xác định trước khi chuyển bước',
    ],
    generatedOutputs: ['Phiếu đề xuất mua sắm (dự thảo)'],
  },
  {
    id: 'PROCUREMENT_REQUEST',
    displayName: 'Yêu cầu mua sắm',
    description: 'Trình trưởng đơn vị xem xét và chấp thuận nhu cầu mua sắm.',
    requiredInputs: ['Chữ ký người lập hồ sơ', 'Lý do mua sắm', 'Thời hạn hoàn thành dự kiến'],
    requiredDocuments: [],
    responsibleRole: 'Trưởng đơn vị / Phòng Kế hoạch - Đấu thầu',
    legalBasis: [
      { document: L, article: 'Điều 49', clause: 'khoản 1' },
      { document: D, article: 'Điều 50' },
    ],
    allowedTransitions: nextOf('PROCUREMENT_REQUEST'),
    validationRules: [
      'Yêu cầu mua sắm phải được trưởng đơn vị ký duyệt',
      'Mô tả rõ mục đích và phạm vi sử dụng',
    ],
    generatedOutputs: ['Tờ trình yêu cầu mua sắm'],
  },
  {
    id: 'FUND_CONFIRMED',
    displayName: 'Xác nhận nguồn vốn',
    description: 'Phòng Tài chính - Kế toán xác nhận nguồn vốn được phân bổ đủ cho gói thầu.',
    requiredInputs: ['Mã nguồn vốn', 'Năm ngân sách', 'Hạn mức được duyệt'],
    requiredDocuments: [],
    responsibleRole: 'Phòng Tài chính - Kế toán',
    legalBasis: [
      { document: L, article: 'Điều 49', clause: 'khoản 2' },
      { document: D, article: 'Điều 51' },
      { document: F, article: 'Điều 5' },
    ],
    allowedTransitions: nextOf('FUND_CONFIRMED'),
    validationRules: [
      'Nguồn vốn phải được ghi rõ trong kế hoạch ngân sách đã được phê duyệt',
      'Không được sử dụng nguồn vốn chưa được phân bổ',
    ],
    generatedOutputs: ['Văn bản xác nhận nguồn vốn'],
  },
  {
    id: 'METHOD_SELECTED',
    displayName: 'Lựa chọn hình thức đấu thầu',
    description: 'Xác định hình thức lựa chọn nhà thầu phù hợp với giá trị và loại gói thầu.',
    requiredInputs: ['Hình thức lựa chọn nhà thầu', 'Căn cứ pháp lý áp dụng'],
    requiredDocuments: ['ke-hoach-lua-chon-nha-thau'],
    responsibleRole: 'Phòng Kế hoạch - Đấu thầu',
    legalBasis: [
      { document: L, article: 'Điều 21' },
      { document: L, article: 'Điều 22' },
      { document: D, article: 'Điều 56' },
    ],
    allowedTransitions: nextOf('METHOD_SELECTED'),
    validationRules: [
      'Hình thức đấu thầu phải phù hợp ngưỡng giá trị theo NĐ 214/2025',
      'Phải có kế hoạch lựa chọn nhà thầu (KHLCNT) trước khi chuyển bước',
      'Áp dụng đúng hình thức theo loại gói thầu và nguồn vốn',
    ],
    generatedOutputs: ['Kế hoạch lựa chọn nhà thầu (KHLCNT) dự thảo'],
  },
  {
    id: 'PLAN_APPROVED',
    displayName: 'Kế hoạch được phê duyệt',
    description: 'Người có thẩm quyền phê duyệt kế hoạch lựa chọn nhà thầu.',
    requiredInputs: ['Quyết định phê duyệt KHLCNT', 'Chữ ký người có thẩm quyền'],
    requiredDocuments: [],
    responsibleRole: 'Thủ trưởng đơn vị / Người có thẩm quyền',
    legalBasis: [
      { document: L, article: 'Điều 49', clause: 'khoản 5' },
      { document: D, article: 'Điều 52' },
    ],
    allowedTransitions: nextOf('PLAN_APPROVED'),
    validationRules: [
      'KHLCNT phải được phê duyệt trước khi chuẩn bị hồ sơ mời thầu',
      'Quyết định phê duyệt KHLCNT phải đúng thẩm quyền theo quy định',
    ],
    generatedOutputs: ['Quyết định phê duyệt kế hoạch lựa chọn nhà thầu'],
  },
  {
    id: 'DOCUMENT_PREPARATION',
    displayName: 'Chuẩn bị hồ sơ mời thầu',
    description: 'Soạn thảo hồ sơ mời thầu (HSMT) hoặc hồ sơ yêu cầu (HSYC) theo quy định.',
    requiredInputs: ['Dự thảo HSMT/HSYC', 'Dự toán gói thầu', 'Tiêu chí đánh giá nhà thầu'],
    requiredDocuments: ['ho-so-moi-thau'],
    responsibleRole: 'Phòng Kế hoạch - Đấu thầu / Tư vấn đấu thầu',
    legalBasis: [
      { document: L, article: 'Điều 34' },
      { document: D, article: 'Điều 57' },
      { document: T, article: 'Điều 8' },
    ],
    allowedTransitions: nextOf('DOCUMENT_PREPARATION'),
    validationRules: [
      'Hồ sơ mời thầu phải đầy đủ nội dung theo Điều 34 Luật 22/2023',
      'Tiêu chí đánh giá phải rõ ràng và không tạo rào cản phân biệt đối xử',
      'Thời gian chuẩn bị HSDT tối thiểu phải đáp ứng quy định',
    ],
    generatedOutputs: ['Hồ sơ mời thầu (HSMT) / Hồ sơ yêu cầu (HSYC) dự thảo'],
  },
  {
    id: 'DOCUMENT_APPROVED',
    displayName: 'Hồ sơ được phê duyệt',
    description: 'Người có thẩm quyền xem xét, thẩm định và phê duyệt hồ sơ mời thầu.',
    requiredInputs: ['Ý kiến thẩm định HSMT', 'Chữ ký phê duyệt'],
    requiredDocuments: [],
    responsibleRole: 'Thủ trưởng đơn vị',
    legalBasis: [
      { document: L, article: 'Điều 34', clause: 'khoản 3' },
      { document: D, article: 'Điều 58' },
    ],
    allowedTransitions: nextOf('DOCUMENT_APPROVED'),
    validationRules: [
      'HSMT phải được tổ thẩm định thông qua trước khi trình phê duyệt',
      'Phê duyệt phải đúng thẩm quyền theo giá trị gói thầu',
    ],
    generatedOutputs: ['Quyết định phê duyệt hồ sơ mời thầu'],
  },
  {
    id: 'INVITATION',
    displayName: 'Phát hành mời thầu',
    description: 'Đăng tải thông báo mời thầu trên hệ thống mạng đấu thầu quốc gia và phát hành HSMT.',
    requiredInputs: ['Ngày đăng tải', 'Thời hạn nhận HSDT', 'Giá bán HSMT (nếu có)'],
    requiredDocuments: [],
    responsibleRole: 'Phòng Kế hoạch - Đấu thầu',
    legalBasis: [
      { document: L, article: 'Điều 35' },
      { document: L, article: 'Điều 36' },
      { document: D, article: 'Điều 59' },
    ],
    allowedTransitions: nextOf('INVITATION'),
    validationRules: [
      'Thông báo mời thầu phải đăng trên hệ thống mạng đấu thầu quốc gia',
      'Thời gian nhận HSDT phải đáp ứng tối thiểu theo hình thức đấu thầu',
    ],
    generatedOutputs: ['Thông báo mời thầu công khai', 'HSMT phát hành chính thức'],
  },
  {
    id: 'BID_RECEIPT',
    displayName: 'Tiếp nhận hồ sơ dự thầu',
    description: 'Nhận và bảo quản hồ sơ dự thầu (HSDT) từ các nhà thầu trong thời hạn quy định.',
    requiredInputs: ['Danh sách nhà thầu nộp HSDT', 'Biên nhận từng bộ hồ sơ'],
    requiredDocuments: [],
    responsibleRole: 'Tổ tiếp nhận hồ sơ',
    legalBasis: [
      { document: L, article: 'Điều 38' },
      { document: D, article: 'Điều 60' },
    ],
    allowedTransitions: nextOf('BID_RECEIPT'),
    validationRules: [
      'HSDT nộp sau thời hạn quy định phải bị từ chối',
      'Bảo đảm dự thầu phải hợp lệ',
      'Tất cả HSDT phải được niêm phong và bảo mật cho đến khi mở thầu',
    ],
    generatedOutputs: ['Biên bản tiếp nhận HSDT', 'Danh sách nhà thầu tham dự'],
  },
  {
    id: 'BID_OPENING',
    displayName: 'Mở thầu',
    description: 'Mở hồ sơ dự thầu công khai theo đúng thời điểm và địa điểm đã thông báo.',
    requiredInputs: ['Thành phần tham dự mở thầu', 'Biên bản mở thầu'],
    requiredDocuments: [],
    responsibleRole: 'Tổ mở thầu',
    legalBasis: [
      { document: L, article: 'Điều 39' },
      { document: D, article: 'Điều 61' },
    ],
    allowedTransitions: nextOf('BID_OPENING'),
    validationRules: [
      'Mở thầu phải diễn ra đúng thời điểm ghi trong thông báo mời thầu',
      'Biên bản mở thầu phải được đại diện các bên ký xác nhận',
      'Đọc và công bố công khai thông tin từ tất cả HSDT',
    ],
    generatedOutputs: ['Biên bản mở thầu (công khai)'],
  },
  {
    id: 'EVALUATION',
    displayName: 'Đánh giá hồ sơ dự thầu',
    description: 'Tổ chuyên gia đánh giá HSDT theo tiêu chí đã phê duyệt trong HSMT.',
    requiredInputs: ['Báo cáo đánh giá HSDT', 'Danh sách nhà thầu đạt/không đạt'],
    requiredDocuments: ['bien-ban-danh-gia'],
    responsibleRole: 'Tổ chuyên gia đánh giá',
    legalBasis: [
      { document: L, article: 'Điều 40' },
      { document: L, article: 'Điều 41' },
      { document: D, article: 'Điều 62' },
    ],
    allowedTransitions: nextOf('EVALUATION'),
    validationRules: [
      'Đánh giá phải theo đúng tiêu chí trong HSMT đã phê duyệt',
      'Bảo mật thông tin trong toàn bộ quá trình đánh giá',
      'Báo cáo đánh giá phải được tất cả thành viên tổ chuyên gia ký',
    ],
    generatedOutputs: ['Báo cáo đánh giá HSDT', 'Danh sách xếp hạng nhà thầu'],
  },
  {
    id: 'APPROVAL',
    displayName: 'Phê duyệt kết quả lựa chọn nhà thầu',
    description: 'Người có thẩm quyền xem xét tờ trình thẩm định và phê duyệt kết quả LCNT.',
    requiredInputs: ['Tờ trình đề nghị phê duyệt', 'Kết quả thẩm định của đơn vị thẩm định'],
    requiredDocuments: ['quyet-dinh-phe-duyet-ket-qua'],
    responsibleRole: 'Người có thẩm quyền phê duyệt',
    legalBasis: [
      { document: L, article: 'Điều 45' },
      { document: D, article: 'Điều 63' },
      { document: D2, article: 'Điều 45' },
    ],
    allowedTransitions: nextOf('APPROVAL'),
    validationRules: [
      'Phê duyệt phải đúng thẩm quyền theo giá trị gói thầu (NĐ 214/2025 Điều 76)',
      'Kết quả phải qua thẩm định của đơn vị có thẩm quyền trước khi trình',
      'Thông báo kết quả cho tất cả nhà thầu tham dự trong thời hạn quy định',
    ],
    generatedOutputs: ['Quyết định phê duyệt kết quả LCNT', 'Thông báo kết quả đấu thầu'],
  },
  {
    id: 'CONTRACT_SIGNED',
    displayName: 'Ký kết hợp đồng',
    description: 'Hoàn thiện và ký kết hợp đồng với nhà thầu trúng thầu trong thời hạn quy định.',
    requiredInputs: ['Dự thảo hợp đồng', 'Bảo đảm thực hiện hợp đồng hợp lệ'],
    requiredDocuments: [],
    responsibleRole: 'Thủ trưởng đơn vị / Đại diện theo pháp luật',
    legalBasis: [
      { document: L, article: 'Điều 46' },
      { document: D, article: 'Điều 64' },
    ],
    allowedTransitions: nextOf('CONTRACT_SIGNED'),
    validationRules: [
      'Ký hợp đồng trong thời hạn quy định sau khi có quyết định phê duyệt kết quả',
      'Bảo đảm thực hiện hợp đồng phải nộp trước khi ký',
      'Nội dung hợp đồng không được thay đổi trọng yếu so với HSMT và HSDT trúng thầu',
    ],
    generatedOutputs: ['Hợp đồng kinh tế đã ký kết'],
  },
  {
    id: 'IMPLEMENTATION',
    displayName: 'Thực hiện hợp đồng',
    description: 'Nhà thầu triển khai nghĩa vụ hợp đồng; bên mua giám sát tiến độ và chất lượng.',
    requiredInputs: ['Lịch thực hiện chi tiết', 'Báo cáo tiến độ định kỳ'],
    requiredDocuments: [],
    responsibleRole: 'Nhà thầu / Ban Quản lý dự án',
    legalBasis: [
      { document: L, article: 'Điều 47' },
      { document: D, article: 'Điều 65' },
    ],
    allowedTransitions: nextOf('IMPLEMENTATION'),
    validationRules: [
      'Thực hiện đúng tiến độ và khối lượng theo hợp đồng đã ký',
      'Bên mua phải giám sát thường xuyên việc thực hiện hợp đồng',
    ],
    generatedOutputs: ['Nhật ký thi công / thực hiện', 'Báo cáo tiến độ định kỳ'],
  },
  {
    id: 'ACCEPTANCE',
    displayName: 'Nghiệm thu',
    description: 'Hội đồng nghiệm thu kiểm tra, đánh giá và xác nhận chất lượng, khối lượng thực hiện.',
    requiredInputs: ['Hồ sơ hoàn công / hồ sơ nghiệm thu', 'Kết quả kiểm tra chất lượng'],
    requiredDocuments: ['bien-ban-nghiem-thu'],
    responsibleRole: 'Hội đồng nghiệm thu',
    legalBasis: [
      { document: L, article: 'Điều 47', clause: 'khoản 3' },
      { document: D, article: 'Điều 66' },
    ],
    allowedTransitions: nextOf('ACCEPTANCE'),
    validationRules: [
      'Nghiệm thu phải có đủ thành phần theo quy định',
      'Biên bản nghiệm thu phải ghi rõ kết quả kiểm tra chất lượng',
      'Không được thanh toán trước khi có biên bản nghiệm thu',
    ],
    generatedOutputs: ['Biên bản nghiệm thu'],
  },
  {
    id: 'PAYMENT',
    displayName: 'Thanh toán',
    description: 'Phòng Tài chính - Kế toán thực hiện thanh toán cho nhà thầu theo tiến độ hợp đồng.',
    requiredInputs: ['Hóa đơn tài chính hợp lệ', 'Biên bản nghiệm thu', 'Đề nghị thanh toán'],
    requiredDocuments: [],
    responsibleRole: 'Phòng Tài chính - Kế toán',
    legalBasis: [
      { document: L, article: 'Điều 47', clause: 'khoản 4' },
      { document: F, article: 'Điều 12' },
      { document: D2, article: 'Điều 50' },
    ],
    allowedTransitions: nextOf('PAYMENT'),
    validationRules: [
      'Thanh toán theo tiến độ thực hiện hợp đồng, không ứng trước quá mức quy định',
      'Giữ lại tỷ lệ bảo hành theo thỏa thuận hợp đồng',
      'Hóa đơn phải hợp lệ theo quy định của pháp luật thuế',
    ],
    generatedOutputs: ['Lệnh chi', 'Phiếu chi thanh toán hợp đồng'],
  },
  {
    id: 'COMPLETED',
    displayName: 'Hoàn thành',
    description: 'Gói thầu đã hoàn thành toàn bộ quy trình. Lưu trữ hồ sơ theo quy định pháp luật.',
    requiredInputs: ['Biên bản thanh lý hợp đồng', 'Hồ sơ lưu trữ đầy đủ'],
    requiredDocuments: [],
    responsibleRole: 'Phòng Kế hoạch - Đấu thầu',
    legalBasis: [
      { document: L, article: 'Điều 47', clause: 'khoản 5' },
      { document: D, article: 'Điều 67' },
    ],
    allowedTransitions: [],
    validationRules: [
      'Toàn bộ hồ sơ đấu thầu phải được lưu trữ theo quy định',
      'Biên bản thanh lý hợp đồng phải được lập và ký kết',
    ],
    generatedOutputs: ['Biên bản thanh lý hợp đồng', 'Báo cáo tổng kết thực hiện gói thầu'],
  },
];

// ─── Exports ─────────────────────────────────────────────────────────────────

export const STATES: Readonly<Record<WorkflowStateId, StateDefinition>> =
  Object.fromEntries(STATES_LIST.map(s => [s.id, s])) as Readonly<Record<WorkflowStateId, StateDefinition>>;

export function getStateDefinition(id: WorkflowStateId): StateDefinition {
  return STATES[id];
}
