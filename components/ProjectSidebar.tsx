import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Project, ProjectStatus, Team, AdultSubType, Worker } from '../types';
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_BADGE_COLORS, TEAMS, PROJECT_TYPE_DOT_COLORS } from '../constants';

interface ProjectSidebarProps {
  projects: Project[];
  workers: Worker[];
  activeProjectId: string | null;
  sortOrder: 'lastModified' | 'alphabetical' | 'subType' | 'progress';
  sortDirection: 'asc' | 'desc';
  showCompletedOnly: boolean;
  onSelectProject: (id: string) => void;
  onAddProject: () => void;
  onDeleteProject: (id: string, title: string) => void;
  onSortOrderChange: (order: 'lastModified' | 'alphabetical' | 'subType' | 'progress') => void;
  onCompletedFilterChange: (showCompleted: boolean) => void;
  onFilteredProjectsChange?: (filteredProjects: Project[]) => void;
}

const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
  projects,
  workers,
  activeProjectId,
  sortOrder,
  sortDirection,
  showCompletedOnly,
  onSelectProject,
  onAddProject,
  onDeleteProject,
  onSortOrderChange,
  onCompletedFilterChange,
  onFilteredProjectsChange,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [teamFilter, setTeamFilter] = useState<Team | 'all'>('all');
  const [subTypeFilter, setSubTypeFilter] = useState<AdultSubType | 'all'>('all');
  const [deleteMode, setDeleteMode] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // 체크박스 필터 상태
  const [checkboxFilter, setCheckboxFilter] = useState<{
    type: 'all' | 'checked' | 'unchecked';
    field: 'hasGeneralCover' | 'hasAdultCover' | 'hasLogo' | 'hasCharacterSheet' | 'hasSynopsis' | 'hasProposal' | 'none';
  }>({
    type: 'all',
    field: 'none'
  });
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const projectRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (activeProjectId && projectRefs.current[activeProjectId]) {
      projectRefs.current[activeProjectId]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [activeProjectId]);
    
  const getSortButtonClass = (order: 'lastModified' | 'alphabetical' | 'subType' | 'progress') => {
    const base = 'flex-1 text-xs px-1.5 py-1 rounded transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-primary-blue/50';
    if (sortOrder === order) {
        return `${base} bg-primary-blue text-white shadow-inner`;
    }
    return `${base} bg-slate-200 hover:bg-slate-300 text-slate-700`;
  }

  const filteredProjects = useMemo(() => {
    if (!Array.isArray(projects)) {
      return [];
    }
    return projects.filter(project => {
      // 띄어쓰기 무시하고 검색
      const normalizedSearchTerm = searchTerm.toLowerCase().replace(/\s+/g, '');
      const normalizedTitle = project.title.toLowerCase().replace(/\s+/g, '');
      const matchesTitle = normalizedTitle.includes(normalizedSearchTerm);

      const assignedWorkerIds = new Set(project.processes.map(p => p.assignee).filter(Boolean));
      const assignedWorkerNames = workers
        .filter(w => assignedWorkerIds.has(w.id))
        .map(w => w.name.toLowerCase().replace(/\s+/g, ''));
      
      const matchesWorker = assignedWorkerNames.some(name => name.includes(normalizedSearchTerm));

      const matchesSearch = matchesTitle || matchesWorker;
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
      const matchesTeam = teamFilter === 'all' || project.team === teamFilter;
      const matchesSubType = subTypeFilter === 'all' || project.adultSubType === subTypeFilter;
      
      // 체크박스 필터
      let matchesCheckbox = true;
      if (checkboxFilter.field !== 'none') {
        const fieldValue = project[checkboxFilter.field] as boolean;
        if (checkboxFilter.type === 'checked') {
          matchesCheckbox = fieldValue === true;
        } else if (checkboxFilter.type === 'unchecked') {
          matchesCheckbox = fieldValue === false;
        }
      }
      
      return matchesSearch && matchesStatus && matchesTeam && matchesSubType && matchesCheckbox;
    });
  }, [projects, workers, searchTerm, statusFilter, teamFilter, subTypeFilter, checkboxFilter]);

  // 필터링된 작품 목록이 변경될 때마다 상위 컴포넌트에 알림
  useEffect(() => {
    if (onFilteredProjectsChange) {
      onFilteredProjectsChange(filteredProjects);
    }
  }, [filteredProjects, onFilteredProjectsChange]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3 sm:mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-800">작품 목록</h2>
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
              {filteredProjects.length} / {projects.length}
            </span>
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-md hover:bg-slate-100 transition-colors duration-200"
            aria-label={isCollapsed ? '펼치기' : '접기'}
            title={isCollapsed ? '펼치기' : '접기'}
          >
            <svg
              className={`w-4 h-4 text-slate-500 transform transition-transform duration-200 ${
                isCollapsed ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
        
        {!isCollapsed && (
          <>
                        <div className="space-y-2 mb-2 shrink-0">
              <div className="relative">
                <input
                  type="text"
                  placeholder="작품/작업자 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-primary-blue focus:border-primary-blue"
                />
                <svg className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* 드롭다운들을 한 줄에 가로 배치 */}
              <div className="grid grid-cols-3 gap-1.5">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | 'all')}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-700 focus:ring-1 focus:ring-primary-blue focus:border-primary-blue"
                >
                  <option value="all">전체 상태</option>
                  <option value="production">제작중</option>
                  <option value="scheduled">연재예정</option>
                  <option value="live">라이브중</option>
                  <option value="completed">완결</option>
                </select>
                
                <select
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value as Team | 'all')}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-700 focus:ring-1 focus:ring-primary-blue focus:border-primary-blue"
                >
                  <option value="all">전체 팀</option>
                  {TEAMS.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>

                <select
                  value={subTypeFilter}
                  onChange={(e) => setSubTypeFilter(e.target.value as AdultSubType | 'all')}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-700 focus:ring-1 focus:ring-primary-blue focus:border-primary-blue"
                >
                  <option value="all">제작방식 전체</option>
                  <option value="internal-ai">사내AI</option>
                  <option value="cope-inter">코페인터</option>
                </select>
              </div>
              
              {/* 체크박스 필터 */}
              <div className="flex items-center gap-1 mt-2">
                <select
                  value={checkboxFilter.field}
                  onChange={(e) => setCheckboxFilter(prev => ({ ...prev, field: e.target.value as any }))}
                  className="px-2 py-1.5 text-xs font-medium rounded border border-slate-300 bg-slate-50 focus:ring-1 focus:ring-primary-blue focus:border-primary-blue flex-1"
                >
                  <option value="none">체크박스</option>
                    <option value="hasGeneralCover">일반표지</option>
                    <option value="hasAdultCover">성인표지</option>
                    <option value="hasLogo">로고</option>
                    <option value="hasCharacterSheet">캐릭터시트</option>
                    <option value="hasSynopsis">줄거리</option>
                    <option value="hasProposal">소개서</option>
                  </select>
                  {checkboxFilter.field !== 'none' && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => setCheckboxFilter(prev => ({ ...prev, type: 'all' }))}
                        className={`px-2 py-1.5 text-xs font-medium rounded transition-colors ${
                          checkboxFilter.type === 'all'
                            ? 'bg-primary-blue text-white'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        전체
                      </button>
                      <button
                        onClick={() => setCheckboxFilter(prev => ({ ...prev, type: 'checked' }))}
                        className={`px-2 py-1.5 text-xs font-medium rounded transition-colors ${
                          checkboxFilter.type === 'checked'
                            ? 'bg-green-600 text-white'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        체크됨
                      </button>
                      <button
                        onClick={() => setCheckboxFilter(prev => ({ ...prev, type: 'unchecked' }))}
                        className={`px-2 py-1.5 text-xs font-medium rounded transition-colors ${
                          checkboxFilter.type === 'unchecked'
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        체크안됨
                      </button>
                    </div>
                  )}
              </div>
            </div>

          <div className="flex gap-1.5 mb-1.5 mt-2">
          <button
            type="button"
            onClick={onAddProject}
            className="flex-1 bg-primary-blue hover:opacity-90 text-white font-medium py-1.5 px-2 rounded text-xs transition-opacity duration-200 shrink-0 flex items-center justify-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
            새 작품 추가
          </button>
          <button
            onClick={() => onCompletedFilterChange(!showCompletedOnly)}
            className={`px-2 py-1.5 text-xs font-medium rounded transition-colors duration-200 ${
              showCompletedOnly
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            완결작
          </button>
          <button
            type="button"
            onClick={() => setDeleteMode(!deleteMode)}
            className={`px-2 py-1.5 text-xs font-medium rounded transition-colors duration-200 ${
              deleteMode 
                ? 'bg-red-600 text-white hover:bg-red-700' 
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            삭제모드
          </button>
          </div>
          <div className="flex items-center bg-slate-100 rounded p-0.5 mb-1.5 text-xs border border-slate-200">
            <button onClick={() => onSortOrderChange('lastModified')} className={getSortButtonClass('lastModified')}>
              <span>수정한 날짜</span>
              {sortOrder === 'lastModified' && (
                <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
              )}
            </button>
            <button onClick={() => onSortOrderChange('alphabetical')} className={getSortButtonClass('alphabetical')}>
              <span>이름</span>
              {sortOrder === 'alphabetical' && (
                <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
              )}
            </button>
            <button onClick={() => onSortOrderChange('subType')} className={getSortButtonClass('subType')}>
              <span>제작방식</span>
              {sortOrder === 'subType' && (
                <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
              )}
            </button>
            <button onClick={() => onSortOrderChange('progress')} className={getSortButtonClass('progress')}>
              <span>진행상황</span>
              {sortOrder === 'progress' && (
                <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
              )}
            </button>
          </div>
          </>
        )}
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-3 sm:px-4 pb-4">
        <div className="space-y-1.5">
          {filteredProjects.map(project => (
            <div
              key={project.id}
              ref={el => projectRefs.current[project.id] = el}
              className={`p-2 rounded-md border cursor-pointer transition-all duration-200 ${
                activeProjectId === project.id
                  ? 'border-primary-blue bg-primary-blue/5 shadow-md'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
              }`}
              onClick={() => onSelectProject(project.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {/* 상단: 팀, 제작방식, 상태 배지들 */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{project.team}</span>
                    {project.type === 'adult' && project.adultSubType && (
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        project.adultSubType === 'internal-ai' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {project.adultSubType === 'internal-ai' ? '사내AI' : '코페인터'}
                      </span>
                    )}
                    {/* 상태 표시 */}
                    {project.status === 'production' && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                        <span className="text-xs text-yellow-700 font-medium">제작중</span>
                      </div>
                    )}
                    {project.status === 'scheduled' && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-xs text-green-700 font-medium">연재예정</span>
                      </div>
                    )}
                    {project.status === 'live' && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span className="text-xs text-red-700 font-medium">라이브중</span>
                      </div>
                    )}
                    {project.status === 'completed' && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                        <span className="text-xs text-gray-700 font-medium">완결</span>
                      </div>
                    )}
                    {/* 작품 타입 표시 */}
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${PROJECT_TYPE_DOT_COLORS[project.type]}`}
                      title={project.type === 'adult' ? '19금' : '일반'}
                    />
                  </div>
                  
                  {/* 하단: 제목 */}
                  <div>
                    <h3 className="font-medium text-slate-800 text-sm leading-tight">{project.title}</h3>
                  </div>
                </div>
                {deleteMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteProject(project.id, project.title);
                    }}
                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors duration-200"
                    title="삭제"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
          
          {filteredProjects.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <p className="text-sm">검색 결과가 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectSidebar;