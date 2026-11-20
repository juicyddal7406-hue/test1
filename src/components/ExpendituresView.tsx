import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileEdit,
  Plus,
  Printer,
  Search,
} from 'lucide-react';
import { ApprovalStatus, AppState, Expenditure } from '../types/subsidy';
import { evaluateExpenditureEvidence, formatKRW } from '../utils/calculations';
import { ApprovalStatusText } from './StatusText';

interface ExpendituresViewProps {
  state: AppState;
  onOpenNew: () => void;
  onOpenEdit: (exp: Expenditure) => void;
  onOpenPrint: (exp: Expenditure) => void;
}

export function ExpendituresView({
  state,
  onOpenNew,
  onOpenEdit,
  onOpenPrint,
}: ExpendituresViewProps) {
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ApprovalStatus>('ALL');
  const [evidenceFilter, setEvidenceFilter] = useState<'ALL' | 'MISSING' | 'COMPLETE'>('ALL');
  const [search, setSearch] = useState('');

  const projectMap = useMemo(
    () => new Map(state.projects.map((p) => [p.id, p])),
    [state.projects]
  );
  const staffMap = useMemo(
    () => new Map(state.settings.staff.map((s) => [s.id, s])),
    [state.settings.staff]
  );

  const enrichedList = useMemo(() => {
    return state.expenditures
      .map((exp) => {
        const prj = projectMap.get(exp.projectId);
        const evEval = evaluateExpenditureEvidence(
          exp,
          prj,
          state.evidenceRules,
          state.attachments
        );
        return { exp, prj, evEval };
      })
      .filter(({ exp, prj, evEval }) => {
        if (projectFilter !== 'ALL' && exp.projectId !== projectFilter) return false;
        if (statusFilter !== 'ALL' && exp.approvalStatus !== statusFilter) return false;
        if (evidenceFilter === 'MISSING' && evEval.missingRequiredDocs.length === 0) return false;
        if (evidenceFilter === 'COMPLETE' && evEval.missingRequiredDocs.length > 0) return false;
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          return (
            exp.id.toLowerCase().includes(q) ||
            exp.purpose.toLowerCase().includes(q) ||
            exp.vendor.toLowerCase().includes(q) ||
            exp.subCategory.toLowerCase().includes(q) ||
            (prj?.name.toLowerCase().includes(q) ?? false)
          );
        }
        return true;
      });
  }, [
    state.expenditures,
    state.evidenceRules,
    state.attachments,
    projectMap,
    projectFilter,
    statusFilter,
    evidenceFilter,
    search,
  ]);

  const filteredTotal = useMemo(
    () => enrichedList.reduce((sum, item) => sum + item.exp.totalAmount, 0),
    [enrichedList]
  );

  return (
    <div className="space-y-5">
      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="결의번호, 거래처, 지출내용, 세목 검색"
                className="pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-md w-64 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="text-sm border border-slate-300 rounded-md px-3 py-1.5 bg-white"
            >
              <option value="ALL">전체 보조금 사업</option>
              {state.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.code}] {p.name}
                </option>
              ))}
            </select>

            <select
              value={evidenceFilter}
              onChange={(e) =>
                setEvidenceFilter(e.target.value as 'ALL' | 'MISSING' | 'COMPLETE')
              }
              className="text-sm border border-slate-300 rounded-md px-3 py-1.5 bg-white"
            >
              <option value="ALL">증빙 상태: 전체</option>
              <option value="MISSING">필수 증빙 미첨부</option>
              <option value="COMPLETE">필수 증빙 완료</option>
            </select>
          </div>

          <button
            type="button"
            onClick={onOpenNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />새 지출결의서 작성
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['ALL', '작성 중', '결재 요청', '검토 중', '승인', '반려'] as const).map(
              (st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    statusFilter === st
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st === 'ALL' ? '전체 상태' : st}
                </button>
              )
            )}
          </div>
          <div className="text-xs text-slate-600 font-mono-num">
            조회 {enrichedList.length}건 · 합계 {formatKRW(filteredTotal)}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-3.5 py-2.5 whitespace-nowrap">지출결의 번호</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">사업명</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">재원 · 비목 · 세목</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">지출 목적 · 거래처</th>
                <th className="px-3.5 py-2.5 text-right whitespace-nowrap">총액</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">필수 증빙 현황</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">작성자 · 작성일</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">결재 상태</th>
                <th className="px-3.5 py-2.5 text-right whitespace-nowrap">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enrichedList.map(({ exp, prj, evEval }) => {
                const drafter = staffMap.get(exp.drafterId);
                const missingCount = evEval.missingRequiredDocs.length;
                return (
                  <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3.5 py-3 font-mono-num text-xs font-semibold text-slate-900 whitespace-nowrap">
                      {exp.id}
                      {exp.correctionOfId && (
                        <div className="text-[11px] font-normal text-blue-700">
                          정정({exp.correctionOfId})
                        </div>
                      )}
                    </td>
                    <td className="px-3.5 py-3 max-w-[170px] truncate text-slate-700">
                      {prj?.name || exp.projectId}
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <div className="text-xs font-medium text-slate-900">
                        {exp.category} / {exp.subCategory}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {exp.fundingSource} · {exp.paymentMethod}
                      </div>
                    </td>
                    <td className="px-3.5 py-3 max-w-[230px]">
                      <div className="text-slate-900 truncate" title={exp.purpose}>
                        {exp.purpose}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{exp.vendor}</div>
                    </td>
                    <td className="px-3.5 py-3 text-right font-mono-num font-semibold text-slate-900 whitespace-nowrap">
                      {formatKRW(exp.totalAmount)}
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      {missingCount > 0 ? (
                        <div
                          className="text-xs font-semibold text-red-700 inline-flex items-center gap-1"
                          title={evEval.missingRequiredDocs.map((d) => d.docType).join(', ')}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          누락 {missingCount}건 ({evEval.attachedCount}/{evEval.requiredCount})
                        </div>
                      ) : (
                        <div className="text-xs font-medium text-emerald-700 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          완료 ({evEval.attachedCount}/{evEval.requiredCount})
                        </div>
                      )}
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <div className="text-xs text-slate-800">{drafter?.name || exp.drafterId}</div>
                      <div className="font-mono-num text-[11px] text-slate-500">
                        {exp.draftDate}
                      </div>
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <ApprovalStatusText status={exp.approvalStatus} />
                      {exp.paymentCompleted && (
                        <div className="text-[11px] text-slate-500 mt-0.5">지급 완료</div>
                      )}
                    </td>
                    <td className="px-3.5 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenEdit(exp)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded px-2 py-1"
                        >
                          <FileEdit className="w-3 h-3" />
                          열기/수정
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenPrint(exp)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded px-2 py-1"
                        >
                          <Printer className="w-3 h-3" />
                          인쇄양식
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {enrichedList.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                    조건에 일치하는 지출결의서가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
