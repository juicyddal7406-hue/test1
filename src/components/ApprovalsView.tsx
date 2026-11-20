import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  FileText,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { AppState, Expenditure } from '../types/subsidy';
import {
  evaluateExpenditureEvidence,
  formatKRW,
  getBudgetItemSummary,
} from '../utils/calculations';
import { ApprovalStatusText } from './StatusText';

interface ApprovalsViewProps {
  state: AppState;
  onTransitionApproval: (
    expenditureId: string,
    nextAction: '검토 시작' | '승인' | '반려' | '작성 중 복귀' | '지급 완료 처리',
    comment: string
  ) => void;
  onOpenExpenditure: (exp: Expenditure) => void;
}

export function ApprovalsView({
  state,
  onTransitionApproval,
  onOpenExpenditure,
}: ApprovalsViewProps) {
  const [activeTab, setActiveTab] = useState<'QUEUE' | 'PAYMENT' | 'LOGS'>('QUEUE');
  const [selectedId, setSelectedId] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [actionError, setActionError] = useState<string>('');

  const projectMap = useMemo(
    () => new Map(state.projects.map((p) => [p.id, p])),
    [state.projects]
  );
  const budgetMap = useMemo(
    () => new Map(state.budgets.map((b) => [b.id, b])),
    [state.budgets]
  );
  const staffMap = useMemo(
    () => new Map(state.settings.staff.map((s) => [s.id, s])),
    [state.settings.staff]
  );

  const queueItems = useMemo(
    () =>
      state.expenditures.filter(
        (e) =>
          e.approvalStatus === '결재 요청' ||
          e.approvalStatus === '검토 중' ||
          e.approvalStatus === '반려'
      ),
    [state.expenditures]
  );

  const unpaidApprovedItems = useMemo(
    () =>
      state.expenditures.filter(
        (e) => e.approvalStatus === '승인' && !e.paymentCompleted
      ),
    [state.expenditures]
  );

  const selectedExp = useMemo(() => {
    const pool = activeTab === 'PAYMENT' ? unpaidApprovedItems : queueItems;
    return pool.find((e) => e.id === selectedId) || pool[0] || null;
  }, [activeTab, queueItems, unpaidApprovedItems, selectedId]);

  const selectedContext = useMemo(() => {
    if (!selectedExp) return null;
    const project = projectMap.get(selectedExp.projectId);
    const budget = budgetMap.get(selectedExp.budgetItemId);
    const budgetSum = budget ? getBudgetItemSummary(budget, state.expenditures) : null;
    const evEval = evaluateExpenditureEvidence(
      selectedExp,
      project,
      state.evidenceRules,
      state.attachments
    );
    const attachedFiles = state.attachments.filter(
      (a) => a.expenditureId === selectedExp.id && a.status === '첨부 완료'
    );
    return { project, budget, budgetSum, evEval, attachedFiles };
  }, [
    selectedExp,
    projectMap,
    budgetMap,
    state.expenditures,
    state.evidenceRules,
    state.attachments,
  ]);

  const handleAction = (
    action: '검토 시작' | '승인' | '반려' | '작성 중 복귀' | '지급 완료 처리'
  ) => {
    if (!selectedExp) return;
    setActionError('');
    if (action === '반려' && !comment.trim()) {
      setActionError('반려 처리 시에는 반려 사유를 반드시 입력해야 합니다.');
      return;
    }
    onTransitionApproval(selectedExp.id, action, comment.trim());
    setComment('');
  };

  return (
    <div className="space-y-5">
      {/* Segmented Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-5 py-3.5">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('QUEUE')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'QUEUE'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            결재 검토 · 승인함 ({queueItems.length}건)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PAYMENT')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'PAYMENT'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            승인 후 지급 대기 ({unpaidApprovedItems.length}건)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('LOGS')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'LOGS'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            전체 결재 처리 이력 ({state.approvalLogs.length}건)
          </button>
        </div>

        <div className="text-xs text-slate-500">
          현재 역할: <span className="font-semibold text-slate-800">{state.currentRole}</span>
        </div>
      </div>

      {activeTab === 'LOGS' ? (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 whitespace-nowrap">처리 일시</th>
                  <th className="px-4 py-2.5 whitespace-nowrap">지출결의 번호</th>
                  <th className="px-4 py-2.5 whitespace-nowrap">결재 구분</th>
                  <th className="px-4 py-2.5 whitespace-nowrap">처리자</th>
                  <th className="px-4 py-2.5">검토 의견 / 사유</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.approvalLogs
                  .slice()
                  .reverse()
                  .map((log) => {
                    const actor = staffMap.get(log.actorId);
                    return (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono-num text-xs text-slate-600 whitespace-nowrap">
                          {log.timestamp}
                        </td>
                        <td className="px-4 py-2.5 font-mono-num text-xs font-semibold text-slate-900 whitespace-nowrap">
                          {log.expenditureId}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-900 whitespace-nowrap">
                          {log.action}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                          {actor ? `${actor.name} (${actor.role})` : log.actorId}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">{log.comment || '-'}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Queue List */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 text-xs font-semibold text-slate-600">
              {activeTab === 'QUEUE' ? '결재 대기 및 반려 목록' : '승인 완료 · 실제 지급 처리 대상'}
            </div>
            <div className="divide-y divide-slate-100 max-h-[580px] overflow-y-auto">
              {(activeTab === 'QUEUE' ? queueItems : unpaidApprovedItems).map((exp) => {
                const prj = projectMap.get(exp.projectId);
                const isSelected = selectedExp?.id === exp.id;
                return (
                  <button
                    key={exp.id}
                    type="button"
                    onClick={() => {
                      setActionError('');
                      setSelectedId(exp.id);
                    }}
                    className={`w-full text-left px-4 py-3.5 transition-colors ${
                      isSelected ? 'bg-slate-100' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-num text-xs font-semibold text-slate-900">
                        {exp.id}
                      </span>
                      <ApprovalStatusText status={exp.approvalStatus} />
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900 truncate">
                      {exp.purpose}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                      <span className="truncate max-w-[180px]">
                        [{prj?.code}] {exp.subCategory} · {exp.vendor}
                      </span>
                      <span className="font-mono-num font-semibold text-slate-800 shrink-0">
                        {formatKRW(exp.totalAmount)}
                      </span>
                    </div>
                  </button>
                );
              })}
              {(activeTab === 'QUEUE' ? queueItems : unpaidApprovedItems).length === 0 && (
                <div className="px-4 py-14 text-center text-sm text-slate-500">
                  처리 대기 중인 결의서가 없습니다.
                </div>
              )}
            </div>
          </div>

          {/* Right Review & Action Panel */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6">
            {!selectedExp || !selectedContext ? (
              <div className="py-20 text-center text-sm text-slate-500">
                좌측 목록에서 검토할 지출결의서를 선택하세요.
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-num text-xs font-semibold text-slate-500">
                        {selectedExp.id}
                      </span>
                      <ApprovalStatusText status={selectedExp.approvalStatus} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mt-1">
                      {selectedExp.purpose}
                    </h3>
                    <div className="text-xs text-slate-500 mt-1">
                      {selectedContext.project?.name} · [{selectedExp.fundingSource}]{' '}
                      {selectedExp.category} / {selectedExp.subCategory}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenExpenditure(selectedExp)}
                    className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
                  >
                    결의서 원문 열기
                  </button>
                </div>

                {/* Key Numbers */}
                <div className="grid grid-cols-3 gap-4 bg-slate-50 border border-slate-200 rounded-md p-4 text-xs">
                  <div>
                    <div className="text-slate-500">청구 금액</div>
                    <div className="text-base font-bold font-mono-num text-slate-900 mt-0.5">
                      {formatKRW(selectedExp.totalAmount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">거래처 · 지급방법</div>
                    <div className="text-sm font-medium text-slate-900 mt-0.5">
                      {selectedExp.vendor}
                    </div>
                    <div className="text-slate-500">{selectedExp.paymentMethod}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">예산 잔액 현황</div>
                    {selectedContext.budgetSum ? (
                      <>
                        <div className="text-sm font-semibold font-mono-num text-slate-900 mt-0.5">
                          {formatKRW(selectedContext.budgetSum.approvedBalance)}
                        </div>
                        <div
                          className={
                            selectedContext.budgetSum.approvedBalance - selectedExp.totalAmount < 0
                              ? 'text-red-700 font-semibold'
                              : 'text-emerald-700'
                          }
                        >
                          {selectedContext.budgetSum.approvedBalance - selectedExp.totalAmount < 0
                            ? '예산 초과 위험'
                            : '예산 범위 내 적정'}
                        </div>
                      </>
                    ) : (
                      '-'
                    )}
                  </div>
                </div>

                {/* Evidence Audit Check */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                    <span>필수 증빙서류 검토 ({selectedContext.evEval.attachedCount}/{selectedContext.evEval.requiredCount})</span>
                    {selectedContext.evEval.missingRequiredDocs.length > 0 ? (
                      <span className="text-red-700 inline-flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        누락 {selectedContext.evEval.missingRequiredDocs.length}건
                      </span>
                    ) : (
                      <span className="text-emerald-700 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        필수 증빙 충족
                      </span>
                    )}
                  </div>

                  {selectedExp.exceptionReason && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
                      <span className="font-semibold">예외 사유:</span> {selectedExp.exceptionReason}
                    </div>
                  )}

                  <div className="border border-slate-200 rounded-md divide-y divide-slate-100 text-xs">
                    {selectedContext.attachedFiles.map((att) => (
                      <div key={att.id} className="px-3 py-2 flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-slate-900 font-medium">
                          <FileText className="w-3.5 h-3.5 text-slate-500" />
                          {att.docType}
                        </span>
                        <span className="font-mono-num text-slate-600 truncate max-w-[260px]">
                          {att.fileName}
                        </span>
                      </div>
                    ))}
                    {selectedContext.attachedFiles.length === 0 && (
                      <div className="px-3 py-4 text-center text-slate-500">
                        첨부된 증빙파일이 없습니다.
                      </div>
                    )}
                  </div>
                </div>

                {selectedExp.rejectionReason && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-800">
                    <span className="font-semibold">기존 반려 사유:</span>{' '}
                    {selectedExp.rejectionReason}
                  </div>
                )}

                {/* Decision Form */}
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  {actionError && (
                    <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs font-medium text-red-700">
                      {actionError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      검토 의견 / 승인·반려 사유 (반려 시 필수)
                    </label>
                    <input
                      type="text"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="검토 의견, 보완 요청 사항 또는 지급 메모를 입력하세요."
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {activeTab === 'QUEUE' && selectedExp.approvalStatus === '결재 요청' && (
                      <button
                        type="button"
                        onClick={() => handleAction('검토 시작')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-blue-800 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
                      >
                        <Clock className="w-4 h-4" />
                        검토 시작
                      </button>
                    )}
                    {activeTab === 'QUEUE' &&
                      (selectedExp.approvalStatus === '결재 요청' ||
                        selectedExp.approvalStatus === '검토 중') && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleAction('반려')}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50"
                          >
                            <XCircle className="w-4 h-4" />
                            반려
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAction('승인')}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-700 rounded-md hover:bg-emerald-800"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            최종 승인
                          </button>
                        </>
                      )}
                    {activeTab === 'QUEUE' && selectedExp.approvalStatus === '반려' && (
                      <button
                        type="button"
                        onClick={() => handleAction('작성 중 복귀')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                      >
                        <RotateCcw className="w-4 h-4" />
                        작성 중으로 되돌려 재작성
                      </button>
                    )}
                    {activeTab === 'PAYMENT' &&
                      selectedExp.approvalStatus === '승인' &&
                      !selectedExp.paymentCompleted && (
                        <button
                          type="button"
                          onClick={() => handleAction('지급 완료 처리')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800"
                        >
                          <Banknote className="w-4 h-4" />
                          실제 지급 완료 확정
                        </button>
                      )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
