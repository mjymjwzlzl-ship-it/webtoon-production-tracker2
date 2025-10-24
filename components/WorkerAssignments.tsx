

import React, { useMemo } from 'react';
import type { Project, Worker } from '../types';
import { TEAM_BADGE_COLORS } from '../constants';

interface WorkerAssignmentsProps {
  workers: Worker[]; // Filtered workers
  allWorkers: Worker[]; // All workers for context
  projects: Project[];
  onWorkerClick?: (workerId: string | null) => void; // 작업자 클릭 핸들러
  selectedWorkerId?: string | null; // 선택된 작업자 ID
  isCompactView?: boolean; // 작게보기 모드
}

interface ProcessWithProgress {
  processName: string;
  completedCount: number;
  totalCount: number;
}

interface AssignmentsMap {
  [workerId: string]: {
    [projectTitle: string]: ProcessWithProgress[];
  };
}

const WorkerAssignments: React.FC<WorkerAssignmentsProps> = ({ 
  workers, 
  allWorkers, 
  projects, 
  onWorkerClick, 
  selectedWorkerId,
  isCompactView = false
}) => {
  const assignments = useMemo<AssignmentsMap>(() => {
    const map: AssignmentsMap = {};

    projects.forEach(project => {
      project.processes.forEach(process => {
        if (process.assignee) { // assignee is worker ID
          const workerId = process.assignee;
          if (!map[workerId]) {
            map[workerId] = {};
          }
          if (!map[workerId][project.title]) {
            map[workerId][project.title] = [];
          }

          let completedCount = 0;
          for (let i = 1; i <= project.episodeCount; i++) {
            const key = `${process.id}-${i}`;
            const cell = project.statuses[key];
            if (cell && (cell.status === 'done' || cell.status === 'final')) {
              completedCount++;
            }
          }
          
          map[workerId][project.title].push({
            processName: process.name,
            completedCount: completedCount,
            totalCount: project.episodeCount,
          });
        }
      });
    });

    return map;
  }, [projects]);

  const UserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
    </svg>
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6 border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800">작업자별 작업 현황</h2>
        {selectedWorkerId && onWorkerClick && (
          <button
            onClick={() => onWorkerClick(null)}
            className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors duration-200"
          >
            전체보기
          </button>
        )}
      </div>
      {allWorkers.length > 0 ? (
        workers.length > 0 ? (
          <div className={isCompactView ? "grid grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"}>
            {workers.map(worker => (
              <div 
                key={worker.id} 
                className={`bg-white border rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer ${
                  isCompactView ? 'p-3' : 'p-4'
                } ${
                  selectedWorkerId === worker.id 
                    ? 'border-primary-blue bg-blue-50/50 ring-2 ring-primary-blue/20' 
                    : 'border-slate-200/80'
                }`}
                onClick={() => onWorkerClick?.(worker.id)}
              >
                <div className={`font-bold text-slate-900 flex items-center gap-2 ${isCompactView ? 'text-sm mb-3' : 'text-lg mb-4'}`}>
                  {!isCompactView && <UserIcon />}
                  <h3 className={`${selectedWorkerId === worker.id ? 'text-primary-blue' : ''} ${isCompactView ? 'text-center flex-1' : ''}`}>{worker.name}</h3>
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${TEAM_BADGE_COLORS[worker.team]}`}>{worker.team}</span>
                  {selectedWorkerId === worker.id && !isCompactView && (
                    <span className="text-xs text-primary-blue font-medium">선택됨</span>
                  )}
                </div>
                {assignments[worker.id] && Object.keys(assignments[worker.id]).length > 0 ? (
                  isCompactView ? (
                    <div className="space-y-2">
                      {Object.entries(assignments[worker.id]).map(([projectTitle, processesWithProgress]) => (
                        <div key={projectTitle} className="text-xs">
                          <div className="font-medium text-slate-700 truncate mb-1">{projectTitle}</div>
                          {processesWithProgress.map(p => (
                            <div key={p.processName} className="text-slate-500 mb-1">
                              <div className="flex justify-between items-center">
                                <span className="truncate">{p.processName}</span>
                                <span className="font-mono text-xs">{p.completedCount}/{p.totalCount}</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1">
                                <div 
                                  className="bg-primary-blue h-1.5 rounded-full transition-all duration-500"
                                  style={{ width: p.totalCount > 0 ? `${(p.completedCount / p.totalCount) * 100}%` : '0%' }}
                                ></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(assignments[worker.id]).map(([projectTitle, processesWithProgress]) => (
                        <div key={projectTitle} className="bg-slate-50/70 p-3 rounded-md border border-slate-200/60">
                          <h4 className="font-semibold text-slate-700 mb-2">{projectTitle}</h4>
                          <ul className="space-y-2">
                            {processesWithProgress.map(p => (
                              <li key={p.processName} className="text-slate-600 text-sm">
                                  <div className="flex justify-between items-center mb-1">
                                      <span>{p.processName}</span>
                                      <span className="font-mono text-xs text-slate-500">{p.completedCount} / {p.totalCount}화</span>
                                  </div>
                                  <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                      <div 
                                          className="bg-primary-blue h-2.5 rounded-full transition-all duration-500 ease-out"
                                          style={{ width: p.totalCount > 0 ? `${(p.completedCount / p.totalCount) * 100}%` : '0%' }}
                                      ></div>
                                  </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <p className={`text-slate-500 ${isCompactView ? 'text-xs text-center' : 'text-sm'}`}>할당된 작업이 없습니다.</p>
                )}
              </div>
            ))}
          </div>
        ) : (
           <p className="text-slate-500 text-center py-4">선택된 팀에 등록된 작업자가 없습니다.</p>
        )
      ) : (
        <p className="text-slate-500 text-center py-4">등록된 작업자가 없습니다.</p>
      )}
    </div>
  );
};

export default WorkerAssignments;