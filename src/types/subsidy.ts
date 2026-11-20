export type UserRole = '관리자' | '사업·회계 담당자' | '검토·승인 담당자';

export type SheetTab =
  | 'dashboard'
  | 'projects'
  | 'budgets'
  | 'expenditures'
  | 'evidence'
  | 'approvals'
  | 'settlement'
  | 'settings'
  | 'evidenceRules';

export type ProjectStatus = '진행 중' | '준비 중' | '정산 중' | '완료';

export type FundingSource = '보조금' | '자부담';

export type ApprovalStatus = '작성 중' | '결재 요청' | '검토 중' | '승인' | '반려';

export type RequirementLevel = '필수' | '선택' | '조건부';

export type AttachmentStatus = '첨부 완료' | '미첨부' | '해당 없음(예외)';

export interface StaffMember {
  id: string;
  name: string;
  department: string;
  position: string;
  role: UserRole;
  email: string;
}

export interface Project {
  id: string; // e.g., PRJ-2026-001
  code: string; // e.g., 사업001
  name: string;
  grantor: string; // 지원기관
  projectType: string; // 사업 유형
  startDate: string;
  endDate: string;
  subsidyAmount: number; // 보조금
  selfFundingAmount: number; // 자부담금
  managerId: string;
  status: ProjectStatus;
  description?: string;
  createdAt: string;
}

export interface BudgetItem {
  id: string; // e.g., BUD-001
  projectId: string;
  fundingSource: FundingSource;
  category: string; // 비목
  subCategory: string; // 세목
  initialAmount: number; // 최초 예산
  changeAmount: number; // 예산 증감액 합계
  note?: string;
}

export interface BudgetChangeLog {
  id: string;
  budgetItemId: string;
  projectId: string;
  date: string;
  amount: number; // + or -
  reason: string;
  updatedBy: string;
}

export interface EvidenceRule {
  id: string; // e.g., RULE-001
  projectId: string; // 'ALL' or specific Project.id
  projectType: string; // 'ALL' or specific projectType
  grantor: string; // 'ALL' or specific grantor
  fundingSource: 'ALL' | FundingSource;
  category: string; // 비목
  subCategory: string; // 'ALL' or 세목
  docType: string; // 서류 유형
  requirementLevel: RequirementLevel;
  conditionDesc: string; // 적용 조건
  effectiveFrom: string;
  effectiveTo: string;
  guideText: string; // 안내 문구
  isActive: boolean;
  version: string; // e.g., v1.0
}

export interface Expenditure {
  id: string; // e.g., 2026-사업001-지출0001
  projectId: string;
  budgetItemId: string;
  draftDate: string; // 작성일
  plannedDate: string; // 지출 예정일
  actualPaymentDate: string; // 실제 지출일
  fundingSource: FundingSource;
  category: string;
  subCategory: string;
  purpose: string; // 지출 목적·내용
  vendor: string; // 거래처·지급 대상
  paymentMethod: string; // 지급 방법
  supplyAmount: number; // 공급가액
  vatAmount: number; // 부가가치세
  totalAmount: number; // 총액
  drafterId: string; // 작성자
  approvalStatus: ApprovalStatus;
  reviewerId?: string;
  approverId?: string;
  requestedDate?: string;
  approvedDate?: string;
  rejectionReason?: string;
  paymentCompleted: boolean;
  appliedRuleVersion: string;
  exceptionReason?: string;
  isLocked: boolean;
  correctionOfId?: string; // 정정 대상 결의서 번호
}

export interface EvidenceAttachment {
  id: string;
  expenditureId: string;
  ruleId: string; // EvidenceRule.id or 'CUSTOM'
  docType: string;
  requirementLevel: RequirementLevel;
  fileName: string;
  filePath: string;
  fileDataUrl?: string; // Optional browser-local file preview data URL
  fileSizeLabel?: string;
  uploadedAt: string;
  uploaderId: string;
  status: AttachmentStatus;
  note?: string;
}

export interface ApprovalLog {
  id: string;
  expenditureId: string;
  action: '작성' | '수정' | '결재 요청' | '검토 시작' | '승인' | '반려' | '작성 중 복귀' | '지급 완료 처리';
  actorId: string;
  timestamp: string;
  comment: string;
}

export interface CategoryDefinition {
  category: string;
  subCategories: string[];
}

export interface BaseSettings {
  organizationName: string;
  fiscalYear: string;
  rootArchivePath: string;
  strictEvidenceBlock: boolean; // true: 필수 증빙 누락 시 결재 요청 차단, false: 경고 및 예외 사유 기록 허용
  budgetOverrunBlock: boolean; // true: 예산 초과 시 결재 요청 차단, false: 경고 후 진행 허용
  projectTypes: string[];
  grantors: string[];
  paymentMethods: string[];
  categories: CategoryDefinition[];
  staff: StaffMember[];
}

export interface AppState {
  projects: Project[];
  budgets: BudgetItem[];
  budgetLogs: BudgetChangeLog[];
  evidenceRules: EvidenceRule[];
  expenditures: Expenditure[];
  attachments: EvidenceAttachment[];
  approvalLogs: ApprovalLog[];
  settings: BaseSettings;
  currentRole: UserRole;
  currentUserId: string;
}
