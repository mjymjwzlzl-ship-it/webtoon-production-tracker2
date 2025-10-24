
import React, { useState, useEffect } from 'react';
import StatusCell from './StatusCell';
import type { Process, Statuses, CellState, Worker, Team } from '../types';

interface TrackerTableProps {
  title: string;
  processes: Process[]; // These are the FILTERED processes
  allProcesses: Process[]; // These are ALL processes for the project
  episodeCount: number;
  startEpisode: number; // 시작 회차
  statuses: Statuses;
  workers: Worker[];
  projectTeam: Team;
  onCellChange: (processId: number, episode: number, newCellState: CellState) => void;
  onAssigneeChange: (processId: number, newAssigneeId: string) => void;
  onEpisodeCompletionToggle: (episode: number, isComplete: boolean) => void;
  onAddEpisode?: () => void;
  onRemoveEpisode?: () => void;
  onStartEpisodeChange?: (newStartEpisode: number) => void; // 시작 회차 변경
  onProcessNameChange?: (processId: number, newName: string) => void; // 작업 공정 이름 변경
  onAddProcess?: () => void; // 작업 공정 추가
  onRemoveProcess?: (processId: number) => void; // 작업 공정 제거
  onToggleEditing?: () => void; // 수정 모드 토글
  isEditing?: boolean; // 수정 모드 여부
  hiddenEpisodes?: number[]; // 숨겨진 회차 목록
}

const MIN_EPISODE_COLUMNS = 10;
const DEFAULT_CELL_STATE: CellState = { status: 'none', text: '' };

const TrackerTable: React.FC<TrackerTableProps> = ({
  title,
  processes,
  allProcesses,
  episodeCount,
  startEpisode,
  statuses,
  workers,
  projectTeam,
  onCellChange,
  onAssigneeChange,
  onEpisodeCompletionToggle,
  onAddEpisode,
  onRemoveEpisode,
  onStartEpisodeChange,
  onProcessNameChange,
  onAddProcess,
  onRemoveProcess,
  onToggleEditing,
  isEditing = false,
  hiddenEpisodes,
}) => {
  const [isDesktop, setIsDesktop] = useState(false);
  const [showStartEpisodeModal, setShowStartEpisodeModal] = useState(false);
  const [tempStartEpisode, setTempStartEpisode] = useState(startEpisode);
  const [editingProcessId, setEditingProcessId] = useState<number | null>(null);
  const [editingProcessName, setEditingProcessName] = useState('');

  useEffect(() => {
    const checkIsDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    
    checkIsDesktop();
    window.addEventListener('resize', checkIsDesktop);
    
    return () => window.removeEventListener('resize', checkIsDesktop);
  }, []);

  const allDisplayEpisodes = Array.from({ length: episodeCount }, (_, i) => startEpisode + i);
  const displayEpisodes = allDisplayEpisodes.filter(ep => !hiddenEpisodes?.includes(ep));
  
  // 디버깅용 로그
  console.log('TrackerTable Debug:', {
    title,
    episodeCount,
    startEpisode,
    allDisplayEpisodes,
    hiddenEpisodes,
    displayEpisodes,
    hiddenEpisodesLength: hiddenEpisodes?.length || 0
  });
  
  
  const teamWorkers = workers.filter(w => w.team === projectTeam || w.team === '공통');

  const handleProcessNameEdit = (processId: number, currentName: string) => {
    setEditingProcessId(processId);
    setEditingProcessName(currentName);
  };

  const handleProcessNameSave = () => {
    if (editingProcessId && onProcessNameChange) {
      onProcessNameChange(editingProcessId, editingProcessName);
    }
    setEditingProcessId(null);
    setEditingProcessName('');
  };

  const handleProcessNameCancel = () => {
    setEditingProcessId(null);
    setEditingProcessName('');
  };

  // Define column widths in pixels for precise control - 모바일 최적화
  const titleColWidth = 80;    // 5rem
  const processColWidth = isDesktop ? 140 : 90;  // 줄거리, 콘티 등의 텍스트에 적합한 크기
  const assigneeColWidth = isDesktop ? 140 : 90; // 담당자 이름이 잘리지 않도록 충분한 너비 확보
  const episodeColWidth = 72;   // 에피소드 셀 너비 조정

  // Calculate the explicit total width of the table
  const totalTableWidth = isDesktop 
    ? titleColWidth + processColWidth + assigneeColWidth + (displayEpisodes.length * episodeColWidth)
    : processColWidth + assigneeColWidth + (displayEpisodes.length * episodeColWidth);

  return (
    <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
      {/* 모바일에서 프로젝트 제목 및 컨트롤 표시 */}
      <div className="lg:hidden bg-slate-100 px-4 py-3 border-b border-slate-300">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-700 truncate flex-1">{title}</h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={onAddEpisode} 
              className="w-6 h-6 bg-primary-blue hover:opacity-90 text-white rounded transition-opacity duration-200 flex items-center justify-center"
              title="회차 추가"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </button>
            <button 
              onClick={onRemoveEpisode} 
              disabled={episodeCount <= 1} 
              className="w-6 h-6 bg-red-600 hover:bg-red-700 text-white rounded transition-colors duration-200 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center"
              title="회차 제거"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto overflow-y-auto relative" style={{ maxHeight: '70vh' }}>
        <div className="relative" style={{ width: `${totalTableWidth}px` }}>
          <table
            className="table-fixed text-xs text-left text-slate-600 border-collapse w-full"
            style={{ width: `${totalTableWidth}px`, borderSpacing: '0' }}
          >
          <colgroup>
            {isDesktop && <col style={{ width: `${titleColWidth}px` }} />}
            <col style={{ width: `${processColWidth}px` }} />
            <col style={{ width: `${assigneeColWidth}px` }} />
            {displayEpisodes.map(episode => (
              <col key={`col-${episode}`} style={{ width: `${episodeColWidth}px` }} />
            ))}
          </colgroup>
          <thead className="text-xs text-slate-700 uppercase font-bold bg-slate-100">
            <tr>
              {/* 데스크톱에서만 표시되는 제목 컬럼 */}
              <th scope="col" className="hidden lg:table-cell px-2 py-2 sm:py-2 bg-white sticky left-0 top-0 z-30 border-t border-b border-l border-slate-300" style={{ borderRight: '1px solid #cbd5e1' }}>
                <div className="flex items-center justify-center gap-1">
                  <button 
                    onClick={onAddEpisode} 
                    className="w-5 h-5 bg-primary-blue hover:opacity-90 text-white rounded transition-opacity duration-200 flex items-center justify-center"
                    title="회차 추가"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button 
                    onClick={onRemoveEpisode} 
                    disabled={episodeCount <= 1} 
                    className="w-5 h-5 bg-red-600 hover:bg-red-700 text-white rounded transition-colors duration-200 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center"
                    title="회차 제거"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </th>
              <th scope="col" className="px-3 py-2 sm:py-2 text-center bg-white sticky top-0 z-30 border-t border-b border-l border-slate-300" style={{ left: isDesktop ? `${titleColWidth}px` : '0px', borderRight: '1px solid #cbd5e1' }}>
                구분
              </th>
              <th scope="col" className="px-3 py-2 sm:py-2 text-center bg-white sticky top-0 z-30 border-t border-b border-l border-slate-300" style={{ left: isDesktop ? `${titleColWidth + processColWidth}px` : `${processColWidth}px`, borderRight: '1px solid #cbd5e1' }}>
                담당
              </th>
              {displayEpisodes.map(episode => (
                <th 
                  key={episode} 
                  scope="col" 
                  className={`px-2 py-2 sm:py-2 text-center border border-slate-300 sticky top-0 z-10 bg-blue-100 text-primary-blue ${isEditing ? 'cursor-pointer hover:bg-blue-200' : ''}`}
                  onDoubleClick={() => {
                    if (isEditing && onStartEpisodeChange) {
                      setTempStartEpisode(startEpisode);
                      setShowStartEpisodeModal(true);
                    }
                  }}
                  title={isEditing ? '더블클릭하여 시작 회차 변경' : ''}
                >
                  {episode}화
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processes.map((process, processIndex) => {
              const isEvenRow = processIndex % 2 === 1;
              const rowBgColor = isEvenRow ? 'bg-slate-50' : 'bg-white';
              return (
              <tr key={process.id} className={rowBgColor}>
                {/* 데스크톱에서만 표시되는 제목 셀 */}
                {processIndex === 0 && (
                  <td
                    rowSpan={processes.length}
                    className="hidden lg:table-cell px-2 py-2 sm:py-2 bg-white align-middle text-center text-sm font-bold text-slate-700 border-t border-b border-l border-slate-300 sticky left-0 z-20"
                    style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', borderRight: '1px solid #cbd5e1' }}
                  >
                    {title}
                  </td>
                )}
                <td className={`px-4 py-2 sm:py-1.5 font-medium text-slate-800 bg-white border-t border-b border-l border-slate-300 sticky z-20`} style={{ left: isDesktop ? `${titleColWidth}px` : '0px', borderRight: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>
                  {editingProcessId === process.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingProcessName}
                        onChange={(e) => setEditingProcessName(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleProcessNameSave();
                          } else if (e.key === 'Escape') {
                            handleProcessNameCancel();
                          }
                        }}
                      />
                      <button
                        onClick={handleProcessNameSave}
                        className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                      >
                        ✓
                      </button>
                      <button
                        onClick={handleProcessNameCancel}
                        className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span
                        className="flex-1 px-1 py-1 truncate"
                        title={process.name}
                      >
                        {process.name}
                      </span>
                      {isEditing && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleProcessNameEdit(process.id, process.name)}
                            className="p-1 text-gray-400 hover:text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
                            title="이름 변경"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z"></path></svg>
                          </button>
                          {onRemoveProcess && (
                            <button
                              onClick={() => onRemoveProcess(process.id)}
                              className="p-1 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-100 transition-colors"
                              title="삭제"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td className={`px-2 py-2 sm:py-1 text-center bg-white border-t border-b border-l border-slate-300 sticky z-20`} style={{ left: isDesktop ? `${titleColWidth + processColWidth}px` : `${processColWidth}px`, borderRight: '1px solid #cbd5e1' }}>
                   <select
                    value={process.assignee}
                    onChange={(e) => onAssigneeChange(process.id, e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-2 py-2 sm:py-1 text-slate-800 focus:ring-2 focus:ring-primary-blue focus:border-primary-blue text-xs min-h-[44px] sm:min-h-0"
                    aria-label={`Assignee for ${process.name}`}
                  >
                    <option value="">-- 미지정 --</option>
                    {teamWorkers.map(worker => (
                      <option key={worker.id} value={worker.id}>{worker.name}</option>
                    ))}
                  </select>
                </td>
                {displayEpisodes.map(episode => {
                  const key = `${process.id}-${episode}`;
                  const cellState = statuses[key] || DEFAULT_CELL_STATE;
                  return (
                    <StatusCell
                      key={key}
                      cellState={cellState}
                      onCellChange={(newState) => onCellChange(process.id, episode, newState)}
                    />
                  );
                })}
              </tr>
              );
            })}
            {processes.length === 0 && (
              <tr>
                <td colSpan={displayEpisodes.length + (isDesktop ? 3 : 2)} className="text-center py-6 text-slate-500">
                  선택된 작업자에게 할당된 작업이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
           <tfoot className="bg-slate-100">
             <tr className="border-t-2 border-slate-300">
               <th scope="row" colSpan={isDesktop ? 3 : 2} className="px-4 py-2 sm:py-1.5 text-center font-bold text-xs text-slate-700 sticky left-0 bottom-0 z-20 bg-white border-b border-l border-slate-300" style={{ width: isDesktop ? `${titleColWidth + processColWidth + assigneeColWidth}px` : `${processColWidth + assigneeColWidth}px`, borderRight: '1px solid #cbd5e1' }}>
                 전체 완료
               </th>
               {displayEpisodes.map(episode => {
                 const isAllComplete = allProcesses.length > 0 && allProcesses.every(p => statuses[`${p.id}-${episode}`]?.status === 'done' || statuses[`${p.id}-${episode}`]?.status === 'final');
                 return (
                   <td key={episode} className="py-2 sm:py-1.5 text-center border border-slate-300 sticky bottom-0 z-10 bg-slate-100">
                     <input
                       type="checkbox"
                       aria-label={`Mark all tasks for episode ${episode} as complete`}
                       className="h-5 w-5 sm:h-4 sm:w-4 bg-slate-200 border-slate-400 rounded text-primary-green focus:ring-primary-green focus:ring-offset-slate-100 focus:ring-2"
                       checked={isAllComplete}
                       onChange={(e) => onEpisodeCompletionToggle(episode, e.target.checked)}
                       disabled={allProcesses.length === 0}
                     />
                   </td>
                 );
               })}
             </tr>
           </tfoot>
         </table>
         
        {isEditing && onAddProcess && (
          <div className="my-6 flex justify-center">
            <button
              onClick={onAddProcess}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-md border border-emerald-600 text-emerald-700 bg-white hover:bg-emerald-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              작업 공정 추가
            </button>
          </div>
        )}
         </div>
       </div>

       {/* 시작 회차 변경 모달 */}
       {showStartEpisodeModal && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
           <div className="bg-white rounded-lg p-6 w-80 max-w-sm mx-4">
             <h3 className="text-lg font-semibold text-gray-900 mb-4">시작 회차 변경</h3>
             <div className="mb-4">
               <label className="block text-sm font-medium text-gray-700 mb-2">
                 시작 회차
               </label>
               <input
                 type="number"
                 min="1"
                 value={tempStartEpisode}
                 onChange={(e) => setTempStartEpisode(parseInt(e.target.value) || 1)}
                 className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                 autoFocus
               />
             </div>
             <div className="flex justify-end space-x-3">
               <button
                 onClick={() => setShowStartEpisodeModal(false)}
                 className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
               >
                 취소
               </button>
               <button
                 onClick={() => {
                   if (tempStartEpisode > 0 && onStartEpisodeChange) {
                     onStartEpisodeChange(tempStartEpisode);
                   }
                   setShowStartEpisodeModal(false);
                 }}
                 className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
               >
                 확인
               </button>
             </div>
           </div>
         </div>
       )}
     </div>
   );
 };
 
 export default TrackerTable;
