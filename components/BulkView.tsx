import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { Project, Worker, Team, Process } from '../types';
import StatusCell from './StatusCell';
import { GENERAL_PROCESSES, ADULT_INTERNAL_AI_PROCESSES, ADULT_COPE_INTER_PROCESSES } from '../constants';

type SortOrder = 'alphabetical' | 'lastModified' | 'team' | 'type' | 'progress' | 'episodeCount';

interface BulkViewProps {
  projects: Project[];
  workers: Worker[];
  onCellChange: (projectId: string, processId: number, episode: number, newCellState: any) => void;
  onAssigneeChange: (projectId: string, processId: number, newAssigneeId: string) => void;
  onEpisodeCompletionToggle: (projectId: string, episode: number, isComplete: boolean) => void;
  onSelectProject: (projectId: string, bulkViewState?: any) => void;
  restoredBulkViewState?: any;
}

const BulkView: React.FC<BulkViewProps> = ({
  projects,
  workers,
  onCellChange,
  onAssigneeChange,
  onEpisodeCompletionToggle,
  onSelectProject,
  restoredBulkViewState,
}) => {
  const DEFAULT_CELL_STATE = { status: 'none', text: '' };
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('alphabetical');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'completed'>('all');
  const [adultSubTypeFilter, setAdultSubTypeFilter] = useState<'all' | 'internal-ai' | 'cope-inter'>('all');
  const [showCompletedManuscriptsOnly, setShowCompletedManuscriptsOnly] = useState(false);
  const [isCompactView, setIsCompactView] = useState(false);
  
  // 체크박스 필터 상태
  const [checkboxFilter, setCheckboxFilter] = useState<{
    type: 'all' | 'checked' | 'unchecked';
    field: 'hasGeneralCover' | 'hasAdultCover' | 'hasLogo' | 'hasCharacterSheet' | 'hasSynopsis' | 'hasProposal' | 'none';
  }>({
    type: 'all',
    field: 'none'
  });

  const handleSortChange = useCallback((newOrder: SortOrder) => {
    if (newOrder === sortOrder) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortOrder(newOrder);
      setSortDirection('desc');
    }
  }, [sortOrder]);

  // 복원된 BulkView 상태 적용
  useEffect(() => {
    if (restoredBulkViewState) {
      if (restoredBulkViewState.searchTerm !== undefined) setSearchTerm(restoredBulkViewState.searchTerm);
      if (restoredBulkViewState.sortOrder !== undefined) setSortOrder(restoredBulkViewState.sortOrder);
      if (restoredBulkViewState.sortDirection !== undefined) setSortDirection(restoredBulkViewState.sortDirection);
      if (restoredBulkViewState.statusFilter !== undefined) setStatusFilter(restoredBulkViewState.statusFilter);
      if (restoredBulkViewState.adultSubTypeFilter !== undefined) setAdultSubTypeFilter(restoredBulkViewState.adultSubTypeFilter);
      if (restoredBulkViewState.showCompletedManuscriptsOnly !== undefined) setShowCompletedManuscriptsOnly(restoredBulkViewState.showCompletedManuscriptsOnly);
      if (restoredBulkViewState.isCompactView !== undefined) setIsCompactView(restoredBulkViewState.isCompactView);
      if (restoredBulkViewState.checkboxFilter !== undefined) setCheckboxFilter(restoredBulkViewState.checkboxFilter);
    }
  }, [restoredBulkViewState]);

  // 모든 프로젝트에서 동일하게 표시할 마스터 프로세스 리스트 (ID 1-8 고정)
  const masterProcessList = useMemo(() => {
    const allProcesses = new Map<number, Process>();
    
    // 일반 작품 프로세스 추가
    GENERAL_PROCESSES.forEach(p => allProcesses.set(p.id, p));
    
    // 19금 사내AI 프로세스 추가
    ADULT_INTERNAL_AI_PROCESSES.forEach(p => allProcesses.set(p.id, p));
    
    // 19금 코페인터 프로세스 추가
    ADULT_COPE_INTER_PROCESSES.forEach(p => allProcesses.set(p.id, p));
    
    // ID 1부터 8까지 강제로 모든 행을 생성 (없는 프로세스는 기본값으로 생성)
    const fixedProcessList: Process[] = [];
    for (let id = 1; id <= 8; id++) {
      const existingProcess = allProcesses.get(id);
      if (existingProcess) {
        fixedProcessList.push(existingProcess);
      } else {
        // 없는 프로세스는 기본 이름으로 생성
        fixedProcessList.push({ id, name: `${id}_프로세스`, assignee: "" });
      }
    }
    
    return fixedProcessList;
  }, []);


  // 검색 및 정렬된 프로젝트 목록
  const filteredAndSortedProjects = useMemo(() => {
    let filtered = projects.filter(project => {
      // 검색어 필터 (띄어쓰기 무시하고 검색)
      const normalizedSearchTerm = searchTerm.toLowerCase().replace(/\s+/g, '');
      const lowercasedSearchTerm = normalizedSearchTerm; // backward-compat alias for cached bundles
      const normalizedTitle = project.title.toLowerCase().replace(/\s+/g, '');
      const matchesTitle = normalizedTitle.includes(normalizedSearchTerm);

      // 작업자 이름 검색
      const assignedWorkerIds = new Set(project.processes.map(p => p.assignee).filter(Boolean));
      const assignedWorkerNames = workers
        .filter(w => assignedWorkerIds.has(w.id))
        .map(w => w.name.toLowerCase());
      
      const matchesWorker = assignedWorkerNames.some(name => name.includes(normalizedSearchTerm));
      
      const matchesSearch = matchesTitle || matchesWorker;
      
      // 상태 필터
      let matchesStatus = true;
      if (statusFilter === 'live') {
        matchesStatus = project.status !== 'completed'; // 완결이 아닌 모든 상태 (제작중, 연재예정, 라이브중)
      } else if (statusFilter === 'completed') {
        matchesStatus = project.status === 'completed';
      }

      // 19금 하위 타입 필터
      let matchesAdultSubType = true;
      if (adultSubTypeFilter !== 'all') {
        if (project.type !== 'adult') {
          matchesAdultSubType = false;
        } else {
          matchesAdultSubType = project.adultSubType === adultSubTypeFilter;
        }
      }

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
      
      return matchesSearch && matchesStatus && matchesAdultSubType && matchesCheckbox;
    });

    // 진행률 계산 함수
    const calculateProgress = (project: Project) => {
      if (project.processes.length === 0 || project.episodeCount === 0) {
        return 0;
      }
      const totalTasks = project.processes.length * project.episodeCount;
      let completedTasks = 0;
      for (const process of project.processes) {
        for (let episode = 1; episode <= project.episodeCount; episode++) {
          const key = `${process.id}-${episode}`;
          const cellState = project.statuses?.[key];
          if (cellState && (cellState.status === 'done' || cellState.status === 'final')) {
            completedTasks++;
          }
        }
      }
      return (completedTasks / totalTasks) * 100;
    };

    // 정렬
    filtered.sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;

      switch (sortOrder) {
        case 'alphabetical':
          return a.title.localeCompare(b.title) * direction;
        
        case 'team':
          const teamCompare = a.team.localeCompare(b.team);
          if (teamCompare !== 0) return teamCompare * direction;
          return a.title.localeCompare(b.title) * direction;
        
        case 'episodeCount':
          return (a.episodeCount - b.episodeCount) * direction;

        case 'type':
          if (a.type !== b.type) {
            return a.type === 'adult' ? -1 : 1; // 19금 작품을 항상 위로
          }
          if (a.type === 'adult' && b.type === 'adult') {
            const aSubType = a.adultSubType || 'internal-ai';
            const bSubType = b.adultSubType || 'internal-ai';
            // direction이 desc일 때 internal-ai가 위로, asc일 때 cope-inter가 위로
            return bSubType.localeCompare(aSubType) * direction;
          }
          return a.title.localeCompare(b.title) * direction;

        case 'progress':
          const progressA = calculateProgress(a);
          const progressB = calculateProgress(b);
          return (progressA - progressB) * direction;

        case 'lastModified':
        default:
          return ((a.lastModified || 0) - (b.lastModified || 0)) * direction;
      }
    });

    return filtered;
  }, [projects, workers, searchTerm, sortOrder, statusFilter, sortDirection, adultSubTypeFilter, checkboxFilter]);

  const completedManuscriptsProjects = useMemo(() => {
    return filteredAndSortedProjects
      .map(project => {
        const completedEpisodes: number[] = [];
        if (project.processes.length > 0) {
          for (let i = 1; i <= project.episodeCount; i++) {
            const isEpisodeComplete = project.processes.every(proc => {
              const key = `${proc.id}-${i}`;
              const status = project.statuses[key]?.status;
              return status === 'done' || status === 'final';
            });
            if (isEpisodeComplete) {
              completedEpisodes.push(i);
            }
          }
        }
        return {
          ...project,
          completedEpisodes,
        };
      });
  }, [filteredAndSortedProjects]);

  const sortedCompletedManuscriptsProjects = useMemo(() => {
    const sortable = [...completedManuscriptsProjects];
    if (sortOrder === 'progress') {
      sortable.sort((a, b) => b.completedEpisodes.length - a.completedEpisodes.length);
    }
    return sortable;
  }, [completedManuscriptsProjects, sortOrder]);

  const maxEpisodeCount = useMemo(() => {
    if (projects.length === 0) return 0;
    return Math.max(...projects.map(p => p.episodeCount));
  }, [projects]);

  const handleBulkDownload = () => {
    try {
      // xlsx 라이브러리 동적 import
      import('xlsx').then((XLSX) => {
        // 헤더 행 생성
        const headers = [
          '제목', '글작가', '그림작가', '회차수', '줄거리', '팀', '작품 타입', '제작방식', 
          '상태', 'ISBN/UCI', '일반표지', '성인표지', '로고', '캐릭터시트', '줄거리 완료'
        ];

        // 모든 프로젝트의 데이터 행 생성
        const dataRows = filteredAndSortedProjects.map(project => [
          project.title,
          project.storyWriter || '미지정',
          project.artWriter || '미지정',
          project.episodeCount.toString(),
          project.synopsis || '줄거리 없음',
          project.team,
          project.type === 'adult' ? '19금' : '일반',
          project.type === 'adult' && project.adultSubType ? 
            (project.adultSubType === 'internal-ai' ? '사내AI' : '코페인터') : '-',
          project.status === 'production' ? '제작중' : 
            project.status === 'scheduled' ? '연재예정' : 
            project.status === 'live' ? '라이브중' : '완결',
          project.identifierValue || '미지정',
          project.hasGeneralCover ? 'O' : 'X',
          project.hasAdultCover ? 'O' : 'X',
          project.hasLogo ? 'O' : 'X',
          project.hasCharacterSheet ? 'O' : 'X',
          project.hasSynopsis ? 'O' : 'X'
        ]);

        // 헤더와 데이터 결합
        const allData = [headers, ...dataRows];

        // 워크시트 생성
        const ws = XLSX.utils.aoa_to_sheet(allData);
        
        // 컬럼 너비 설정
        ws['!cols'] = [
          { width: 25 }, // 제목
          { width: 15 }, // 글작가
          { width: 15 }, // 그림작가
          { width: 8 },  // 회차수
          { width: 50 }, // 줄거리
          { width: 8 },  // 팀
          { width: 12 }, // 작품 타입
          { width: 12 }, // 제작방식
          { width: 10 }, // 상태
          { width: 15 }, // ISBN/UCI
          { width: 10 }, // 일반표지
          { width: 10 }, // 성인표지
          { width: 8 },  // 로고
          { width: 12 }, // 캐릭터시트
          { width: 12 }  // 줄거리 완료
        ];
        
        // 워크북 생성
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '전체 작품 서지정보');
        
        // 파일명 생성
        const today = new Date().toISOString().split('T')[0];
        const fileName = `전체작품_서지정보_${today}.xlsx`;
        
        // 파일 다운로드
        XLSX.writeFile(wb, fileName);
      });
    } catch (error) {
      console.error('일괄 서지정보 다운로드 중 오류:', error);
      alert('서지정보 일괄 다운로드에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-8 p-4">
      {/* 검색 및 정렬 컨트롤 */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200 p-4">
        <div className="space-y-4">
          {/* 검색 */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">작품/작업자 검색</label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="작품명 또는 작업자명으로 검색..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-blue focus:border-primary-blue text-sm"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* 컨트롤 버튼들 - 한 줄에 배치 */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* 정렬 라벨과 버튼들 */}
            <span className="text-xs font-medium text-slate-700">정렬</span>
            <div className="flex bg-slate-100 rounded-lg p-1 flex-wrap">
              <button
                onClick={() => handleSortChange('alphabetical')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  sortOrder === 'alphabetical'
                    ? 'bg-primary-blue text-white'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                이름순
              </button>
              <button
                onClick={() => handleSortChange('team')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  sortOrder === 'team'
                    ? 'bg-primary-blue text-white'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                팀별
              </button>
              <button
                onClick={() => handleSortChange('type')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  sortOrder === 'type'
                    ? 'bg-primary-blue text-white'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                타입별
              </button>
              <button
                onClick={() => handleSortChange('lastModified')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  sortOrder === 'lastModified'
                    ? 'bg-primary-blue text-white'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                최근수정
              </button>
              <button
                onClick={() => handleSortChange('progress')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  sortOrder === 'progress'
                    ? 'bg-primary-blue text-white'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                진행상황
              </button>
              <button
                onClick={() => handleSortChange('episodeCount')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  sortOrder === 'episodeCount'
                    ? 'bg-primary-blue text-white'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                회차별
              </button>
            </div>

            {/* 작품 상태 라벨과 버튼들 */}
            <span className="text-xs font-medium text-slate-700 ml-4">작품 상태</span>
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-primary-blue text-white'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                전체보기
              </button>
              <button
                onClick={() => setStatusFilter('live')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === 'live'
                    ? 'bg-primary-blue text-white'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                라이브 작품
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === 'completed'
                    ? 'bg-primary-blue text-white'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                완결작
              </button>
            </div>
            
            {/* 제작방식 필터 버튼들 */}
            <span className="text-xs font-medium text-slate-700 ml-4">제작방식</span>
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setAdultSubTypeFilter('all')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  adultSubTypeFilter === 'all'
                    ? 'bg-primary-blue text-white'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                전체
              </button>
              <button
                onClick={() => setAdultSubTypeFilter('internal-ai')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  adultSubTypeFilter === 'internal-ai'
                    ? 'bg-primary-blue text-white'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                사내AI
              </button>
              <button
                onClick={() => setAdultSubTypeFilter('cope-inter')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  adultSubTypeFilter === 'cope-inter'
                    ? 'bg-primary-blue text-white'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                코페인터
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* 체크박스 필터 */}
              <div className="flex bg-slate-100 rounded-lg p-1">
                <select
                  value={checkboxFilter.field}
                  onChange={(e) => setCheckboxFilter(prev => ({ ...prev, field: e.target.value as any }))}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-md border-0 bg-transparent focus:ring-0"
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
                    <div className="flex ml-2">
                      <button
                        onClick={() => setCheckboxFilter(prev => ({ ...prev, type: 'all' }))}
                        className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          checkboxFilter.type === 'all'
                            ? 'bg-primary-blue text-white'
                            : 'text-slate-600 hover:text-slate-800'
                        }`}
                      >
                        전체
                      </button>
                      <button
                        onClick={() => setCheckboxFilter(prev => ({ ...prev, type: 'checked' }))}
                        className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          checkboxFilter.type === 'checked'
                            ? 'bg-green-600 text-white'
                            : 'text-slate-600 hover:text-slate-800'
                        }`}
                      >
                        체크됨
                      </button>
                      <button
                        onClick={() => setCheckboxFilter(prev => ({ ...prev, type: 'unchecked' }))}
                        className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          checkboxFilter.type === 'unchecked'
                            ? 'bg-red-600 text-white'
                            : 'text-slate-600 hover:text-slate-800'
                        }`}
                      >
                        체크안됨
                      </button>
                    </div>
                  )}
              </div>

              {/* 작게보기 버튼 */}
              <button
                onClick={() =>
                  setIsCompactView(prev => {
                    const next = !prev;
                    if (next && showCompletedManuscriptsOnly) {
                      setShowCompletedManuscriptsOnly(false);
                    }
                    return next;
                  })
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue/50 ${
                  isCompactView
                    ? 'bg-primary-blue text-white shadow'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-300'
                }`}
              >
                {isCompactView ? '자세히 보기' : '작게 보기'}
              </button>

              {/* 완성원고만 보기 버튼 */}
              <button
                onClick={() => setShowCompletedManuscriptsOnly(!showCompletedManuscriptsOnly)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue/50 ${
                  showCompletedManuscriptsOnly
                    ? 'bg-primary-blue text-white shadow'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-300'
                }`}
              >
                완성원고만 보기
              </button>
              
              {/* 일괄 다운로드 버튼 */}
              <button
                onClick={handleBulkDownload}
                className="px-3 py-1.5 bg-white text-slate-600 hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                서지정보 일괄 다운로드
              </button>
            </div>
          </div>

          {/* 필터 결과 정보 */}
          <div className="mt-3 text-sm text-slate-600">
            {searchTerm && `"${searchTerm}" 검색 결과: `}
            {statusFilter === 'all' && '전체 '}
            {statusFilter === 'live' && '라이브 '}
            {statusFilter === 'completed' && '완결 '}
            작품 {filteredAndSortedProjects.length}개
          </div>
        </div>
      </div>

      {showCompletedManuscriptsOnly ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {sortedCompletedManuscriptsProjects.map(project => (
            <div key={project.id} className="bg-white rounded-lg shadow-md border border-slate-200 p-2 flex flex-col">
              <div className="flex items-center gap-2 mb-1.5">
                <h3 
                  className="text-xs font-semibold text-slate-800 cursor-pointer hover:text-primary-blue transition-colors"
                  onClick={() => onSelectProject(project.id, {
                    searchTerm,
                    sortOrder,
                    sortDirection,
                    statusFilter,
                    adultSubTypeFilter,
                    showCompletedManuscriptsOnly,
                    isCompactView,
                    checkboxFilter
                  })}
                >
                  {project.title}
                </h3>
                {project.memo && (
                  <div className="flex items-center" title="메모 있음">
                    <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1 mt-auto pt-1">
                {project.completedEpisodes.map(episodeNum => (
                  <div 
                    key={episodeNum} 
                    className="flex items-center justify-center w-6 h-6 bg-[#4A854C] text-white rounded text-xs font-bold shadow"
                    title={`${episodeNum}화 완성`}
                  >
                    {episodeNum}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {completedManuscriptsProjects.length === 0 && (
            <div className="col-span-full text-center py-10 text-slate-500">
              완성된 원고가 있는 작품이 없습니다.
            </div>
          )}
        </div>
      ) : isCompactView ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredAndSortedProjects.map(project => (
            <div key={project.id} className="bg-white rounded-lg shadow-md border border-slate-200 p-2">
              {/* Project Header */}
              <div className="flex items-center flex-wrap gap-2 mb-2 pb-2 border-b border-slate-200">
                <h3 
                  className="font-semibold text-slate-800 cursor-pointer hover:text-primary-blue text-xs"
                  onClick={() => onSelectProject(project.id, {
                    searchTerm,
                    sortOrder,
                    sortDirection,
                    statusFilter,
                    adultSubTypeFilter,
                    showCompletedManuscriptsOnly,
                    isCompactView,
                    checkboxFilter
                  })}
                >
                  {project.title}
                </h3>
                <span className="text-[10px] text-slate-500">({project.team})</span>
                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                  project.type === 'adult' 
                    ? 'bg-red-100 text-red-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {project.type === 'adult' ? '19금' : '일반'}
                </span>
                {project.type === 'adult' && (
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                    project.adultSubType === 'cope-inter'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-orange-100 text-orange-800'
                  }`}>
                    {project.adultSubType === 'cope-inter' ? '코페인터' : '사내AI'}
                  </span>
                )}
                {project.memo && (
                  <div className="flex items-center" title="메모 있음">
                    <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                )}
                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full 
                  ${project.status === 'production'
                    ? 'bg-yellow-100 text-yellow-800'
                    : project.status === 'scheduled'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-green-100 text-green-800'
                  }`}>
                  {project.status === 'production' ? '제작중' : 
                   project.status === 'scheduled' ? '연재예정' : 
                   project.status === 'live' ? '라이브중' : '완결'}
                </span>
              </div>

              {/* Mini Tracker */}
              <div className="space-y-1">
                {project.processes.map(process => (
                  <div key={process.id} className="flex items-start">
                    <div className="w-24 text-[11px] text-slate-700 truncate pr-2 pt-0.5">{process.name}</div>
                    <div className="flex flex-wrap gap-0.5 flex-1">
                      {Array.from({ length: project.episodeCount }, (_, i) => (project.startEpisode || 1) + i)
                        .filter(ep => !project.hiddenEpisodes?.includes(ep))
                        .map(ep => {
                        const status = project.statuses[`${process.id}-${ep}`]?.status || 'none';
                        const statusStyles = {
                          none: 'bg-white border-slate-300 text-slate-400',
                          inProgress: 'bg-yellow-400 border-yellow-500 text-white',
                          done: 'bg-green-500 border-green-600 text-white',
                          final: 'bg-green-500 border-green-600 text-white',
                        };
                        
                        return (
                          <div 
                            key={ep} 
                            className={`flex items-center justify-center w-5 h-5 rounded-sm border text-[10px] font-semibold ${statusStyles[status]}`} 
                            title={`${process.name} ${ep}화: ${status}`}
                          >
                            {ep}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        filteredAndSortedProjects.map(project => (
          <div key={project.id} className="bg-white rounded-lg shadow-md border border-slate-200 overflow-x-auto">
            {/* 프로젝트 제목 */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center flex-wrap gap-2">
                <h3 
                  className="text-lg font-semibold text-slate-700 cursor-pointer hover:text-primary-blue transition-colors"
                  onClick={() => onSelectProject(project.id, {
                    searchTerm,
                    sortOrder,
                    sortDirection,
                    statusFilter,
                    adultSubTypeFilter,
                    showCompletedManuscriptsOnly,
                    isCompactView,
                    checkboxFilter
                  })}
                >
                  {project.title}
                </h3>
                <span className="text-sm text-slate-500">({project.team})</span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  project.type === 'adult' 
                    ? 'bg-red-100 text-red-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {project.type === 'adult' ? '19금' : '일반'}
                  {project.type === 'adult' && project.adultSubType && (
                    <span className="ml-1">
                      ({project.adultSubType === 'internal-ai' ? '사내AI' : '코페인터'})
                    </span>
                  )}
                </span>
                {project.memo && (
                  <div className="flex items-center" title="메모 있음">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                )}
                <span className={`px-2 py-1 text-xs font-medium rounded-full 
                  ${project.status === 'production'
                    ? 'bg-yellow-100 text-yellow-800'
                    : project.status === 'scheduled'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-green-100 text-green-800'
                  }`}>
                  {project.status === 'production' ? '제작중' : 
                   project.status === 'scheduled' ? '연재예정' : 
                   project.status === 'live' ? '라이브중' : '완결'}
                </span>
              </div>
              <span className="text-xs text-slate-400">
                {project.episodeCount}화 | 
                {new Date(project.lastModified || Date.now()).toLocaleDateString('ko-KR')}
              </span>
            </div>
            
            {/* 테이블 */}
            <div 
              className="overflow-x-auto max-h-[70vh] overflow-y-auto"
              onContextMenu={(e) => e.preventDefault()}
              onMouseDown={(e) => {
                if (e.button === 2) { // 오른쪽 마우스 버튼
                  e.preventDefault();
                }
              }}
            >
              <table 
                className="table-fixed text-xs text-left text-slate-600 border-collapse"
                style={{ width: `${140 + 140 + (Array.from({ length: project.episodeCount }, (_, i) => (project.startEpisode || 1) + i).filter(episode => !project.hiddenEpisodes?.includes(episode)).length * 72)}px` }}
                onContextMenu={(e) => e.preventDefault()}
                onMouseDown={(e) => {
                  if (e.button === 2) { // 오른쪽 마우스 버튼
                    e.preventDefault();
                  }
                }}
              >
                <colgroup>
                  <col style={{ width: '140px' }} />
                  <col style={{ width: '140px' }} />
                  {Array.from({ length: project.episodeCount }, (_, i) => (project.startEpisode || 1) + i)
                    .filter(episode => !project.hiddenEpisodes?.includes(episode))
                    .map(episode => (
                    <col key={episode} style={{ width: '72px' }} />
                  ))}
                </colgroup>
                <thead className="text-xs text-slate-700 uppercase font-bold bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 bg-slate-200 text-center border border-slate-300">
                      구분
                    </th>
                    <th className="px-3 py-2 bg-slate-200 text-center border border-slate-300">
                      담당
                    </th>
                    {Array.from({ length: project.episodeCount }, (_, i) => (project.startEpisode || 1) + i)
                      .filter(episode => !project.hiddenEpisodes?.includes(episode))
                      .map(episode => (
                      <th key={episode} className="px-2 py-2 text-center border border-slate-300 bg-blue-100 text-primary-blue">
                        {episode}화
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody 
                  className="bg-white divide-y divide-slate-200"
                  onContextMenu={(e) => e.preventDefault()}
                  onMouseDown={(e) => {
                    if (e.button === 2) { // 오른쪽 마우스 버튼
                      e.preventDefault();
                    }
                  }}
                >
                  {masterProcessList.map((masterProcess, index) => {
                    const teamWorkers = workers.filter(w => w.team === project.team || w.team === '공통');
                    const projectProcess = project.processes.find(p => p.id === masterProcess.id);
                    const hasProcess = !!projectProcess;
                    
                    return (
                      <tr key={masterProcess.id} className={`border-b border-slate-200 ${!hasProcess ? 'opacity-40 bg-slate-50' : ''}`}>
                        <td className="px-3 py-2 text-xs font-medium text-slate-900 border border-slate-300 bg-slate-50">
                          {projectProcess ? projectProcess.name : masterProcess.name}
                        </td>
                        <td className="px-2 py-2 text-xs text-slate-500 border border-slate-300">
                          {hasProcess ? (
                            <select
                              value={projectProcess!.assignee}
                              onChange={(e) => onAssigneeChange(project.id, masterProcess.id, e.target.value)}
                              className="block w-full px-2 py-1 text-xs border-gray-300 focus:outline-none focus:ring-primary-blue focus:border-primary-blue rounded"
                            >
                              <option value="">선택</option>
                              {teamWorkers.map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                        {Array.from({ length: project.episodeCount }, (_, i) => (project.startEpisode || 1) + i)
                          .filter(episode => !project.hiddenEpisodes?.includes(episode))
                          .map(episode => {
                          if (!hasProcess) {
                            // 프로세스가 없는 경우 빈 셀 표시
                            return (
                              <td key={episode} className="p-1 border border-slate-300 bg-slate-100">
                                <div className="w-full h-8 bg-slate-200 rounded border border-slate-400 opacity-50"></div>
                              </td>
                            );
                          }

                          const cellKey = `${masterProcess.id}-${episode}`;
                          const cellState = project.statuses?.[cellKey] || DEFAULT_CELL_STATE;

                          return (
                            <StatusCell
                              key={episode}
                              cellState={cellState}
                              onCellChange={(newState) => onCellChange(project.id, masterProcess.id, episode, newState)}
                            />
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* 하단 전체 완료 체크박스 */}
            <div className="flex items-center p-4 border-t border-slate-200 bg-slate-50">
              <span className="text-sm font-medium text-slate-700 mr-4">전체 완료</span>
              {Array.from({ length: project.episodeCount }, (_, i) => (project.startEpisode || 1) + i)
                .filter(episode => !project.hiddenEpisodes?.includes(episode))
                .map(episode => {
                // 해당 프로젝트에 실제로 있는 프로세스들만 확인
                const projectProcesses = project.processes;
                const isAllComplete = projectProcesses.length > 0 && projectProcesses.every(process => {
                  const key = `${process.id}-${episode}`;
                  const cellState = project.statuses?.[key] || DEFAULT_CELL_STATE;
                  return cellState.status === 'done' || cellState.status === 'final';
                });
                
                return (
                  <input
                    key={episode}
                    type="checkbox"
                    className="form-checkbox h-4 w-4 text-primary-blue rounded focus:ring-primary-blue mr-2"
                    checked={isAllComplete}
                    onChange={(e) => onEpisodeCompletionToggle(project.id, episode, e.target.checked)}
                  />
                );
              })}
            </div>
          </div>
        )))}
    </div>
  );
};

export default BulkView;
