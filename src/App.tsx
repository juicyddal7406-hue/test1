/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Briefcase,
  CheckSquare,
  ClipboardCheck,
  FileCheck2,
  FileSpreadsheet,
  FolderOpen,
  Menu,
  PieChart,
  Plus,
  Receipt,
  Settings,
  X,
} from 'lucide-react';
import { ApprovalsView } from './components/ApprovalsView';
import { BudgetsView } from './components/BudgetsView';
import { DashboardView } from './components/DashboardView';
import { EvidenceRulesView } from './components/EvidenceRulesView';
import { EvidenceView } from './components/EvidenceView';
import { ExpenditureFormModal } from './components/ExpenditureFormModal';
import { ExpenditurePrintModal } from './components/ExpenditurePrintModal';
import { ExpendituresView } from './components/ExpendituresView';
import { ProjectsView } from './components/ProjectsView';
import { SettingsView } from './components/SettingsView';
import { SettlementView } from './components/SettlementView';
import { INITIAL_APP_STATE } from './data/seedData';
import {
  AppState,
  ApprovalLog,
  BaseSettings,
  BudgetItem,
  EvidenceAttachment,
  EvidenceRule,
  Expenditure,
  Project,
  SheetTab,
} from './types/subsidy';
import {
  evaluateExpenditureEvidence,
  generateNextExpenditureId,
} from './utils/calculations';
import { exportFullWorkbookToExcel } from './utils/excelExport';

const STORAGE_KEY = 'subsidy_integrated_manager_v1';

interface NavItem {
  id: SheetTab;
  label: string;
  sheetCode: string;
  icon: typeof BarChart3;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: '01. 통합 대시보드', sheetCode: '01_대시보드', icon: BarChart3 },
  { id: 'projects', label: '02. 사업 등록·관리', sheetCode: '02_사업등록', icon: Briefcase },
  { id: 'budgets', label: '03. 예산 편성·관리', sheetCode: '03_예산관리', icon: PieChart },
  { id: 'expenditures', label: '04. 지출결의서 관리', sheetCode: '04_지출결의', icon: Receipt },
  { id: 'evidence', label: '05. 증빙자료 관리', sheetCode: '05_증빙관리', icon: FolderOpen },
  { id: 'approvals', label: '06. 결재 상태 관리', sheetCode: '06_결재관리', icon: CheckSquare },
  { id: 'settlement', label: '07. 정산 및 보고서', sheetCode: '07_정산보고', icon: FileCheck2 },
  { id: 'evidenceRules', label: '09. 증빙 기준 설정', sheetCode: '09_증빙기준설정', icon: ClipboardCheck },
  { id: 'settings', label: '08. 기초 코드 설정', sheetCode: '08_기초설정', icon: Settings },
];

function loadInitialState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && Array.isArray(parsed.projects) && parsed.settings) {
        return parsed;
      }
    }
  } catch {
    // Fallback to initial seed state
  }
  return INITIAL_APP_STATE;
}

export default function App() {
  const [state, setState] = useState<AppState>(loadInitialState);
  const [activeTab, setActiveTab] = useState<SheetTab>('dashboard');
  const [budgetProjectId, setBudgetProjectId] = useState<string | undefined>(undefined);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Modals
  const [editingExp, setEditingExp] = useState<Expenditure | null | undefined>(undefined); // undefined = closed, null = new
  const [printingExp, setPrintingExp] = useState<Expenditure | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota exceeded
    }
  }, [state]);

  const currentStaff = useMemo(
    () =>
      state.settings.staff.find((s) => s.id === state.currentUserId) ||
      state.settings.staff[0],
    [state.settings.staff, state.currentUserId]
  );

  const navCounters = useMemo(() => {
    const pendingApprovals = state.expenditures.filter(
      (e) => e.approvalStatus === '결재 요청' || e.approvalStatus === '검토 중'
    ).length;
    const missingEvidence = state.expenditures.filter((exp) => {
      if (exp.approvalStatus === '반려') return false;
      const prj = state.projects.find((p) => p.id === exp.projectId);
      const ev = evaluateExpenditureEvidence(
        exp,
        prj,
        state.evidenceRules,
        state.attachments
      );
      return ev.missingRequiredDocs.length > 0;
    }).length;
    return { pendingApprovals, missingEvidence };
  }, [state.expenditures, state.projects, state.evidenceRules, state.attachments]);

  const activeNav = NAV_ITEMS.find((n) => n.id === activeTab) || NAV_ITEMS[0];

  // Handlers
  const handleSaveProject = (project: Project, isNew: boolean) => {
    setState((prev) => ({
      ...prev,
      projects: isNew
        ? [...prev.projects, project]
        : prev.projects.map((p) => (p.id === project.id ? project : p)),
    }));
  };

  const handleAddBudgetItem = (item: BudgetItem) => {
    setState((prev) => ({
      ...prev,
      budgets: [...prev.budgets, item],
    }));
  };

  const handleAdjustBudget = (budgetItemId: string, delta: number, reason: string) => {
    setState((prev) => {
      const target = prev.budgets.find((b) => b.id === budgetItemId);
      if (!target) return prev;
      const nextBudgets = prev.budgets.map((b) =>
        b.id === budgetItemId ? { ...b, changeAmount: b.changeAmount + delta } : b
      );
      const actorName =
        prev.settings.staff.find((s) => s.id === prev.currentUserId)?.name || '담당자';
      const nextLog = {
        id: `BLOG-${Date.now()}`,
        budgetItemId,
        projectId: target.projectId,
        date: new Date().toISOString().slice(0, 10),
        amount: delta,
        reason,
        updatedBy: actorName,
      };
      return {
        ...prev,
        budgets: nextBudgets,
        budgetLogs: [...prev.budgetLogs, nextLog],
      };
    });
  };

  const handleSaveExpenditure = (
    expenditure: Expenditure,
    attachmentsForExp: EvidenceAttachment[],
    submitForApproval: boolean,
    isNew: boolean
  ) => {
    setState((prev) => {
      const nextExpenditures = isNew
        ? [expenditure, ...prev.expenditures]
        : prev.expenditures.map((e) => (e.id === expenditure.id ? expenditure : e));

      const otherAttachments = prev.attachments.filter(
        (a) => a.expenditureId !== expenditure.id
      );
      const nextAttachments = [...otherAttachments, ...attachmentsForExp];

      const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
      const newLogs: ApprovalLog[] = [
        {
          id: `LOG-${Date.now()}`,
          expenditureId: expenditure.id,
          action: submitForApproval ? '결재 요청' : isNew ? '작성' : '수정',
          actorId: prev.currentUserId,
          timestamp: nowStr,
          comment: submitForApproval
            ? expenditure.exceptionReason
              ? `결재 요청 (증빙 예외 사유: ${expenditure.exceptionReason})`
              : '필수 증빙 확인 후 결재 요청 상신'
            : isNew
              ? '지출결의서 초안 저장'
              : '지출결의서 내용 수정',
        },
      ];

      return {
        ...prev,
        expenditures: nextExpenditures,
        attachments: nextAttachments,
        approvalLogs: [...prev.approvalLogs, ...newLogs],
      };
    });
    setEditingExp(undefined);
  };

  const handleCreateCorrection = (source: Expenditure) => {
    const project = state.projects.find((p) => p.id === source.projectId);
    if (!project) return;
    const newId = generateNextExpenditureId(
      project,
      state.settings.fiscalYear,
      state.expenditures
    );
    const correctionDraft: Expenditure = {
      ...source,
      id: newId,
      draftDate: new Date().toISOString().slice(0, 10),
      purpose: `[정정] ${source.purpose}`,
      approvalStatus: '작성 중',
      reviewerId: undefined,
      approverId: undefined,
      requestedDate: undefined,
      approvedDate: undefined,
      rejectionReason: undefined,
      paymentCompleted: false,
      actualPaymentDate: '',
      isLocked: false,
      correctionOfId: source.id,
    };
    setEditingExp(correctionDraft);
  };

  const handleDeleteAttachment = (attachmentId: string) => {
    setState((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((a) => a.id !== attachmentId),
    }));
  };

  const handleTransitionApproval = (
    expenditureId: string,
    nextAction: '검토 시작' | '승인' | '반려' | '작성 중 복귀' | '지급 완료 처리',
    comment: string
  ) => {
    const today = new Date().toISOString().slice(0, 10);
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');

    setState((prev) => {
      const nextExpenditures = prev.expenditures.map((exp) => {
        if (exp.id !== expenditureId) return exp;
        switch (nextAction) {
          case '검토 시작':
            return {
              ...exp,
              approvalStatus: '검토 중' as const,
              reviewerId: prev.currentUserId,
            };
          case '승인':
            return {
              ...exp,
              approvalStatus: '승인' as const,
              approverId: prev.currentUserId,
              approvedDate: today,
              rejectionReason: undefined,
              isLocked: true,
            };
          case '반려':
            return {
              ...exp,
              approvalStatus: '반려' as const,
              approverId: prev.currentUserId,
              approvedDate: today,
              rejectionReason: comment,
              isLocked: false,
            };
          case '작성 중 복귀':
            return {
              ...exp,
              approvalStatus: '작성 중' as const,
              isLocked: false,
            };
          case '지급 완료 처리':
            return {
              ...exp,
              paymentCompleted: true,
              actualPaymentDate: today,
            };
          default:
            return exp;
        }
      });

      const log: ApprovalLog = {
        id: `LOG-${Date.now()}`,
        expenditureId,
        action: nextAction,
        actorId: prev.currentUserId,
        timestamp: nowStr,
        comment: comment || `${nextAction} 처리 완료`,
      };

      return {
        ...prev,
        expenditures: nextExpenditures,
        approvalLogs: [...prev.approvalLogs, log],
      };
    });
  };

  const handleSaveRule = (rule: EvidenceRule, isNew: boolean) => {
    setState((prev) => ({
      ...prev,
      evidenceRules: isNew
        ? [...prev.evidenceRules, rule]
        : prev.evidenceRules.map((r) => (r.id === rule.id ? rule : r)),
    }));
  };

  const handleToggleRuleActive = (ruleId: string) => {
    setState((prev) => ({
      ...prev,
      evidenceRules: prev.evidenceRules.map((r) =>
        r.id === ruleId ? { ...r, isActive: !r.isActive } : r
      ),
    }));
  };

  const handleUpdateSettings = (nextSettings: BaseSettings) => {
    setState((prev) => ({
      ...prev,
      settings: nextSettings,
    }));
  };

  const handleRestoreBackup = (restored: AppState) => {
    setState(restored);
  };

  const handleResetSampleData = () => {
    setState(INITIAL_APP_STATE);
  };

  const handleNavigate = (tab: SheetTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const handleOpenExpenditureById = (id: string) => {
    const found = state.expenditures.find((e) => e.id === id);
    if (found) setEditingExp(found);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Sidebar (Desktop) */}
      <aside className="no-print hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-[#98EBD3] border-r border-teal-900/15">
        <div className="h-16 px-5 border-b border-teal-900/10 flex items-center">
          <span className="text-sm font-bold tracking-tight text-teal-950 whitespace-nowrap">
            보조금 지출결의 통합관리
          </span>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const badgeCount =
              item.id === 'approvals'
                ? navCounters.pendingApprovals
                : item.id === 'evidence'
                  ? navCounters.missingEvidence
                  : 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-md transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-teal-900 text-white font-semibold shadow-sm'
                    : 'text-teal-950 hover:bg-white/40 hover:text-teal-950 font-medium'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {badgeCount > 0 && (
                  <span
                    className={`text-xs font-mono-num font-semibold ml-2 ${
                      isActive
                        ? 'text-amber-300'
                        : item.id === 'evidence'
                          ? 'bg-white/90 text-red-700 px-1.5 py-0.5 rounded'
                          : 'bg-white/90 text-amber-800 px-1.5 py-0.5 rounded'
                    }`}
                  >
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Active User / Role Switcher */}
        <div className="p-4 border-t border-teal-900/10 space-y-2 bg-teal-950/5">
          <div className="text-[11px] font-semibold text-teal-900">
            현재 작업자 · 권한 전환
          </div>
          <select
            value={state.currentUserId}
            onChange={(e) => {
              const staff = state.settings.staff.find((s) => s.id === e.target.value);
              setState((prev) => ({
                ...prev,
                currentUserId: e.target.value,
                currentRole: staff?.role || prev.currentRole,
              }));
            }}
            className="w-full text-xs border border-teal-900/20 rounded-md px-2.5 py-1.5 bg-white/95 text-slate-900"
          >
            {state.settings.staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.role})
              </option>
            ))}
          </select>
          <div className="text-[11px] text-teal-900 truncate">
            {state.settings.organizationName} · {currentStaff?.department}
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-[#98EBD3] h-full flex flex-col border-r border-teal-900/15 z-10">
            <div className="h-14 px-4 border-b border-teal-900/10 flex items-center justify-between">
              <span className="text-sm font-bold text-teal-950 whitespace-nowrap">
                보조금 지출결의 통합관리
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-teal-900 hover:text-teal-950"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-md whitespace-nowrap ${
                      isActive
                        ? 'bg-teal-900 text-white font-semibold shadow-sm'
                        : 'text-teal-950 hover:bg-white/40 hover:text-teal-950 font-medium'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract */}
        <header className="no-print h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900"
              aria-label="메뉴 열기"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-500 hidden sm:inline whitespace-nowrap">
                {state.settings.organizationName}
              </span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-semibold text-slate-900 truncate whitespace-nowrap">
                {activeNav.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => exportFullWorkbookToExcel(state)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              Excel 통합 내려받기
            </button>
            <button
              type="button"
              onClick={() => setEditingExp(null)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />새 지출결의 작성
            </button>
          </div>
        </header>

        {/* Active Sheet Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              state={state}
              onNavigate={handleNavigate}
              onOpenExpenditure={handleOpenExpenditureById}
            />
          )}
          {activeTab === 'projects' && (
            <ProjectsView
              state={state}
              onSaveProject={handleSaveProject}
              onSelectProjectForBudget={(prjId) => {
                setBudgetProjectId(prjId);
                setActiveTab('budgets');
              }}
            />
          )}
          {activeTab === 'budgets' && (
            <BudgetsView
              state={state}
              initialProjectId={budgetProjectId}
              onAddBudgetItem={handleAddBudgetItem}
              onAdjustBudget={handleAdjustBudget}
            />
          )}
          {activeTab === 'expenditures' && (
            <ExpendituresView
              state={state}
              onOpenNew={() => setEditingExp(null)}
              onOpenEdit={(exp) => setEditingExp(exp)}
              onOpenPrint={(exp) => setPrintingExp(exp)}
            />
          )}
          {activeTab === 'evidence' && (
            <EvidenceView
              state={state}
              onOpenExpenditure={(exp) => setEditingExp(exp)}
              onDeleteAttachment={handleDeleteAttachment}
            />
          )}
          {activeTab === 'approvals' && (
            <ApprovalsView
              state={state}
              onTransitionApproval={handleTransitionApproval}
              onOpenExpenditure={(exp) => setEditingExp(exp)}
            />
          )}
          {activeTab === 'settlement' && <SettlementView state={state} />}
          {activeTab === 'evidenceRules' && (
            <EvidenceRulesView
              state={state}
              onSaveRule={handleSaveRule}
              onToggleRuleActive={handleToggleRuleActive}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsView
              state={state}
              onUpdateSettings={handleUpdateSettings}
              onRestoreBackup={handleRestoreBackup}
              onResetSampleData={handleResetSampleData}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      {editingExp !== undefined && (
        <ExpenditureFormModal
          state={state}
          initialExpenditure={editingExp}
          onClose={() => setEditingExp(undefined)}
          onSave={handleSaveExpenditure}
          onCreateCorrection={handleCreateCorrection}
        />
      )}

      {printingExp && (
        <ExpenditurePrintModal
          state={state}
          expenditure={printingExp}
          onClose={() => setPrintingExp(null)}
        />
      )}
    </div>
  );
}
