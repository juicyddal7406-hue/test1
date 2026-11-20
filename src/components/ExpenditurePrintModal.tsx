import { Printer, X } from 'lucide-react';
import { AppState, Expenditure } from '../types/subsidy';
import { evaluateExpenditureEvidence, formatKRW } from '../utils/calculations';

interface ExpenditurePrintModalProps {
  state: AppState;
  expenditure: Expenditure;
  onClose: () => void;
}

function numberToKoreanCurrency(num: number): string {
  if (num === 0) return '영원';
  const units = ['', '만', '억', '조'];
  const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  const subUnits = ['', '십', '백', '천'];
  let result = '';
  let unitIdx = 0;
  let n = Math.floor(num);
  while (n > 0) {
    const part = n % 10000;
    if (part > 0) {
      let partStr = '';
      let p = part;
      for (let i = 0; i < 4 && p > 0; i++) {
        const d = p % 10;
        if (d > 0) {
          partStr = (d === 1 && i > 0 ? '' : digits[d]) + subUnits[i] + partStr;
        }
        p = Math.floor(p / 10);
      }
      result = partStr + units[unitIdx] + result;
    }
    n = Math.floor(n / 10000);
    unitIdx++;
  }
  return `금 ${result}원정`;
}

export function ExpenditurePrintModal({
  state,
  expenditure,
  onClose,
}: ExpenditurePrintModalProps) {
  const project = state.projects.find((p) => p.id === expenditure.projectId);
  const staffMap = new Map(state.settings.staff.map((s) => [s.id, s]));
  const drafter = staffMap.get(expenditure.drafterId);
  const reviewer = expenditure.reviewerId ? staffMap.get(expenditure.reviewerId) : undefined;
  const approver = expenditure.approverId ? staffMap.get(expenditure.approverId) : undefined;

  const evEval = evaluateExpenditureEvidence(
    expenditure,
    project,
    state.evidenceRules,
    state.attachments
  );
  const linkedAttachments = state.attachments.filter(
    (a) => a.expenditureId === expenditure.id
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg border border-slate-200 w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden print-only-container">
        {/* Non-print Action Bar */}
        <div className="no-print flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="text-sm font-semibold text-slate-900">
            지출결의서 표준 인쇄 양식 ({expenditure.id})
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800"
            >
              <Printer className="w-4 h-4" />
              인쇄 / PDF 저장
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-900 p-1.5"
              aria-label="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable A4 Sheet */}
        <div className="p-8 overflow-y-auto bg-white text-slate-900">
          {/* Title + Approval Boxes */}
          <div className="flex items-start justify-between gap-6 mb-6">
            <div>
              <div className="text-xs text-slate-500 mb-1">
                {state.settings.organizationName} · 보조금사업 회계 표준 서식
              </div>
              <h1 className="text-2xl font-bold tracking-[0.25em] text-slate-900">
                지 출 결 의 서
              </h1>
              <div className="mt-2 text-xs font-mono-num text-slate-700">
                결의 번호: {expenditure.id} · 결재 상태: {expenditure.approvalStatus}
              </div>
            </div>

            <table className="border-collapse border border-slate-800 text-xs text-center">
              <thead>
                <tr className="bg-slate-100">
                  <th rowSpan={2} className="border border-slate-800 px-2 py-1 w-7">
                    결<br />재
                  </th>
                  <th className="border border-slate-800 px-3 py-1 w-20">담 당</th>
                  <th className="border border-slate-800 px-3 py-1 w-20">검 토</th>
                  <th className="border border-slate-800 px-3 py-1 w-20">승 인</th>
                </tr>
                <tr>
                  <td className="border border-slate-800 h-14 px-2 align-middle">
                    <div className="font-semibold">{drafter?.name || '-'}</div>
                    <div className="text-[10px] text-slate-500 font-mono-num">
                      {expenditure.draftDate}
                    </div>
                  </td>
                  <td className="border border-slate-800 h-14 px-2 align-middle">
                    <div className="font-semibold">{reviewer?.name || '-'}</div>
                    <div className="text-[10px] text-slate-500 font-mono-num">
                      {expenditure.requestedDate || ''}
                    </div>
                  </td>
                  <td className="border border-slate-800 h-14 px-2 align-middle">
                    <div className="font-semibold">
                      {expenditure.approvalStatus === '승인' ? approver?.name || '승인' : '-'}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono-num">
                      {expenditure.approvedDate || ''}
                    </div>
                  </td>
                </tr>
              </thead>
            </table>
          </div>

          {/* Main Resolution Table */}
          <table className="w-full border-collapse border border-slate-800 text-sm mb-6">
            <tbody>
              <tr>
                <th className="border border-slate-800 bg-slate-50 px-3 py-2 text-left w-32 font-semibold">
                  보조금 사업명
                </th>
                <td className="border border-slate-800 px-3 py-2" colSpan={3}>
                  [{project?.code}] {project?.name} ({project?.grantor})
                </td>
              </tr>
              <tr>
                <th className="border border-slate-800 bg-slate-50 px-3 py-2 text-left font-semibold">
                  예산 과목
                </th>
                <td className="border border-slate-800 px-3 py-2">
                  [{expenditure.fundingSource}] {expenditure.category} &gt;{' '}
                  {expenditure.subCategory}
                </td>
                <th className="border border-slate-800 bg-slate-50 px-3 py-2 text-left w-28 font-semibold">
                  작성 / 예정일
                </th>
                <td className="border border-slate-800 px-3 py-2 font-mono-num text-xs">
                  {expenditure.draftDate} / {expenditure.plannedDate}
                </td>
              </tr>
              <tr>
                <th className="border border-slate-800 bg-slate-50 px-3 py-2 text-left font-semibold">
                  지출 금액
                </th>
                <td className="border border-slate-800 px-3 py-2 font-bold" colSpan={3}>
                  <span className="mr-3">{numberToKoreanCurrency(expenditure.totalAmount)}</span>
                  <span className="font-mono-num">
                    ({formatKRW(expenditure.totalAmount)} · 공급가{' '}
                    {formatKRW(expenditure.supplyAmount)} / 부가세{' '}
                    {formatKRW(expenditure.vatAmount)})
                  </span>
                </td>
              </tr>
              <tr>
                <th className="border border-slate-800 bg-slate-50 px-3 py-2 text-left font-semibold">
                  거래처 / 수령인
                </th>
                <td className="border border-slate-800 px-3 py-2">{expenditure.vendor}</td>
                <th className="border border-slate-800 bg-slate-50 px-3 py-2 text-left font-semibold">
                  지급 방법
                </th>
                <td className="border border-slate-800 px-3 py-2">
                  {expenditure.paymentMethod}
                  {expenditure.paymentCompleted && expenditure.actualPaymentDate
                    ? ` (지급완료: ${expenditure.actualPaymentDate})`
                    : ''}
                </td>
              </tr>
              <tr>
                <th className="border border-slate-800 bg-slate-50 px-3 py-3 text-left font-semibold align-top">
                  지출 목적 및 내용
                </th>
                <td className="border border-slate-800 px-3 py-3 min-h-[80px]" colSpan={3}>
                  {expenditure.purpose}
                </td>
              </tr>
              {expenditure.exceptionReason && (
                <tr>
                  <th className="border border-slate-800 bg-slate-50 px-3 py-2 text-left font-semibold">
                    증빙 예외 사유
                  </th>
                  <td className="border border-slate-800 px-3 py-2 text-xs" colSpan={3}>
                    {expenditure.exceptionReason}
                  </td>
                </tr>
              )}
              {expenditure.rejectionReason && (
                <tr>
                  <th className="border border-slate-800 bg-red-50 px-3 py-2 text-left font-semibold text-red-800">
                    반려 사유
                  </th>
                  <td className="border border-slate-800 px-3 py-2 text-xs text-red-800" colSpan={3}>
                    {expenditure.rejectionReason}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Linked Evidence Checklist Table */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800 mb-2">
              <span>첨부 증빙서류 확인 목록 (적용 기준: {expenditure.appliedRuleVersion})</span>
              <span>
                필수 서류 충족: {evEval.attachedCount} / {evEval.requiredCount}건
              </span>
            </div>
            <table className="w-full border-collapse border border-slate-800 text-xs">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-800 px-2.5 py-1.5 w-16">구분</th>
                  <th className="border border-slate-800 px-2.5 py-1.5 text-left">증빙 서류명</th>
                  <th className="border border-slate-800 px-2.5 py-1.5 w-20">첨부 여부</th>
                  <th className="border border-slate-800 px-2.5 py-1.5 text-left">
                    연결 파일명 / 저장 경로
                  </th>
                </tr>
              </thead>
              <tbody>
                {evEval.applicableRules.map((rule) => {
                  const att = linkedAttachments.find(
                    (a) =>
                      (a.ruleId === rule.id || a.docType === rule.docType) &&
                      a.status === '첨부 완료'
                  );
                  return (
                    <tr key={rule.id}>
                      <td className="border border-slate-800 px-2.5 py-1.5 text-center">
                        {rule.requirementLevel}
                      </td>
                      <td className="border border-slate-800 px-2.5 py-1.5 font-medium">
                        {rule.docType}
                      </td>
                      <td className="border border-slate-800 px-2.5 py-1.5 text-center">
                        {att ? '첨부 완료' : '미첨부'}
                      </td>
                      <td className="border border-slate-800 px-2.5 py-1.5 font-mono-num text-[11px] break-all">
                        {att ? `${att.fileName} (${att.filePath})` : '-'}
                      </td>
                    </tr>
                  );
                })}
                {evEval.applicableRules.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="border border-slate-800 px-3 py-3 text-center text-slate-500"
                    >
                      적용된 증빙 기준 항목이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="text-center text-xs text-slate-600 pt-4 border-t border-slate-300">
            위 금액을 보조금 사업 수행 지출결의서로 정히 청구(집행)합니다. · 출력일:{' '}
            {new Date().toISOString().slice(0, 10)}
          </div>
        </div>
      </div>
    </div>
  );
}
