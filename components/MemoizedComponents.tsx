import React, { memo } from 'react';
import type { Project, Worker, Process, CellState } from '../types';

// 메모이제이션된 StatusCell 컴포넌트
export const MemoizedStatusCell = memo(({ 
  cellState, 
  onCellChange 
}: { 
  cellState: CellState; 
  onCellChange: (newState: CellState) => void; 
}) => {
  return (
    <div 
      className={`w-8 h-8 border-2 rounded cursor-pointer flex items-center justify-center text-xs font-bold transition-all duration-200 ${
        cellState.status === 'none' 
          ? 'bg-white border-slate-300 text-slate-400 hover:border-slate-400' 
          : cellState.status === 'inProgress' 
          ? 'bg-yellow-400 border-yellow-500 text-white hover:bg-yellow-500' 
          : cellState.status === 'done' 
          ? 'bg-green-500 border-green-600 text-white hover:bg-green-600' 
          : 'bg-green-600 border-green-700 text-white hover:bg-green-700'
      }`}
      onClick={() => {
        const statuses: Array<CellState['status']> = ['none', 'inProgress', 'done', 'final'];
        const currentIndex = statuses.indexOf(cellState.status);
        const nextIndex = (currentIndex + 1) % statuses.length;
        onCellChange({ ...cellState, status: statuses[nextIndex] });
      }}
      title={`${cellState.status}${cellState.text ? ': ' + cellState.text : ''}`}
    >
      {cellState.status === 'none' ? '' : 
       cellState.status === 'inProgress' ? '●' : 
       cellState.status === 'done' ? '✓' : '★'}
    </div>
  );
});

MemoizedStatusCell.displayName = 'MemoizedStatusCell';

// 메모이제이션된 프로젝트 카드 컴포넌트
export const MemoizedProjectCard = memo(({ 
  project, 
  onSelect 
}: { 
  project: Project; 
  onSelect: (projectId: string) => void; 
}) => {
  return (
    <div 
      className="bg-white rounded-lg shadow-md border border-slate-200 p-4 cursor-pointer hover:shadow-lg transition-shadow duration-200"
      onClick={() => onSelect(project.id)}
    >
      <h3 className="text-lg font-semibold text-slate-800 mb-2">{project.title}</h3>
      <div className="flex flex-wrap gap-2">
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          project.type === 'adult' 
            ? 'bg-red-100 text-red-800' 
            : 'bg-blue-100 text-blue-800'
        }`}>
          {project.type === 'adult' ? '19금' : '일반'}
        </span>
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
          {project.team}
        </span>
        <span className="text-xs text-slate-500">
          {project.episodeCount}화
        </span>
      </div>
    </div>
  );
});

MemoizedProjectCard.displayName = 'MemoizedProjectCard';

// 메모이제이션된 작업자 선택 컴포넌트
export const MemoizedWorkerSelect = memo(({ 
  workers, 
  value, 
  onChange, 
  team 
}: { 
  workers: Worker[]; 
  value: string; 
  onChange: (value: string) => void; 
  team: string; 
}) => {
  const teamWorkers = React.useMemo(() => 
    workers.filter(w => w.team === team || w.team === '공통'),
    [workers, team]
  );

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="block w-full px-2 py-1 text-xs border-gray-300 focus:outline-none focus:ring-primary-blue focus:border-primary-blue rounded"
    >
      <option value="">선택</option>
      {teamWorkers.map(worker => (
        <option key={worker.id} value={worker.id}>
          {worker.name}
        </option>
      ))}
    </select>
  );
});

MemoizedWorkerSelect.displayName = 'MemoizedWorkerSelect';
