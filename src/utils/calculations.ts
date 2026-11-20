import {
  BudgetItem,
  EvidenceAttachment,
  EvidenceRule,
  Expenditure,
  Project,
} from '../types/subsidy';

export function formatKRW(amount: number): string {
  if (!Number.isFinite(amount)) return '0원';
  return `${Math.round(amount).toLocaleString('ko-KR')}원`;
}

export function formatNumber(amount: number): string {
  if (!Number.isFinite(amount)) return '0';
  return Math.round(amount).toLocaleString('ko-KR');
}

export function calcExecutionRate(executed: number, budget: number): number {
  if (!Number.isFinite(budget) || budget <= 0) return 0;
  if (!Number.isFinite(executed) || executed <= 0) return 0;
  return Math.round((executed / budget) * 1000) / 10; // 1 decimal place
}

export interface BudgetSummary {
  budgetItem: BudgetItem;
  currentBudget: number;
  approvedAmount: number;
  paidAmount: number;
  pendingAmount: number;
  approvedBalance: number;
  projectedBalance: number;
  executionRate: number;
  isOverBudget: boolean;
  isProjectedOverBudget: boolean;
}

export function getBudgetItemSummary(
  budgetItem: BudgetItem,
  expenditures: Expenditure[]
): BudgetSummary {
  const currentBudget = Math.max(0, (budgetItem.initialAmount || 0) + (budgetItem.changeAmount || 0));
  const itemExps = expenditures.filter((e) => e.budgetItemId === budgetItem.id);

  const approvedAmount = itemExps
    .filter((e) => e.approvalStatus === '승인')
    .reduce((sum, e) => sum + (e.totalAmount || 0), 0);

  const paidAmount = itemExps
    .filter((e) => e.approvalStatus === '승인' && e.paymentCompleted)
    .reduce((sum, e) => sum + (e.totalAmount || 0), 0);

  const pendingAmount = itemExps
    .filter((e) => e.approvalStatus === '결재 요청' || e.approvalStatus === '검토 중')
    .reduce((sum, e) => sum + (e.totalAmount || 0), 0);

  const approvedBalance = currentBudget - approvedAmount;
  const projectedBalance = currentBudget - approvedAmount - pendingAmount;
  const executionRate = calcExecutionRate(approvedAmount, currentBudget);

  return {
    budgetItem,
    currentBudget,
    approvedAmount,
    paidAmount,
    pendingAmount,
    approvedBalance,
    projectedBalance,
    executionRate,
    isOverBudget: approvedBalance < 0,
    isProjectedOverBudget: projectedBalance < 0,
  };
}

export interface ProjectSummary {
  project: Project;
  plannedTotal: number;
  currentBudget: number;
  approvedAmount: number;
  paidAmount: number;
  pendingAmount: number;
  approvedBalance: number;
  executionRate: number;
  pendingCount: number;
  missingEvidenceExpCount: number;
}

export function getProjectSummary(
  project: Project,
  budgets: BudgetItem[],
  expenditures: Expenditure[],
  rules: EvidenceRule[],
  attachments: EvidenceAttachment[]
): ProjectSummary {
  const projectBudgets = budgets.filter((b) => b.projectId === project.id);
  const projectExps = expenditures.filter((e) => e.projectId === project.id);

  const currentBudget = projectBudgets.reduce(
    (sum, b) => sum + Math.max(0, (b.initialAmount || 0) + (b.changeAmount || 0)),
    0
  );

  const approvedAmount = projectExps
    .filter((e) => e.approvalStatus === '승인')
    .reduce((sum, e) => sum + (e.totalAmount || 0), 0);

  const paidAmount = projectExps
    .filter((e) => e.approvalStatus === '승인' && e.paymentCompleted)
    .reduce((sum, e) => sum + (e.totalAmount || 0), 0);

  const pendingExps = projectExps.filter(
    (e) => e.approvalStatus === '결재 요청' || e.approvalStatus === '검토 중'
  );

  const pendingAmount = pendingExps.reduce((sum, e) => sum + (e.totalAmount || 0), 0);
  const approvedBalance = currentBudget - approvedAmount;
  const executionRate = calcExecutionRate(approvedAmount, currentBudget);

  const missingEvidenceExpCount = projectExps.filter((exp) => {
    if (exp.approvalStatus === '반려') return false;
    const check = evaluateExpenditureEvidence(exp, project, rules, attachments);
    return check.missingRequiredDocs.length > 0;
  }).length;

  return {
    project,
    plannedTotal: (project.subsidyAmount || 0) + (project.selfFundingAmount || 0),
    currentBudget,
    approvedAmount,
    paidAmount,
    pendingAmount,
    approvedBalance,
    executionRate,
    pendingCount: pendingExps.length,
    missingEvidenceExpCount,
  };
}

/**
 * F-09: 사업명, 지원기관, 재원, 비목·세목을 기준으로 적용 가능한 증빙 기준을 자동 조회
 * 동일 비목이라도 사업(projectId) 또는 지원기관(grantor)에 따라 다른 기준을 적용(T-06)
 */
export function resolveApplicableEvidenceRules(
  project: Project | undefined,
  fundingSource: string,
  category: string,
  subCategory: string,
  draftDate: string,
  allRules: EvidenceRule[]
): EvidenceRule[] {
  if (!project || !category) return [];

  const matched = allRules.filter((rule) => {
    if (!rule.isActive) return false;
    if (rule.category !== category) return false;
    if (rule.subCategory !== 'ALL' && rule.subCategory !== subCategory) return false;
    if (rule.fundingSource !== 'ALL' && rule.fundingSource !== fundingSource) return false;

    // Effective date check
    if (rule.effectiveFrom && draftDate && draftDate < rule.effectiveFrom) return false;
    if (rule.effectiveTo && draftDate && draftDate > rule.effectiveTo) return false;

    // Scope match: either specific projectId OR general (ALL) matching grantor & projectType
    if (rule.projectId !== 'ALL') {
      return rule.projectId === project.id;
    }

    const grantorMatch = rule.grantor === 'ALL' || rule.grantor === project.grantor;
    const typeMatch = rule.projectType === 'ALL' || rule.projectType === project.projectType;
    return grantorMatch && typeMatch;
  });

  // Sort: project-specific rules first, then 필수 -> 조건부 -> 선택
  const reqOrder: Record<string, number> = { 필수: 0, 조건부: 1, 선택: 2 };
  return matched.sort((a, b) => {
    const aSpec = a.projectId !== 'ALL' ? 0 : a.grantor !== 'ALL' ? 1 : 2;
    const bSpec = b.projectId !== 'ALL' ? 0 : b.grantor !== 'ALL' ? 1 : 2;
    if (aSpec !== bSpec) return aSpec - bSpec;
    return (reqOrder[a.requirementLevel] ?? 9) - (reqOrder[b.requirementLevel] ?? 9);
  });
}

export interface EvidenceEvaluation {
  applicableRules: EvidenceRule[];
  requiredRules: EvidenceRule[];
  missingRequiredDocs: EvidenceRule[];
  attachedCount: number;
  requiredCount: number;
  conditionalDocs: EvidenceRule[];
  optionalDocs: EvidenceRule[];
}

export function evaluateExpenditureEvidence(
  expenditure: Pick<
    Expenditure,
    'id' | 'projectId' | 'fundingSource' | 'category' | 'subCategory' | 'draftDate'
  >,
  project: Project | undefined,
  allRules: EvidenceRule[],
  attachments: EvidenceAttachment[]
): EvidenceEvaluation {
  const applicableRules = resolveApplicableEvidenceRules(
    project,
    expenditure.fundingSource,
    expenditure.category,
    expenditure.subCategory,
    expenditure.draftDate,
    allRules
  );

  const expAttachments = attachments.filter((a) => a.expenditureId === expenditure.id);

  const requiredRules = applicableRules.filter((r) => r.requirementLevel === '필수');
  const conditionalDocs = applicableRules.filter((r) => r.requirementLevel === '조건부');
  const optionalDocs = applicableRules.filter((r) => r.requirementLevel === '선택');

  const isRuleSatisfied = (rule: EvidenceRule): boolean => {
    return expAttachments.some(
      (att) =>
        (att.ruleId === rule.id || att.docType === rule.docType) &&
        att.status === '첨부 완료' &&
        (att.fileName.trim().length > 0 || att.filePath.trim().length > 0)
    );
  };

  const missingRequiredDocs = requiredRules.filter((r) => !isRuleSatisfied(r));
  const attachedCount = requiredRules.filter((r) => isRuleSatisfied(r)).length;

  return {
    applicableRules,
    requiredRules,
    missingRequiredDocs,
    attachedCount,
    requiredCount: requiredRules.length,
    conditionalDocs,
    optionalDocs,
  };
}

export function generateNextExpenditureId(
  project: Project,
  fiscalYear: string,
  expenditures: Expenditure[]
): string {
  const year = fiscalYear || '2026';
  const prefix = `${year}-${project.code}-지출`;
  const existing = expenditures
    .filter((e) => e.id.startsWith(prefix))
    .map((e) => {
      const suffix = e.id.replace(prefix, '');
      const num = parseInt(suffix, 10);
      return Number.isNaN(num) ? 0 : num;
    });
  const nextNum = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

export function buildStandardEvidencePath(
  rootArchivePath: string,
  fiscalYear: string,
  projectId: string,
  expenditureId: string,
  docType: string,
  fileName?: string
): string {
  const cleanRoot = (rootArchivePath || '\\\\공용서버\\보조금증빙').replace(/[\\/]+$/, '');
  const cleanFile = fileName && fileName.trim() ? fileName.trim() : `${docType}.pdf`;
  return `${cleanRoot}\\${fiscalYear}\\${projectId}\\${expenditureId}\\${cleanFile}`;
}
