import { useMemo, useState } from 'react';
import { Edit2, Plus, Search, X } from 'lucide-react';
import { AppState, Project, ProjectStatus } from '../types/subsidy';
import { formatKRW, getProjectSummary } from '../utils/calculations';
import { ProjectStatusText } from './StatusText';

interface ProjectsViewProps {
  state: AppState;
  onSaveProject: (project: Project, isNew: boolean) => void;
  onSelectProjectForBudget: (projectId: string) => void;
}

export function ProjectsView({
  state,
  onSaveProject,
  onSelectProjectForBudget,
}: ProjectsViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ProjectStatus>('ALL');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isNewModal, setIsNewModal] = useState(false);
  const [formError, setFormError] = useState('');

  const staffMap = useMemo(
    () => new Map(state.settings.staff.map((s) => [s.id, s])),
    [state.settings.staff]
  );

  const filteredProjects = useMemo(() => {
    return state.projects.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          p.id.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.grantor.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [state.projects, statusFilter, search]);

  const openCreateModal = () => {
    const seq = state.projects.length + 1;
    const year = state.settings.fiscalYear || '2026';
    const nextNum = String(seq).padStart(3, '0');
    let candidateId = `PRJ-${year}-${nextNum}`;
    let counter = seq;
    while (state.projects.some((p) => p.id === candidateId)) {
      counter += 1;
      candidateId = `PRJ-${year}-${String(counter).padStart(3, '0')}`;
    }

    setFormError('');
    setIsNewModal(true);
    setEditingProject({
      id: candidateId,
      code: `사업${String(counter).padStart(3, '0')}`,
      name: '',
      grantor: state.settings.grantors[0] || '',
      projectType: state.settings.projectTypes[0] || '',
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      subsidyAmount: 0,
      selfFundingAmount: 0,
      managerId: state.currentUserId || state.settings.staff[0]?.id || '',
      status: '진행 중',
      description: '',
      createdAt: new Date().toISOString().slice(0, 10),
    });
  };

  const openEditModal = (project: Project) => {
    setFormError('');
    setIsNewModal(false);
    setEditingProject({ ...project });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    if (!editingProject.name.trim()) {
      setFormError('사업명을 입력해 주세요.');
      return;
    }
    if (!editingProject.grantor.trim()) {
      setFormError('지원기관을 선택하거나 입력해 주세요.');
      return;
    }
    if (isNewModal && state.projects.some((p) => p.id === editingProject.id)) {
      setFormError('이미 존재하는 사업 ID입니다.');
      return;
    }
    if (isNewModal && state.projects.some((p) => p.code === editingProject.code)) {
      setFormError('이미 사용 중인 사업 코드입니다. 중복되지 않게 변경해 주세요.');
      return;
    }
    if (editingProject.startDate > editingProject.endDate) {
      setFormError('사업 종료일은 시작일 이후여야 합니다.');
      return;
    }
    onSaveProject(editingProject, isNewModal);
    setEditingProject(null);
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="사업명, 사업 ID, 지원기관 검색"
              className="pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-md w-64 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['ALL', '진행 중', '준비 중', '정산 중', '완료'] as const).map((st) => (
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
                {st === 'ALL' ? '전체' : st}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />새 보조금 사업 등록
        </button>
      </div>

      {/* Projects Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">사업 ID · 코드</th>
                <th className="px-4 py-3 whitespace-nowrap">사업명</th>
                <th className="px-4 py-3 whitespace-nowrap">지원기관 · 유형</th>
                <th className="px-4 py-3 whitespace-nowrap">사업 기간</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">총사업비 (보조/자부담)</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">편성예산 / 집행액</th>
                <th className="px-4 py-3 whitespace-nowrap">담당자</th>
                <th className="px-4 py-3 whitespace-nowrap">상태</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProjects.map((project) => {
                const summary = getProjectSummary(
                  project,
                  state.budgets,
                  state.expenditures,
                  state.evidenceRules,
                  state.attachments
                );
                const manager = staffMap.get(project.managerId);
                return (
                  <tr key={project.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-mono-num text-xs font-semibold text-slate-900">
                        {project.id}
                      </div>
                      <div className="text-xs text-slate-500">{project.code}</div>
                    </td>
                    <td className="px-4 py-3 max-w-[260px]">
                      <div className="font-medium text-slate-900 truncate" title={project.name}>
                        {project.name}
                      </div>
                      {project.description && (
                        <div className="text-xs text-slate-500 truncate">{project.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-slate-900">{project.grantor}</div>
                      <div className="text-xs text-slate-500">{project.projectType}</div>
                    </td>
                    <td className="px-4 py-3 font-mono-num text-xs text-slate-600 whitespace-nowrap">
                      {project.startDate} ~ {project.endDate}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="font-mono-num font-semibold text-slate-900">
                        {formatKRW(summary.plannedTotal)}
                      </div>
                      <div className="font-mono-num text-[11px] text-slate-500">
                        보조 {formatKRW(project.subsidyAmount)} / 자부담{' '}
                        {formatKRW(project.selfFundingAmount)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="font-mono-num text-slate-900">
                        {formatKRW(summary.currentBudget)}
                      </div>
                      <div className="font-mono-num text-xs text-blue-700">
                        집행 {formatKRW(summary.approvedAmount)} ({summary.executionRate.toFixed(1)}
                        %)
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {manager ? `${manager.name} (${manager.department})` : project.managerId}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <ProjectStatusText status={project.status} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectProjectForBudget(project.id)}
                          className="text-xs font-medium text-blue-700 hover:underline px-2 py-1"
                        >
                          예산 보기
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(project)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded px-2 py-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          수정
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredProjects.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                    조건에 해당하는 보조금 사업이 없습니다. 새 사업을 등록해 주세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {editingProject && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">
                {isNewModal ? '새 보조금 사업 등록' : '보조금 사업 정보 수정'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingProject(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-xs font-medium text-red-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    사업 ID (자동 부여 · 고유 식별자)
                  </label>
                  <input
                    type="text"
                    value={editingProject.id}
                    disabled={!isNewModal}
                    onChange={(e) =>
                      setEditingProject({ ...editingProject, id: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-num bg-slate-50 disabled:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    결의번호용 사업 코드
                  </label>
                  <input
                    type="text"
                    value={editingProject.code}
                    disabled={!isNewModal}
                    onChange={(e) =>
                      setEditingProject({ ...editingProject, code: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  사업명 *
                </label>
                <input
                  type="text"
                  required
                  value={editingProject.name}
                  onChange={(e) =>
                    setEditingProject({ ...editingProject, name: e.target.value })
                  }
                  placeholder="예: 2026 청년 문화예술 지원사업"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    지원기관 *
                  </label>
                  <select
                    value={editingProject.grantor}
                    onChange={(e) =>
                      setEditingProject({ ...editingProject, grantor: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    {state.settings.grantors.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    사업 유형
                  </label>
                  <select
                    value={editingProject.projectType}
                    onChange={(e) =>
                      setEditingProject({ ...editingProject, projectType: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    {state.settings.projectTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    사업 시작일
                  </label>
                  <input
                    type="date"
                    value={editingProject.startDate}
                    onChange={(e) =>
                      setEditingProject({ ...editingProject, startDate: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    사업 종료일
                  </label>
                  <input
                    type="date"
                    value={editingProject.endDate}
                    onChange={(e) =>
                      setEditingProject({ ...editingProject, endDate: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-num"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    보조금 (원)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={editingProject.subsidyAmount}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        subsidyAmount: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-num text-right"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    자부담금 (원)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={editingProject.selfFundingAmount}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        selfFundingAmount: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-num text-right"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    총사업비 (자동 합계)
                  </label>
                  <div className="w-full px-3 py-2 text-sm border border-slate-200 bg-slate-50 rounded-md font-mono-num text-right font-semibold text-slate-900">
                    {formatKRW(
                      (editingProject.subsidyAmount || 0) +
                        (editingProject.selfFundingAmount || 0)
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    담당자
                  </label>
                  <select
                    value={editingProject.managerId}
                    onChange={(e) =>
                      setEditingProject({ ...editingProject, managerId: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    {state.settings.staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.department} · {s.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    진행 상태
                  </label>
                  <select
                    value={editingProject.status}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        status: e.target.value as ProjectStatus,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="준비 중">준비 중</option>
                    <option value="진행 중">진행 중</option>
                    <option value="정산 중">정산 중</option>
                    <option value="완료">완료</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  사업 요약 / 비고
                </label>
                <textarea
                  rows={2}
                  value={editingProject.description || ''}
                  onChange={(e) =>
                    setEditingProject({ ...editingProject, description: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800"
                >
                  {isNewModal ? '사업 등록 완료' : '변경사항 저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
