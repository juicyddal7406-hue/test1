import { useMemo, useState } from 'react';
import { Edit2, Plus, X } from 'lucide-react';
import { AppState, EvidenceRule, FundingSource, RequirementLevel } from '../types/subsidy';
import { RequirementText } from './StatusText';

interface EvidenceRulesViewProps {
  state: AppState;
  onSaveRule: (rule: EvidenceRule, isNew: boolean) => void;
  onToggleRuleActive: (ruleId: string) => void;
}

export function EvidenceRulesView({
  state,
  onSaveRule,
  onToggleRuleActive,
}: EvidenceRulesViewProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [editingRule, setEditingRule] = useState<EvidenceRule | null>(null);
  const [isNewModal, setIsNewModal] = useState(false);

  const projectMap = useMemo(
    () => new Map(state.projects.map((p) => [p.id, p])),
    [state.projects]
  );

  const filteredRules = useMemo(() => {
    return state.evidenceRules.filter((r) => {
      if (categoryFilter !== 'ALL' && r.category !== categoryFilter) return false;
      if (projectFilter !== 'ALL' && r.projectId !== projectFilter) return false;
      return true;
    });
  }, [state.evidenceRules, categoryFilter, projectFilter]);

  const openCreateModal = () => {
    const maxNum = state.evidenceRules.reduce((max, r) => {
      const n = parseInt(r.id.replace('RULE-', ''), 10);
      return Number.isNaN(n) ? max : Math.max(max, n);
    }, 0);
    const firstCat = state.settings.categories[0];
    setIsNewModal(true);
    setEditingRule({
      id: `RULE-${String(maxNum + 1).padStart(3, '0')}`,
      projectId: 'ALL',
      projectType: 'ALL',
      grantor: 'ALL',
      fundingSource: 'ALL',
      category: firstCat?.category || '사업진행비',
      subCategory: firstCat?.subCategories[0] || '강사비',
      docType: '',
      requirementLevel: '필수',
      conditionDesc: '',
      effectiveFrom: `${state.settings.fiscalYear}-01-01`,
      effectiveTo: `${state.settings.fiscalYear}-12-31`,
      guideText: '',
      isActive: true,
      version: 'v1.3',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule || !editingRule.docType.trim()) return;
    onSaveRule(editingRule, isNewModal);
    setEditingRule(null);
  };

  const subCatOptions = useMemo(() => {
    if (!editingRule) return [];
    const found = state.settings.categories.find(
      (c) => c.category === editingRule.category
    );
    return found ? found.subCategories : [];
  }, [state.settings.categories, editingRule]);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="text-sm border border-slate-300 rounded-md px-3 py-1.5 bg-white"
          >
            <option value="ALL">적용 사업: 전체 보기</option>
            {state.projects.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.code}] {p.name} 전용
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-sm border border-slate-300 rounded-md px-3 py-1.5 bg-white"
          >
            <option value="ALL">전체 비목</option>
            {state.settings.categories.map((c) => (
              <option key={c.category} value={c.category}>
                {c.category}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />새 증빙 기준 추가
        </button>
      </div>

      {/* Info Notice */}
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-3 text-xs text-slate-600">
        지출결의서 작성 시 선택한 <strong>사업·지원기관·재원·비목·세목</strong>에 일치하는 활성
        기준이 자동 조회됩니다. 동일 세목이라도 특정 사업 ID 또는 지원기관별 기준을 별도 등록하면
        사업에 맞는 필요서류가 구분 표시됩니다.
      </div>

      {/* Rules Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-3.5 py-2.5 whitespace-nowrap">기준 ID · 버전</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">적용 대상 (사업 / 기관)</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">재원 · 비목 · 세목</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">필수 여부</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">서류 유형 · 안내 문구</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">상태</th>
                <th className="px-3.5 py-2.5 text-right whitespace-nowrap">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRules.map((rule) => {
                const prj = rule.projectId !== 'ALL' ? projectMap.get(rule.projectId) : null;
                return (
                  <tr
                    key={rule.id}
                    className={!rule.isActive ? 'bg-slate-50/70 opacity-65' : 'hover:bg-slate-50'}
                  >
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <div className="font-mono-num text-xs font-semibold text-slate-900">
                        {rule.id}
                      </div>
                      <div className="text-[11px] text-slate-500">{rule.version}</div>
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap text-xs">
                      <div className="font-medium text-slate-900">
                        {prj ? `[${prj.code}] ${prj.name}` : '전체 공통 사업'}
                      </div>
                      <div className="text-slate-500">
                        기관: {rule.grantor === 'ALL' ? '전체' : rule.grantor} · 유형:{' '}
                        {rule.projectType === 'ALL' ? '전체' : rule.projectType}
                      </div>
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap text-xs">
                      <div className="font-medium text-slate-900">
                        {rule.category} / {rule.subCategory === 'ALL' ? '전체 세목' : rule.subCategory}
                      </div>
                      <div className="text-slate-500">
                        재원: {rule.fundingSource === 'ALL' ? '전체' : rule.fundingSource}
                      </div>
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <RequirementText level={rule.requirementLevel} />
                    </td>
                    <td className="px-3.5 py-3 max-w-[300px]">
                      <div className="font-medium text-slate-900">{rule.docType}</div>
                      <div className="text-xs text-slate-500 truncate" title={rule.guideText}>
                        {rule.guideText}
                      </div>
                      {rule.conditionDesc && (
                        <div className="text-[11px] text-slate-400">
                          조건: {rule.conditionDesc}
                        </div>
                      )}
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onToggleRuleActive(rule.id)}
                        className={`text-xs font-semibold ${
                          rule.isActive ? 'text-emerald-700' : 'text-slate-500'
                        }`}
                      >
                        {rule.isActive ? '사용 중' : '비활성'}
                      </button>
                    </td>
                    <td className="px-3.5 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setIsNewModal(false);
                          setEditingRule({ ...rule });
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded px-2 py-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        수정
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Rule Modal */}
      {editingRule && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">
                {isNewModal ? '새 증빙 기준 등록' : `증빙 기준 수정 (${editingRule.id})`}
              </h3>
              <button
                type="button"
                onClick={() => setEditingRule(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    적용 사업
                  </label>
                  <select
                    value={editingRule.projectId}
                    onChange={(e) =>
                      setEditingRule({ ...editingRule, projectId: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="ALL">전체 공통 사업 (ALL)</option>
                    {state.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.code}] {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    지원기관 조건
                  </label>
                  <select
                    value={editingRule.grantor}
                    onChange={(e) =>
                      setEditingRule({ ...editingRule, grantor: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="ALL">전체 지원기관 (ALL)</option>
                    {state.settings.grantors.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    재원 구분
                  </label>
                  <select
                    value={editingRule.fundingSource}
                    onChange={(e) =>
                      setEditingRule({
                        ...editingRule,
                        fundingSource: e.target.value as 'ALL' | FundingSource,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="ALL">전체 (보조금·자부담)</option>
                    <option value="보조금">보조금</option>
                    <option value="자부담">자부담</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">비목</label>
                  <select
                    value={editingRule.category}
                    onChange={(e) => {
                      const cat = e.target.value;
                      const found = state.settings.categories.find((c) => c.category === cat);
                      setEditingRule({
                        ...editingRule,
                        category: cat,
                        subCategory: found?.subCategories[0] || 'ALL',
                      });
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
                    value={editingRule.subCategory}
                    onChange={(e) =>
                      setEditingRule({ ...editingRule, subCategory: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="ALL">전체 세목 (ALL)</option>
                    {subCatOptions.map((sc) => (
                      <option key={sc} value={sc}>
                        {sc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    서류 유형명 *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingRule.docType}
                    onChange={(e) =>
                      setEditingRule({ ...editingRule, docType: e.target.value })
                    }
                    placeholder="예: 강의확인서, 비교견적서"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    필수 여부
                  </label>
                  <select
                    value={editingRule.requirementLevel}
                    onChange={(e) =>
                      setEditingRule({
                        ...editingRule,
                        requirementLevel: e.target.value as RequirementLevel,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="필수">필수</option>
                    <option value="조건부">조건부</option>
                    <option value="선택">선택</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    적용 조건
                  </label>
                  <input
                    type="text"
                    value={editingRule.conditionDesc}
                    onChange={(e) =>
                      setEditingRule({ ...editingRule, conditionDesc: e.target.value })
                    }
                    placeholder="예: 건당 30만원 초과 시"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    기준 버전
                  </label>
                  <input
                    type="text"
                    value={editingRule.version}
                    onChange={(e) =>
                      setEditingRule({ ...editingRule, version: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  담당자 안내 문구
                </label>
                <textarea
                  rows={2}
                  value={editingRule.guideText}
                  onChange={(e) =>
                    setEditingRule({ ...editingRule, guideText: e.target.value })
                  }
                  placeholder="지출결의서 작성 시 표시될 유의사항"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800"
                >
                  기준 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
