import * as XLSX from 'xlsx';
import { AppState } from '../types/subsidy';
import {
  evaluateExpenditureEvidence,
  getBudgetItemSummary,
  getProjectSummary,
} from './calculations';

/**
 * PRD 6. Excel 시트 구조(01_대시보드 ~ 09_증빙기준설정)에 맞춘
 * 실제 다중 시트 .xlsx 통합관리 파일 내보내기
 */
export function exportFullWorkbookToExcel(state: AppState): void {
  const wb = XLSX.utils.book_new();
  const staffMap = new Map(state.settings.staff.map((s) => [s.id, s.name]));
  const projectMap = new Map(state.projects.map((p) => [p.id, p]));

  // 01_대시보드
  const projectSummaries = state.projects.map((p) =>
    getProjectSummary(p, state.budgets, state.expenditures, state.evidenceRules, state.attachments)
  );
  const dashboardRows = projectSummaries.map((s) => ({
    '사업 ID': s.project.id,
    사업명: s.project.name,
    지원기관: s.project.grantor,
    진행상태: s.project.status,
    '현재 편성예산(원)': s.currentBudget,
    '승인 집행액(원)': s.approvedAmount,
    '지급 완료액(원)': s.paidAmount,
    '결재 대기액(원)': s.pendingAmount,
    '승인 기준 잔액(원)': s.approvedBalance,
    '집행률(%)': s.executionRate,
    '결재 대기(건)': s.pendingCount,
    '증빙 누락(건)': s.missingEvidenceExpCount,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dashboardRows), '01_대시보드');

  // 02_사업등록
  const projectRows = state.projects.map((p) => ({
    '사업 ID': p.id,
    사업코드: p.code,
    사업명: p.name,
    지원기관: p.grantor,
    사업유형: p.projectType,
    시작일: p.startDate,
    종료일: p.endDate,
    '보조금(원)': p.subsidyAmount,
    '자부담금(원)': p.selfFundingAmount,
    '총사업비(원)': p.subsidyAmount + p.selfFundingAmount,
    담당자: staffMap.get(p.managerId) || p.managerId,
    진행상태: p.status,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(projectRows), '02_사업등록');

  // 03_예산관리
  const budgetRows = state.budgets.map((b) => {
    const sum = getBudgetItemSummary(b, state.expenditures);
    const prj = projectMap.get(b.projectId);
    return {
      '예산 항목 ID': b.id,
      '사업 ID': b.projectId,
      사업명: prj?.name || '',
      재원구분: b.fundingSource,
      비목: b.category,
      세목: b.subCategory,
      '최초 예산(원)': b.initialAmount,
      '증감액 합계(원)': b.changeAmount,
      '현재 예산(원)': sum.currentBudget,
      '승인 지출액(원)': sum.approvedAmount,
      '결재 대기액(원)': sum.pendingAmount,
      '승인 기준 잔액(원)': sum.approvedBalance,
      '집행률(%)': sum.executionRate,
      비고: b.note || '',
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(budgetRows), '03_예산관리');

  // 04_지출결의
  const expRows = state.expenditures.map((e) => {
    const prj = projectMap.get(e.projectId);
    const evEval = evaluateExpenditureEvidence(e, prj, state.evidenceRules, state.attachments);
    return {
      '지출결의 번호': e.id,
      '사업 ID': e.projectId,
      사업명: prj?.name || '',
      작성일: e.draftDate,
      지출예정일: e.plannedDate,
      실제지출일: e.actualPaymentDate || '-',
      재원구분: e.fundingSource,
      비목: e.category,
      세목: e.subCategory,
      '지출 목적·내용': e.purpose,
      거래처: e.vendor,
      지급방법: e.paymentMethod,
      '공급가액(원)': e.supplyAmount,
      '부가세(원)': e.vatAmount,
      '총액(원)': e.totalAmount,
      작성자: staffMap.get(e.drafterId) || e.drafterId,
      결재상태: e.approvalStatus,
      지급완료: e.paymentCompleted ? '완료' : '미지급',
      '필수증빙 현황': `${evEval.attachedCount}/${evEval.requiredCount}`,
      '미첨부 필수서류': evEval.missingRequiredDocs.map((d) => d.docType).join(', ') || '없음',
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expRows), '04_지출결의');

  // 05_증빙관리
  const attRows = state.attachments.map((a) => ({
    '증빙 파일 ID': a.id,
    '지출결의 번호': a.expenditureId,
    '적용 기준 ID': a.ruleId,
    서류유형: a.docType,
    필수여부: a.requirementLevel,
    파일명: a.fileName,
    저장경로: a.filePath,
    등록일: a.uploadedAt,
    담당자: staffMap.get(a.uploaderId) || a.uploaderId,
    첨부상태: a.status,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(attRows), '05_증빙관리');

  // 06_결재관리
  const logRows = state.approvalLogs.map((l) => ({
    이력ID: l.id,
    '지출결의 번호': l.expenditureId,
    결재처리: l.action,
    처리자: staffMap.get(l.actorId) || l.actorId,
    처리일시: l.timestamp,
    '의견·사유': l.comment,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(logRows), '06_결재관리');

  // 07_정산보고 (승인 건 기준 상세 내역)
  const settlementRows = state.expenditures
    .filter((e) => e.approvalStatus === '승인')
    .map((e) => {
      const prj = projectMap.get(e.projectId);
      const linkedFiles = state.attachments
        .filter((a) => a.expenditureId === e.id && a.status === '첨부 완료')
        .map((a) => a.fileName)
        .join(', ');
      return {
        사업명: prj?.name || '',
        지원기관: prj?.grantor || '',
        '지출결의 번호': e.id,
        승인일: e.approvedDate || '',
        실제지출일: e.actualPaymentDate || '',
        재원: e.fundingSource,
        비목: e.category,
        세목: e.subCategory,
        지출내용: e.purpose,
        거래처: e.vendor,
        '집행액(원)': e.totalAmount,
        지급여부: e.paymentCompleted ? '지급완료' : '지급대기',
        첨부증빙파일: linkedFiles,
      };
    });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(settlementRows), '07_정산보고');

  // 08_기초설정
  const staffRows = state.settings.staff.map((s) => ({
    직원ID: s.id,
    성명: s.name,
    부서: s.department,
    직급: s.position,
    권한역할: s.role,
    이메일: s.email,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(staffRows), '08_기초설정');

  // 09_증빙기준설정
  const ruleRows = state.evidenceRules.map((r) => ({
    '기준 ID': r.id,
    '적용 사업 ID': r.projectId,
    사업유형: r.projectType,
    지원기관: r.grantor,
    재원구분: r.fundingSource,
    비목: r.category,
    세목: r.subCategory,
    서류유형: r.docType,
    필수여부: r.requirementLevel,
    적용조건: r.conditionDesc,
    적용시작일: r.effectiveFrom,
    적용종료일: r.effectiveTo,
    안내문구: r.guideText,
    활성상태: r.isActive ? '사용' : '비활성',
    기준버전: r.version,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ruleRows), '09_증빙기준설정');

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `보조금사업_지출결의_통합관리_${today}.xlsx`);
}

export function exportProjectSettlementToExcel(
  state: AppState,
  projectId: string | 'ALL'
): void {
  const wb = XLSX.utils.book_new();
  const projectMap = new Map(state.projects.map((p) => [p.id, p]));
  const targetBudgets =
    projectId === 'ALL' ? state.budgets : state.budgets.filter((b) => b.projectId === projectId);
  const targetExps =
    projectId === 'ALL'
      ? state.expenditures
      : state.expenditures.filter((e) => e.projectId === projectId);

  const budgetRows = targetBudgets.map((b) => {
    const sum = getBudgetItemSummary(b, targetExps);
    const prj = projectMap.get(b.projectId);
    return {
      사업명: prj?.name || '',
      재원: b.fundingSource,
      비목: b.category,
      세목: b.subCategory,
      '현재예산(원)': sum.currentBudget,
      '승인집행액(원)': sum.approvedAmount,
      '지급완료액(원)': sum.paidAmount,
      '미집행잔액(원)': sum.approvedBalance,
      '집행률(%)': sum.executionRate,
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(budgetRows), '비목별_집행실적표');

  const detailRows = targetExps
    .filter((e) => e.approvalStatus === '승인')
    .map((e) => {
      const prj = projectMap.get(e.projectId);
      const files = state.attachments
        .filter((a) => a.expenditureId === e.id && a.status === '첨부 완료')
        .map((a) => `${a.docType}(${a.fileName})`)
        .join(' | ');
      return {
        사업명: prj?.name || '',
        지출결의번호: e.id,
        승인일: e.approvedDate || '',
        실제지출일: e.actualPaymentDate || '',
        재원: e.fundingSource,
        비목: e.category,
        세목: e.subCategory,
        거래처: e.vendor,
        지출내용: e.purpose,
        '공급가액(원)': e.supplyAmount,
        '부가세(원)': e.vatAmount,
        '합계금액(원)': e.totalAmount,
        연동증빙목록: files || '미등록',
      };
    });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), '정산용_지출증빙명세서');

  const today = new Date().toISOString().slice(0, 10);
  const prjLabel = projectId === 'ALL' ? '전체사업' : projectId;
  XLSX.writeFile(wb, `정산보고서_${prjLabel}_${today}.xlsx`);
}
