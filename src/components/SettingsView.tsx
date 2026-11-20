import { useState } from 'react';
import { Download, Plus, RotateCcw, Upload } from 'lucide-react';
import { AppState, BaseSettings, StaffMember, UserRole } from '../types/subsidy';

interface SettingsViewProps {
  state: AppState;
  onUpdateSettings: (nextSettings: BaseSettings) => void;
  onRestoreBackup: (restored: AppState) => void;
  onResetSampleData: () => void;
}

export function SettingsView({
  state,
  onUpdateSettings,
  onRestoreBackup,
  onResetSampleData,
}: SettingsViewProps) {
  const [settings, setSettings] = useState<BaseSettings>(state.settings);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffDept, setNewStaffDept] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<UserRole>('사업·회계 담당자');
  const [newGrantor, setNewGrantor] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(settings);
    setStatusMessage('기초 설정 및 통제 정책이 저장되었습니다.');
  };

  const handleAddStaff = () => {
    if (!newStaffName.trim()) return;
    const nextStaff: StaffMember = {
      id: `STF-${String(settings.staff.length + 1).padStart(3, '0')}`,
      name: newStaffName.trim(),
      department: newStaffDept.trim() || '사업운영팀',
      position: '담당자',
      role: newStaffRole,
      email: 'staff@org.kr',
    };
    const updated = { ...settings, staff: [...settings.staff, nextStaff] };
    setSettings(updated);
    onUpdateSettings(updated);
    setNewStaffName('');
    setNewStaffDept('');
    setStatusMessage(`담당자 '${nextStaff.name}'이(가) 추가되었습니다.`);
  };

  const handleAddGrantor = () => {
    if (!newGrantor.trim() || settings.grantors.includes(newGrantor.trim())) return;
    const updated = {
      ...settings,
      grantors: [...settings.grantors, newGrantor.trim()],
    };
    setSettings(updated);
    onUpdateSettings(updated);
    setNewGrantor('');
  };

  const handleExportBackupJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `보조금통합관리_백업_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage('전체 데이터 백업(.json) 파일이 다운로드되었습니다.');
  };

  const handleRestoreJsonFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as AppState;
        if (parsed && Array.isArray(parsed.projects) && Array.isArray(parsed.budgets)) {
          onRestoreBackup(parsed);
          setSettings(parsed.settings);
          setStatusMessage('백업 파일에서 모든 사업·예산·결의·증빙 데이터가 복구되었습니다.');
        } else {
          setStatusMessage('유효하지 않은 백업 파일 형식입니다.');
        }
      } catch {
        setStatusMessage('백업 파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {statusMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* General & Policy Settings */}
        <form
          onSubmit={handleSaveGeneral}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-4"
        >
          <h3 className="text-base font-semibold text-slate-900 border-b border-slate-200 pb-2">
            기관 기본 정보 및 결재·증빙 통제 정책
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                수행 기관명
              </label>
              <input
                type="text"
                value={settings.organizationName}
                onChange={(e) =>
                  setSettings({ ...settings, organizationName: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                기준 회계연도
              </label>
              <input
                type="text"
                value={settings.fiscalYear}
                onChange={(e) => setSettings({ ...settings, fiscalYear: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-num"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              증빙 파일 공용 저장소 기본 경로
            </label>
            <input
              type="text"
              value={settings.rootArchivePath}
              onChange={(e) =>
                setSettings({ ...settings, rootArchivePath: e.target.value })
              }
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-num"
            />
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={settings.strictEvidenceBlock}
                onChange={(e) =>
                  setSettings({ ...settings, strictEvidenceBlock: e.target.checked })
                }
                className="mt-0.5"
              />
              <div>
                <div className="font-medium text-slate-900">
                  필수 증빙서류 미첨부 시 결재 요청 차단 (엄격 모드)
                </div>
                <div className="text-xs text-slate-500">
                  해제 시 미첨부 경고를 표시하고 &apos;예외 사유&apos; 입력 후 결재 요청을 허용합니다.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={settings.budgetOverrunBlock}
                onChange={(e) =>
                  setSettings({ ...settings, budgetOverrunBlock: e.target.checked })
                }
                className="mt-0.5"
              />
              <div>
                <div className="font-medium text-slate-900">
                  비목 가용 예산 초과 시 결재 요청 차단
                </div>
                <div className="text-xs text-slate-500">
                  해제 시 예산 초과 사전 경고만 표시하고 상신할 수 있습니다.
                </div>
              </div>
            </label>
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800"
            >
              설정 저장
            </button>
          </div>
        </form>

        {/* Backup & Recovery (T-15) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900 border-b border-slate-200 pb-2">
            데이터 백업 및 복구
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            모든 사업, 예산, 지출결의, 증빙 링크 및 설정은 브라우저에 자동 저장되며, 언제든지
            JSON 파일로 전체 백업하거나 이전 백업을 복구할 수 있습니다.
          </p>

          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={handleExportBackupJson}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              <Download className="w-4 h-4" />
              전체 데이터 백업 파일 저장 (.json)
            </button>

            <label className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer">
              <Upload className="w-4 h-4" />
              백업 파일에서 복구하기 (.json)
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => handleRestoreJsonFile(e.target.files?.[0])}
              />
            </label>

            <button
              type="button"
              onClick={() => {
                onResetSampleData();
                setStatusMessage('초기 예시 데이터로 복원되었습니다.');
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              초기 예시 데이터로 재설정
            </button>
          </div>
        </div>
      </div>

      {/* Staff & Code Management */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">담당자 및 역할 관리</h3>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={newStaffName}
              onChange={(e) => setNewStaffName(e.target.value)}
              placeholder="성명"
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-md w-28"
            />
            <input
              type="text"
              value={newStaffDept}
              onChange={(e) => setNewStaffDept(e.target.value)}
              placeholder="소속 부서"
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-md w-36"
            />
            <select
              value={newStaffRole}
              onChange={(e) => setNewStaffRole(e.target.value as UserRole)}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white"
            >
              <option value="사업·회계 담당자">사업·회계 담당자</option>
              <option value="검토·승인 담당자">검토·승인 담당자</option>
              <option value="관리자">관리자</option>
            </select>
            <button
              type="button"
              onClick={handleAddStaff}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800"
            >
              <Plus className="w-3.5 h-3.5" />
              추가
            </button>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-md text-sm">
            {settings.staff.map((s) => (
              <div key={s.id} className="px-3.5 py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-medium text-slate-900">{s.name}</span>
                  <span className="text-xs text-slate-500 ml-2">
                    {s.department} · {s.position}
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-700">{s.role}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">지원기관 및 비목 코드</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newGrantor}
              onChange={(e) => setNewGrantor(e.target.value)}
              placeholder="새 지원기관명 입력"
              className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-md"
            />
            <button
              type="button"
              onClick={handleAddGrantor}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800"
            >
              <Plus className="w-3.5 h-3.5" />
              기관 추가
            </button>
          </div>
          <div className="text-xs text-slate-600 space-y-2">
            <div>
              <span className="font-semibold text-slate-800">등록된 지원기관: </span>
              {settings.grantors.join(' · ')}
            </div>
            <div>
              <span className="font-semibold text-slate-800">지급 방법: </span>
              {settings.paymentMethods.join(' · ')}
            </div>
            <div className="pt-2 border-t border-slate-100 space-y-1">
              <div className="font-semibold text-slate-800">비목 · 세목 체계</div>
              {settings.categories.map((c) => (
                <div key={c.category}>
                  <span className="font-medium text-slate-900">{c.category}:</span>{' '}
                  {c.subCategories.join(', ')}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
