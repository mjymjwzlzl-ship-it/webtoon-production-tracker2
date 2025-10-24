import React, { useState, useMemo } from 'react';
import type { Project, ProjectStatus, Team } from '../types';
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_BADGE_COLORS, TEAMS, PROJECT_TYPE_DOT_COLORS } from '../constants';

interface LaunchSidebarProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onAddProject: () => void;
  onDeleteProject: (id: string, title: string) => void;
  onAddPlatform: () => void;
}

const LaunchSidebar: React.FC<LaunchSidebarProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onAddProject,
  onDeleteProject,
  onAddPlatform,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [teamFilter, setTeamFilter] = useState<Team | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<'lastModified' | 'alphabetical'>('lastModified');

  const getSortButtonClass = (order: 'lastModified' | 'alphabetical') => {
    const base = 'flex-1 text-xs px-2 py-2 sm:py-1.5 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary-blue/50 min-h-[44px] sm:min-h-0';
    if (sortOrder === order) {
        return `${base} bg-primary-blue text-white shadow-inner`;
    }
    return `${base} bg-slate-200 hover:bg-slate-300 text-slate-700`;
  }

  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      // 띄어쓰기 무시하고 검색
      const normalizedSearchTerm = searchTerm.toLowerCase().replace(/\s+/g, '');
      const normalizedTitle = project.title.toLowerCase().replace(/\s+/g, '');
      const matchesSearch = normalizedTitle.includes(normalizedSearchTerm);
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
      const matchesTeam = teamFilter === 'all' || project.team === teamFilter;
      return matchesSearch && matchesStatus && matchesTeam;
    });
  }, [projects, searchTerm, statusFilter, teamFilter]);

  const sortedProjects = useMemo(() => {
    const sortable = [...filteredProjects];
    if (sortOrder === 'alphabetical') {
      sortable.sort((a, b) => a.title.localeCompare(b.title));
    } else { // 'lastModified'
      sortable.sort((a, b) => b.lastModified - a.lastModified);
    }
    return sortable;
  }, [filteredProjects, sortOrder]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 sm:p-4">
        <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-3 sm:mb-4 shrink-0">런칭 관리</h2>
        
        <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4 shrink-0">
          <div className="relative">
            <input
              type="text"
              placeholder="작품명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 sm:py-2 bg-slate-50 border border-slate-300 rounded-md text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-primary-blue focus:border-primary-blue min-h-[44px] sm:min-h-0"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | 'all')}
            className="w-full px-3 py-2 sm:py-2 bg-slate-50 border border-slate-300 rounded-md text-sm text-slate-700 focus:ring-2 focus:ring-primary-blue focus:border-primary-blue min-h-[44px] sm:min-h-0"
          >
            <option value="all">전체 상태</option>
            <option value="production">제작중</option>
            <option value="scheduled">연재예정</option>
            <option value="live">라이브중</option>
          </select>
          
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value as Team | 'all')}
            className="w-full px-3 py-2 sm:py-2 bg-slate-50 border border-slate-300 rounded-md text-sm text-slate-700 focus:ring-2 focus:ring-primary-blue focus:border-primary-blue min-h-[44px] sm:min-h-0"
          >
            <option value="all">전체 팀</option>
            {TEAMS.map(team => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2 mb-2 shrink-0">
          <button
            type="button"
            onClick={onAddProject}
            className="w-full bg-green-600 hover:opacity-90 text-white font-bold py-3 sm:py-2 px-4 rounded-md transition-opacity duration-200 flex items-center justify-center gap-2 min-h-[44px] sm:min-h-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
            새 작품 추가
          </button>
          
          <button
            type="button"
            onClick={onAddPlatform}
            className="w-full bg-blue-600 hover:opacity-90 text-white font-bold py-3 sm:py-2 px-4 rounded-md transition-opacity duration-200 flex items-center justify-center gap-2 min-h-[44px] sm:min-h-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
            플랫폼 추가
          </button>
        </div>
        <div className="flex items-center bg-slate-100 rounded-lg p-1 mb-2 sm:mb-3 text-sm border border-slate-200">
            <button onClick={() => setSortOrder('lastModified')} className={getSortButtonClass('lastModified')}>
                수정한 날짜
            </button>
            <button onClick={() => setSortOrder('alphabetical')} className={getSortButtonClass('alphabetical')}>
                이름
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 sm:px-4 pb-4">
        <div className="space-y-2">
          {sortedProjects.map(project => (
            <div
              key={project.id}
              className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                activeProjectId === project.id
                  ? 'border-green-600 bg-green-50 shadow-md'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
              }`}
              onClick={() => onSelectProject(project.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className={`w-2 h-2 rounded-full ${PROJECT_TYPE_DOT_COLORS[project.type]}`}
                      title={project.type === 'adult' ? '19금' : '일반'}
                    />
                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      {PROJECT_STATUS_BADGE_COLORS[project.status].label}
                    </span>
                  </div>
                  <h3 className="font-medium text-slate-800 truncate">{project.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">{project.team}</p>
                </div>
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
              </div>
            </div>
          ))}
          
          {sortedProjects.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <p className="text-sm">검색 결과가 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LaunchSidebar;
