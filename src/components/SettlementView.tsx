import { useMemo, useState } from 'react';
import { FileSpreadsheet, Printer } from 'lucide-react';
import { AppState } from '../types/subsidy';
import {
  calcExecutionRate,
  formatKRW,
  getBudgetItemSummary,
} from '../utils/calculations';
import { exportProjectSettlementToExcel } from '../utils/excelExport';

interface SettlementViewProps {
  state: AppState;
}

export function SettlementView({ state }: SettlementViewProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    state.projects[0]?.id || 'ALL'
  );

  const projectMap = useMemo(
    () => new Map(state.projects.map((p) => [p.id, p])),
    [state.projects]
  );

  const targetBudgets = useMemo(() => {
    return state.budgets.filter((b) =>
      selectedProjectId === 'ALL' ? true : b.projectId === selectedProjectId
    );
  }, [state.budgets, selectedProjectId]);

  const approvedExpenditures = useMemo(() => {
    return state.expenditures.filter(
      (e) =>
        e.approvalStatus === '승인' &&
        (selectedProjectId === 'ALL' ? true : e.projectId === selectedProjectId)
    );
  }, [state.expenditures, selectedProjectId]);

  const budgetRows = useMemo(
    () => targetBudgets.map((b) => getBudgetItemSummary(b, approvedExpenditures)),
    [targetBudgets, approvedExpenditures]
  );

  const totals = useMemo(() => {
    const budget = budgetRows.reduce((s, r) => s + r.currentBudget, 0);
    const approved = budgetRows.reduce((s, r) => s + r.approvedAmount, 0);
    const paid = budgetRows.reduce((s, r) => s + r.paidAmount, 0);
    const balance = budget - approved;
    const rate = calcExecutionRate(approved, budget);
    return { budget, approved, paid, balance, rate };
  }, [budgetRows]);

  const expTotalSum = useMemo(
    () => approvedExpenditures.reduce((s, e) => s + e.totalAmount, 0),
    [approvedExpenditures]
  );

  const selectedProject =
    selectedProjectId === 'ALL' ? null : projectMap.get(selectedProjectId);

  return (
    <div className="space-y-6">
      {/* Toolbar (hidden when printing) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-lg px-5 py-3.5">
        <div className="flex items-center gap-3">
          <label htmlFor="settle-prj" className="text-xs font-semibold text-slate-600">
            정산 대상 사업
          </label>
          <select
            id="settle-prj"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="text-sm border border-slate-300 rounded-md px-3 py-1.5 bg-white"
          >
            <option value="ALL">전체 보조금 사업 통합 정산</option>
            {state.projects.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.code}] {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportProjectSettlementToExcel(state, selectedProjectId)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            정산용 Excel 내보내기
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            보고서 인쇄 / PDF
          </button>
        </div>
      </div>

      {/* Printable Report Body */}
      <div className="print-only-container space-y-6">
        {/* Report Header */}
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="text-xs text-slate-500">
                {state.settings.organizationName} · 보조금 정산 보고서
              </div>
              <h2 className="text-xl font-bold text-slate-900 mt-1">
                {selectedProject
                  ? `${selectedProject.name} 집행 실적 및 증빙 정산표`
                  : '전체 보조금 사업 통합 집행 실적표'}
              </h2>
              {selectedProject && (
                <div className="text-xs text-slate-600 mt-1">
                  지원기관: {selectedProject.grantor} · 사업기간: {selectedProject.startDate} ~{' '}
                  {selectedProject.endDate}
                </div>
              )}
            </div>
            <div className="text-right text-xs text-slate-500 font-mono-num">
              작성 기준일: {new Date().toISOString().slice(0, 10)}
              <br />
              집계 기준: 최종 승인 결의서 ({approvedExpenditures.length}건)
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-4">
            <div>
              <div className="text-xs text-slate-500">총 편성 예산</div>
              <div className="text-base font-bold font-mono-num text-slate-900 mt-0.5">
                {formatKRW(totals.budget)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">승인 집행 합계</div>
              <div className="text-base font-bold font-mono-num text-blue-700 mt-0.5">
                {formatKRW(totals.approved)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">실제 지급 완료</div>
              <div className="text-base font-bold font-mono-num text-slate-900 mt-0.5">
                {formatKRW(totals.paid)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">미집행 잔액</div>
              <div className="text-base font-bold font-mono-num text-emerald-700 mt-0.5">
                {formatKRW(totals.balance)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">집행률</div>
              <div className="text-base font-bold font-mono-num text-slate-900 mt-0.5">
                {totals.rate.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: 비목·세목별 집행 실적 */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">
              1. 재원·비목·세목별 예산 집행 실적표
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">사업명</th>
                  <th className="px-4 py-2.5">재원</th>
                  <th className="px-4 py-2.5">비목 · 세목</th>
                  <th className="px-4 py-2.5 text-right">현재 예산</th>
                  <th className="px-4 py-2.5 text-right">승인 집행액</th>
                  <th className="px-4 py-2.5 text-right">지급 완료액</th>
                  <th className="px-4 py-2.5 text-right">미집행 잔액</th>
                  <th className="px-4 py-2.5 text-right">집행률</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {budgetRows.map((row) => {
                  const prj = projectMap.get(row.budgetItem.projectId);
                  return (
                    <tr key={row.budgetItem.id}>
                      <td className="px-4 py-2.5 text-xs text-slate-700">
                        [{prj?.code}] {prj?.name}
                      </td>
                      <td className="px-4 py-2.5 text-xs">{row.budgetItem.fundingSource}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">
                        {row.budgetItem.category} / {row.budgetItem.subCategory}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono-num">
                        {formatKRW(row.currentBudget)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono-num font-semibold">
                        {formatKRW(row.approvedAmount)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono-num">
                        {formatKRW(row.paidAmount)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono-num">
                        {formatKRW(row.approvedBalance)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono-num">
                        {row.executionRate.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-300 font-semibold">
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 text-xs">
                    합계
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-num">
                    {formatKRW(totals.budget)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-num">
                    {formatKRW(totals.approved)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-num">
                    {formatKRW(totals.paid)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-num">
                    {formatKRW(totals.balance)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-num">
                    {totals.rate.toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Section 2: 결의서-증빙 연동 명세서 */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              2. 정산용 지출결의 및 연동 증빙 명세서
            </h3>
            <span className="text-xs font-mono-num text-slate-600">
              승인 내역 합계: {formatKRW(expTotalSum)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-3.5 py-2.5 whitespace-nowrap">지출결의 번호</th>
                  <th className="px-3.5 py-2.5 whitespace-nowrap">승인일 / 지급일</th>
                  <th className="px-3.5 py-2.5 whitespace-nowrap">비목 · 세목</th>
                  <th className="px-3.5 py-2.5">지출 내용 · 거래처</th>
                  <th className="px-3.5 py-2.5 text-right whitespace-nowrap">집행액</th>
                  <th className="px-3.5 py-2.5">연결 증빙서류 목록</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {approvedExpenditures.map((exp) => {
                  const files = state.attachments.filter(
                    (a) => a.expenditureId === exp.id && a.status === '첨부 완료'
                  );
                  return (
                    <tr key={exp.id}>
                      <td className="px-3.5 py-2.5 font-mono-num font-semibold text-slate-900 whitespace-nowrap">
                        {exp.id}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono-num text-slate-600 whitespace-nowrap">
                        {exp.approvedDate || '-'} / {exp.actualPaymentDate || '미지급'}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        {exp.category} / {exp.subCategory}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="text-slate-900 font-medium">{exp.purpose}</div>
                        <div className="text-slate-500">{exp.vendor}</div>
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono-num font-semibold text-slate-900 whitespace-nowrap">
                        {formatKRW(exp.totalAmount)}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-700">
                        {files.length > 0
                          ? files.map((f) => `${f.docType}(${f.fileName})`).join(', ')
                          : '첨부 내역 없음'}
                      </td>
                    </tr>
                  );
                })}
                {approvedExpenditures.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                      승인 완료된 지출결의 내역이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
