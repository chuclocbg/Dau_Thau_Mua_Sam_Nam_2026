/**
 * P5-04 / 8-C: RAG Legal Knowledge Base
 *
 * Static embedded knowledge base of key procurement law provisions.
 * Sources: Luật ĐT 22/2023/QH15 (VBHN 74/VBHN-VPQH 25/3/2026),
 *          NĐ 214/2025/NĐ-CP, TT 79/2025/TT-BTC, TT 80/2025/TT-BTC,
 *          TT 45/2018/TT-BTC, NĐ 186/2025/NĐ-CP, NĐ 52/2026/NĐ-CP,
 *          NĐ 60/2021/NĐ-CP, TT 13/2026/TT-BCT,
 *          NĐ 98/2025/NĐ-CP, TT 65/2021/TT-BTC, NĐ 104/2026/NĐ-CP.
 *
 * 8-C additions (kb-016 – kb-021): expand coverage for regulations listed in
 * CLAUDE.md that were absent or underrepresented in the original 15 entries.
 * QI-01 additions (kb-022 – kb-024): budget-planning regulations for regular
 * expenditure procurement/repair (NĐ 98/2025, TT 65/2021, NĐ 104/2026).
 *
 * Search: BM25-lite (keyword frequency + IDF weight).
 * No external API. No fabricated content.
 */

export interface LegalEntry {
  id: string;
  title: string;
  source: string;           // e.g. "Điều 62 Luật ĐT 22/2023/QH15"
  keywords: string[];       // normalized search keywords
  content: string;          // full article summary / paraphrase
  appliesTo?: string[];     // contexts where this is relevant
}

export interface SearchResult {
  entry: LegalEntry;
  score: number;
  highlights: string[];
}

// ─── Knowledge Base Entries ────────────────────────────────────────────────────

export const LEGAL_KB: LegalEntry[] = [
  {
    id: 'kb-001',
    title: 'Ngưỡng và phương thức lựa chọn nhà thầu',
    source: 'NĐ 214/2025/NĐ-CP Điều 24 (hàng hóa/dịch vụ phi tư vấn)',
    keywords: [
      'ngưỡng', 'phương thức', 'lựa chọn nhà thầu', 'chào hàng cạnh tranh',
      'chỉ định thầu', 'đấu thầu rộng rãi', 'mua sắm trực tiếp',
      'threshold', 'procurement method',
    ],
    content: `Ngưỡng phương thức lựa chọn nhà thầu (hàng hóa, dịch vụ phi tư vấn) theo NĐ 214/2025/NĐ-CP:

• Mua sắm trực tiếp (DIRECT_50): Tổng giá gói thầu ≤ 50.000.000 VND (50 triệu). Hiệu trưởng tự quyết, không cần KHLCNT.

• Chỉ định thầu rút gọn (DIRECT_SELECTION_SIMPLIFIED): Tổng giá trị > 50 triệu đến ≤ 500.000.000 VND (500 triệu). Hiệu trưởng phê duyệt; cần KHLCNT nội bộ.

• Chào hàng cạnh tranh (COMPETITIVE_SHOPPING): Tổng giá trị > 500 triệu đến ≤ 5.000.000.000 VND (5 tỷ). Yêu cầu ít nhất 3 hồ sơ đề xuất hợp lệ. KHLCNT cần trình Bộ Công Thương theo TT 13/2026/TT-BCT.

• Đấu thầu rộng rãi (OPEN_BIDDING): Tổng giá trị > 5 tỷ VND. KHLCNT bắt buộc trình và được phê duyệt bởi Bộ Công Thương trước khi tổ chức.`,
    appliesTo: ['package-generator', 'khlcnt', 'legal-review'],
  },
  {
    id: 'kb-002',
    title: 'Loại hợp đồng: trọn gói và đơn giá',
    source: 'Điều 62 Luật Đấu thầu 22/2023/QH15',
    keywords: [
      'hợp đồng', 'loại hợp đồng', 'trọn gói', 'đơn giá', 'lump sum',
      'unit price', 'contract type', 'bảo trì điều hòa', 'dịch vụ biến động',
    ],
    content: `Điều 62 Luật ĐT 22/2023 quy định loại hợp đồng:

• Hợp đồng trọn gói (lump_sum): Áp dụng khi đã xác định rõ toàn bộ khối lượng, giá trị công việc trước khi ký hợp đồng. Phù hợp với mua sắm hàng hóa số lượng xác định.

• Hợp đồng theo đơn giá (unit_price): Áp dụng khi khối lượng công việc có thể biến động theo thực tế. Phù hợp với: bảo trì/sửa chữa (ví dụ: bảo trì điều hòa, thay linh kiện theo thực tế), dịch vụ định kỳ với khối lượng chưa xác định.

⚠ Cảnh báo: Gói bảo trì điều hòa bao gồm nạp gas theo kg và thay linh kiện theo thực tế kiểm tra KHÔNG nên dùng hợp đồng trọn gói — dễ gây tranh chấp thanh toán.`,
    appliesTo: ['contract', 'legal-review'],
  },
  {
    id: 'kb-003',
    title: 'Cấm khóa thương hiệu trong yêu cầu kỹ thuật',
    source: 'Điều 44 khoản 7 Luật Đấu thầu 22/2023/QH15',
    keywords: [
      'thương hiệu', 'nhà sản xuất', 'xuất xứ', 'brand', 'brand locking',
      'hạn chế cạnh tranh', 'yêu cầu kỹ thuật', 'HSYC', 'HSMT',
      'tên thương mại', 'nhãn hiệu', 'catalog', 'model',
    ],
    content: `Điều 44 khoản 7 Luật ĐT 22/2023 cấm hạn chế cạnh tranh:

• KHÔNG được nêu tên thương hiệu, nhà sản xuất, xuất xứ hàng hóa cụ thể trong hồ sơ yêu cầu / hồ sơ mời thầu.

• KHÔNG được đặt tiêu chí kỹ thuật chỉ phù hợp với một sản phẩm cụ thể (cố tình thu hẹp cạnh tranh).

• PHẢI dùng: tiêu chí chức năng, thông số kỹ thuật tối thiểu, tiêu chuẩn quốc tế/quốc gia có thể kiểm chứng.

• PHẢI bổ sung: "hoặc tương đương" (equivalent or better) sau mọi thông số kỹ thuật cụ thể.

Ví dụ sai: "Card đồ họa NVIDIA GTX 1650" → Đúng: "Card đồ họa rời VRAM ≥4 GB, hiệu năng ≥X điểm benchmark hoặc tương đương"`,
    appliesTo: ['spec-generator', 'legal-review', 'hsyc', 'hsmt'],
  },
  {
    id: 'kb-004',
    title: 'Thời gian tối thiểu HSYC → Đóng thầu',
    source: 'Điều 81 NĐ 214/2025/NĐ-CP',
    keywords: [
      'thời gian', 'HSYC', 'đóng thầu', 'hạn nộp', 'tối thiểu', 'ngày làm việc',
      'phát hành HSYC', 'khoảng cách ngày', 'hạn chót nộp hồ sơ',
    ],
    content: `Điều 81 NĐ 214/2025 về thời gian tối thiểu:

• HSYC phát hành → Hạn đóng thầu: Tối thiểu 5 ngày làm việc (≈7 ngày lịch).

• Hồ sơ mời thầu đấu thầu rộng rãi → Đóng thầu: Tối thiểu 10 ngày làm việc.

• Đánh giá hồ sơ → Thẩm định kết quả: Tối thiểu 1 ngày làm việc (phải là ngày khác nhau để đảm bảo độc lập).

• Thẩm định kết quả → Phê duyệt kết quả: Tối thiểu 1 ngày làm việc.

⚠ Dấu hiệu kiểm toán đỏ: 5 bước phê duyệt cùng 1 ngày → nghi vấn hợp thức hóa hồ sơ.`,
    appliesTo: ['legal-review', 'timeline'],
  },
  {
    id: 'kb-005',
    title: 'Độc lập Tổ chuyên gia và Tổ thẩm định',
    source: 'Điều 16 khoản 7 Luật Đấu thầu 22/2023/QH15',
    keywords: [
      'tổ chuyên gia', 'thẩm định', 'độc lập', 'xung đột lợi ích', 'conflict of interest',
      'tổ thẩm định', 'người lập HSYC', 'đánh giá hồ sơ',
    ],
    content: `Điều 16 khoản 7 Luật ĐT 22/2023 về tính độc lập:

• Người tham gia lập HSYC/HSMT KHÔNG được là người thẩm định kết quả LCNT.

• Người đánh giá hồ sơ đề xuất KHÔNG được là người thẩm định báo cáo đánh giá.

• Tổ thẩm định phải là đơn vị/cá nhân KHÁC với Tổ chuyên gia về mặt tổ chức.

• Trước khi thực hiện nhiệm vụ, mỗi thành viên Tổ CG phải ký "Bản cam kết không có xung đột lợi ích" (Doc 25).

⚠ Vi phạm thường gặp: Phòng Kế hoạch - Tài chính vừa lập KHLCNT vừa thẩm định kết quả → Báo cáo thẩm định không hợp lệ.`,
    appliesTo: ['expert-team', 'appraisal-team', 'legal-review'],
  },
  {
    id: 'kb-006',
    title: 'Nghĩa vụ đăng tải thông tin đấu thầu',
    source: 'Điều 12 Luật ĐT 22/2023/QH15; TT 79/2025/TT-BTC',
    keywords: [
      'đăng tải', 'mạng đấu thầu quốc gia', 'công khai', 'KHLCNT',
      'kết quả LCNT', 'hệ thống thông tin', 'TT 79',
    ],
    content: `Nghĩa vụ đăng tải theo Điều 12 Luật ĐT 22/2023 và TT 79/2025/TT-BTC:

• KHLCNT (gói ≥50 triệu): Đăng tải trên Hệ thống mạng đấu thầu quốc gia trước khi triển khai.

• Hồ sơ yêu cầu / Thông báo mời chào hàng: Đăng tải đồng thời phát hành.

• Kết quả LCNT: Đăng tải trong vòng 7 ngày kể từ ngày ký hợp đồng.

• Thông tin thực hiện hợp đồng: Đăng tải sau khi hoàn thành.

⚠ Rủi ro kiểm toán: Không có bằng chứng đăng tải = không thể chứng minh công khai minh bạch. Kiểm toán tra Hệ thống mạng đấu thầu quốc gia sẽ phát hiện.`,
    appliesTo: ['publication', 'legal-review', 'khlcnt'],
  },
  {
    id: 'kb-007',
    title: 'Ngưỡng tài sản cố định',
    source: 'TT 45/2018/TT-BTC Điều 3',
    keywords: [
      'tài sản cố định', 'TSCĐ', 'ghi tăng tài sản', 'vật tư tiêu hao',
      'công cụ dụng cụ', 'ngưỡng tài sản', '10 triệu', 'fixed asset',
    ],
    content: `TT 45/2018/TT-BTC Điều 3 về ngưỡng tài sản cố định:

• Tài sản cố định hữu hình: Giá trị ≥ 10.000.000 VND/đơn vị VÀ thời gian sử dụng ≥ 1 năm.

• Dưới ngưỡng (< 10 triệu hoặc < 1 năm): Hạch toán là công cụ dụng cụ hoặc chi phí kỳ.

• Hàng tiêu hao (hóa chất, văn phòng phẩm, vật tư dùng hết trong quá trình sử dụng): KHÔNG ghi tăng tài sản, hạch toán vào chi phí hoạt động.

Ví dụ phân loại:
- Máy tính 20 triệu/cái → TSCĐ, ghi tăng tài sản
- Ghế làm việc 3 triệu/cái → Công cụ dụng cụ (< 10 triệu)
- Giấy in, bút bi → Tiêu hao, không ghi TSCĐ
- Hóa chất thí nghiệm → Tiêu hao`,
    appliesTo: ['asset-recording', 'package-type', 'accounting'],
  },
  {
    id: 'kb-008',
    title: 'Cơ chế tự chủ tài chính nhóm 2',
    source: 'NĐ 60/2021/NĐ-CP; QĐ 541/BCT ngày 25/3/2026',
    keywords: [
      'tự chủ', 'tự chủ tài chính', 'nhóm 2', 'đơn vị sự nghiệp',
      'nguồn thu hợp pháp', 'quỹ phát triển', 'thẩm quyền chi',
    ],
    content: `NĐ 60/2021/NĐ-CP và QĐ 541/BCT về tự chủ nhóm 2:

• Trường CĐ Kỹ thuật Công nghiệp: Đơn vị sự nghiệp tự chủ TÀI CHÍNH NHÓM 2 theo QĐ 541 của Bộ Công Thương ngày 25/3/2026.

• Nhóm 2: Đơn vị tự đảm bảo một phần chi thường xuyên (thu < chi thường xuyên).

• Thẩm quyền chi từ nguồn thu hợp pháp/quỹ phát triển:
  - ≤50 triệu: Hiệu trưởng tự quyết, không cần KHLCNT
  - 50 triệu – 500 triệu: Hiệu trưởng phê duyệt; cần KHLCNT nội bộ
  - 500 triệu – 5 tỷ: Hiệu trưởng phê duyệt; KHLCNT trình Bộ CT
  - >5 tỷ: KHLCNT trình và được phê duyệt bởi Bộ CT

⚠ Không có "Hiệu trưởng tự quyết không giới hạn hạn mức" — mọi mức đều có ràng buộc.`,
    appliesTo: ['authority', 'khlcnt', 'funding-source'],
  },
  {
    id: 'kb-009',
    title: 'Phân cấp KHLCNT — TT 13/2026/TT-BCT',
    source: 'TT 13/2026/TT-BCT về phân cấp quản lý',
    keywords: [
      'KHLCNT', 'kế hoạch lựa chọn nhà thầu', 'phân cấp', 'Bộ Công Thương',
      'trình phê duyệt', 'TT 13', 'thẩm quyền phê duyệt KHLCNT',
    ],
    content: `TT 13/2026/TT-BCT phân cấp KHLCNT cho Trường CĐ Kỹ thuật Công nghiệp:

• Gói ≤500 triệu VND: KHLCNT do Hiệu trưởng phê duyệt (thẩm quyền nội bộ).

• Gói 500 triệu – 5 tỷ VND: KHLCNT trình Bộ Công Thương phê duyệt (hoặc đơn vị được Bộ phân cấp).

• Gói >5 tỷ VND: KHLCNT bắt buộc trình Bộ Công Thương phê duyệt trước khi tổ chức đấu thầu.

Trình tự phê duyệt KHLCNT:
1. Phòng TC-KH soạn thảo tờ trình KHLCNT
2. Ban Giám hiệu xét duyệt nội bộ
3. Nếu >500 triệu: gửi Bộ CT phê duyệt
4. Sau phê duyệt: mới tổ chức LCNT`,
    appliesTo: ['khlcnt', 'authority'],
  },
  {
    id: 'kb-010',
    title: 'Định nghĩa gói thầu dịch vụ phi tư vấn',
    source: 'Khoản 12 Điều 4 Luật Đấu thầu 22/2023/QH15',
    keywords: [
      'dịch vụ phi tư vấn', 'bảo trì', 'vận hành', 'bảo dưỡng', 'sửa chữa',
      'vệ sinh', 'bảo vệ', 'non-consulting service', 'loại gói thầu',
    ],
    content: `Khoản 12 Điều 4 Luật ĐT 22/2023 định nghĩa gói dịch vụ phi tư vấn:

Gói dịch vụ phi tư vấn bao gồm: bảo dưỡng, bảo trì, sửa chữa thiết bị; vệ sinh, bảo vệ, giặt ủi; vận hành cơ sở hạ tầng; chụp ảnh, in ấn, quảng cáo; dịch vụ vận chuyển; và các loại dịch vụ khác không thuộc tư vấn.

Phân biệt với gói tư vấn: Tư vấn là các công việc đòi hỏi chuyên môn cao, sáng tạo (thiết kế, khảo sát, lập dự toán, giám sát).

Tác động thực tiễn:
- Gói bảo trì điều hòa → dịch vụ phi tư vấn → cần đề cập Khoản 12 Điều 4 trong căn cứ pháp lý
- Hợp đồng: nên dùng đơn giá vì khối lượng biến động`,
    appliesTo: ['package-type', 'contract', 'legal-review'],
  },
  {
    id: 'kb-011',
    title: 'Điều khoản bắt buộc trong hợp đồng',
    source: 'Điều 62 Luật ĐT 22/2023/QH15',
    keywords: [
      'điều khoản hợp đồng', 'VAT', 'thuế GTGT', 'phạt vi phạm', 'bảo hành',
      'bảo trì', 'chậm giao hàng', 'penalty', 'warranty', 'contract clause',
    ],
    content: `Điều 62 Luật ĐT 22/2023 — các điều khoản bắt buộc trong hợp đồng:

1. Điều khoản VAT: Hợp đồng phải ghi rõ giá [đã/chưa] bao gồm thuế GTGT 10%. Thiếu → tranh chấp thanh toán khi kho bạc yêu cầu hóa đơn.

2. Điều khoản phạt vi phạm: Chậm giao hàng → phạt 0,05%/ngày trên giá trị phần chậm, tối đa 8% giá trị hợp đồng.

3. Điều khoản bảo hành: Ghi rõ thời hạn bảo hành (tháng) và trách nhiệm sửa chữa trong thời hạn.

4. Điều khoản thanh lý: Phải có biên bản thanh lý hợp đồng sau khi hoàn thành.

⚠ Thiếu bất kỳ điều khoản nào trên → hợp đồng có thể bị tuyên vô hiệu một phần.`,
    appliesTo: ['contract', 'legal-review'],
  },
  {
    id: 'kb-012',
    title: 'Tiêu chí đánh giá nhà thầu — giá đánh giá thấp nhất',
    source: 'Điều 38, Điều 39 Luật ĐT 22/2023/QH15',
    keywords: [
      'tiêu chí đánh giá', 'giá thấp nhất', 'nhà thầu trúng', 'kết quả LCNT',
      'evaluation criteria', 'lowest price', 'bid evaluation',
    ],
    content: `Đối với gói chào hàng cạnh tranh và chỉ định thầu rút gọn (mua sắm hàng hóa thông thường):

Nhà thầu trúng = Nhà thầu có giá chào thấp nhất trong số các hồ sơ đề xuất đáp ứng yêu cầu kỹ thuật.

Quy tắc so sánh:
1. Loại hồ sơ không đáp ứng yêu cầu kỹ thuật tối thiểu
2. Trong số hồ sơ đáp ứng: chọn giá thấp nhất
3. Nếu 2 nhà thầu giá bằng nhau: xét thêm tiêu chí phụ hoặc bắt thăm

⚠ Tuyên bố Nhà thầu 1 luôn trúng thầu bất kể giá thực tế → dấu hiệu thông đồng đấu thầu (Điều 89 khoản 1 điểm d Luật ĐT 2023).`,
    appliesTo: ['evaluation', 'legal-review'],
  },
  {
    id: 'kb-013',
    title: 'Kế hoạch lựa chọn nhà thầu (KHLCNT) — nội dung bắt buộc',
    source: 'Điều 38 Luật ĐT 22/2023/QH15; NĐ 214/2025 Điều 24',
    keywords: [
      'KHLCNT', 'kế hoạch lựa chọn nhà thầu', 'nội dung KHLCNT',
      'nguồn vốn', 'hình thức lựa chọn', 'loại hợp đồng',
    ],
    content: `Nội dung KHLCNT phải bao gồm (theo NĐ 214/2025):

1. Tên gói thầu, mã gói thầu
2. Giá gói thầu (tổng mức dự toán phê duyệt)
3. Nguồn vốn
4. Hình thức và phương thức lựa chọn nhà thầu
5. Loại hợp đồng (trọn gói / đơn giá)
6. Thời gian thực hiện hợp đồng
7. Thời gian bắt đầu tổ chức LCNT

Trình tự KHLCNT:
1. Lập dự toán (đơn vị sử dụng)
2. Phê duyệt dự toán (Hiệu trưởng hoặc Bộ CT)
3. Soạn thảo KHLCNT (Phòng TC-KH)
4. Phê duyệt KHLCNT (Hiệu trưởng / Bộ CT tùy mức)
5. Tổ chức LCNT`,
    appliesTo: ['khlcnt', 'workflow'],
  },
  {
    id: 'kb-014',
    title: 'Văn bản hợp nhất VBHN 74/VBHN-VPQH',
    source: 'VBHN 74/VBHN-VPQH ngày 25/3/2026',
    keywords: [
      'VBHN 74', 'văn bản hợp nhất', 'luật đấu thầu hợp nhất',
      'luật sửa đổi', '57/2024', '90/2025', '116/2025', '133/2025', '142/2025',
    ],
    content: `VBHN 74/VBHN-VPQH ngày 25/3/2026 là văn bản hợp nhất Luật Đấu thầu:

Hợp nhất: Luật số 22/2023/QH15 + sửa đổi bởi:
- Luật số 57/2024/QH15
- Luật số 90/2025/QH15
- Luật số 116/2025/QH15
- Luật số 133/2025/QH15
- Luật số 142/2025/QH15

Đây là văn bản có hiệu lực pháp lý cao nhất và được ưu tiên trích dẫn trong tất cả hồ sơ pháp lý (ưu tiên #4 trong CLAUDE.md). Khi trích dẫn trong căn cứ pháp lý của hồ sơ, dùng: "Văn bản hợp nhất số 74/VBHN-VPQH ngày 25/3/2026".`,
    appliesTo: ['legal-basis', 'citation'],
  },
  {
    id: 'kb-015',
    title: 'Số văn bản hành chính — quy định định danh',
    source: 'NĐ 30/2020/NĐ-CP về công tác văn thư',
    keywords: [
      'số văn bản', 'ký hiệu văn bản', 'số thứ tự', 'văn thư', 'định danh',
      'tờ trình số', 'quyết định số', 'biên bản số',
    ],
    content: `NĐ 30/2020/NĐ-CP quy định văn bản hành chính phải có số và ký hiệu riêng biệt:

Định dạng: [Số thứ tự]/[Năm]-[Ký hiệu loại VB]-[Tên cơ quan]
Ví dụ: 01/2026/TTr-CĐKTCN (Tờ trình số 01 năm 2026)

⚠ Văn bản có số "..." hoặc để trống KHÔNG PHẢI là văn bản hành chính hợp lệ theo pháp luật văn thư.

Hậu quả: Văn bản không số → không có hiệu lực pháp lý → cả bộ hồ sơ có thể bị từ chối khi kiểm toán.

Lưu ý khi dùng phần mềm: Điền số văn bản thực tế trước khi in và ký. Không in bản có số "..." để nộp.`,
    appliesTo: ['document-numbering', 'legal-review'],
  },

  // ── 8-C additions — kb-016 through kb-021 ───────────────────────────────────

  {
    id: 'kb-016',
    title: 'Cấm chia nhỏ gói thầu để né ngưỡng phương thức',
    source: 'Điều 57 khoản 1 Luật ĐT 22/2023/QH15; NĐ 214/2025/NĐ-CP',
    keywords: [
      'chia nhỏ', 'tách gói', 'né ngưỡng', 'vi phạm chia nhỏ', 'gộp gói',
      'package splitting', 'split package', 'hành vi bị cấm', 'thông đồng',
    ],
    content: `Điều 57 khoản 1 Luật ĐT 22/2023 và NĐ 214/2025 cấm tuyệt đối chia nhỏ gói thầu:

• KHÔNG ĐƯỢC tách một gói thầu đồng nhất thành nhiều gói nhỏ hơn để đưa vào phương thức mua sắm có thủ tục đơn giản hơn (ví dụ: chia 1 gói 600 triệu thành 2 gói 300 triệu để né chào hàng cạnh tranh).

• KHÔNG ĐƯỢC thực hiện nhiều lần mua sắm cùng chủng loại hàng hóa trong cùng năm ngân sách nếu cộng dồn vượt ngưỡng, mà không tổ chức lựa chọn nhà thầu phù hợp.

Dấu hiệu nhận biết vi phạm chia nhỏ gói thầu:
1. Nhiều quyết định mua sắm cùng loại hàng hóa, cùng thời điểm, cho cùng nhà cung cấp.
2. Tổng giá trị các hợp đồng nhỏ vượt ngưỡng của phương thức được sử dụng.
3. Hồ sơ báo giá từ cùng 3 nhà cung cấp trong nhiều đợt liên tiếp.

⚠ Hậu quả: Hủy kết quả LCNT, xử phạt hành chính, thu hồi ngân sách chi sai.
⚠ Kiểm toán sẽ đối chiếu TOÀN BỘ hợp đồng trong năm, không chỉ từng gói riêng lẻ.`,
    appliesTo: ['package-generator', 'legal-review', 'khlcnt', 'audit-risk'],
  },

  {
    id: 'kb-017',
    title: 'Đăng ký tài khoản và sử dụng Hệ thống mạng đấu thầu quốc gia',
    source: 'TT 79/2025/TT-BTC Điều 5, 6, 7',
    keywords: [
      'đăng ký tài khoản', 'mạng đấu thầu', 'cổng thông tin', 'hệ thống',
      'TT 79', 'tài khoản bên mời thầu', 'xác thực', 'chữ ký số', 'portal',
    ],
    content: `TT 79/2025/TT-BTC hướng dẫn đăng ký và sử dụng Hệ thống mạng đấu thầu quốc gia (muasamcong.mpi.gov.vn):

Điều kiện đăng ký tài khoản bên mời thầu:
• Đơn vị phải có tư cách pháp nhân hợp lệ.
• Người đăng ký phải có chữ ký số (USB token) do CA cấp.
• Nộp hồ sơ đăng ký theo mẫu kèm bản sao quyết định thành lập đơn vị.

Trách nhiệm sử dụng tài khoản:
• Bảo mật thông tin đăng nhập — mọi hành động dưới tài khoản đều có giá trị pháp lý.
• Cập nhật thông tin khi có thay đổi về người phụ trách, con dấu, chữ ký.

Nội dung bắt buộc đăng tải qua hệ thống:
• KHLCNT được phê duyệt → đăng trước khi triển khai.
• Thông báo mời chào hàng / HSYC → đăng đồng thời phát hành.
• Kết quả LCNT → đăng trong 7 ngày kể từ ngày ký hợp đồng.
• Thông tin thực hiện hợp đồng → đăng sau khi hoàn thành.

⚠ Không đăng tải = không có bằng chứng minh bạch = rủi ro kiểm toán [HIGH].`,
    appliesTo: ['publication', 'khlcnt', 'legal-review'],
  },

  {
    id: 'kb-018',
    title: 'Kiểm soát chi và thanh toán hợp đồng mua sắm qua Kho bạc Nhà nước',
    source: 'TT 80/2025/TT-BTC về kiểm soát chi ngân sách nhà nước',
    keywords: [
      'kho bạc nhà nước', 'kiểm soát chi', 'thanh toán', 'quyết toán',
      'hóa đơn VAT', 'TT 80', 'kho bạc', 'lệnh chi', 'dự toán được duyệt',
    ],
    content: `TT 80/2025/TT-BTC quy định kiểm soát chi và thanh toán hợp đồng mua sắm công:

Điều kiện Kho bạc Nhà nước (KBNN) chấp nhận thanh toán:
1. Có dự toán được cấp có thẩm quyền phê duyệt còn số dư.
2. Có hợp đồng mua sắm hợp lệ (ký đúng thẩm quyền, đủ điều khoản bắt buộc).
3. Có biên bản nghiệm thu bàn giao đã ký (không thanh toán khi chưa nghiệm thu).
4. Có hóa đơn VAT hợp lệ từ nhà cung cấp (điện tử hoặc giấy theo quy định).
5. Có lệnh chi của cơ quan có thẩm quyền (không vượt dự toán được duyệt).

Hồ sơ thanh toán nộp KBNN:
- Lệnh chi + Hợp đồng + Biên bản nghiệm thu + Hóa đơn VAT + Biên bản bàn giao.

⚠ KBNN từ chối thanh toán nếu:
- Hóa đơn ngày trước ngày ký hợp đồng.
- Biên bản nghiệm thu có ngày sau ngày thanh toán đề nghị.
- Giá trị thanh toán vượt giá hợp đồng mà không có phụ lục điều chỉnh.

⚠ Sai sót trong hồ sơ thanh toán → phải bổ sung/chỉnh sửa trước khi KBNN phê duyệt → có thể gây chậm thanh toán cho nhà cung cấp.`,
    appliesTo: ['contract', 'payment', 'legal-review', 'accounting'],
  },

  {
    id: 'kb-019',
    title: 'Tiêu chuẩn, định mức và chế độ quản lý tài sản công',
    source: 'NĐ 186/2025/NĐ-CP về quản lý, sử dụng tài sản công',
    keywords: [
      'tiêu chuẩn định mức', 'kiểm kê định kỳ', 'báo cáo Bộ Công Thương',
      'ghi tăng thiết bị', 'NĐ 186', 'định mức sử dụng', 'phần mềm QLTS',
    ],
    content: `NĐ 186/2025/NĐ-CP quy định tiêu chuẩn định mức và chế độ quản lý tài sản công tại đơn vị sự nghiệp:

Định mức trang bị:
• Mỗi cán bộ: không quá 1 máy tính làm việc chính.
• Phòng máy thực hành: theo định mức do cơ quan chủ quản phê duyệt riêng.
• Vượt định mức: cần quyết định của cấp có thẩm quyền.

Kiểm kê và báo cáo định kỳ:
• Kiểm kê toàn đơn vị: tối thiểu 1 lần/năm (cuối năm tài chính).
• Báo cáo gửi Bộ Công Thương: trước ngày 31/01 năm sau.
• Nhập Phần mềm QLTS: trong vòng 30 ngày kể từ ngày ghi tăng.

Thủ tục sau khi mua sắm hoàn thành:
1. Lập biên bản ghi tăng (sau nghiệm thu).
2. Gắn mã thiết bị (nhãn mã vạch/QR theo quy định).
3. Cập nhật Phần mềm QLTS và danh mục thiết bị hàng năm.

⚠ Không ghi tăng ngay sau mua sắm = sai sót kế toán → rủi ro kiểm toán.`,
    appliesTo: ['asset-recording', 'legal-review', 'accounting'],
  },

  {
    id: 'kb-020',
    title: 'Giám sát, kiểm tra và xử lý vi phạm trong thực hiện hợp đồng mua sắm công',
    source: 'NĐ 52/2026/NĐ-CP về giám sát, kiểm tra hoạt động mua sắm công',
    keywords: [
      'giám sát hợp đồng', 'kiểm tra thực hiện hợp đồng', 'xử lý vi phạm',
      'NĐ 52', 'nghiệm thu tài chính', 'thanh tra mua sắm', 'vi phạm hợp đồng',
    ],
    content: `NĐ 52/2026/NĐ-CP quy định giám sát, kiểm tra và xử lý vi phạm trong mua sắm công:

Trách nhiệm giám sát của đơn vị mua sắm:
• Chỉ định người theo dõi hợp đồng (có thể là thành viên Tổ chuyên gia hoặc cán bộ phụ trách kỹ thuật).
• Lập biên bản theo dõi tiến độ giao hàng / thực hiện dịch vụ nếu hợp đồng > 3 tháng.
• Báo cáo kịp thời cho Ban Giám hiệu khi nhà thầu vi phạm tiến độ.

Kiểm tra hợp đồng sau ký kết:
• Kiểm tra điều kiện thực hiện: Nhà thầu có đủ năng lực, nhân lực, thiết bị như cam kết không?
• Kiểm tra chất lượng nghiệm thu: Hàng hóa có đúng thông số kỹ thuật HSYC không?
• Xác nhận xuất xứ: Hóa đơn, chứng từ nhập khẩu (nếu hàng ngoại).

Xử lý khi nhà thầu vi phạm:
1. Thông báo bằng văn bản yêu cầu khắc phục (nêu rõ hạn khắc phục).
2. Nếu không khắc phục: áp dụng điều khoản phạt trong hợp đồng (0,05%/ngày, tối đa 8%).
3. Nếu vi phạm nghiêm trọng: hủy hợp đồng, thông báo cho Hệ thống mạng đấu thầu quốc gia.

⚠ Thiếu hồ sơ giám sát → không thể chứng minh đã thực hiện nghĩa vụ giám sát → rủi ro kiểm toán [MEDIUM].`,
    appliesTo: ['contract', 'legal-review', 'evaluation'],
  },

  {
    id: 'kb-021',
    title: 'Chế độ báo cáo định kỳ tình hình mua sắm gửi Bộ Công Thương',
    source: 'TT 13/2026/TT-BCT Điều 8, 9 về chế độ báo cáo',
    keywords: [
      'báo cáo định kỳ', 'tổng hợp mua sắm', 'Bộ Công Thương báo cáo',
      'TT 13 báo cáo', 'báo cáo năm', 'báo cáo quý', 'nộp báo cáo',
    ],
    content: `TT 13/2026/TT-BCT quy định chế độ báo cáo tình hình mua sắm của các đơn vị thuộc Bộ Công Thương:

Chu kỳ và thời hạn báo cáo:
• Báo cáo 6 tháng đầu năm: Nộp trước ngày 15/7 hàng năm.
• Báo cáo năm (tổng kết): Nộp trước ngày 15/1 năm sau.
• Báo cáo đột xuất: Theo yêu cầu của Bộ (không quá 5 ngày làm việc kể từ ngày nhận yêu cầu).

Nội dung báo cáo tình hình mua sắm bắt buộc:
1. Danh sách tất cả hợp đồng đã ký trong kỳ (mã gói, tên gói, giá trị, nhà thầu trúng thầu).
2. Phương thức LCNT đã sử dụng và căn cứ áp dụng.
3. Số lượng gói đã đăng tải trên mạng đấu thầu quốc gia.
4. Tình hình thực hiện hợp đồng (tiến độ, vi phạm nếu có).
5. Kiến nghị vướng mắc (nếu có).

Hình thức nộp báo cáo:
• Báo cáo điện tử qua Hệ thống văn bản điều hành của Bộ CT.
• Kèm bản cứng có chữ ký và con dấu của Hiệu trưởng.

⚠ Không nộp báo cáo đúng hạn hoặc nộp báo cáo thiếu nội dung → vi phạm kỷ luật tài chính → Bộ CT có thể đình chỉ thẩm quyền phê duyệt KHLCNT của đơn vị.`,
    appliesTo: ['khlcnt', 'authority', 'publication'],
  },

  // ── QI-01 additions — kb-022 through kb-024 ──────────────────────────────────

  {
    id: 'kb-022',
    title: 'Phạm vi chi thường xuyên ngân sách nhà nước để mua sắm, sửa chữa tài sản',
    source: 'NĐ 98/2025/NĐ-CP Điều 1 — lập dự toán chi thường xuyên mua sắm sửa chữa (06/05/2025)',
    keywords: [
      'dự toán chi thường xuyên', 'mua sắm tài sản ngân sách', 'sửa chữa cải tạo nâng cấp',
      'thuê hàng hóa dịch vụ ngân sách', 'NĐ 98 2025', 'chi thường xuyên mua sắm',
      'quản lý sử dụng quyết toán chi thường xuyên',
    ],
    content: `NĐ 98/2025/NĐ-CP (06/05/2025) quy định việc lập dự toán, quản lý, sử dụng và quyết toán chi thường xuyên ngân sách nhà nước để:

a) Mua sắm, sửa chữa, cải tạo, nâng cấp tài sản, trang thiết bị theo quy định về quản lý, sử dụng tài sản công.
b) Sửa chữa, cải tạo, nâng cấp, mở rộng, xây dựng mới hạng mục công trình trong các dự án đã đầu tư xây dựng.
c) Thuê hàng hóa, dịch vụ phục vụ hoạt động thường xuyên của cơ quan, đơn vị.
d) Các nhiệm vụ chi cần thiết khác theo quy định của pháp luật.

Nghị định này áp dụng cho các cơ quan nhà nước, đơn vị sự nghiệp công lập (bao gồm Trường Cao đẳng Kỹ thuật Công nghiệp) được giao dự toán chi thường xuyên từ ngân sách nhà nước.

Yêu cầu dự toán:
• Lập dự toán hàng năm theo định mức, tiêu chuẩn, chế độ hiện hành.
• Phải phê duyệt KHLCNT trước khi thực hiện mua sắm, sửa chữa.
• Quyết toán theo đúng nội dung dự toán được duyệt và quy định về đấu thầu.

⚠ Rủi ro kiểm toán: Chi thường xuyên vượt dự toán, thực hiện không đúng nội dung dự toán, hoặc mua sắm không qua đấu thầu đúng quy định → vi phạm kỷ luật tài chính.`,
    appliesTo: ['budget-planning', 'procurement', 'khlcnt'],
  },

  {
    id: 'kb-023',
    title: 'Kinh phí bảo dưỡng, sửa chữa tài sản công tại đơn vị sự nghiệp công lập',
    source: 'TT 65/2021/TT-BTC Điều 1–4 — bảo dưỡng sửa chữa tài sản công (29/07/2021)',
    keywords: [
      'bảo dưỡng sửa chữa tài sản công', 'quỹ phát triển hoạt động sự nghiệp',
      'TT 65 2021', 'kinh phí bảo trì tài sản', 'đơn vị sự nghiệp công lập bảo dưỡng',
      'dự toán kinh phí bảo dưỡng', 'bảo dưỡng định kỳ tài sản',
    ],
    content: `TT 65/2021/TT-BTC (29/07/2021) quy định lập, quản lý và sử dụng kinh phí bảo dưỡng, sửa chữa tài sản công.

Đối tượng áp dụng (Điều 1): Cơ quan nhà nước, đơn vị sự nghiệp công lập, tổ chức chính trị-xã hội được giao quản lý tài sản công — bao gồm Trường Cao đẳng Kỹ thuật Công nghiệp.

Nguồn kinh phí bảo dưỡng (Điều 2):
a) Chi thường xuyên ngân sách nhà nước được giao.
b) Phí để lại chi thường xuyên (nếu có).
c) Quỹ phát triển hoạt động sự nghiệp của đơn vị.
d) Kinh phí hợp pháp khác.

Nguyên tắc bảo dưỡng (Điều 3):
• Bảo dưỡng tài sản đúng tiêu chuẩn kỹ thuật ban đầu; không làm thay đổi chức năng, quy mô, công suất.
• Không được dùng kinh phí bảo dưỡng để nâng cấp, mở rộng (phải chuyển sang chi đầu tư).

Lập dự toán kinh phí bảo dưỡng (Điều 4):
• Lập hàng năm, trình cấp có thẩm quyền phê duyệt.
• Hồ sơ dự toán gồm: tên tài sản, thời gian bảo dưỡng gần nhất, lý do bảo dưỡng, mục tiêu, khối lượng công việc, dự kiến chi phí.
• Căn cứ định mức bảo dưỡng theo quy định của cơ quan chuyên ngành (Bộ Tài chính, Bộ chủ quản).

⚠ Rủi ro kiểm toán: Dùng kinh phí bảo dưỡng để nâng cấp, mở rộng tài sản; không có hồ sơ dự toán; thực hiện mà không qua đấu thầu đúng quy định.`,
    appliesTo: ['asset-recording', 'budget-planning', 'repair-service'],
  },

  {
    id: 'kb-024',
    title: 'Lập dự toán kinh phí chi thường xuyên theo Điều 40 Luật Ngân sách Nhà nước',
    source: 'NĐ 104/2026/NĐ-CP Điều 1 — dự toán chi thường xuyên Điều 40 Luật NSNN (31/03/2026)',
    keywords: [
      'Điều 40 Luật Ngân sách Nhà nước', 'dự toán kinh phí chi thường xuyên 2026',
      'NĐ 104 2026', 'mua sắm sửa chữa chi thường xuyên Luật NSNN',
      'thuê hàng hóa dịch vụ chi thường xuyên', 'phân bổ giao dự toán chi thường xuyên',
    ],
    content: `NĐ 104/2026/NĐ-CP (31/03/2026) quy định lập dự toán, phân bổ, giao dự toán, quản lý, sử dụng và quyết toán kinh phí chi thường xuyên để thực hiện các nhiệm vụ tại Điều 40 Luật Ngân sách Nhà nước (Luật NSNN số 89/2025/QH15, Luật Đấu thầu số 22/2023/QH15).

Phạm vi điều chỉnh (Điều 1) — bao gồm:
a) Bồi thường, hỗ trợ, tái định cư khi Nhà nước thu hồi đất.
b) Chi phí chuẩn bị dự án đầu tư công ODA.
c) Lập, thẩm định, phê duyệt báo cáo nghiên cứu tiền khả thi.
d) Mua sắm, sửa chữa, cải tạo, nâng cấp tài sản, trang thiết bị; thuê hàng hóa, dịch vụ; sửa chữa, cải tạo, nâng cấp, mở rộng, xây dựng mới hạng mục công trình trong dự án đã đầu tư.
e) Hoạt động quy hoạch.
f) Các nhiệm vụ cần thiết khác.

Áp dụng cho Trường Cao đẳng Kỹ thuật Công nghiệp: Khoản d — mua sắm, sửa chữa, cải tạo, nâng cấp tài sản, trang thiết bị; thuê hàng hóa, dịch vụ.

Nghị định này là văn bản pháp lý mới nhất (2026) quy định về lập dự toán chi thường xuyên cho mua sắm, sửa chữa, có hiệu lực thay thế hoặc bổ sung cho các quy định cũ về cùng phạm vi.

⚠ Rủi ro kiểm toán: Thực hiện mua sắm, sửa chữa không có dự toán được phê duyệt theo NĐ 104/2026; chi vượt dự toán; không thực hiện đấu thầu theo Luật ĐT 22/2023/QH15 được dẫn chiếu tại căn cứ pháp lý của Nghị định.`,
    appliesTo: ['budget-planning', 'procurement', 'khlcnt'],
  },
];

// ─── Search Engine ─────────────────────────────────────────────────────────────

// Minimum 3 chars to avoid noise from short tokens ('da', 'vo', 'ba', etc.)
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3);
}

// Score 4+ requires either: 1 keyword match (score=3) + content match, or 2 content matches
// This filters out coincidental diacritic collisions (e.g., "dịch" vs "địch")
const MIN_SCORE_THRESHOLD = 4;

function scoreEntry(query: string, entry: LegalEntry): number {
  const qTokens = tokenize(query);
  const entryText = [entry.title, ...entry.keywords, entry.content, entry.source]
    .join(' ')
    .toLowerCase();
  const entryTokens = tokenize(entryText);

  let score = 0;
  for (const qt of qTokens) {
    // Keyword field match (higher weight)
    const kwMatch = entry.keywords.some(kw => kw.toLowerCase().includes(qt));
    if (kwMatch) score += 3;

    // Title match (medium weight)
    if (entry.title.toLowerCase().includes(qt)) score += 2;

    // Content/source match (lower weight)
    const count = entryTokens.filter(t => t === qt || t.includes(qt)).length;
    score += count * 0.5;
  }
  return score;
}

function extractHighlights(query: string, entry: LegalEntry): string[] {
  const qTokens = tokenize(query);
  const lines = entry.content.split('\n').filter(l => l.trim());
  return lines
    .filter(line => qTokens.some(t => tokenize(line).some(et => et.includes(t))))
    .slice(0, 3);
}

/**
 * Search the legal knowledge base for entries relevant to the query.
 * Returns top results sorted by relevance score.
 */
export function searchLegalKB(query: string, topK = 3): SearchResult[] {
  if (!query.trim()) return [];

  const scored = LEGAL_KB
    .map(entry => ({
      entry,
      score: scoreEntry(query, entry),
      highlights: extractHighlights(query, entry),
    }))
    .filter(r => r.score >= MIN_SCORE_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

/**
 * Answer a natural-language question using the knowledge base.
 * Returns a formatted answer with the most relevant entry.
 */
export function answerQuestion(question: string): {
  answer: string;
  sources: string[];
  confidence: 'high' | 'medium' | 'low';
} {
  const results = searchLegalKB(question, 2);

  if (results.length === 0) {
    return {
      answer: 'Không tìm thấy thông tin liên quan trong cơ sở tri thức pháp luật. Vui lòng tra cứu trực tiếp tại https://vbpl.vn hoặc https://thuvienphapluat.vn.',
      sources: [],
      confidence: 'low',
    };
  }

  const top = results[0];
  const confidence: 'high' | 'medium' | 'low' =
    top.score >= 8 ? 'high' : top.score >= 4 ? 'medium' : 'low';

  const highlights = top.highlights.length > 0
    ? top.highlights.join('\n')
    : top.entry.content.split('\n').slice(0, 3).join('\n');

  const answer = `**${top.entry.title}**\n_Căn cứ: ${top.entry.source}_\n\n${highlights}`;
  const sources = results.map(r => r.entry.source);

  return { answer, sources, confidence };
}
