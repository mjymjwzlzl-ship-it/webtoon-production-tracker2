

import React, { useState, useEffect } from 'react';
import type { Worker, Team } from '../types';
import { TEAMS, TEAM_BADGE_COLORS } from '../constants';

interface WorkerManagerProps {
  workers: Worker[]; // All workers for context
  displayWorkers: Worker[];
  onAddWorker: (name: string, team: Team) => void;
  onDeleteWorker: (id: string) => void;
  onUpdateWorker: (id: string, name: string, team: Team) => void;
  activeFilter: Team | 'all';
  onFilterChange: (team: Team | 'all') => void;
  onSearchResultsChange?: (filteredWorkers: Worker[]) => void; // 검색 결과 변경 콜백
  onCompactViewChange?: (isCompact: boolean) => void; // 작게보기 모드 변경 콜백
}

const WorkerManager: React.FC<WorkerManagerProps> = ({ 
  workers,
  displayWorkers, 
  onAddWorker, 
  onDeleteWorker,
  onUpdateWorker,
  activeFilter,
  onFilterChange,
  onSearchResultsChange,
  onCompactViewChange,
}) => {
  const [newWorkerName, setNewWorkerName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<Team>('0팀');
  const [bulkAddMode, setBulkAddMode] = useState(false);
  const [bulkWorkerNames, setBulkWorkerNames] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingTeam, setEditingTeam] = useState<Team>('0팀');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCompactView, setIsCompactView] = useState(false);

  const handleAddClick = () => {
    if (newWorkerName.trim()) {
      onAddWorker(newWorkerName, selectedTeam);
      setNewWorkerName('');
      setSelectedTeam('0팀');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleAddClick();
    }
  };

  const handleBulkAdd = () => {
    if (bulkWorkerNames.trim()) {
      const names = bulkWorkerNames.split('\n').map(name => name.trim()).filter(name => name);
      names.forEach(name => {
        onAddWorker(name, selectedTeam);
      });
      setBulkWorkerNames('');
      setBulkAddMode(false);
    }
  };

  // 편집 시작
  const handleStartEdit = (worker: Worker) => {
    setEditingWorkerId(worker.id);
    setEditingName(worker.name);
    setEditingTeam(worker.team);
  };

  // 편집 저장
  const handleSaveEdit = () => {
    if (editingWorkerId && editingName.trim()) {
      onUpdateWorker(editingWorkerId, editingName.trim(), editingTeam);
      setEditingWorkerId(null);
      setEditingName('');
      setEditingTeam('0팀');
    }
  };

  // 편집 취소
  const handleCancelEdit = () => {
    setEditingWorkerId(null);
    setEditingName('');
    setEditingTeam('0팀');
  };

  // 검색어로 작업자 필터링 (띄어쓰기 무시하고 검색)
  const filteredWorkers = displayWorkers.filter(worker => {
    const normalizedSearchTerm = searchTerm.toLowerCase().replace(/\s+/g, '');
    const normalizedName = worker.name.toLowerCase().replace(/\s+/g, '');
    return normalizedName.includes(normalizedSearchTerm);
  });

  // 검색 결과가 변경될 때마다 상위 컴포넌트에 알림
  useEffect(() => {
    if (onSearchResultsChange) {
      onSearchResultsChange(filteredWorkers);
    }
  }, [filteredWorkers, onSearchResultsChange]);

  // 작게보기 모드가 변경될 때마다 상위 컴포넌트에 알림
  useEffect(() => {
    if (onCompactViewChange) {
      onCompactViewChange(isCompactView);
    }
  }, [isCompactView, onCompactViewChange]);

  const getFilterButtonClass = (team: Team | 'all') => {
    const base = "px-4 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200";
    if (activeFilter === team) {
        return `${base} bg-primary-blue text-white shadow-sm`;
    }
    return `${base} bg-slate-200 hover:bg-slate-300 text-slate-700`;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800">작업자 관리</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditMode(!editMode)}
            className={`px-2 py-1 text-xs font-medium rounded-md transition-colors duration-200 ${
              editMode 
                ? 'bg-red-600 text-white hover:bg-red-700' 
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            {editMode ? '수정모드 종료' : '수정모드'}
          </button>
          <button
            onClick={() => setIsCompactView(!isCompactView)}
            className={`px-2 py-1 text-xs font-medium rounded-md transition-colors duration-200 ${
              isCompactView 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            {isCompactView ? '일반보기' : '작게보기'}
          </button>
          <div className="flex items-center space-x-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
              {(['all', ...TEAMS] as const).map(team => (
                  <button key={team} onClick={() => onFilterChange(team)} className={getFilterButtonClass(team)}>
                      {team === 'all' ? '전체' : team}
                  </button>
              ))}
          </div>
        </div>
      </div>
      
      <div className="space-y-3 mb-4">
        {/* 검색 기능 */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="작업자 이름으로 검색..."
              className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 pl-8 text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-primary-blue focus:border-primary-blue"
              aria-label="Search workers"
            />
            <svg 
              className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              title="검색어 지우기"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setBulkAddMode(!bulkAddMode)}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              bulkAddMode 
                ? 'bg-green-600 text-white' 
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            {bulkAddMode ? '일괄 추가 모드' : '일괄 추가'}
          </button>
          <span className="text-xs text-slate-500">
            {bulkAddMode ? '여러 줄로 작업자 이름을 입력하세요' : '한 번에 여러 작업자를 추가할 수 있습니다'}
          </span>
        </div>

        {bulkAddMode ? (
          <div className="space-y-2">
            <textarea
              value={bulkWorkerNames}
              onChange={(e) => setBulkWorkerNames(e.target.value)}
              placeholder="작업자 이름을 한 줄씩 입력하세요&#10;예:&#10;김태환&#10;문제용&#10;문제원"
              className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-primary-blue focus:border-primary-blue h-24 resize-none"
              aria-label="Bulk worker names"
            />
            <div className="flex gap-2">
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value as Team)}
                className="bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-slate-800 focus:ring-2 focus:ring-primary-blue focus:border-primary-blue"
                aria-label="Select worker team"
              >
                {TEAMS.map(team => <option key={team} value={team}>{team}</option>)}
              </select>
              <button
                onClick={handleBulkAdd}
                className="bg-green-600 hover:opacity-90 text-white font-bold py-2 px-4 rounded-md transition-opacity duration-200"
              >
                일괄 추가
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newWorkerName}
              onChange={(e) => setNewWorkerName(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="새 작업자 이름 입력"
              className="flex-grow bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-primary-blue focus:border-primary-blue"
              aria-label="New worker name"
            />
            <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value as Team)}
                className="bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-slate-800 focus:ring-2 focus:ring-primary-blue focus:border-primary-blue"
                aria-label="Select worker team"
            >
                {TEAMS.map(team => <option key={team} value={team}>{team}</option>)}
            </select>
            <button
              onClick={handleAddClick}
              className="bg-primary-blue hover:opacity-90 text-white font-bold py-2 px-4 rounded-md transition-opacity duration-200"
            >
              + 작업자 추가
            </button>
          </div>
        )}
      </div>
      
      <div className="border-t border-slate-200 pt-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-md font-semibold text-slate-700">등록된 작업자</h3>
          {editMode && (
            <span className="text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded">
              ⚠️ 수정 모드: 작업자를 삭제할 수 있습니다
            </span>
          )}
        </div>
        {filteredWorkers.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            {filteredWorkers.map(worker => (
              <div key={worker.id} className="flex items-center rounded-md overflow-hidden shadow-sm bg-slate-100 border border-slate-200" role="group">
                {editingWorkerId === worker.id ? (
                  // 편집 모드
                  <div className="flex items-center">
                    <select
                      value={editingTeam}
                      onChange={(e) => setEditingTeam(e.target.value as Team)}
                      className="px-2 py-2 text-xs font-bold bg-blue-100 border border-slate-300 focus:ring-1 focus:ring-blue-500 rounded"
                    >
                      {TEAMS.map(team => <option key={team} value={team}>{team}</option>)}
                    </select>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="py-2 px-3 flex-1 text-sm font-medium text-slate-700 bg-white border border-slate-300 focus:ring-1 focus:ring-blue-500 rounded"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      autoFocus
                    />
                    <div className="flex items-center">
                      <button
                        onClick={handleSaveEdit}
                        className="px-2 py-1 bg-green-600 text-white hover:bg-green-700 transition-colors rounded text-xs"
                        title="저장"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-2 py-1 bg-slate-500 text-white hover:bg-slate-600 transition-colors rounded text-xs"
                        title="취소"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  // 일반 모드
                  <div className="flex items-center">
                    <span className={`px-2 py-2 text-xs font-bold ${TEAM_BADGE_COLORS[worker.team]} rounded`}>{worker.team}</span>
                    <span className="py-2 px-4 text-sm font-medium text-slate-700 truncate">{worker.name}</span>
                    {editMode && (
                      <div className="flex items-center">
                        <button
                          onClick={() => handleStartEdit(worker)}
                          className="px-2 py-1 bg-blue-500 text-white hover:bg-blue-600 transition-colors rounded text-xs"
                          title="편집"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete worker ${worker.name}`}
                          title={editMode ? `Delete ${worker.name}` : '수정 모드를 활성화하여 삭제하세요'}
                          onClick={() => editMode && onDeleteWorker(worker.id)}
                          disabled={!editMode}
                          className={`px-2 py-1 rounded text-xs transition-colors duration-200 ${
                            editMode 
                              ? 'bg-slate-200 text-slate-500 hover:bg-red-500 hover:text-white cursor-pointer' 
                              : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                          }`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500">
             {workers.length === 0 
               ? '등록된 작업자가 없습니다.' 
               : searchTerm 
                 ? `'${searchTerm}'에 해당하는 작업자가 없습니다.`
                 : '선택된 팀에 등록된 작업자가 없습니다.'
             }
          </p>
        )}
      </div>
    </div>
  );
};

export default WorkerManager;