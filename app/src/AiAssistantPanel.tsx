import React, { useState } from 'react';
import { runPlannerWorkflow, PlannerBridgeResult } from './ai/plannerBridge';
import { WORKFLOW_DOCUMENT_NAMES } from './ai/workflowOrchestrator';
import { documentTemplates, getProcurementMethod } from './docTemplates';
import { ProcurementPackage } from './demoData';

interface Props {
  onApplyPackage: (pkg: ProcurementPackage) => void;
}

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: '#c0392b',
  HIGH:     '#e67e22',
  MEDIUM:   '#f39c12',
  LOW:      '#27ae60',
};

const PACKAGE_TYPE_LABEL: Record<string, string> = {
  goods_fixed_asset: 'Tài sản cố định',
  goods_consumable:  'Hàng hóa tiêu hao',
  service:           'Dịch vụ',
  mixed:             'Hỗn hợp',
};

const CONTRACT_TYPE_LABEL: Record<string, string> = {
  lump_sum:   'Trọn gói',
  unit_price: 'Đơn giá cố định',
  time_based: 'Theo thời gian',
};

export default function AiAssistantPanel({ onApplyPackage }: Props) {
  const [request, setRequest] = useState('');
  const [year, setYear]       = useState(new Date().getFullYear());
  const [result, setResult]   = useState<PlannerBridgeResult | null>(null);
  const [isRunning, setIsRunning]   = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  async function handleRun() {
    if (!request.trim()) return;
    setIsRunning(true);
    try {
      const r = await runPlannerWorkflow(request.trim(), year);
      setResult(r);
    } finally {
      setIsRunning(false);
    }
  }

  async function handleDownloadZip() {
    if (!result) return;
    setIsExporting(true);
    try {
      const { default: JSZip } = await import('jszip');
      const { Packer } = await import('docx');
      const zip   = new JSZip();
      const method = getProcurementMethod(result.pkg);
      const selected = documentTemplates.filter(d =>
        result.selectedDocumentIds.includes(d.id)
      );
      for (const docConfig of selected) {
        const doc  = docConfig.getDocx(result.pkg, method.code);
        const blob = await Packer.toBlob(doc);
        const idStr = docConfig.id.toString().padStart(2, '0');
        const nameClean = docConfig.name
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/đ/g, 'd').replace(/Đ/g, 'D')
          .replace(/[^a-zA-Z0-9]/g, '_');
        zip.file(`${idStr}_AI_${nameClean}.docx`, blob);
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const { saveAs } = await import('file-saver');
      saveAs(content, `AI_HoSo_${result.pkg.packageCode || year}.zip`);
    } catch (e) {
      alert('Lỗi khi tạo file ZIP: ' + e);
    } finally {
      setIsExporting(false);
    }
  }

  const stepIcons: Record<string, string> = {
    pending: '○',
    running: '⟳',
    done:    '✓',
    error:   '✗',
  };

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <span className="ai-panel-title">Trợ lý AI — Quy trình một chạm</span>
        <span className="ai-panel-sub">
          Nhập yêu cầu bằng tiếng Việt tự nhiên → tự động sinh hồ sơ + xuất ZIP
        </span>
      </div>

      {/* Input */}
      <div className="ai-input-row">
        <input
          className="ai-input"
          type="text"
          placeholder='Ví dụ: "20 máy tính để bàn phục vụ phòng thực hành"'
          value={request}
          onChange={e => setRequest(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleRun()}
        />
        <select
          className="ai-year-select"
          value={year}
          onChange={e => setYear(Number(e.target.value))}
        >
          {[2025, 2026, 2027, 2028].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button
          className="btn btn-primary"
          onClick={handleRun}
          disabled={isRunning || !request.trim()}
        >
          {isRunning ? 'Đang phân tích...' : 'Phân tích yêu cầu'}
        </button>
      </div>

      {result && (
        <div className="ai-result">
          {/* Steps */}
          <div className="ai-steps">
            {result.steps.map(s => (
              <div key={s.step} className={`ai-step ai-step-${s.status}`}>
                <span className="ai-step-icon">{stepIcons[s.status]}</span>
                <span className="ai-step-label">{s.label}</span>
                {s.message && <span className="ai-step-msg">{s.message}</span>}
              </div>
            ))}
          </div>

          {/* Package summary */}
          <div className="ai-summary" data-source={result.source} data-trace-id={result.traceId}>
            <div><b>Gói thầu:</b> {result.pkg.packageName}</div>
            <div><b>Mã:</b> {result.pkg.packageCode} &nbsp;|&nbsp; <b>Năm:</b> {result.pkg.budgetYear}</div>
            <div><b>Loại:</b> {PACKAGE_TYPE_LABEL[result.pkg.packageType ?? ''] ?? result.pkg.packageType} &nbsp;|&nbsp; <b>Hợp đồng:</b> {CONTRACT_TYPE_LABEL[result.pkg.contractType ?? ''] ?? result.pkg.contractType}</div>
            <div><b>Nguồn:</b> {result.source === 'planner-agent' ? 'P6-01 PlannerAgent' : 'P5 Workflow (fallback)'} &nbsp;|&nbsp; <b>TraceID:</b> {result.traceId.slice(0, 8)}…</div>
          </div>

          {/* Legal findings */}
          {result.legalReview.findings.length > 0 && (
            <div className="ai-findings">
              <div className="ai-section-title">Kết quả rà soát pháp lý (P5-03)</div>
              {result.legalReview.findings.map((f, i) => (
                <div key={i} className="ai-finding">
                  <span
                    className="ai-badge"
                    style={{ background: SEVERITY_COLOR[f.severity] }}
                  >
                    {f.severity}
                  </span>
                  <span className="ai-finding-msg">{f.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Legal KB results */}
          {result.kbResults.length > 0 && (
            <div className="ai-kb">
              <div className="ai-section-title">Căn cứ pháp lý liên quan (P5-04)</div>
              {result.kbResults.map((kb, i) => (
                <div key={i} className="ai-kb-entry">
                  <div className="ai-kb-title">{kb.entry.title}</div>
                  <div className="ai-kb-source">{kb.entry.source}</div>
                  {kb.highlights.length > 0 && (
                    <div className="ai-kb-highlight">{kb.highlights[0]}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Document list */}
          <div className="ai-doc-list">
            <div className="ai-section-title">Hồ sơ sẽ xuất ZIP ({result.selectedDocumentIds.length} tài liệu)</div>
            <div className="ai-doc-grid">
              {result.selectedDocumentIds.map(id => (
                <div key={id} className="ai-doc-item">
                  <span className="ai-doc-id">{id.toString().padStart(2, '0')}</span>
                  <span>{WORKFLOW_DOCUMENT_NAMES[id]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="ai-warnings">
              <div className="ai-section-title">Cảnh báo</div>
              {result.warnings.map((w, i) => (
                <div key={i} className="ai-warning-item">⚠ {w}</div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="ai-actions">
            <button
              className="btn btn-secondary"
              onClick={() => onApplyPackage(result.pkg)}
              title="Sao chép dữ liệu AI vào biểu mẫu chính để chỉnh sửa thêm"
            >
              Áp dụng vào biểu mẫu
            </button>
            <button
              className="btn btn-primary"
              onClick={handleDownloadZip}
              disabled={isExporting || !result.readyForExport}
              title={!result.readyForExport ? 'Khắc phục lỗi CRITICAL trước khi xuất' : ''}
            >
              {isExporting ? 'Đang tạo ZIP...' : `Tải ${result.selectedDocumentIds.length} hồ sơ (ZIP)`}
            </button>
            {!result.readyForExport && (
              <span className="ai-export-blocked">
                [CRITICAL] Cần khắc phục lỗi trước khi xuất hồ sơ
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
