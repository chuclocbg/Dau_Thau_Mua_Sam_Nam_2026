export interface ProcurementItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  specs: string;
  supplier1Price: number;
  supplier2Price: number;
  supplier3Price: number;
}

export interface ProcurementPackage {
  id: string;
  packageName: string;
  packageCode: string;
  fundingSource: 'autonomy_fund' | 'state_budget' | 'other_revenue';
  fundingSourceName: string;
  budgetYear: number;
  rectorName: string;
  departmentName: string;
  departmentCode: string; // e.g. HC-TH, KH-TC
  expertTeamLeader: string;
  expertTeamMember1: string;
  expertTeamMember2: string;
  appraisalLeader: string;
  appraisalMember: string;
  supplier1Name: string;
  supplier1Address: string;
  supplier1TaxCode: string;
  supplier1Representative: string;
  supplier1Position: string;
  supplier2Name: string;
  supplier2Address: string;
  supplier3Name: string;
  supplier3Address: string;
  
  // Timelines
  dateProposal: string;     // Ngày Tờ trình đề nghị
  dateSurvey: string;       // Ngày Biên bản khảo sát giá
  dateQuotes: string;       // Ngày trên các báo giá
  dateCompare: string;      // Ngày Bảng so sánh báo giá
  dateKhlcnt: string;       // Ngày trình KHLCNT
  dateKhlcntApprove: string;// Ngày Quyết định phê duyệt KHLCNT
  dateExpertEstablish: string; // Ngày Quyết định thành lập Tổ chuyên gia
  dateDocIssue: string;     // Ngày phát hành HSYC/HSMT
  dateBidClose: string;     // Ngày đóng thầu/hết hạn nộp HSDĐ
  dateEvaluate: string;     // Ngày Báo cáo đánh giá
  dateAppraise: string;     // Ngày Báo cáo thẩm định
  dateResultProposal: string;  // Ngày Tờ trình phê duyệt kết quả
  dateResultApprove: string;   // Ngày Quyết định phê duyệt kết quả
  dateContractSign: string; // Ngày ký hợp đồng
  dateDelivery: string;     // Ngày bàn giao
  dateAcceptance: string;   // Ngày nghiệm thu
  dateLiquidation: string;  // Ngày thanh lý
  dateAssetIncrease: string;// Ngày ghi tăng tài sản
  
  contractDurationDays: number;
  items: ProcurementItem[];
}

export const demoPackages: ProcurementPackage[] = [
  {
    id: 'pkg-1',
    packageName: 'Mua sắm máy tính, thiết bị mạng phục vụ phòng máy thực hành Khoa Công nghệ thông tin',
    packageCode: 'MS-2026-MT01',
    fundingSource: 'autonomy_fund',
    fundingSourceName: 'Quỹ phát triển hoạt động sự nghiệp của nhà trường',
    budgetYear: 2026,
    rectorName: 'TS. Nguyễn Hồng Giang',
    departmentName: 'Phòng Quản trị đời sống',
    departmentCode: 'QTDS',
    expertTeamLeader: 'Ông Trần Văn Nam (Trưởng phòng QTDS - Tổ trưởng)',
    expertTeamMember1: 'Bà Nguyễn Thị Mai (Chuyên viên Phòng QTDS - Thành viên)',
    expertTeamMember2: 'Ông Lê Hoàng Hải (Giảng viên Khoa CNTT - Thành viên)',
    appraisalLeader: 'Bà Phạm Thị Dung (Trưởng phòng Tài chính - Kế hoạch - Tổ trưởng)',
    appraisalMember: 'Ông Vũ Minh Tuấn (Chuyên viên Phòng TC-KH - Thành viên)',
    supplier1Name: 'Công ty Cổ phần Công nghệ T & T Việt Nam',
    supplier1Address: 'Số 45, Đường Lê Lợi, Thành phố Bắc Giang, Tỉnh Bắc Giang',
    supplier1TaxCode: '2400123456',
    supplier1Representative: 'Ông Trần Tiến Đạt',
    supplier1Position: 'Giám đốc',
    supplier2Name: 'Công ty TNHH Máy tính và Thiết bị Việt Nam',
    supplier2Address: 'Số 102, Đường Nguyễn Văn Cừ, Quận Long Biên, Thành phố Hà Nội',
    supplier3Name: 'Công ty TNHH Tin học Sao Nam',
    supplier3Address: 'Số 15, Phố Trần Quốc Hoàn, Quận Cầu Giấy, Thành phố Hà Nội',
    
    dateProposal: '2026-04-06',
    dateSurvey: '2026-04-08',
    dateQuotes: '2026-04-10',
    dateCompare: '2026-04-13',
    dateKhlcnt: '2026-04-15',
    dateKhlcntApprove: '2026-04-17',
    dateExpertEstablish: '2026-04-20',
    dateDocIssue: '2026-04-21',
    dateBidClose: '2026-04-27',
    dateEvaluate: '2026-04-29',
    dateAppraise: '2026-05-02',
    dateResultProposal: '2026-05-04',
    dateResultApprove: '2026-05-05',
    dateContractSign: '2026-05-07',
    dateDelivery: '2026-05-22',
    dateAcceptance: '2026-05-27',
    dateLiquidation: '2026-05-29',
    dateAssetIncrease: '2026-06-01',
    contractDurationDays: 15,
    items: [
      {
        id: 'item-1-1',
        name: 'Máy tính để bàn PC phục vụ thực hành đồ họa (Đồng bộ CPU Intel Core i7, RAM 16GB, SSD 512GB, Card đồ họa rời 4GB, Màn hình 24 inch)',
        unit: 'Bộ',
        quantity: 20,
        unitPrice: 15000000,
        specs: 'Hàng mới 100%, đồng bộ linh kiện, bảo hành 24 tháng chính hãng, CPU thế hệ 13 trở lên, VGA GTX 1650 hoặc tương đương.',
        supplier1Price: 15000000,
        supplier2Price: 15700000,
        supplier3Price: 16100000
      },
      {
        id: 'item-1-2',
        name: 'Thiết bị chia mạng Switch 24-ports Gigabit (Managed L2/L3)',
        unit: 'Cái',
        quantity: 2,
        unitPrice: 5000000,
        specs: 'Hàng mới 100%, bảo hành 12 tháng, hỗ trợ VLAN, QoS, băng thông chuyển mạch tối thiểu 48Gbps.',
        supplier1Price: 5000000,
        supplier2Price: 5200000,
        supplier3Price: 5400000
      },
      {
        id: 'item-1-3',
        name: 'Bộ lưu điện UPS công suất 1000VA / 600W',
        unit: 'Cái',
        quantity: 2,
        unitPrice: 5000000,
        specs: 'Hàng mới 100%, bảo hành 24 tháng cho máy và 12 tháng cho ắc quy. Thời gian lưu điện tối thiểu 5 phút ở 100% tải.',
        supplier1Price: 5000000,
        supplier2Price: 5100000,
        supplier3Price: 5200000
      }
    ]
  },
  {
    id: 'pkg-2',
    packageName: 'Bảo trì, sửa chữa hệ thống điều hòa không khí tại Khu nhà hiệu bộ và các phòng học lý thuyết năm học 2025-2026',
    packageCode: 'SC-2026-DH02',
    fundingSource: 'other_revenue',
    fundingSourceName: 'Nguồn thu sự nghiệp hợp pháp khác của nhà trường',
    budgetYear: 2026,
    rectorName: 'TS. Nguyễn Hồng Giang',
    departmentName: 'Phòng Quản trị đời sống',
    departmentCode: 'QTDS',
    expertTeamLeader: 'Ông Trần Văn Nam (Trưởng phòng QTDS - Tổ trưởng)',
    expertTeamMember1: 'Ông Nguyễn Văn Hùng (Kỹ thuật viên phòng QTDS - Thành viên)',
    expertTeamMember2: 'Bà Nguyễn Thị Mai (Chuyên viên Phòng QTDS - Thành viên)',
    appraisalLeader: 'Bà Phạm Thị Dung (Trưởng phòng Tài chính - Kế hoạch - Tổ trưởng)',
    appraisalMember: 'Bà Lê Thị Thu (Chuyên viên Phòng TC-KH - Thành viên)',
    supplier1Name: 'Công ty TNHH Cơ điện lạnh Hà Bắc',
    supplier1Address: 'Đường Xương Giang, Thành phố Bắc Giang, Tỉnh Bắc Giang',
    supplier1TaxCode: '2400987654',
    supplier1Representative: 'Ông Hoàng Văn Bắc',
    supplier1Position: 'Giám đốc',
    supplier2Name: 'Công ty Cổ phần Công nghệ Điện lạnh Việt',
    supplier2Address: 'Số 12, Ngõ 90, Đường Láng, Quận Đống Đa, Thành phố Hà Nội',
    supplier3Name: 'Công ty TNHH Thương mại và Dịch vụ Sao Việt',
    supplier3Address: 'Số 33, Phố Hùng Vương, Thành phố Bắc Giang, Tỉnh Bắc Giang',
    
    dateProposal: '2026-05-11',
    dateSurvey: '2026-05-12',
    dateQuotes: '2026-05-14',
    dateCompare: '2026-05-15',
    dateKhlcnt: '2026-05-18',
    dateKhlcntApprove: '2026-05-19',
    dateExpertEstablish: '2026-05-20',
    dateDocIssue: '2026-05-21',
    dateBidClose: '2026-05-26',
    dateEvaluate: '2026-05-27',
    dateAppraise: '2026-05-28',
    dateResultProposal: '2026-05-29',
    dateResultApprove: '2026-05-30',
    dateContractSign: '2026-06-01',
    dateDelivery: '2026-06-08',
    dateAcceptance: '2026-06-08',
    dateLiquidation: '2026-06-12',
    dateAssetIncrease: '2026-06-12',
    contractDurationDays: 7,
    items: [
      {
        id: 'item-2-1',
        name: 'Dịch vụ bảo dưỡng, vệ sinh máy điều hòa treo tường (công suất từ 9000 BTU - 18000 BTU)',
        unit: 'Máy',
        quantity: 60,
        unitPrice: 350000,
        specs: 'Bao gồm vệ sinh lưới lọc, dàn nóng, dàn lạnh, kiểm tra lượng gas, kiểm tra hệ thống điện và ống thoát nước.',
        supplier1Price: 350000,
        supplier2Price: 380000,
        supplier3Price: 400000
      },
      {
        id: 'item-2-2',
        name: 'Dịch vụ bảo dưỡng, vệ sinh máy điều hòa âm trần (công suất từ 24000 BTU - 48000 BTU)',
        unit: 'Máy',
        quantity: 20,
        unitPrice: 850000,
        specs: 'Vệ sinh chi tiết máng nước thải, bơm xả, dàn trao đổi nhiệt bằng bơm áp lực cao, kiểm tra dòng điện làm việc.',
        supplier1Price: 850000,
        supplier2Price: 900000,
        supplier3Price: 950000
      },
      {
        id: 'item-2-3',
        name: 'Thay thế block máy nén điều hòa 24000 BTU (đã bao gồm nhân công lắp đặt và cân chỉnh hệ thống)',
        unit: 'Bộ',
        quantity: 6,
        unitPrice: 5500000,
        specs: 'Lốc nén chính hãng Panasonic hoặc tương đương, mới 100%, bảo hành 12 tháng.',
        supplier1Price: 5500000,
        supplier2Price: 6000000,
        supplier3Price: 6200000
      },
      {
        id: 'item-2-4',
        name: 'Nạp gas bổ sung điều hòa (Gas R410A nhập khẩu Ấn Độ)',
        unit: 'Kg',
        quantity: 30,
        unitPrice: 300000,
        specs: 'Gas sạch chất lượng cao, không lẫn tạp chất, nạp bổ sung đạt áp suất định mức cho máy.',
        supplier1Price: 300000,
        supplier2Price: 320000,
        supplier3Price: 330000
      }
    ]
  },
  {
    id: 'pkg-3',
    packageName: 'Mua sắm hóa chất, dụng cụ và thiết bị đo phục vụ đào tạo các lớp thực hành Khoa Công nghệ hóa chất',
    packageCode: 'MS-2026-HC03',
    fundingSource: 'autonomy_fund',
    fundingSourceName: 'Quỹ phát triển hoạt động sự nghiệp của nhà trường',
    budgetYear: 2026,
    rectorName: 'TS. Nguyễn Hồng Giang',
    departmentName: 'Khoa Công nghệ hóa chất',
    departmentCode: 'CNHC',
    expertTeamLeader: 'Ông Lê Văn Khoa (Trưởng khoa CNHC - Tổ trưởng)',
    expertTeamMember1: 'Bà Hoàng Thị Yến (Giảng viên Khoa CNHC - Thành viên)',
    expertTeamMember2: 'Ông Nguyễn Văn Hải (Chuyên viên Phòng Đào tạo - Thành viên)',
    appraisalLeader: 'Bà Phạm Thị Dung (Trưởng phòng Tài chính - Kế hoạch - Tổ trưởng)',
    appraisalMember: 'Ông Trần Thanh Bình (Chuyên viên Phòng TC-KH - Thành viên)',
    supplier1Name: 'Công ty TNHH Thiết bị Khoa học và Hóa chất Việt',
    supplier1Address: 'Khu đô thị mới Dịch Vọng, Quận Cầu Giấy, Thành phố Hà Nội',
    supplier1TaxCode: '0101567890',
    supplier1Representative: 'Bà Trần Kim Oanh',
    supplier1Position: 'Giám đốc',
    supplier2Name: 'Công ty Cổ phần Vật tư Khoa học Kỹ thuật',
    supplier2Address: 'Đường Giải Phóng, Quận Thanh Xuân, Thành phố Hà Nội',
    supplier3Name: 'Công ty TNHH Thiết bị và Hóa chất Sao Mai',
    supplier3Address: 'Khu công nghiệp Song Khê - Nội Hoàng, Tỉnh Bắc Giang',
    
    dateProposal: '2026-03-02',
    dateSurvey: '2026-03-04',
    dateQuotes: '2026-03-06',
    dateCompare: '2026-03-09',
    dateKhlcnt: '2026-03-11',
    dateKhlcntApprove: '2026-03-13',
    dateExpertEstablish: '2026-03-16',
    dateDocIssue: '2026-03-17',
    dateBidClose: '2026-03-24',
    dateEvaluate: '2026-03-27',
    dateAppraise: '2026-03-30',
    dateResultProposal: '2026-04-01',
    dateResultApprove: '2026-04-02',
    dateContractSign: '2026-04-06',
    dateDelivery: '2026-05-06',
    dateAcceptance: '2026-05-13',
    dateLiquidation: '2026-05-15',
    dateAssetIncrease: '2026-05-18',
    contractDurationDays: 30,
    items: [
      {
        id: 'item-3-1',
        name: 'Hóa chất Axit Sunfuric H2SO4 tinh khiết phân tích (Hàm lượng >= 98%, chai 500ml)',
        unit: 'Chai',
        quantity: 100,
        unitPrice: 250000,
        specs: 'Tiêu chuẩn phân tích AR, sản xuất bởi Merck (Đức) hoặc Sigma-Aldrich, có CO/CQ đầy đủ.',
        supplier1Price: 250000,
        supplier2Price: 265000,
        supplier3Price: 270000
      },
      {
        id: 'item-3-2',
        name: 'Hóa chất Natri Hydroxit NaOH hạt tinh khiết phân tích (Hàm lượng >= 99%, lọ 500g)',
        unit: 'Lọ',
        quantity: 200,
        unitPrice: 150000,
        specs: 'Dạng hạt tròn trắng, dễ tan trong nước, tiêu chuẩn AR, Merck (Đức).',
        supplier1Price: 150000,
        supplier2Price: 160000,
        supplier3Price: 165000
      },
      {
        id: 'item-3-3',
        name: 'Thiết bị đo pH và phân tích nồng độ dung dịch cầm tay đa chỉ tiêu',
        unit: 'Cái',
        quantity: 10,
        unitPrice: 15000000,
        specs: 'Hàng mới 100%, bảo hành 12 tháng. Khoảng đo pH: 0.00 đến 14.00, độ chính xác ±0.01 pH. Đi kèm điện cực và dung dịch chuẩn.',
        supplier1Price: 15000000,
        supplier2Price: 15500000,
        supplier3Price: 15800000
      },
      {
        id: 'item-3-4',
        name: 'Hệ thống máy chưng cất nước 2 lần tự động công suất 4 lít/giờ',
        unit: 'Bộ',
        quantity: 3,
        unitPrice: 115000000,
        specs: 'Hàng mới 100%, bảo hành 12 tháng. Vật liệu thủy tinh borosilicate cao cấp chống bám cặn, tự động ngắt khi mất nước.',
        supplier1Price: 115000000,
        supplier2Price: 122000000,
        supplier3Price: 125000000
      },
      {
        id: 'item-3-5',
        name: 'Ống đong thủy tinh chia vạch 100ml (Thủy tinh borosilicate 3.3 chịu nhiệt)',
        unit: 'Cái',
        quantity: 500,
        unitPrice: 200000,
        specs: 'Vạch chia màu xanh chịu hóa chất, Class A tiêu chuẩn DIN ISO.',
        supplier1Price: 200000,
        supplier2Price: 215000,
        supplier3Price: 220000
      }
    ]
  },
  {
    id: 'pkg-4',
    packageName: 'Mua sắm vật tư, văn phòng phẩm phục vụ kỳ thi tuyển sinh và nhập học năm học 2026-2027',
    packageCode: 'MS-2026-VPP04',
    fundingSource: 'other_revenue',
    fundingSourceName: 'Nguồn thu sự nghiệp hợp pháp khác của nhà trường',
    budgetYear: 2026,
    rectorName: 'TS. Nguyễn Hồng Giang',
    departmentName: 'Phòng Tuyển sinh và Truyền thông',
    departmentCode: 'TSTT',
    expertTeamLeader: 'Ông Nguyễn Văn Bình (Trưởng phòng TSTT - Tổ trưởng)',
    expertTeamMember1: 'Bà Lê Thị Nga (Chuyên viên phòng TSTT - Thành viên)',
    expertTeamMember2: 'Ông Trần Văn Nam (Trưởng phòng QTDS - Thành viên)',
    appraisalLeader: 'Bà Phạm Thị Dung (Trưởng phòng Tài chính - Kế hoạch - Tổ trưởng)',
    appraisalMember: 'Bà Nguyễn Thị Thu (Chuyên viên Phòng TC-KH - Thành viên)',
    supplier1Name: 'Hộ kinh doanh Văn phòng phẩm Hồng Hà Bắc Giang',
    supplier1Address: 'Số 154, Đường Nguyễn Văn Cừ, Thành phố Bắc Giang, Tỉnh Bắc Giang',
    supplier1TaxCode: '2400112233',
    supplier1Representative: 'Bà Nguyễn Thị Hồng',
    supplier1Position: 'Chủ hộ kinh doanh',
    supplier2Name: 'Công ty TNHH Thương mại và Dịch vụ Thăng Long',
    supplier2Address: 'Đường Hùng Vương, Thành phố Bắc Giang, Tỉnh Bắc Giang',
    supplier3Name: 'Nhà sách Giáo dục Tỉnh Bắc Giang',
    supplier3Address: 'Đường Ngô Gia Tự, Thành phố Bắc Giang, Tỉnh Bắc Giang',
    
    dateProposal: '2026-06-01',
    dateSurvey: '2026-06-02',
    dateQuotes: '2026-06-03',
    dateCompare: '2026-06-04',
    dateKhlcnt: '2026-06-05',
    dateKhlcntApprove: '2026-06-08',
    dateExpertEstablish: '2026-06-09',
    dateDocIssue: '2026-06-09',
    dateBidClose: '2026-06-16',
    dateEvaluate: '2026-06-18',
    dateAppraise: '2026-06-19',
    dateResultProposal: '2026-06-22',
    dateResultApprove: '2026-06-23',
    dateContractSign: '2026-06-24',
    dateDelivery: '2026-06-26',
    dateAcceptance: '2026-06-26',
    dateLiquidation: '2026-06-30',
    dateAssetIncrease: '2026-07-01',
    contractDurationDays: 2,
    items: [
      {
        id: 'item-4-1',
        name: 'Giấy in văn phòng Double A khổ A4, định lượng 70gsm',
        unit: 'Ram',
        quantity: 300,
        unitPrice: 70000,
        specs: 'Độ trắng 148-150 CIE, bề mặt nhẵn mịn, đóng gói 500 tờ/ram, nhập khẩu Thái Lan.',
        supplier1Price: 70000,
        supplier2Price: 75000,
        supplier3Price: 78000
      },
      {
        id: 'item-4-2',
        name: 'Bút bi Thiên Long xanh ngòi 0.5mm (Mã sản phẩm TL-027)',
        unit: 'Cái',
        quantity: 2000,
        unitPrice: 4000,
        specs: 'Độ dài viết được tối thiểu 1000m, mực ra đều, nét chữ thanh mảnh.',
        supplier1Price: 4000,
        supplier2Price: 4500,
        supplier3Price: 4800
      },
      {
        id: 'item-4-3',
        name: 'File còng lưu trữ hồ sơ gáy 7cm (Mặt ngoài phủ nhựa PP cao cấp)',
        unit: 'Cái',
        quantity: 400,
        unitPrice: 40000,
        specs: 'Khóa còng bằng thép không gỉ chắc chắn, lưu được khoảng 500 tờ giấy A4.',
        supplier1Price: 40000,
        supplier2Price: 43000,
        supplier3Price: 45000
      }
    ]
  }
];
