import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  FileText,
  FolderOpen,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { AppState, EvidenceAttachment, Expenditure } from '../types/subsidy';
import { evaluateExpenditureEvidence } from '../utils/calculations';
import { AttachmentStatusText, RequirementText } from './StatusText';

interface EvidenceViewProps {
  state: AppState;
  onOpenExpenditure: (exp: Expenditure) => void;
  onDeleteAttachment: (attachmentId: string) => void;
}

export function EvidenceView({
  state,
  onOpenExpenditure,
  onDeleteAttachment,
}: EvidenceViewProps) {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'FILES' | 'MISSING'>('FILES');
  const [previewAttachment, setPreviewAttachment] = useState<EvidenceAttachment | null>(null);

  const projectMap = useMemo(
    () => new Map(state.projects.map((p) => [p.id, p])),
    [state.projects]
  );
  const expMap = useMemo(
    () => new Map(state.expenditures.map((e) => [e.id, e])),
    [state.expenditures]
  );
  const staffMap = useMemo(
    () => new Map(state.settings.staff.map((s) => [s.id, s])),
    [state.settings.staff]
  );

  const missingExpenditures = useMemo(() => {
    return state.expenditures
      .filter((e) => e.approvalStatus !== '반려')
      .map((exp) => {
        const prj = projectMap.get(exp.projectId);
        const ev = evaluateExpenditureEvidence(
          exp,
          prj,
          state.evidenceRules,
          state.attachments
        );
        return { exp, prj, ev };
      })
      .filter(({ ev }) => ev.missingRequiredDocs.length > 0);
  }, [state.expenditures, state.evidenceRules, state.attachments, projectMap]);

  const filteredAttachments = useMemo(() => {
    return state.attachments.filter((att) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        att.expenditureId.toLowerCase().includes(q) ||
        att.docType.toLowerCase().includes(q) ||
        att.fileName.toLowerCase().includes(q) ||
        att.filePath.toLowerCase().includes(q)
      );
    });
  }, [state.attachments, search]);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('FILES')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'FILES'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              등록된 증빙파일 ({state.attachments.length}건)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('MISSING')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'MISSING'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              필수 증빙 누락 결의서 ({missingExpenditures.length}건)
            </button>
          </div>

          {viewMode === 'FILES' && (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="결의번호, 서류유형, 파일명, 경로 검색"
                className="pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-md w-72 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          )}
        </div>

        <div className="text-xs text-slate-500 font-mono-num">
          표준 저장소 루트: {state.settings.rootArchivePath}
        </div>
      </div>

      {viewMode === 'FILES' ? (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-3.5 py-2.5 whitespace-nowrap">지출결의 번호</th>
                  <th className="px-3.5 py-2.5 whitespace-nowrap">구분 · 서류 유형</th>
                  <th className="px-3.5 py-2.5 whitespace-nowrap">파일명</th>
                  <th className="px-3.5 py-2.5">공용 저장소 파일 경로</th>
                  <th className="px-3.5 py-2.5 whitespace-nowrap">등록자 · 등록일</th>
                  <th className="px-3.5 py-2.5 whitespace-nowrap">상태</th>
                  <th className="px-3.5 py-2.5 text-right whitespace-nowrap">열람 · 관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAttachments.map((att) => {
                  const exp = expMap.get(att.expenditureId);
                  const uploader = staffMap.get(att.uploaderId);
                  return (
                    <tr key={att.id} className="hover:bg-slate-50">
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => exp && onOpenExpenditure(exp)}
                          className="font-mono-num text-xs font-semibold text-blue-700 hover:underline"
                        >
                          {att.expenditureId}
                        </button>
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <RequirementText level={att.requirementLevel} />
                          <span className="font-medium text-slate-900">{att.docType}</span>
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 text-slate-900">
                          <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{att.fileName}</span>
                        </div>
                      </td>
                      <td
                        className="px-3.5 py-2.5 font-mono-num text-xs text-slate-600 max-w-[300px] truncate"
                        title={att.filePath}
                      >
                        {att.filePath}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-xs text-slate-600">
                        {uploader?.name || att.uploaderId} ·{' '}
                        <span className="font-mono-num">{att.uploadedAt}</span>
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <AttachmentStatusText status={att.status} />
                      </td>
                      <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewAttachment(att)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded px-2 py-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            파일 열람
                          </button>
                          {exp && !exp.isLocked && (
                            <button
                              type="button"
                              onClick={() => onDeleteAttachment(att.id)}
                              className="text-slate-400 hover:text-red-700 p-1"
                              title="증빙 링크 삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredAttachments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                      조건에 일치하는 증빙 파일이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 whitespace-nowrap">지출결의 번호</th>
                  <th className="px-4 py-2.5 whitespace-nowrap">사업명 · 비목</th>
                  <th className="px-4 py-2.5 whitespace-nowrap">지출 내용</th>
                  <th className="px-4 py-2.5 whitespace-nowrap">미첨부 필수 서류 목록</th>
                  <th className="px-4 py-2.5 text-right whitespace-nowrap">조치</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {missingExpenditures.map(({ exp, prj, ev }) => (
                  <tr key={exp.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono-num text-xs font-semibold text-slate-900 whitespace-nowrap">
                      {exp.id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-slate-900">{prj?.name}</div>
                      <div className="text-xs text-slate-500">
                        {exp.category} / {exp.subCategory}
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[240px] truncate text-slate-700">
                      {exp.purpose}
                    </td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {ev.missingRequiredDocs.length}건 미첨부:{' '}
                          {ev.missingRequiredDocs.map((d) => d.docType).join(', ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onOpenExpenditure(exp)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded px-3 py-1.5"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        증빙 첨부하기
                      </button>
                    </td>
                  </tr>
                ))}
                {missingExpenditures.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-emerald-700">
                      모든 진행 중인 지출결의서의 필수 증빙서류가 첨부되어 있습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Preview / Link Info Modal (T-08) */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  증빙자료 연결 상세 및 열람
                </h3>
                <p className="text-xs text-slate-500 font-mono-num">
                  {previewAttachment.expenditureId} · {previewAttachment.docType}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewAttachment(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-md p-4 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">파일명</span>
                  <span className="font-semibold text-slate-900">
                    {previewAttachment.fileName}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500 shrink-0">저장소 경로</span>
                  <span className="font-mono-num text-slate-800 break-all text-right">
                    {previewAttachment.filePath}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">적용 기준 ID / 등록일</span>
                  <span className="font-mono-num text-slate-700">
                    {previewAttachment.ruleId} · {previewAttachment.uploadedAt}
                  </span>
                </div>
              </div>

              {previewAttachment.fileDataUrl ? (
                previewAttachment.fileDataUrl.startsWith('data:image') ? (
                  <div className="border border-slate-200 rounded-md overflow-hidden max-h-[380px] flex items-center justify-center bg-slate-100">
                    <img
                      src={previewAttachment.fileDataUrl}
                      alt={previewAttachment.fileName}
                      className="max-h-[380px] object-contain"
                    />
                  </div>
                ) : (
                  <div className="p-6 border border-slate-200 rounded-md text-center space-y-3">
                    <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                    <div className="text-sm text-slate-700">
                      업로드된 파일({previewAttachment.fileName})이 브라우저에 연결되어 있습니다.
                    </div>
                    <a
                      href={previewAttachment.fileDataUrl}
                      download={previewAttachment.fileName}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800"
                    >
                      첨부 파일 다운로드하여 열기
                    </a>
                  </div>
                )
              ) : (
                <div className="p-6 border border-dashed border-slate-300 rounded-md text-center text-xs text-slate-600 space-y-2">
                  <FolderOpen className="w-7 h-7 text-slate-400 mx-auto" />
                  <div>
                    공용 네트워크/로컬 폴더 경로로 등록된 증빙 링크입니다. 실제 파일은 위 경로에서
                    확인하거나, 지출결의서 수정 화면에서 파일을 직접 첨부하면 즉시 미리보기가
                    지원됩니다.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
