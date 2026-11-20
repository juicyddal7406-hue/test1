import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  FolderPlus,
  Lock,
  Paperclip,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  AppState,
  EvidenceAttachment,
  EvidenceRule,
  Expenditure,
} from '../types/subsidy';
import {
  buildStandardEvidencePath,
  formatKRW,
  generateNextExpenditureId,
  getBudgetItemSummary,
  resolveApplicableEvidenceRules,
} from '../utils/calculations';
import { RequirementText } from './StatusText';

interface ExpenditureFormModalProps {
  state: AppState;
  initialExpenditure: Expenditure | null; // null = create new
  onClose: () => void;
  onSave: (
    expenditure: Expenditure,
    attachmentsForExp: EvidenceAttachment[],
    submitForApproval: boolean,
    isNew: boolean
  ) => void;
  onCreateCorrection?: (source: Expenditure) => void;
}

export function ExpenditureFormModal({
  state,
  initialExpenditure,
  onClose,
  onSave,
  onCreateCorrection,
}: ExpenditureFormModalProps) {
  const isNew = !initialExpenditure;
  const isLocked = Boolean(
    initialExpenditure && initialExpenditure.approvalStatus === '승인' && initialExpenditure.isLocked
  );

  const defaultProject = state.projects[0];
  const [projectId, setProjectId] = useState<string>(
    initialExpenditure?.projectId || defaultProject?.id || ''
  );

  const projectBudgets = useMemo(
    () => state.budgets.filter((b) => b.projectId === projectId),
    [state.budgets, projectId]
  );

  const [budgetItemId, setBudgetItemId] = useState<string>(
    initialExpenditure?.budgetItemId || projectBudgets[0]?.id || ''
  );

  useEffect(() => {
    if (!projectBudgets.some((b) => b.id === budgetItemId)) {
      setBudgetItemId(projectBudgets[0]?.id || '');
    }
  }, [projectId, projectBudgets, budgetItemId]);

  const selectedProject = useMemo(
    () => state.projects.find((p) => p.id === projectId),
    [state.projects, projectId]
  );
  const selectedBudget = useMemo(
    () => projectBudgets.find((b) => b.id === budgetItemId),
    [projectBudgets, budgetItemId]
  );

  const [draftDate, setDraftDate] = useState<string>(
    initialExpenditure?.draftDate || new Date().toISOString().slice(0, 10)
  );
  const [plannedDate, setPlannedDate] = useState<string>(
    initialExpenditure?.plannedDate || new Date().toISOString().slice(0, 10)
  );
  const [purpose, setPurpose] = useState<string>(initialExpenditure?.purpose || '');
  const [vendor, setVendor] = useState<string>(initialExpenditure?.vendor || '');
  const [paymentMethod, setPaymentMethod] = useState<string>(
    initialExpenditure?.paymentMethod || state.settings.paymentMethods[0] || '보조금 전용카드'
  );
  const [supplyAmount, setSupplyAmount] = useState<number>(
    initialExpenditure?.supplyAmount ?? 0
  );
  const [vatAmount, setVatAmount] = useState<number>(initialExpenditure?.vatAmount ?? 0);
  const [exceptionReason, setExceptionReason] = useState<string>(
    initialExpenditure?.exceptionReason || ''
  );
  const [formError, setFormError] = useState<string>('');

  const generatedId = useMemo(() => {
    if (initialExpenditure) return initialExpenditure.id;
    if (!selectedProject) return `EXP-${Date.now()}`;
    return generateNextExpenditureId(
      selectedProject,
      state.settings.fiscalYear,
      state.expenditures
    );
  }, [initialExpenditure, selectedProject, state.settings.fiscalYear, state.expenditures]);

  // Local editable attachments for this expenditure
  const [localAttachments, setLocalAttachments] = useState<EvidenceAttachment[]>(() => {
    if (!initialExpenditure) return [];
    return state.attachments.filter((a) => a.expenditureId === initialExpenditure.id);
  });

  // F-09: Live Evidence Rule Matching!
  const applicableRules = useMemo(() => {
    if (!selectedProject || !selectedBudget) return [];
    return resolveApplicableEvidenceRules(
      selectedProject,
      selectedBudget.fundingSource,
      selectedBudget.category,
      selectedBudget.subCategory,
      draftDate,
      state.evidenceRules
    );
  }, [selectedProject, selectedBudget, draftDate, state.evidenceRules]);

  const appliedVersionLabel = useMemo(() => {
    if (applicableRules.length === 0) return '기준 미등록';
    return Array.from(new Set(applicableRules.map((r) => r.version))).join(', ');
  }, [applicableRules]);

  const totalAmount = (supplyAmount || 0) + (vatAmount || 0);

  // Budget Overrun Check (F-02 / T-03)
  const budgetSummary = useMemo(() => {
    if (!selectedBudget) return null;
    // Exclude this expenditure's previous amount when editing
    const otherExps = state.expenditures.filter((e) => e.id !== generatedId);
    return getBudgetItemSummary(selectedBudget, otherExps);
  }, [selectedBudget, state.expenditures, generatedId]);

  const remainingAfterThis = budgetSummary
    ? budgetSummary.approvedBalance - budgetSummary.pendingAmount - totalAmount
    : 0;
  const isOverBudget = budgetSummary ? remainingAfterThis < 0 : false;

  // Missing required evidence calculation (T-07)
  const requiredRules = applicableRules.filter((r) => r.requirementLevel === '필수');
  const getAttachmentForRule = (rule: EvidenceRule) =>
    localAttachments.find(
      (a) =>
        (a.ruleId === rule.id || a.docType === rule.docType) &&
        a.status === '첨부 완료' &&
        (a.fileName.trim().length > 0 || a.filePath.trim().length > 0)
    );

  const missingRequiredRules = requiredRules.filter((r) => !getAttachmentForRule(r));

  const upsertAttachmentForRule = (
    rule: EvidenceRule,
    fileName: string,
    filePath: string,
    fileDataUrl?: string,
    fileSizeLabel?: string
  ) => {
    setLocalAttachments((prev) => {
      const existingIdx = prev.findIndex(
        (a) => a.ruleId === rule.id || a.docType === rule.docType
      );
      const nextItem: EvidenceAttachment = {
        id:
          existingIdx >= 0
            ? prev[existingIdx].id
            : `EVD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        expenditureId: generatedId,
        ruleId: rule.id,
        docType: rule.docType,
        requirementLevel: rule.requirementLevel,
        fileName,
        filePath,
        fileDataUrl: fileDataUrl || (existingIdx >= 0 ? prev[existingIdx].fileDataUrl : undefined),
        fileSizeLabel:
          fileSizeLabel || (existingIdx >= 0 ? prev[existingIdx].fileSizeLabel : '경로 등록'),
        uploadedAt: new Date().toISOString().slice(0, 10),
        uploaderId: state.currentUserId,
        status: fileName.trim() || filePath.trim() ? '첨부 완료' : '미첨부',
      };
      if (existingIdx >= 0) {
        const clone = [...prev];
        clone[existingIdx] = nextItem;
        return clone;
      }
      return [...prev, nextItem];
    });
  };

  const handleAutoGeneratePath = (rule: EvidenceRule) => {
    const defaultFileName = `${rule.docType.replace(/[/\\:*?"<>|]/g, '_')}_${vendor || '증빙'}.pdf`;
    const stdPath = buildStandardEvidencePath(
      state.settings.rootArchivePath,
      state.settings.fiscalYear,
      projectId,
      generatedId,
      rule.docType,
      defaultFileName
    );
    upsertAttachmentForRule(rule, defaultFileName, stdPath, undefined, '표준경로 지정');
  };

  const handleFileInput = (rule: EvidenceRule, file: File | undefined) => {
    if (!file) return;
    const stdPath = buildStandardEvidencePath(
      state.settings.rootArchivePath,
      state.settings.fiscalYear,
      projectId,
      generatedId,
      rule.docType,
      file.name
    );
    const sizeLabel =
      file.size >= 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.max(1, Math.round(file.size / 1024))} KB`;

    if (file.size <= 3 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = () => {
        upsertAttachmentForRule(
          rule,
          file.name,
          stdPath,
          typeof reader.result === 'string' ? reader.result : undefined,
          sizeLabel
        );
      };
      reader.readAsDataURL(file);
    } else {
      upsertAttachmentForRule(rule, file.name, stdPath, undefined, sizeLabel);
    }
  };

  const handleRemoveAttachment = (ruleId: string, docType: string) => {
    setLocalAttachments((prev) =>
      prev.filter((a) => !(a.ruleId === ruleId || a.docType === docType))
    );
  };

  const handleSaveAction = (submitForApproval: boolean) => {
    setFormError('');
    if (!selectedProject || !selectedBudget) {
      setFormError('사업과 예산 항목(비목·세목)을 선택해 주세요.');
      return;
    }
    if (!purpose.trim()) {
      setFormError('지출 목적 및 내용을 입력해 주세요.');
      return;
    }
    if (!vendor.trim()) {
      setFormError('거래처 또는 지급 대상을 입력해 주세요.');
      return;
    }
    if (totalAmount <= 0) {
      setFormError('지출 총액은 0원보다 커야 합니다.');
      return;
    }

    if (submitForApproval) {
      // T-09: Evidence missing enforcement
      if (missingRequiredRules.length > 0) {
        if (state.settings.strictEvidenceBlock) {
          setFormError(
            `필수 증빙서류 ${missingRequiredRules.length}건(${missingRequiredRules
              .map((r) => r.docType)
              .join(', ')})이 미첨부되어 결재 요청을 진행할 수 없습니다.`
          );
          return;
        } else if (!exceptionReason.trim()) {
          setFormError(
            `필수 증빙서류 ${missingRequiredRules.length}건이 누락되었습니다. 예외 사유를 입력해야 결재 요청이 가능합니다.`
          );
          return;
        }
      }

      if (isOverBudget && state.settings.budgetOverrunBlock) {
        setFormError(
          `선택한 비목의 가용 잔액을 ${formatKRW(Math.abs(remainingAfterThis))} 초과하여 결재 요청이 차단되었습니다.`
        );
        return;
      }
    }

    const nextExp: Expenditure = {
      id: generatedId,
      projectId: selectedProject.id,
      budgetItemId: selectedBudget.id,
      draftDate,
      plannedDate,
      actualPaymentDate: initialExpenditure?.actualPaymentDate || '',
      fundingSource: selectedBudget.fundingSource,
      category: selectedBudget.category,
      subCategory: selectedBudget.subCategory,
      purpose: purpose.trim(),
      vendor: vendor.trim(),
      paymentMethod,
      supplyAmount,
      vatAmount,
      totalAmount,
      drafterId: initialExpenditure?.drafterId || state.currentUserId,
      approvalStatus: submitForApproval ? '결재 요청' : '작성 중',
      requestedDate: submitForApproval ? new Date().toISOString().slice(0, 10) : undefined,
      paymentCompleted: initialExpenditure?.paymentCompleted || false,
      appliedRuleVersion: appliedVersionLabel,
      exceptionReason: exceptionReason.trim() || undefined,
      isLocked: false,
      correctionOfId: initialExpenditure?.correctionOfId,
    };

    const normalizedAttachments = localAttachments.map((a) => ({
      ...a,
      expenditureId: generatedId,
    }));

    onSave(nextExp, normalizedAttachments, submitForApproval, isNew);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                {isNew
                  ? '새 지출결의서 작성 및 필요 증빙서류 등록'
                  : `지출결의서 상세 · ${generatedId}`}
              </h3>
              {isLocked && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
                  <Lock className="w-3.5 h-3.5" />
                  승인 완료(잠금)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              사업과 비목·세목을 선택하면 지원기관 기준에 맞는 필수 증빙서류가 우측에 자동 안내됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {formError && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-md flex items-start gap-2 text-xs font-medium text-red-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {isLocked && (
            <div className="mb-5 p-3.5 bg-slate-50 border border-slate-300 rounded-md flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-600 shrink-0" />
                <span>
                  최종 승인된 지출결의서는 회계 무결성 유지를 위해 임의 수정이 제한됩니다.
                  금액·항목 정정이 필요한 경우 정정 결의서를 작성하세요.
                </span>
              </div>
              {onCreateCorrection && initialExpenditure && (
                <button
                  type="button"
                  onClick={() => onCreateCorrection(initialExpenditure)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded font-medium text-slate-900 hover:bg-slate-100 whitespace-nowrap"
                >
                  정정 결의서 작성
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Expenditure Input Form */}
            <div className="lg:col-span-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="text-sm font-semibold text-slate-900">1. 지출결의 기본 정보</h4>
                <span className="font-mono-num text-xs text-slate-500">{generatedId}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  보조금 사업 선택 *
                </label>
                <select
                  value={projectId}
                  disabled={isLocked}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white disabled:bg-slate-100"
                >
                  {state.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.code}] {p.name} ({p.grantor})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  예산 항목 (재원 · 비목 · 세목) *
                </label>
                <select
                  value={budgetItemId}
                  disabled={isLocked}
                  onChange={(e) => setBudgetItemId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white disabled:bg-slate-100"
                >
                  {projectBudgets.map((b) => (
                    <option key={b.id} value={b.id}>
                      [{b.fundingSource}] {b.category} &gt; {b.subCategory}
                    </option>
                  ))}
                  {projectBudgets.length === 0 && (
                    <option value="">편성된 예산 항목 없음</option>
                  )}
                </select>
              </div>

              {/* Live Budget Check Box */}
              {budgetSummary && (
                <div
                  className={`p-3 rounded-md border text-xs space-y-1 ${
                    isOverBudget
                      ? 'bg-red-50 border-red-200 text-red-900'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex justify-between">
                    <span>현재 예산 / 승인 지출액 / 대기</span>
                    <span className="font-mono-num">
                      {formatKRW(budgetSummary.currentBudget)} /{' '}
                      {formatKRW(budgetSummary.approvedAmount)} /{' '}
                      {formatKRW(budgetSummary.pendingAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>금회 지출 반영 시 예상 잔액</span>
                    <span className="font-mono-num">{formatKRW(remainingAfterThis)}</span>
                  </div>
                  {isOverBudget && (
                    <div className="pt-1 flex items-center gap-1.5 font-semibold text-red-700">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      예산 초과 경고: 가용 잔액을 {formatKRW(Math.abs(remainingAfterThis))}{' '}
                      초과합니다.
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">작성일</label>
                  <input
                    type="date"
                    disabled={isLocked}
                    value={draftDate}
                    onChange={(e) => setDraftDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-num disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    지출 예정일
                  </label>
                  <input
                    type="date"
                    disabled={isLocked}
                    value={plannedDate}
                    onChange={(e) => setPlannedDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-num disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  지출 목적 및 상세 내용 *
                </label>
                <textarea
                  rows={2}
                  disabled={isLocked}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="예: 2회차 워크숍 외부 강사료 지급 (2시간)"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md disabled:bg-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    거래처 / 지급 대상 *
                  </label>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    placeholder="예: 홍길동 또는 (주)OO문구"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    지급 방법
                  </label>
                  <select
                    disabled={isLocked}
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white disabled:bg-slate-100"
                  >
                    {state.settings.paymentMethods.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    공급가액 (원)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    disabled={isLocked}
                    value={supplyAmount}
                    onChange={(e) => setSupplyAmount(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-num text-right disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    부가세 (원)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    disabled={isLocked}
                    value={vatAmount}
                    onChange={(e) => setVatAmount(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-num text-right disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    지출 총액 (자동)
                  </label>
                  <div className="w-full px-3 py-2 text-sm border border-slate-200 bg-slate-50 rounded-md font-mono-num text-right font-bold text-slate-900">
                    {formatKRW(totalAmount)}
                  </div>
                </div>
              </div>

              {!state.settings.strictEvidenceBlock && missingRequiredRules.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-amber-800 mb-1">
                    필수 증빙 미첨부 예외 사유 (예외 허용 정책 적용 중)
                  </label>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={exceptionReason}
                    onChange={(e) => setExceptionReason(e.target.value)}
                    placeholder="예: 강사 이체확인증은 지급 완료 후 3일 이내 사후 첨부 예정"
                    className="w-full px-3 py-2 text-sm border border-amber-300 bg-amber-50/40 rounded-md"
                  />
                </div>
              )}
            </div>

            {/* Right: F-09 Auto Evidence Guidance & Attachment Panel */}
            <div className="lg:col-span-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">
                    2. 사업비 항목별 필요 증빙서류 자동 안내 및 첨부
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {selectedProject?.grantor} · {selectedBudget?.category} /{' '}
                    {selectedBudget?.subCategory} (적용 기준: {appliedVersionLabel})
                  </p>
                </div>
                <div className="text-xs font-semibold">
                  {missingRequiredRules.length > 0 ? (
                    <span className="text-red-700">
                      미첨부 필수 {missingRequiredRules.length}건 (
                      {requiredRules.length - missingRequiredRules.length}/
                      {requiredRules.length})
                    </span>
                  ) : (
                    <span className="text-emerald-700">
                      필수 증빙 완료 ({requiredRules.length}/{requiredRules.length})
                    </span>
                  )}
                </div>
              </div>

              {missingRequiredRules.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    미첨부 필수 서류 ({missingRequiredRules.length}건)
                  </div>
                  <div className="text-amber-800">
                    {missingRequiredRules.map((r) => r.docType).join(' · ')}
                  </div>
                </div>
              )}

              {applicableRules.length === 0 ? (
                <div className="p-8 border border-dashed border-slate-300 rounded-md text-center text-xs text-slate-500">
                  선택한 사업 및 세목({selectedBudget?.subCategory || '-'})에 등록된 증빙 기준이
                  없습니다. &apos;09. 증빙 기준 설정&apos;에서 기준을 추가할 수 있습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {applicableRules.map((rule) => {
                    const attached = getAttachmentForRule(rule);
                    const isProjectSpecific = rule.projectId !== 'ALL';
                    return (
                      <div
                        key={rule.id}
                        className={`p-3.5 rounded-md border ${
                          attached
                            ? 'border-emerald-200 bg-emerald-50/30'
                            : rule.requirementLevel === '필수'
                              ? 'border-red-200 bg-red-50/20'
                              : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <RequirementText level={rule.requirementLevel} />
                              <span className="text-sm font-semibold text-slate-900">
                                {rule.docType}
                              </span>
                              {isProjectSpecific && (
                                <span className="text-[11px] font-medium text-blue-700">
                                  · 사업 전용 기준
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-600">{rule.guideText}</div>
                            {rule.conditionDesc && (
                              <div className="text-[11px] text-slate-500">
                                적용 조건: {rule.conditionDesc} ({rule.id})
                              </div>
                            )}
                          </div>
                          {attached ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 shrink-0">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              첨부됨
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-slate-500 shrink-0">
                              미첨부
                            </span>
                          )}
                        </div>

                        {/* Attachment Controls */}
                        <div className="mt-3 pt-2.5 border-t border-slate-200/70 space-y-2">
                          {attached ? (
                            <div className="flex items-center justify-between gap-2 text-xs bg-white border border-slate-200 rounded px-2.5 py-1.5">
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-slate-900 truncate flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                  {attached.fileName}
                                  <span className="text-slate-400 font-normal">
                                    ({attached.fileSizeLabel})
                                  </span>
                                </div>
                                <div
                                  className="text-[11px] text-slate-500 font-mono-num truncate mt-0.5"
                                  title={attached.filePath}
                                >
                                  {attached.filePath}
                                </div>
                              </div>
                              {!isLocked && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAttachment(rule.id, rule.docType)}
                                  className="text-slate-400 hover:text-red-700 p-1 shrink-0"
                                  title="첨부 연결 해제"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ) : (
                            !isLocked && (
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 cursor-pointer">
                                  <Upload className="w-3.5 h-3.5" />
                                  파일 선택 첨부
                                  <input
                                    type="file"
                                    className="hidden"
                                    onChange={(e) => handleFileInput(rule, e.target.files?.[0])}
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => handleAutoGeneratePath(rule)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
                                >
                                  <FolderPlus className="w-3.5 h-3.5" />
                                  표준 폴더 경로 연결
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const customPath = buildStandardEvidencePath(
                                      state.settings.rootArchivePath,
                                      state.settings.fiscalYear,
                                      projectId,
                                      generatedId,
                                      rule.docType,
                                      `${rule.docType}.pdf`
                                    );
                                    upsertAttachmentForRule(
                                      rule,
                                      `${rule.docType}_스캔본.pdf`,
                                      customPath,
                                      undefined,
                                      '경로 링크'
                                    );
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-blue-700 hover:underline"
                                >
                                  <Paperclip className="w-3 h-3" />
                                  스캔본 링크 등록
                                </button>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            증빙 정책:{' '}
            {state.settings.strictEvidenceBlock
              ? '필수 서류 미첨부 시 결재 요청 차단'
              : '미첨부 시 예외 사유 입력 후 요청 가능'}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              닫기
            </button>
            {!isLocked && (
              <>
                <button
                  type="button"
                  onClick={() => handleSaveAction(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-md hover:bg-slate-100"
                >
                  작성 중 저장
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveAction(true)}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800"
                >
                  결재 요청 상신
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
