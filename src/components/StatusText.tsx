import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileEdit,
  XCircle,
} from 'lucide-react';
import { ApprovalStatus, AttachmentStatus, ProjectStatus, RequirementLevel } from '../types/subsidy';

export function ApprovalStatusText({ status }: { status: ApprovalStatus }) {
  switch (status) {
    case '승인':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          승인
        </span>
      );
    case '결재 요청':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          결재 요청
        </span>
      );
    case '검토 중':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 whitespace-nowrap">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          검토 중
        </span>
      );
    case '반려':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 whitespace-nowrap">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          반려
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 whitespace-nowrap">
          <FileEdit className="w-3.5 h-3.5 shrink-0" />
          작성 중
        </span>
      );
  }
}

export function ProjectStatusText({ status }: { status: ProjectStatus }) {
  switch (status) {
    case '진행 중':
      return <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">진행 중</span>;
    case '정산 중':
      return <span className="text-xs font-semibold text-amber-700 whitespace-nowrap">정산 중</span>;
    case '완료':
      return <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">완료</span>;
    default:
      return <span className="text-xs font-semibold text-blue-700 whitespace-nowrap">준비 중</span>;
  }
}

export function RequirementText({ level }: { level: RequirementLevel }) {
  if (level === '필수') {
    return <span className="text-xs font-semibold text-red-700 whitespace-nowrap">필수</span>;
  }
  if (level === '조건부') {
    return <span className="text-xs font-semibold text-amber-700 whitespace-nowrap">조건부</span>;
  }
  return <span className="text-xs font-medium text-slate-500 whitespace-nowrap">선택</span>;
}

export function AttachmentStatusText({ status }: { status: AttachmentStatus }) {
  if (status === '첨부 완료') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        첨부 완료
      </span>
    );
  }
  if (status === '해당 없음(예외)') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 whitespace-nowrap">
        해당 없음(예외)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 whitespace-nowrap">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
      미첨부
    </span>
  );
}
