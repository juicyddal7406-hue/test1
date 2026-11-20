import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpDown, Plus, X } from 'lucide-react';
import { AppState, BudgetChangeLog, BudgetItem, FundingSource } from '../types/subsidy';
import { formatKRW, getBudgetItemSummary } from '../utils/calculations';

interface BudgetsViewProps {
  state: AppState;
  initialProjectId?: string;
  onAddBudgetItem: (item: BudgetItem) => void;
  onAdjustBudget: (budgetItemId: string, delta: number, reason: string) => void;
}

export function BudgetsView({
  state,
  initialProjectId,
  onAddBudgetItem,
  onAdjustBudget,
}: BudgetsViewProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjectId || 'ALL'
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<BudgetItem | null>(null);

  // Add Budget Form
  const [newProjectId, setNewProjectId] = useState<string>(
    state.projects[0]?.id || ''
  );
  const [newFunding, setNewFunding] = useState<FundingSource>('보조금');
  const [newCategory, setNewCategory] = useState<string>(
    state.settings.categories[0]?.category || '사업진행비'
  );
  const [newSubCategory, setNewSubCategory] = useState<string>(
    state.settings.categories[0]?.subCategories[0] || '강사비'
  );
  const [newInitialAmount, setNewInitialAmount] = useState<number>(0);
  const [newNote, setNewNote] = useState<string>('');
  const [addError, setAddError] = useState<string>('');

  // Adjust Budget Form
  const [deltaAmount, setDeltaAmount] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustError, setAdjustError] = useState<string>('');

  const projectMap = useMemo(
    () => new Map(state.projects.map((p) => [p.id, p])),
    [state.projects]
  );

  const subCategoryOptions = useMemo(() => {
    const found = state.settings.categories.find((c) => c.category === newCategory);
    return found ? found.subCategories : [];
  }, [state.settings.categories, newCategory]);

  const filteredBudgets = useMemo(() => {
    return state.budgets.filter((b) =>
      selectedProjectId === 'ALL' ? true : b.projectId === selectedProjectId
    );
  }, [state.budgets, selectedProjectId]);

  const summaries = useMemo(() => {
    return filteredBudgets.map((b) => getBudgetItemSummary(b, state.expenditures));
  }, [filteredBudgets, state.expenditures]);

  const totals = useMemo(() => {
    return summaries.reduce(
      (acc, s) => ({
        initial: acc.initial + s.budgetItem.initialAmount,
        change: acc.change + s.budgetItem.changeAmount,
        current: acc.current + s.currentBudget,
        approved: acc.approved + s.approvedAmount,
        paid: acc.paid + s.paidAmount,
        pending: acc.pending + s.pendingAmount,
        balance: acc.balance + s.approvedBalance,
      }),
      { initial: 0, change: 0, current: 0, approved: 0, paid: 0, pending: 0, balance: 0 }
    );
  }, [summaries]);

  const filteredLogs = useMemo(() => {
    return state.budgetLogs
      .filter((l) => (selectedProjectId === 'ALL' ? true : l.projectId === selectedProjectId))
      .slice()
      .reverse();
  }, [state.budgetLogs, selectedProjectId]);

  const handleOpenAdd = () => {
    setAddError('');
    setNewProjectId(
      selectedProjectId !== 'ALL' ? selectedProjectId : state.projects[0]?.id || ''
    );
    const firstCat = state.settings.categories[0];
    setNewCategory(firstCat?.category || '사업진행비');
    setNewSubCategory(firstCat?.subCategories[0] || '강사비');
    setNewInitialAmount(0);
    setNewNote('');
    setShowAddModal(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectId) {
      setAddError('사업을 선택해 주세요.');
      return;
    }
    const exists = state.budgets.some(
      (b) =>
        b.projectId === newProjectId &&
        b.fundingSource === newFunding &&
        b.category === newCategory &&
        b.subCategory === newSubCategory
    );
    if (exists) {
      setAddError('해당 사업에 동일한 재원·비목·세목 항목이 이미 존재합니다.');
      return;
    }
    const maxNum = state.budgets.reduce((max, b) => {
      const n = parseInt(b.id.replace('BUD-', ''), 10);
      return Number.isNaN(n) ? max : Math.max(max, n);
    }, 0);
    onAddBudgetItem({
      id: `BUD-${String(maxNum + 1).padStart(3, '0')}`,
      projectId: newProjectId,
      fundingSource: newFunding,
      category: newCategory,
      subCategory: newSubCategory,
      initialAmount: Math.max(0, newInitialAmount),
      changeAmount: 0,
      note: newNote,
    });
    setShowAddModal(false);
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;
    if (deltaAmount === 0) {
      setAdjustError('증감 금액은 0원이 될 수 없습니다.');
      return;
    }
    if (!adjustReason.trim()) {
      setAdjustError('예산 변경 사유를 반드시 입력해 주세요.');
      return;
    }
    onAdjustBudget(adjustingItem.id, deltaAmount, adjustReason.trim());
    setAdjustingItem(null);
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-lg px-5 py-3.5">
        <div className="flex items-center gap-3">
          <label htmlFor="budget-prj" className="text-xs font-semibold text-slate-600">
            사업 선택
          </label>
          <select
            id="budget-prj"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="text-sm border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="ALL">전체 보조금 사업</option>
            {state.projects.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.code}] {p.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          예산 비목·세목 추가
        </button>
      </div>

      {/* Budget Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">
            비목·세목별 예산 편성 및 집행 현황
          </h3>
          <span className="text-xs text-slate-500">
            현재 예산 = 최초 예산 + 증감액 합계 · 승인 기준 잔액 = 현재 예산 − 승인 지출액
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-3.5 py-2.5 whitespace-nowrap">사업명</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">재원</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">비목 · 세목</th>
                <th className="px-3.5 py-2.5 text-right whitespace-nowrap">최초 예산</th>
                <th className="px-3.5 py-2.5 text-right whitespace-nowrap">증감액</th>
                <th className="px-3.5 py-2.5 text-right whitespace-nowrap">현재 예산</th>
                <th className="px-3.5 py-2.5 text-right whitespace-nowrap">승인 지출액</th>
                <th className="px-3.5 py-2.5 text-right whitespace-nowrap">결재 대기</th>
                <th className="px-3.5 py-2.5 text-right whitespace-nowrap">승인 기준 잔액</th>
                <th className="px-3.5 py-2.5 text-right whitespace-nowrap">집행률</th>
                <th className="px-3.5 py-2.5 text-right whitespace-nowrap">변경</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summaries.map((s) => {
                const prj = projectMap.get(s.budgetItem.projectId);
                return (
                  <tr key={s.budgetItem.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3.5 py-2.5 max-w-[180px] truncate text-slate-800">
                      <span className="font-mono-num text-xs text-slate-500 mr-1">
                        [{prj?.code}]
                      </span>
                      {prj?.name}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap text-xs font-medium text-slate-700">
                      {s.budgetItem.fundingSource}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <span className="font-medium text-slate-900">{s.budgetItem.category}</span>
                      <span className="text-slate-400 mx-1">/</span>
                      <span className="text-slate-700">{s.budgetItem.subCategory}</span>
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono-num text-slate-600 whitespace-nowrap">
                      {formatKRW(s.budgetItem.initialAmount)}
                    </td>
                    <td
                      className={`px-3.5 py-2.5 text-right font-mono-num whitespace-nowrap ${
                        s.budgetItem.changeAmount > 0
                          ? 'text-blue-700'
                          : s.budgetItem.changeAmount < 0
                            ? 'text-amber-700'
                            : 'text-slate-400'
                      }`}
                    >
                      {s.budgetItem.changeAmount > 0 ? '+' : ''}
                      {formatKRW(s.budgetItem.changeAmount)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono-num font-semibold text-slate-900 whitespace-nowrap">
                      {formatKRW(s.currentBudget)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono-num text-slate-900 whitespace-nowrap">
                      {formatKRW(s.approvedAmount)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono-num text-amber-700 whitespace-nowrap">
                      {formatKRW(s.pendingAmount)}
                    </td>
                    <td
                      className={`px-3.5 py-2.5 text-right font-mono-num font-semibold whitespace-nowrap ${
                        s.isOverBudget
                          ? 'text-red-700'
                          : s.isProjectedOverBudget
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                      }`}
                    >
                      {s.isOverBudget && (
                        <AlertTriangle className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                      )}
                      {formatKRW(s.approvedBalance)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono-num text-slate-800 whitespace-nowrap">
                      {s.currentBudget === 0 ? '0.0%' : `${s.executionRate.toFixed(1)}%`}
                    </td>
                    <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setAdjustError('');
                          setDeltaAmount(0);
                          setAdjustReason('');
                          setAdjustingItem(s.budgetItem);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded px-2 py-1"
                      >
                        <ArrowUpDown className="w-3 h-3" />
                        증감
                      </button>
                    </td>
                  </tr>
                );
              })}
              {summaries.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-sm text-slate-500">
                    등록된 예산 항목이 없습니다. 우측 상단 버튼으로 예산 비목·세목을 추가하세요.
                  </td>
                </tr>
              )}
            </tbody>
            {summaries.length > 0 && (
              <tfoot className="bg-slate-50 border-t border-slate-300 font-semibold text-slate-900">
                <tr>
                  <td colSpan={3} className="px-3.5 py-3 text-xs">
                    합계 ({summaries.length}개 항목)
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono-num whitespace-nowrap">
                    {formatKRW(totals.initial)}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono-num whitespace-nowrap">
                    {totals.change > 0 ? '+' : ''}
                    {formatKRW(totals.change)}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono-num whitespace-nowrap">
                    {formatKRW(totals.current)}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono-num whitespace-nowrap">
                    {formatKRW(totals.approved)}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono-num text-amber-700 whitespace-nowrap">
                    {formatKRW(totals.pending)}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono-num whitespace-nowrap">
                    {formatKRW(totals.balance)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Budget Change Logs */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">예산 변경(전용·증감) 이력</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 whitespace-nowrap">변경일</th>
                <th className="px-4 py-2.5 whitespace-nowrap">사업명</th>
                <th className="px-4 py-2.5 whitespace-nowrap">예산 항목 ID</th>
                <th className="px-4 py-2.5 text-right whitespace-nowrap">증감 금액</th>
                <th className="px-4 py-2.5">변경 사유</th>
                <th className="px-4 py-2.5 whitespace-nowrap">처리자</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log: BudgetChangeLog) => {
                const prj = projectMap.get(log.projectId);
                return (
                  <tr key={log.id}>
                    <td className="px-4 py-2.5 font-mono-num text-xs text-slate-600 whitespace-nowrap">
                      {log.date}
                    </td>
                    <td className="px-4 py-2.5 text-slate-800 whitespace-nowrap">
                      {prj?.name || log.projectId}
                    </td>
                    <td className="px-4 py-2.5 font-mono-num text-xs text-slate-600 whitespace-nowrap">
                      {log.budgetItemId}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono-num font-medium whitespace-nowrap ${
                        log.amount >= 0 ? 'text-blue-700' : 'text-red-700'
                      }`}
                    >
                      {log.amount >= 0 ? '+' : ''}
                      {formatKRW(log.amount)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{log.reason}</td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{log.updatedBy}</td>
                  </tr>
                );
              })}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-500">
                    기록된 예산 변경 이력이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Budget Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">예산 비목·세목 추가 편성</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {addError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-xs font-medium text-red-700">
                  {addError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">대상 사업</label>
                <select
                  value={newProjectId}
                  onChange={(e) => setNewProjectId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                >
                  {state.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.code}] {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">재원 구분</label>
                  <select
                    value={newFunding}
                    onChange={(e) => setNewFunding(e.target.value as FundingSource)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="보조금">보조금</option>
                    <option value="자부담">자부담</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">비목</label>
                  <select
                    value={newCategory}
                    onChange={(e) => {
                      const cat = e.target.value;
                      setNewCategory(cat);
                      const found = state.settings.categories.find((c) => c.category === cat);
                      setNewSubCategory(found?.subCategories[0] || '');
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    {state.settings.categories.map((c) => (
                      <option key={c.category} value={c.category}>
                        {c.category}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">세목</label>
                  <select
                    value={newSubCategory}
                    onChange={(e) => setNewSubCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    {subCategoryOptions.map((sc) => (
                      <option key={sc} value={sc}>
                        {sc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  최초 편성 예산 (원)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={newInitialAmount}
                  onChange={(e) => setNewInitialAmount(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-num text-right"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">산출 근거 / 비고</label>
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="예: 특강 강사료 10회 기준"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800"
                >
                  편성 등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Budget Modal */}
      {adjustingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">예산 변경(증감) 등록</h3>
              <button
                type="button"
                onClick={() => setAdjustingItem(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdjustSubmit} className="p-6 space-y-4">
              {adjustError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-xs font-medium text-red-700">
                  {adjustError}
                </div>
              )}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
                <div className="font-semibold text-slate-900">
                  {projectMap.get(adjustingItem.projectId)?.name}
                </div>
                <div className="text-slate-600">
                  {adjustingItem.fundingSource} · {adjustingItem.category} /{' '}
                  {adjustingItem.subCategory}
                </div>
                <div className="font-mono-num text-slate-800">
                  현재 예산: {formatKRW(adjustingItem.initialAmount + adjustingItem.changeAmount)}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  증감액 (원 · 감액 시 마이너스 입력)
                </label>
                <input
                  type="number"
                  step={1000}
                  value={deltaAmount}
                  onChange={(e) => setDeltaAmount(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-num text-right"
                />
                <div className="mt-1 text-xs text-slate-500 font-mono-num text-right">
                  변경 후 예산:{' '}
                  {formatKRW(
                    Math.max(
                      0,
                      adjustingItem.initialAmount + adjustingItem.changeAmount + deltaAmount
                    )
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  변경 사유 (필수) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="예: 사업계획 변경 승인에 따른 비목 간 전용"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setAdjustingItem(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800"
                >
                  변경 반영
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
