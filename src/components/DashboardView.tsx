import { useMemo, useState } from 'react';
import { ArrowRight, AlertTriangle, CheckCircle2, FileWarning } from 'lucide-react';
import { AppState, SheetTab } from '../types/subsidy';
import {
  calcExecutionRate,
  evaluateExpenditureEvidence,
  formatKRW,
  getProjectSummary,
} from '../utils/calculations';
import { ApprovalStatusText } from './StatusText';

interface DashboardViewProps {
  state: AppState;
  onNavigate: (tab: SheetTab) => void;
  onOpenExpenditure: (expenditureId: string) => void;
}

export function DashboardView({
  state,
  onNavigate,
  onOpenExpenditure,
}: DashboardViewProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    state.expenditures.forEach((e) => {
      if (e.draftDate && e.draftDate.length >= 7) {
        months.add(e.draftDate.slice(0, 7));
      }
    });
    return Array.from(months).sort();
  }, [state.expenditures]);

  const filteredProjects = useMemo(() => {
    if (selectedProjectId === 'ALL') return state.projects;
    return state.projects.filter((p) => p.id === selectedProjectId);
  }, [state.projects, selectedProjectId]);

  const filteredExpenditures = useMemo(() => {
    return state.expenditures.filter((e) => {
      if (selectedProjectId !== 'ALL' && e.projectId !== selectedProjectId) return false;
      if (selectedMonth !== 'ALL' && !e.draftDate.startsWith(selectedMonth)) return false;
      return true;
    });
  }, [state.expenditures, selectedProjectId, selectedMonth]);

  const projectSummaries = useMemo(() => {
    return filteredProjects.map((p) =>
      getProjectSummary(
        p,
        state.budgets,
        filteredExpenditures,
        state.evidenceRules,
        state.attachments
      )
    );
  }, [filteredProjects, state.budgets, filteredExpenditures, state.evidenceRules, state.attachments]);

  const totals = useMemo(() => {
    const totalBudget = projectSummaries.reduce((s, p) => s + p.currentBudget, 0);
    const totalApproved = projectSummaries.reduce((s, p) => s + p.approvedAmount, 0);
    const totalPaid = projectSummaries.reduce((s, p) => s + p.paidAmount, 0);
    const totalPending = projectSummaries.reduce((s, p) => s + p.pendingAmount, 0);
    const totalBalance = totalBudget - totalApproved;
    const executionRate = calcExecutionRate(totalApproved, totalBudget);
    const activeCount = filteredProjects.filter((p) => p.status === '진행 중').length;
    const pendingCount = filteredExpenditures.filter(
      (e) => e.approvalStatus === '결재 요청' || e.approvalStatus === '검토 중'
    ).length;

    const missingEvidenceExps = filteredExpenditures.filter((exp) => {
      if (exp.approvalStatus === '반려') return false;
      const prj = state.projects.find((p) => p.id === exp.projectId);
      const ev = evaluateExpenditureEvidence(exp, prj, state.evidenceRules, state.attachments);
      return ev.missingRequiredDocs.length > 0;
    });

    return {
      totalBudget,
      totalApproved,
      totalPaid,
      totalPending,
      totalBalance,
      executionRate,
      activeCount,
      pendingCount,
      missingEvidenceCount: missingEvidenceExps.length,
      missingEvidenceExps,
    };
  }, [
    projectSummaries,
    filteredProjects,
    filteredExpenditures,
    state.projects,
    state.evidenceRules,
    state.attachments,
  ]);

  // 비목별 집행 현황
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { category: string; budget: number; approved: number }>();
    state.budgets
      .filter((b) => selectedProjectId === 'ALL' || b.projectId === selectedProjectId)
      .forEach((b) => {
        const cur = map.get(b.category) || { category: b.category, budget: 0, approved: 0 };
        cur.budget += Math.max(0, b.initialAmount + b.changeAmount);
        map.set(b.category, cur);
      });

    filteredExpenditures
      .filter((e) => e.approvalStatus === '승인')
      .forEach((e) => {
        const cur = map.get(e.category) || { category: e.category, budget: 0, approved: 0 };
        cur.approved += e.totalAmount;
        map.set(e.category, cur);
      });

    return Array.from(map.values()).sort((a, b) => b.budget - a.budget);
  }, [state.budgets, filteredExpenditures, selectedProjectId]);

  // 월별 지출 추이 (승인 기준)
  const monthlyTrend = useMemo(() => {
    const map = new Map<string, { month: string; approved: number; pending: number }>();
    state.expenditures
      .filter((e) => selectedProjectId === 'ALL' || e.projectId === selectedProjectId)
      .forEach((e) => {
        const m = e.draftDate.slice(0, 7);
        const cur = map.get(m) || { month: m, approved: 0, pending: 0 };
        if (e.approvalStatus === '승인') cur.approved += e.totalAmount;
        if (e.approvalStatus === '결재 요청' || e.approvalStatus === '검토 중') {
          cur.pending += e.totalAmount;
        }
        map.set(m, cur);
      });
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [state.expenditures, selectedProjectId]);

  const maxMonthlyValue = Math.max(
    1,
    ...monthlyTrend.map((m) => m.approved + m.pending)
  );

  const projectMap = useMemo(
    () => new Map(state.projects.map((p) => [p.id, p])),
    [state.projects]
  );

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-lg px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="dash-project" className="text-xs font-semibold text-slate-600">
              대상 사업
            </label>
            <select
              id="dash-project"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="text-sm border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="ALL">전체 보조금 사업 ({state.projects.length}개)</option>
              {state.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.code}] {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="dash-month" className="text-xs font-semibold text-slate-600">
              작성 기간
            </label>
            <select
              id="dash-month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-sm border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="ALL">전체 기간</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="text-xs text-slate-500">
          집계 기준: 승인 완료 결의서 기준 · 회계연도 {state.settings.fiscalYear}
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
          <div className="text-xs font-medium text-blue-700">전체 사업 / 진행 중</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-900 font-mono-num">
              {filteredProjects.length}건
            </span>
            <span className="text-xs text-blue-700">
              · 진행 중 {totals.activeCount}건
            </span>
          </div>
          <div className="mt-3 text-xs text-blue-700">
            승인 기준 총 편성예산 {formatKRW(totals.totalBudget)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-blue-700">승인 집행액 (집행률)</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-700 font-mono-num">
              {formatKRW(totals.totalApproved)}
            </span>
            <span className="text-sm font-semibold text-blue-700 font-mono-num">
              {totals.executionRate.toFixed(1)}%
            </span>
          </div>
          <div className="mt-3 text-xs text-blue-600 font-mono-num">
            실제 지급 완료 {formatKRW(totals.totalPaid)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">승인 기준 미집행 잔액</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono-num ${
                totals.totalBalance < 0 ? 'text-red-700' : 'text-slate-900'
              }`}
            >
              {formatKRW(totals.totalBalance)}
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500 font-mono-num">
            결재 대기 금액 {formatKRW(totals.totalPending)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">결재 대기 / 필수 증빙 누락</div>
          <div className="mt-2 flex items-baseline gap-3">
            <button
              type="button"
              onClick={() => onNavigate('approvals')}
              className="text-2xl font-bold text-blue-700 hover:underline font-mono-num"
            >
              대기 {totals.pendingCount}건
            </button>
            <span className="text-slate-300">/</span>
            <button
              type="button"
              onClick={() => onNavigate('evidence')}
              className="text-2xl font-bold text-orange-600 hover:underline font-mono-num"
            >
              누락 {totals.missingEvidenceCount}건
            </button>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            클릭 시 해당 관리 화면으로 이동합니다
          </div>
        </div>
      </div>

      {/* Charts & Breakdown Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 사업별 예산 대비 집행 현황 */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                사업별 예산 대비 집행 현황
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                현재 편성 예산 대비 승인 집행액 및 결재 대기 금액 비율
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('budgets')}
              className="text-xs font-medium text-slate-700 hover:text-slate-900 inline-flex items-center gap-1 whitespace-nowrap"
            >
              예산 상세 <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {projectSummaries.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              표시할 사업 데이터가 없습니다.
            </div>
          ) : (
            <div className="space-y-4">
              {projectSummaries.map((s) => {
                const approvedPct =
                  s.currentBudget > 0
                    ? Math.min(100, (s.approvedAmount / s.currentBudget) * 100)
                    : 0;
                const pendingPct =
                  s.currentBudget > 0
                    ? Math.min(100 - approvedPct, (s.pendingAmount / s.currentBudget) * 100)
                    : 0;

                return (
                  <div key={s.project.id} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        <span className="font-mono-num text-xs text-slate-500 mr-1.5">
                          [{s.project.code}]
                        </span>
                        {s.project.name}
                      </div>
                      <div className="text-xs font-mono-num text-slate-700 whitespace-nowrap shrink-0">
                        {formatKRW(s.approvedAmount)} / {formatKRW(s.currentBudget)} (
                        {s.executionRate.toFixed(1)}%)
                      </div>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-sm overflow-hidden flex">
                      <div
                        className="bg-emerald-600 h-full transition-all"
                        style={{ width: `${approvedPct}%` }}
                        title={`승인 집행: ${formatKRW(s.approvedAmount)}`}
                      />
                      <div
                        className="bg-amber-400 h-full transition-all"
                        style={{ width: `${pendingPct}%` }}
                        title={`결재 대기: ${formatKRW(s.pendingAmount)}`}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        {s.project.grantor} · {s.project.status}
                      </span>
                      <span className="font-mono-num">
                        잔액 {formatKRW(s.approvedBalance)}
                        {s.missingEvidenceExpCount > 0 && (
                          <span className="text-red-700 font-semibold ml-2">
                            · 증빙누락 {s.missingEvidenceExpCount}건
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                  <span className="w-2.5 h-2.5 bg-emerald-600 inline-block rounded-xs" />
                  승인 집행액
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-amber-400 inline-block rounded-xs" />
                  결재 대기액
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 비목별 집행 & 월별 지출 추이 */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="text-base font-semibold text-slate-900 mb-3">
              비목별 집행 현황
            </h3>
            <div className="divide-y divide-slate-100">
              {categoryBreakdown.map((c) => {
                const rate = calcExecutionRate(c.approved, c.budget);
                return (
                  <div key={c.category} className="py-2.5 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium text-slate-900">{c.category}</div>
                      <div className="text-xs text-slate-500 font-mono-num">
                        예산 {formatKRW(c.budget)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-slate-900 font-mono-num">
                        {formatKRW(c.approved)}
                      </div>
                      <div className="text-xs text-blue-700 font-mono-num">{rate.toFixed(1)}%</div>
                    </div>
                  </div>
                );
              })}
              {categoryBreakdown.length === 0 && (
                <div className="py-6 text-center text-xs text-slate-500">
                  등록된 비목 예산이 없습니다.
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="text-base font-semibold text-slate-900 mb-3">
              월별 지출 추이
            </h3>
            {monthlyTrend.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                지출 내역이 없습니다.
              </div>
            ) : (
              <div className="space-y-2.5">
                {monthlyTrend.map((m) => {
                  const total = m.approved + m.pending;
                  const widthPct = Math.max(4, (total / maxMonthlyValue) * 100);
                  return (
                    <div key={m.month} className="flex items-center gap-3 text-xs">
                      <span className="w-16 font-mono-num text-slate-600 shrink-0">
                        {m.month}
                      </span>
                      <div className="flex-1 bg-slate-100 h-5 rounded-sm overflow-hidden flex">
                        <div
                          className="bg-emerald-600 h-full"
                          style={{
                            width: `${total > 0 ? (m.approved / total) * widthPct : 0}%`,
                          }}
                          title={`승인: ${formatKRW(m.approved)}`}
                        />
                        <div
                          className="bg-amber-400 h-full"
                          style={{
                            width: `${total > 0 ? (m.pending / total) * widthPct : 0}%`,
                          }}
                          title={`대기: ${formatKRW(m.pending)}`}
                        />
                      </div>
                      <span className="w-24 text-right font-mono-num text-slate-800 shrink-0">
                        {formatKRW(total)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 조치 필요 목록 (증빙 누락 / 결재 대기 / 최근 지출결의) */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">
              최근 지출결의 및 증빙 점검 현황
            </h3>
            {totals.missingEvidenceCount > 0 && (
              <span className="text-xs font-semibold text-red-700 inline-flex items-center gap-1">
                · <FileWarning className="w-3.5 h-3.5" /> 필수 증빙 미첨부 {totals.missingEvidenceCount}건 확인 필요
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onNavigate('expenditures')}
            className="text-xs font-medium text-slate-700 hover:text-slate-900 inline-flex items-center gap-1 whitespace-nowrap"
          >
            전체 지출결의 보기 <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 whitespace-nowrap">결의 번호</th>
                <th className="px-4 py-2.5 whitespace-nowrap">사업명</th>
                <th className="px-4 py-2.5 whitespace-nowrap">비목 · 세목</th>
                <th className="px-4 py-2.5 whitespace-nowrap">지출 내용</th>
                <th className="px-4 py-2.5 text-right whitespace-nowrap">총액</th>
                <th className="px-4 py-2.5 whitespace-nowrap">필수 증빙</th>
                <th className="px-4 py-2.5 whitespace-nowrap">결재 상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenditures.slice(0, 8).map((exp) => {
                const prj = projectMap.get(exp.projectId);
                const ev = evaluateExpenditureEvidence(
                  exp,
                  prj,
                  state.evidenceRules,
                  state.attachments
                );
                const isMissing = ev.missingRequiredDocs.length > 0 && exp.approvalStatus !== '반려';
                return (
                  <tr
                    key={exp.id}
                    onClick={() => onOpenExpenditure(exp.id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono-num text-xs font-medium text-slate-900 whitespace-nowrap">
                      {exp.id}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 max-w-[180px] truncate">
                      {prj?.name || exp.projectId}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                      {exp.category} / {exp.subCategory}
                    </td>
                    <td className="px-4 py-2.5 text-slate-900 max-w-[240px] truncate">
                      {exp.purpose}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-num font-medium text-slate-900 whitespace-nowrap">
                      {formatKRW(exp.totalAmount)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {isMissing ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          누락 {ev.missingRequiredDocs.length}건 ({ev.attachedCount}/{ev.requiredCount})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          완료 ({ev.attachedCount}/{ev.requiredCount})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <ApprovalStatusText status={exp.approvalStatus} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
