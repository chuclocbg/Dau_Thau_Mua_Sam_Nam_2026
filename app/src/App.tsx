import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { 
  FileText, Download, Play, Plus, Trash2, AlertTriangle, 
  CheckCircle, Layers, Calendar, DollarSign, FileCheck, Info
} from 'lucide-react';
import { demoPackages, ProcurementPackage, ProcurementItem } from './demoData';
import {
  documentTemplates, getProcurementMethod, formatVND, downloadDocx
} from './docTemplates';
import { validateDateGaps, validatePackageBeforeExport } from './utils';
import { DocErrorBoundary } from './DocErrorBoundary';
import AiAssistantPanel from './AiAssistantPanel';
import AgentProviderPanel, { createAgentSystem } from './components/AgentProviderPanel';
import JSZip from 'jszip';
import { Packer } from 'docx';
import './App.css';

// Module-level singleton — created once when the module loads.
// Agents are stateful; creating them outside the component function
// keeps instances stable across re-renders.
const agentSystem = createAgentSystem();

export default function App() {
  // Main State
  const [selectedPackage, setSelectedPackage] = useState<ProcurementPackage>(demoPackages[0]);
  const [activeTab, setActiveTab] = useState<'all' | 'required' | 'recommended' | 'not_applicable'>('all');
  const [activeDocIndex, setActiveDocIndex] = useState<number>(0);
  const [activeSection, setActiveSection] = useState<'info' | 'dates' | 'items'>('info');
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [showAiPanel, setShowAiPanel] = useState<boolean>(false);
  const [showAgentPanel, setShowAgentPanel] = useState<boolean>(false);

  // Sync state when selecting a demo package
  const handleSelectDemo = (pkgId: string) => {
    const pkg = demoPackages.find(p => p.id === pkgId);
    if (pkg) {
      setSelectedPackage(structuredClone(pkg));
      setActiveDocIndex(0);
    }
  };

  // Form field change handlers
  const handleInfoChange = <K extends keyof ProcurementPackage>(field: K, value: ProcurementPackage[K]) => {
    setSelectedPackage(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Timeline changes
  const handleDateChange = (field: keyof ProcurementPackage, value: string) => {
    setSelectedPackage(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Items changes — unitPrice (approved budget) and supplier prices are independent
  const handleItemChange = <K extends keyof ProcurementItem>(itemId: string, field: K, value: ProcurementItem[K]) => {
    setSelectedPackage(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    }));
  };

  // Add Item
  const handleAddItem = () => {
    const newItem: ProcurementItem = {
      id: `item-${Date.now()}`,
      name: 'Thiết bị mới đề xuất',
      unit: 'Bộ',
      quantity: 1,
      unitPrice: 10000000,
      specs: 'Hàng mới 100%, bảo hành 12 tháng.',
      supplier1Price: 10000000,
      supplier2Price: 10500000,
      supplier3Price: 11000000
    };
    setSelectedPackage(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  // Delete Item
  const handleDeleteItem = (itemId: string) => {
    setSelectedPackage(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }));
  };

  // Calculate dynamic totals — unitPrice is the approved budget baseline, not supplier quotes
  const totalAmount = selectedPackage.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const method = getProcurementMethod({ ...selectedPackage, items: selectedPackage.items });

  // Date sequence order errors (red)
  const dateValidationErrors: string[] = [];
  const dateValidationWarnings: string[] = validateDateGaps(selectedPackage);
  const validateDateOrder = () => {
    const dates = [
      { name: 'Ngày đề xuất', val: selectedPackage.dateProposal },
      { name: 'Ngày khảo sát giá', val: selectedPackage.dateSurvey },
      { name: 'Ngày báo giá', val: selectedPackage.dateQuotes },
      { name: 'Ngày so sánh báo giá', val: selectedPackage.dateCompare },
      { name: 'Ngày tờ trình KHLCNT', val: selectedPackage.dateKhlcnt },
      { name: 'Ngày phê duyệt KHLCNT', val: selectedPackage.dateKhlcntApprove },
      { name: 'Ngày thành lập tổ chuyên gia', val: selectedPackage.dateExpertEstablish },
      { name: 'Ngày phát hành HSYC', val: selectedPackage.dateDocIssue },
      { name: 'Ngày đóng thầu', val: selectedPackage.dateBidClose },
      { name: 'Ngày đánh giá hồ sơ', val: selectedPackage.dateEvaluate },
      { name: 'Ngày thẩm định kết quả', val: selectedPackage.dateAppraise },
      { name: 'Ngày phê duyệt kết quả', val: selectedPackage.dateResultApprove },
      { name: 'Ngày ký hợp đồng', val: selectedPackage.dateContractSign },
      { name: 'Ngày bàn giao', val: selectedPackage.dateDelivery },
      { name: 'Ngày nghiệm thu', val: selectedPackage.dateAcceptance },
      { name: 'Ngày thanh lý', val: selectedPackage.dateLiquidation },
      { name: 'Ngày ghi tăng tài sản', val: selectedPackage.dateAssetIncrease }
    ];
    for (let i = 0; i < dates.length - 1; i++) {
      if (dates[i].val && dates[i+1].val) {
        if (new Date(dates[i].val) > new Date(dates[i+1].val)) {
          dateValidationErrors.push(`[⚠ AUDIT RISK] "${dates[i].name}" (${dates[i].val}) xảy ra sau "${dates[i+1].name}" (${dates[i+1].val}). Thời gian quy trình không hợp lý.`);
        }
      }
    }
  };
  validateDateOrder();

  // Filter documents by tab
  const filteredDocs = documentTemplates.filter(doc => {
    const category = doc.getCategory(method.code, selectedPackage);
    if (activeTab === 'all') return true;
    return category === activeTab;
  });

  const activeDoc = documentTemplates[activeDocIndex];

  // Download ZIP of all 24 documents
  const handleDownloadAllZip = async () => {
    const errors = validatePackageBeforeExport(selectedPackage);
    const exportWarnings: string[] = [];
    if (!selectedPackage.dateDelivery) exportWarnings.push('Chưa điền ngày bàn giao hàng hóa — Doc 19 sẽ để trống.');
    if (!selectedPackage.dateAcceptance) exportWarnings.push('Chưa điền ngày nghiệm thu — Doc 20 sẽ để trống.');
    if (dateValidationErrors.length > 0) exportWarnings.push(`Có ${dateValidationErrors.length} mâu thuẫn trình tự ngày tháng chưa được khắc phục.`);
    if (dateValidationWarnings.length > 0) exportWarnings.push(`Có ${dateValidationWarnings.length} cảnh báo khoảng cách thời gian tối thiểu.`);
    const warnings = exportWarnings;
    if (errors.length > 0) {
      alert('Không thể xuất hồ sơ — vui lòng khắc phục các lỗi sau:\n\n' + errors.map(e => '• ' + e).join('\n'));
      return;
    }
    if (warnings.length > 0) {
      const proceed = window.confirm(
        'Cảnh báo trước khi xuất hồ sơ:\n\n' +
        warnings.map(w => '• ' + w).join('\n') +
        '\n\nVẫn tiếp tục xuất file?'
      );
      if (!proceed) return;
    }
    setIsExportingZip(true);
    try {
      const zip = new JSZip();
      for (const docConfig of documentTemplates) {
        const doc = docConfig.getDocx(selectedPackage, method.code);
        const blob = await Packer.toBlob(doc);
        const indexStr = docConfig.id.toString().padStart(2, '0');
        const nameClean = docConfig.name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .replace(/Đ/g, 'D')
          .replace(/[^a-zA-Z0-9]/g, '_');
        zip.file(`${indexStr}_HSMS_${nameClean}.docx`, blob);
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const { saveAs } = await import('file-saver');
      saveAs(content, `Bo_Ho_So_Mua_Sam_${selectedPackage.packageCode || '2026'}.zip`);
    } catch (error) {
      alert("Lỗi khi tạo file nén: " + error);
    } finally {
      setIsExportingZip(false);
    }
  };

  return (
    <div className="app-container">
      {/* Premium Dashboard Header */}
      <header className="app-header">
        <div className="header-title-group">
          <h1>Hệ Thống Tự Động Thiết Lập Hồ Sơ Mua Sắm</h1>
          <div className="header-subtitle">
            <span>Đơn vị: <b>Trường Cao đẳng Kỹ thuật Công nghiệp</b></span>
            <span className="badge">Tự chủ tài chính nhóm 2</span>
            <span className="badge badge-warning">Bộ Công Thương</span>
          </div>
        </div>
        <div className="header-actions">
          <button
            className={`btn ${showAiPanel ? 'btn-secondary' : 'btn-ai'}`}
            onClick={() => setShowAiPanel(p => !p)}
          >
            {showAiPanel ? 'Ẩn trợ lý AI' : 'Trợ lý AI'}
          </button>
          <button
            className={`btn ${showAgentPanel ? 'btn-secondary' : 'btn-ai'}`}
            onClick={() => setShowAgentPanel(p => !p)}
          >
            {showAgentPanel ? 'Ẩn Multi-Agent' : 'Multi-Agent'}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleDownloadAllZip}
            disabled={isExportingZip}
          >
            <Download size={16} />
            {isExportingZip ? 'Đang tạo file nén ZIP...' : 'Tải trọn bộ 24 hồ sơ (ZIP)'}
          </button>
        </div>
      </header>

      {showAiPanel && (
        <AiAssistantPanel
          onApplyPackage={pkg => {
            setSelectedPackage(structuredClone(pkg));
            setActiveDocIndex(0);
            setShowAiPanel(false);
          }}
        />
      )}

      {showAgentPanel && (
        <AgentProviderPanel
          agents={agentSystem.agents}
          title="Hệ thống Multi-Agent"
        />
      )}

      {/* Main Layout */}
      <main className="app-main">
        {/* Panel 1: Configuration Sidebar */}
        <div className="panel app-sidebar-left">
          <div className="panel-title">
            <Layers size={18} />
            <span>Cấu Hình Gói Thầu</span>
          </div>

          <div className="demo-selector-group">
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Chọn Gói Thầu Mẫu:</label>
            {demoPackages.map(pkg => (
              <div 
                key={pkg.id} 
                className={`demo-card ${selectedPackage.id === pkg.id ? 'active' : ''}`}
                onClick={() => handleSelectDemo(pkg.id)}
              >
                <h3>{pkg.packageName.slice(0, 50)}...</h3>
                <p>Mã: {pkg.packageCode} | Giá trị mẫu: {formatVND(pkg.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0))}</p>
              </div>
            ))}
          </div>

          <div className="section-tabs">
            <button 
              className={`section-tab-btn ${activeSection === 'info' ? 'active' : ''}`}
              onClick={() => setActiveSection('info')}
            >
              Thông tin chung
            </button>
            <button 
              className={`section-tab-btn ${activeSection === 'dates' ? 'active' : ''}`}
              onClick={() => setActiveSection('dates')}
            >
              Mốc thời gian
            </button>
            <button 
              className={`section-tab-btn ${activeSection === 'items' ? 'active' : ''}`}
              onClick={() => setActiveSection('items')}
            >
              Hàng hóa / Báo giá
            </button>
          </div>

          <div className="scrollable">
            {activeSection === 'info' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div className="form-group">
                  <label>Tên gói thầu:</label>
                  <textarea 
                    className="form-textarea" 
                    rows={3} 
                    value={selectedPackage.packageName}
                    onChange={(e) => handleInfoChange('packageName', e.target.value)}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Mã gói thầu:</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={selectedPackage.packageCode}
                      onChange={(e) => handleInfoChange('packageCode', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Năm ngân sách:</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={selectedPackage.budgetYear}
                      onChange={(e) => handleInfoChange('budgetYear', Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Nguồn vốn:</label>
                  <select 
                    className="form-select" 
                    value={selectedPackage.fundingSource}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      handleInfoChange('fundingSource', val);
                      const labels = {
                        autonomy_fund: 'Quỹ phát triển hoạt động sự nghiệp của nhà trường',
                        state_budget: 'Nguồn ngân sách nhà nước cấp chi thường xuyên',
                        other_revenue: 'Nguồn thu sự nghiệp hợp pháp khác của nhà trường'
                      };
                      handleInfoChange('fundingSourceName', labels[val as keyof typeof labels]);
                    }}
                  >
                    <option value="autonomy_fund">Quỹ phát triển hoạt động sự nghiệp (Tự chủ)</option>
                    <option value="state_budget">Ngân sách nhà nước (NSNN)</option>
                    <option value="other_revenue">Nguồn thu hợp pháp khác</option>
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Tên phòng/khoa đề xuất:</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={selectedPackage.departmentName}
                      onChange={(e) => handleInfoChange('departmentName', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Mã viết tắt phòng:</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={selectedPackage.departmentCode}
                      onChange={(e) => handleInfoChange('departmentCode', e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Hiệu trưởng:</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={selectedPackage.rectorName}
                      onChange={(e) => handleInfoChange('rectorName', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Thời gian thực hiện (ngày):</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={selectedPackage.contractDurationDays}
                      onChange={(e) => handleInfoChange('contractDurationDays', Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'dates' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Ngày Tờ trình mua sắm:</label>
                    <input type="date" className="form-input" value={selectedPackage.dateProposal} onChange={(e) => handleDateChange('dateProposal', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Ngày Biên bản khảo sát giá:</label>
                    <input type="date" className="form-input" value={selectedPackage.dateSurvey} onChange={(e) => handleDateChange('dateSurvey', e.target.value)} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Ngày trên Báo giá:</label>
                    <input type="date" className="form-input" value={selectedPackage.dateQuotes} onChange={(e) => handleDateChange('dateQuotes', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Ngày Bảng so sánh:</label>
                    <input type="date" className="form-input" value={selectedPackage.dateCompare} onChange={(e) => handleDateChange('dateCompare', e.target.value)} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Ngày trình KHLCNT:</label>
                    <input type="date" className="form-input" value={selectedPackage.dateKhlcnt} onChange={(e) => handleDateChange('dateKhlcnt', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Ngày phê duyệt KHLCNT:</label>
                    <input type="date" className="form-input" value={selectedPackage.dateKhlcntApprove} onChange={(e) => handleDateChange('dateKhlcntApprove', e.target.value)} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Ngày thành lập Tổ chuyên gia:</label>
                    <input type="date" className="form-input" value={selectedPackage.dateExpertEstablish} onChange={(e) => handleDateChange('dateExpertEstablish', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Ngày phát hành HSYC/HSMT:</label>
                    <input type="date" className="form-input" value={selectedPackage.dateDocIssue} onChange={(e) => handleDateChange('dateDocIssue', e.target.value)} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Ngày đóng thầu:</label>
                    <input type="date" className="form-input" value={selectedPackage.dateBidClose} onChange={(e) => handleDateChange('dateBidClose', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Ngày Báo cáo đánh giá:</label>
                    <input type="date" className="form-input" value={selectedPackage.dateEvaluate} onChange={(e) => handleDateChange('dateEvaluate', e.target.value)} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Ngày Báo cáo thẩm định:</label>
                    <input type="date" className="form-input" value={selectedPackage.dateAppraise} onChange={(e) => handleDateChange('dateAppraise', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Ngày phê duyệt kết quả:</label>
                    <input type="date" className="form-input" value={selectedPackage.dateResultApprove} onChange={(e) => handleDateChange('dateResultApprove', e.target.value)} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Ngày ký Hợp đồng:</label>
                    <input type="date" className="form-input" value={selectedPackage.dateContractSign} onChange={(e) => handleDateChange('dateContractSign', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Ngày bàn giao hàng hóa:</label>
                    <input type="date" className="form-input" value={selectedPackage.dateDelivery} onChange={(e) => handleDateChange('dateDelivery', e.target.value)} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Ngày nghiệm thu bàn giao:</label>
                    <input type="date" className="form-input" value={selectedPackage.dateAcceptance} onChange={(e) => handleDateChange('dateAcceptance', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Ngày thanh lý hợp đồng:</label>
                    <input type="date" className="form-input" value={selectedPackage.dateLiquidation} onChange={(e) => handleDateChange('dateLiquidation', e.target.value)} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Ngày ghi tăng tài sản (kế toán):</label>
                    <input type="date" className="form-input" value={selectedPackage.dateAssetIncrease} onChange={(e) => handleDateChange('dateAssetIncrease', e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'items' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontWeight: 600 }}>Danh mục vật tư đề xuất:</label>
                  <button className="btn" style={{ padding: '0.3rem 0.6rem' }} onClick={handleAddItem}>
                    <Plus size={14} /> Thêm vật tư
                  </button>
                </div>
                {selectedPackage.items.map((item, idx) => (
                  <div key={item.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-accent)' }}>Mặt hàng #{idx + 1}</span>
                      <button className="btn btn-danger" style={{ padding: '0.2rem' }} onClick={() => handleDeleteItem(item.id)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="form-group">
                      <label>Tên thiết bị:</label>
                      <input type="text" className="form-input" value={item.name} onChange={(e) => handleItemChange(item.id, 'name', e.target.value)} />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Số lượng:</label>
                        <input type="number" className="form-input" value={item.quantity} onChange={(e) => handleItemChange(item.id, 'quantity', Number(e.target.value))} />
                      </div>
                      <div className="form-group">
                        <label>Đơn vị tính:</label>
                        <input type="text" className="form-input" value={item.unit} onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label title="Đơn giá trong dự toán được phê duyệt — dùng tính tổng giá gói và xác định phương thức LCNT. Khác với báo giá thực tế của nhà cung cấp.">
                        Đơn giá dự toán (VND) <span style={{ color: 'var(--color-accent)', fontSize: '0.72rem' }}>▸ Dự toán phê duyệt</span>
                      </label>
                      <input type="number" className="form-input" value={item.unitPrice} onChange={(e) => handleItemChange(item.id, 'unitPrice', Number(e.target.value))} />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Báo giá 1 (VND):</label>
                        <input type="number" className="form-input" value={item.supplier1Price} onChange={(e) => handleItemChange(item.id, 'supplier1Price', Number(e.target.value))} />
                      </div>
                      <div className="form-group">
                        <label>Báo giá 2 (VND):</label>
                        <input type="number" className="form-input" value={item.supplier2Price} onChange={(e) => handleItemChange(item.id, 'supplier2Price', Number(e.target.value))} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Báo giá 3 (VND):</label>
                      <input type="number" className="form-input" value={item.supplier3Price} onChange={(e) => handleItemChange(item.id, 'supplier3Price', Number(e.target.value))} />
                    </div>
                    <div className="form-group">
                      <label>Yêu cầu quy cách kỹ thuật:</label>
                      <textarea className="form-textarea" rows={2} value={item.specs} onChange={(e) => handleItemChange(item.id, 'specs', e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Panel 2: Legal Analysis Dashboard & Doc Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Analysis Card */}
          <div className="panel">
            <div className="panel-title">
              <FileCheck size={18} />
              <span>Phân Tích Quy Trình & Căn Cứ Pháp Lý</span>
            </div>
            
            <div className="analysis-header">
              <div className="analysis-total-box">
                <span style={{ color: 'var(--text-secondary)' }}>Tổng giá trị dự toán:</span>
                <span className="analysis-total-amount">{formatVND(totalAmount)}</span>
              </div>
              <p style={{ fontSize: '0.85rem' }}>
                Đề xuất hình thức: <b style={{ color: 'var(--color-accent)' }}>{method.name}</b>
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="analysis-card">
                <h4><Info size={14} /> Thẩm quyền phê duyệt</h4>
                <ul className="analysis-list">
                  {selectedPackage.fundingSource === 'state_budget' ? (
                    <li>Tổng giá trị dưới 45 tỷ đồng: Thuộc thẩm quyền phê duyệt của <b>Hiệu trưởng</b> theo Thông tư 13/2026/TT-BCT phân cấp Bộ Công Thương.</li>
                  ) : (
                    <>
                      {method.code === 'DIRECT_50' && <li>≤50 triệu đồng: <b>Hiệu trưởng</b> tự quyết định, không cần lập KHLCNT.</li>}
                      {method.code === 'DIRECT_SELECTION_SIMPLIFIED' && <li>50 triệu – 500 triệu đồng: <b>Hiệu trưởng</b> phê duyệt; cần lập KHLCNT nội bộ.</li>}
                      {method.code === 'COMPETITIVE_SHOPPING' && <li>500 triệu – 5 tỷ đồng: <b>Hiệu trưởng</b> phê duyệt; KHLCNT trình Bộ Công Thương theo TT 13/2026/TT-BCT.</li>}
                      {method.code === 'OPEN_BIDDING' && <li>Trên 5 tỷ đồng: KHLCNT <b>phải trình Bộ Công Thương phê duyệt</b> trước khi tổ chức đấu thầu.</li>}
                    </>
                  )}
                </ul>
              </div>

              <div className="analysis-card">
                <h4><Calendar size={14} /> Trình tự thời gian</h4>
                <ul className="analysis-list">
                  {dateValidationErrors.length === 0 && dateValidationWarnings.length === 0 ? (
                    <li style={{ color: 'var(--color-success)' }}>Tất cả các mốc ngày tháng đã sắp xếp đúng trình tự pháp lý lựa chọn nhà thầu.</li>
                  ) : (
                    <>
                      {dateValidationErrors.length > 0 && <li style={{ color: 'var(--color-danger)' }}>Có {dateValidationErrors.length} điểm mâu thuẫn trình tự cần kiểm tra lại!</li>}
                      {dateValidationWarnings.length > 0 && <li style={{ color: 'var(--color-warning, #f59e0b)' }}>Có {dateValidationWarnings.length} cảnh báo khoảng cách thời gian tối thiểu.</li>}
                    </>
                  )}
                </ul>
              </div>
            </div>

            {/* Date order errors (red) */}
            {dateValidationErrors.length > 0 && (
              <div className="risk-warning-card">
                <h5><AlertTriangle size={14} /> Mâu thuẫn trình tự ngày tháng</h5>
                <div style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {dateValidationErrors.map((err, i) => <div key={i}>{err}</div>)}
                </div>
              </div>
            )}

            {/* Date gap warnings (orange) */}
            {dateValidationWarnings.length > 0 && (
              <div className="risk-warning-card" style={{ borderColor: 'var(--color-warning, #f59e0b)', background: 'rgba(245,158,11,0.08)' }}>
                <h5 style={{ color: 'var(--color-warning, #f59e0b)' }}><AlertTriangle size={14} /> Cảnh báo khoảng cách thời gian tối thiểu</h5>
                <div style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', color: 'var(--color-warning, #f59e0b)' }}>
                  {dateValidationWarnings.map((w, i) => <div key={i}>{w}</div>)}
                </div>
              </div>
            )}
          </div>

          {/* Document Preview Pane */}
          <div className="preview-pane-container">
            <div className="preview-pane-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <FileText size={18} color="var(--color-accent)" />
                <span style={{ fontWeight: 600 }}>Xem trước: {activeDoc.name}</span>
              </div>
              <button 
                className="btn" 
                style={{ padding: '0.4rem 0.8rem', background: 'rgba(6, 182, 212, 0.1)', borderColor: 'var(--color-accent)' }}
                onClick={() => downloadDocx(activeDoc, selectedPackage, method.code)}
              >
                <Download size={14} /> Tải file .docx
              </button>
            </div>

            {/* Document number reminder — NĐ 30/2020/NĐ-CP: văn bản phải có số riêng */}
            <div style={{ padding: '0.5rem 0.8rem', background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.4)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: '#fcd34d', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertTriangle size={13} />
              <span><b>Lưu ý:</b> Điền số văn bản (thay ký hiệu <b>"..."</b>) trước khi ký và lưu hồ sơ. Văn bản hành chính không có số thứ tự không có giá trị pháp lý (NĐ 30/2020/NĐ-CP).</span>
            </div>

            {/* Document specific audit risk warning card */}
            {activeDoc.getAuditRisk(selectedPackage) && (
              <div className="risk-warning-card" style={{ padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)' }}>
                <h5 style={{ fontSize: '0.8rem' }}><AlertTriangle size={12} /> [⚠ AUDIT RISK] Điểm kiểm toán cần lưu ý:</h5>
                <p style={{ fontSize: '0.75rem', marginTop: '0.2rem', color: '#fca5a5' }}>{activeDoc.getAuditRisk(selectedPackage)}</p>
              </div>
            )}

            <DocErrorBoundary fallbackLabel={`Không thể hiển thị "${activeDoc.name}". Kiểm tra console để biết chi tiết lỗi.`}>
              <div className="paper-sheet scrollable" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(activeDoc.getHtml(selectedPackage, method.code)) }} />
            </DocErrorBoundary>
          </div>
        </div>

        {/* Panel 3: Document Hub Sidebar (Right Panel) */}
        <div className="panel app-sidebar-right">
          <div className="panel-title">
            <FileText size={18} />
            <span>Bộ 24 Tài Liệu Hồ Sơ</span>
          </div>

          <div className="section-tabs">
            <button className={`section-tab-btn ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>Tất cả</button>
            <button className={`section-tab-btn ${activeTab === 'required' ? 'active' : ''}`} onClick={() => setActiveTab('required')}>Bắt buộc</button>
            <button className={`section-tab-btn ${activeTab === 'recommended' ? 'active' : ''}`} onClick={() => setActiveTab('recommended')}>Khuyến nghị</button>
            <button className={`section-tab-btn ${activeTab === 'not_applicable' ? 'active' : ''}`} onClick={() => setActiveTab('not_applicable')}>Không áp dụng</button>
          </div>

          <div className="scrollable" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            <div className="doc-tab-list">
              {filteredDocs.map((doc) => {
                const category = doc.getCategory(method.code, selectedPackage);
                const isSelected = activeDoc.id === doc.id;

                let badgeClass = 'badge';
                if (category === 'required') badgeClass += ' badge-success';
                if (category === 'recommended') badgeClass += ' badge-warning';
                if (category === 'not_applicable') badgeClass += ' badge-danger';

                const displayCategoryLabel = doc.getCategoryLabel(method.code, selectedPackage);

                return (
                  <div 
                    key={doc.id}
                    className={`doc-tab-item ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      const idx = documentTemplates.findIndex(d => d.id === doc.id);
                      setActiveDocIndex(idx);
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>{doc.id.toString().padStart(2, '0')}</span>
                      <span className="doc-tab-title" style={{ color: isSelected ? 'var(--color-accent)' : 'var(--text-primary)' }}>{doc.name}</span>
                    </div>
                    <span className={badgeClass} style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>
                      {displayCategoryLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
