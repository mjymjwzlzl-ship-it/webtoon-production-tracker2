import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import CalendarView from './CalendarView';
import { getKoreanToday } from '../utils/dateUtils';
import type { DailyTask, Worker, Project, Process } from '../types';

interface DailyTasksProps {
  workers: Worker[];
  projects: Project[];
  onTaskStatusChange?: (projectId: string, processId: number, episode: number, status: 'done' | 'none') => void;
}

interface WorkerAssignment {
  projectId: string;
  projectTitle: string;
  processId: number;
  processName: string;
  episodeCount: number;
}

const DailyTasks: React.FC<DailyTasksProps> = ({ workers, projects, onTaskStatusChange }) => {
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    getKoreanToday() // 한국 시간 기준 오늘 날짜
  );
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedProcessId, setSelectedProcessId] = useState<number | null>(null);
  const [selectedEpisodes, setSelectedEpisodes] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<string>('');
  const [isOverviewMode, setIsOverviewMode] = useState(false);
  const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
  const [taskType, setTaskType] = useState<'assigned' | 'custom'>('assigned');
  const [customTaskContent, setCustomTaskContent] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  // Firebase에서 오늘의 할일 데이터 실시간 구독
  useEffect(() => {
    console.log('Firebase 쿼리 시작:', selectedDate, 'viewMode:', viewMode);
    
    let q;
    
    if (viewMode === 'calendar') {
      // 캘린더 뷰에서는 현재 월의 모든 데이터 가져오기
      const currentMonth = new Date(selectedDate);
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      const startDate = startOfMonth.toISOString().split('T')[0];
      const endDate = endOfMonth.toISOString().split('T')[0];
      
      q = query(
        collection(db, 'dailyTasks'),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
    } else {
      // 리스트 뷰에서는 선택된 날짜만
      q = query(
        collection(db, 'dailyTasks'),
        where('date', '==', selectedDate)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('Firebase 데이터 수신:', snapshot.size, '개 문서');
      const tasks: DailyTask[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as DailyTask));
      
      // 클라이언트 사이드에서 정렬
      tasks.sort((a, b) => b.createdAt - a.createdAt);
      
      console.log('가져온 할일들:', tasks);
      setDailyTasks(tasks);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching daily tasks:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedDate, viewMode]);

  // 선택된 작업자의 배정된 작업들을 프로젝트별로 그룹화
  const workerAssignments = useMemo(() => {
    if (!selectedWorkerId) return [];
    
    const projectMap = new Map<string, {
      projectId: string;
      projectTitle: string;
      episodeCount: number;
      processes: { processId: number; processName: string; }[];
    }>();
    
    projects.forEach(project => {
      project.processes.forEach(process => {
        if (process.assignee === selectedWorkerId) {
          if (!projectMap.has(project.id)) {
            projectMap.set(project.id, {
              projectId: project.id,
              projectTitle: project.title,
              episodeCount: project.episodeCount,
              processes: []
            });
          }
          
          projectMap.get(project.id)!.processes.push({
            processId: process.id,
            processName: process.name
          });
        }
      });
    });
    
    return Array.from(projectMap.values());
  }, [selectedWorkerId, projects]);

  // 선택된 프로젝트의 해당 작업자 배정 프로세스들
  const availableProcesses = useMemo(() => {
    if (!selectedProjectId || !selectedWorkerId) return [];
    
    const assignment = workerAssignments.find(a => a.projectId === selectedProjectId);
    if (!assignment) return [];
    
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return [];
    
    return project.processes.filter(process => 
      process.assignee === selectedWorkerId &&
      assignment.processes.some(p => p.processId === process.id)
    );
  }, [selectedProjectId, selectedWorkerId, workerAssignments, projects]);

  // 선택된 날짜의 할일 목록 필터링
  const filteredTasks = useMemo(() => {
    let filtered = dailyTasks;

    // 작업자 필터
    if (selectedWorkerId) {
      filtered = filtered.filter(task => task.workerId === selectedWorkerId);
    }

    // 검색 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(task => 
        task.workerName.toLowerCase().includes(query) ||
        task.task.toLowerCase().includes(query) ||
        (task.projectTitle && task.projectTitle.toLowerCase().includes(query)) ||
        (task.processName && task.processName.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [dailyTasks, selectedWorkerId, searchQuery]);

  // 전체보기용 작업자별 할일 그룹화
  const overviewData = useMemo(() => {
    if (!isOverviewMode) return [];

    // 검색 필터 적용
    let tasksToGroup = dailyTasks;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      tasksToGroup = dailyTasks.filter(task => 
        task.workerName.toLowerCase().includes(query) ||
        task.task.toLowerCase().includes(query) ||
        (task.projectTitle && task.projectTitle.toLowerCase().includes(query)) ||
        (task.processName && task.processName.toLowerCase().includes(query))
      );
    }

    // 작업자별로 할일 그룹화
    const workerTaskMap = new Map<string, DailyTask[]>();
    
    tasksToGroup.forEach(task => {
      if (!workerTaskMap.has(task.workerId)) {
        workerTaskMap.set(task.workerId, []);
      }
      workerTaskMap.get(task.workerId)!.push(task);
    });

    // 작업자별 데이터 생성
    const result = workers.map(worker => {
      const tasks = workerTaskMap.get(worker.id) || [];
      return {
        worker,
        tasks,
        completedCount: tasks.filter(task => task.completed).length,
        totalCount: tasks.length
      };
    }).filter(item => {
      // 검색 중일 때는 할일이 있는 작업자만 표시
      if (searchQuery.trim()) {
        return item.totalCount > 0;
      }
      // 검색하지 않을 때는 모든 작업자 표시
      return true;
    });

    // 팀별, 가나다순 정렬
    result.sort((a, b) => {
      // 먼저 팀별로 정렬
      if (a.worker.team !== b.worker.team) {
        const teamOrder = ['0팀', '1팀', '공통'];
        return teamOrder.indexOf(a.worker.team) - teamOrder.indexOf(b.worker.team);
      }
      // 같은 팀 내에서 가나다순
      return a.worker.name.localeCompare(b.worker.name, 'ko');
    });

    return result;
  }, [isOverviewMode, dailyTasks, workers, searchQuery]);

  // 검색어 하이라이트 함수
  const highlightSearchTerm = (text: string, searchTerm: string) => {
    if (!searchTerm.trim()) return text;
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 px-1 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  // 팀별로 작업자 그룹화
  const workersByTeam = useMemo(() => {
    const teams = ['0팀', '1팀', '공통'] as const;
    const grouped: Record<string, Worker[]> = {};
    
    teams.forEach(team => {
      grouped[team] = workers
        .filter(worker => worker.team === team)
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    });
    
    return grouped;
  }, [workers]);

  // 팀 접기/펼치기 토글
  const toggleTeam = (team: string) => {
    setCollapsedTeams(prev => {
      const newSet = new Set(prev);
      if (newSet.has(team)) {
        newSet.delete(team);
      } else {
        newSet.add(team);
      }
      return newSet;
    });
  };

  // 에피소드 선택 토글
  const toggleEpisode = (episode: number) => {
    setSelectedEpisodes(prev => {
      if (prev.includes(episode)) {
        return prev.filter(e => e !== episode);
      } else {
        return [...prev, episode];
      }
    });
  };

  // 통합된 할일 추가
  const handleAddTask = async () => {
    if (!selectedWorkerId) {
      alert('작업자를 선택해주세요.');
      return;
    }

    const worker = workers.find(w => w.id === selectedWorkerId);
    if (!worker) {
      alert('작업자를 찾을 수 없습니다.');
      return;
    }

    if (taskType === 'assigned') {
      // 배정된 작업 추가
      if (!selectedProjectId || !selectedProcessId || selectedEpisodes.length === 0) {
        alert('프로젝트, 작업, 에피소드를 모두 선택해주세요.');
        return;
      }

      const project = projects.find(p => p.id === selectedProjectId);
      const process = project?.processes.find(p => p.id === selectedProcessId);

      if (!project || !process) {
        alert('선택된 데이터를 찾을 수 없습니다.');
        return;
      }

      try {
        // 선택된 각 에피소드에 대해 할일 생성
        const promises = selectedEpisodes.map(episode => {
          const taskDescription = `${project.title} - ${process.name} ${episode}화`;
          
          return addDoc(collection(db, 'dailyTasks'), {
            workerId: selectedWorkerId,
            workerName: worker.name,
            date: selectedDate,
            task: taskDescription,
            projectId: selectedProjectId,
            projectTitle: project.title,
            processId: selectedProcessId,
            processName: process.name,
            episode: episode,
            completed: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
        });

        await Promise.all(promises);
        alert(`${selectedEpisodes.length}개의 배정된 작업이 성공적으로 추가되었습니다!`);

        // 폼 초기화
        setSelectedProjectId('');
        setSelectedProcessId(null);
        setSelectedEpisodes([]);
      } catch (error) {
        console.error('Error adding assigned tasks:', error);
        alert(`배정된 작업 추가에 실패했습니다: ${error.message}`);
      }
    } else {
      // 기타 업무 추가
      if (!customTaskContent.trim()) {
        alert('업무 내용을 입력해주세요.');
        return;
      }

      try {
        await addDoc(collection(db, 'dailyTasks'), {
          workerId: selectedWorkerId,
          workerName: worker.name,
          date: selectedDate,
          task: customTaskContent.trim(),
          completed: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });

        alert('기타 업무가 성공적으로 추가되었습니다!');
        setCustomTaskContent('');
      } catch (error) {
        console.error('Error adding custom task:', error);
        alert(`기타 업무 추가에 실패했습니다: ${error.message}`);
      }
    }
  };

  // 할일 완료 상태 토글
  const handleToggleComplete = async (task: DailyTask) => {
    try {
      const newCompletedStatus = !task.completed;
      
      // 오늘의 할일 상태 업데이트
      await updateDoc(doc(db, 'dailyTasks', task.id), {
        completed: newCompletedStatus,
        updatedAt: Date.now()
      });

      // 배정된 작업인 경우 일정관리도 연동 업데이트
      if (task.projectId && task.processId && task.episode && onTaskStatusChange) {
        const newStatus = newCompletedStatus ? 'done' : 'none';
        onTaskStatusChange(task.projectId, task.processId, task.episode, newStatus);
      }
    } catch (error) {
      console.error('Error updating task:', error);
      alert('할일 업데이트에 실패했습니다.');
    }
  };

  // 캘린더 더블클릭 핸들러
  const handleCalendarDoubleClick = (date: string) => {
    setSelectedDate(date);
    setViewMode('list'); // 리스트 모드로 전환
    setIsAddingTask(true); // 할일 추가 모드 활성화
  };

  // 할일 수정 시작
  const handleStartEdit = (task: DailyTask) => {
    setEditingTaskId(task.id);
    setEditingTask(task.task);
  };

  // 할일 수정 완료
  const handleSaveEdit = async () => {
    if (!editingTaskId || !editingTask.trim()) return;

    try {
      await updateDoc(doc(db, 'dailyTasks', editingTaskId), {
        task: editingTask.trim(),
        updatedAt: Date.now()
      });

      setEditingTaskId(null);
      setEditingTask('');
    } catch (error) {
      console.error('Error updating task:', error);
      alert('할일 수정에 실패했습니다.');
    }
  };

  // 할일 수정 취소
  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditingTask('');
  };

  // 할일 삭제
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('정말로 이 할일을 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, 'dailyTasks', taskId));
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('할일 삭제에 실패했습니다.');
    }
  };

  // 날짜 변경 핸들러
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
    setLoading(true);
  };

  // 작업자 변경 핸들러
  const handleWorkerChange = (workerId: string) => {
    setSelectedWorkerId(workerId);
    setSelectedProjectId('');
    setSelectedProcessId(null);
    setSelectedEpisodes([]);
    setTaskType('assigned');
    setCustomTaskContent('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg font-semibold text-slate-600">오늘의 할일을 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <h2 className="text-2xl font-bold text-slate-800">오늘의 할일</h2>
          
          <div className="flex items-center gap-4">
            {/* 뷰 모드 토글 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 rounded-md font-medium transition-colors text-sm ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                목록
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-2 rounded-md font-medium transition-colors text-sm ${
                  viewMode === 'calendar'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                캘린더
              </button>
            </div>
            
            {/* 전체보기 토글 - 리스트 모드에서만 */}
            {viewMode === 'list' && (
              <button
                onClick={() => {
                  setIsOverviewMode(!isOverviewMode);
                  setSelectedWorkerId(''); // 전체보기 시 작업자 필터 초기화
                }}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  isOverviewMode
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {isOverviewMode ? '개별보기' : '전체보기'}
              </button>
            )}
            
            {/* 날짜 선택 */}
            <div className="flex items-center gap-2">
              <label htmlFor="date-select" className="text-sm font-medium text-slate-700">
                날짜:
              </label>
              <input
                id="date-select"
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                className="px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 할일 추가 폼 - 리스트 뷰의 개별보기 모드에서만 표시 */}
      {viewMode === 'list' && !isOverviewMode && (
      <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">새 할일 추가</h3>
        
        <div className="space-y-4">
          {/* 작업자 선택 */}
          <div>
            <label htmlFor="worker-select" className="block text-sm font-medium text-slate-700 mb-2">
              작업자 선택
            </label>
            <select
              id="worker-select"
              value={selectedWorkerId}
              onChange={(e) => handleWorkerChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">작업자를 선택하세요</option>
              {workers.map(worker => (
                <option key={worker.id} value={worker.id}>
                  {worker.name} ({worker.team})
                </option>
              ))}
            </select>
          </div>

          {/* 작업 유형 선택 */}
          {selectedWorkerId && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                작업 유형 선택
              </label>
              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => {
                    setTaskType('assigned');
                    setCustomTaskContent('');
                  }}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    taskType === 'assigned'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  배정된 작업
                </button>
                <button
                  onClick={() => {
                    setTaskType('custom');
                    setSelectedProjectId('');
                    setSelectedProcessId(null);
                    setSelectedEpisodes([]);
                  }}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    taskType === 'custom'
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  기타 업무
                </button>
              </div>
            </div>
          )}

          {/* 배정된 작업 목록 표시 - 컴팩트 버전 */}
          {selectedWorkerId && taskType === 'assigned' && workerAssignments.length > 0 && (
            <div className="bg-blue-50 p-3 rounded-lg mb-4">
              <h4 className="text-sm font-medium text-blue-800 mb-2">
                {workers.find(w => w.id === selectedWorkerId)?.name}님의 배정된 작업
              </h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {workerAssignments.map((assignment, index) => (
                  <div key={index} className="bg-white p-2 rounded border border-blue-200 text-xs">
                    <div className="font-medium text-slate-800 mb-1">{assignment.projectTitle}</div>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {assignment.processes.map((process, pIndex) => (
                        <span 
                          key={pIndex}
                          className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded"
                        >
                          {process.processName}
                        </span>
                      ))}
                    </div>
                    <div className="text-xs text-slate-500">{assignment.episodeCount}화</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 배정된 작업이 없는 경우 */}
          {selectedWorkerId && taskType === 'assigned' && workerAssignments.length === 0 && (
            <div className="bg-yellow-50 p-4 rounded-lg mb-4 border border-yellow-200">
              <div className="text-yellow-800 text-sm">
                {workers.find(w => w.id === selectedWorkerId)?.name}님에게 배정된 작업이 없습니다.
                "기타 업무"를 선택해서 자유롭게 할일을 추가해보세요.
              </div>
            </div>
          )}

          {/* 기타 업무 입력 */}
          {selectedWorkerId && taskType === 'custom' && (
            <div className="bg-orange-50 p-4 rounded-lg mb-4">
              <h4 className="text-sm font-medium text-orange-800 mb-3">
                기타 업무 입력 (자유 업무)
              </h4>
              <input
                type="text"
                value={customTaskContent}
                onChange={(e) => setCustomTaskContent(e.target.value)}
                placeholder="예: 회의 참석, 자료 정리, 클라이언트 미팅 등"
                className="w-full px-3 py-2 border border-orange-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
              />
            </div>
          )}

          {/* 프로젝트 선택 - 배정된 작업일 때만 */}
          {selectedWorkerId && taskType === 'assigned' && workerAssignments.length > 0 && (
            <div>
              <label htmlFor="project-select" className="block text-sm font-medium text-slate-700 mb-2">
                프로젝트 선택
              </label>
              <select
                id="project-select"
                value={selectedProjectId}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value);
                  setSelectedProcessId(null);
                  setSelectedEpisodes([]);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">프로젝트를 선택하세요</option>
                {workerAssignments.map((assignment) => (
                  <option key={assignment.projectId} value={assignment.projectId}>
                    {assignment.projectTitle} ({assignment.processes.length}개 작업)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 작업 선택 - 배정된 작업일 때만 */}
          {selectedWorkerId && taskType === 'assigned' && selectedProjectId && availableProcesses.length > 0 && (
            <div>
              <label htmlFor="process-select" className="block text-sm font-medium text-slate-700 mb-2">
                작업 선택
              </label>
              <select
                id="process-select"
                value={selectedProcessId || ''}
                onChange={(e) => {
                  setSelectedProcessId(Number(e.target.value));
                  setSelectedEpisodes([]);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">작업을 선택하세요</option>
                {availableProcesses.map(process => (
                  <option key={process.id} value={process.id}>
                    {process.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 에피소드 선택 - 배정된 작업일 때만 */}
          {selectedWorkerId && taskType === 'assigned' && selectedProjectId && selectedProcessId && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                에피소드 선택 ({selectedEpisodes.length}개 선택됨)
              </label>
              <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-40 overflow-y-auto p-2 border border-slate-300 rounded-md">
                {(() => {
                  const project = projects.find(p => p.id === selectedProjectId);
                  if (!project) return [];
                  return Array.from({ length: project.episodeCount }, (_, i) => project.startEpisode + i);
                })().map(episode => {
                  // 해당 에피소드가 일정관리에서 완료되었는지 확인
                  const project = projects.find(p => p.id === selectedProjectId);
                  const isEpisodeCompleted = project && selectedProcessId ? 
                    project.statuses[`${selectedProcessId}-${episode}`]?.status === 'done' : false;
                  
                  return (
                    <button
                      key={episode}
                      onClick={() => toggleEpisode(episode)}
                      className={`px-2 py-1 text-sm rounded transition-colors relative ${
                        selectedEpisodes.includes(episode)
                          ? 'bg-blue-600 text-white'
                          : isEpisodeCompleted
                          ? 'bg-green-100 text-green-800 border border-green-300'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                      title={isEpisodeCompleted ? `${episode}화 - 이미 완료됨` : `${episode}화`}
                    >
                      {episode}화
                      {isEpisodeCompleted && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-600 rounded-full flex items-center justify-center">
                          <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 완료된 에피소드 선택 안내 */}
          {selectedWorkerId && taskType === 'assigned' && selectedProjectId && selectedProcessId && selectedEpisodes.length > 0 && (
            (() => {
              const project = projects.find(p => p.id === selectedProjectId);
              const completedEpisodes = selectedEpisodes.filter(episode => 
                project?.statuses[`${selectedProcessId}-${episode}`]?.status === 'done'
              );
              
              return completedEpisodes.length > 0 && (
                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                  <div className="text-green-800 text-sm">
                    ✅ 선택된 에피소드 중 {completedEpisodes.join(', ')}화는 이미 완료된 작업입니다.
                  </div>
                </div>
              );
            })()
          )}

          {/* 추가 버튼 */}
          <div className="flex justify-end">
            {taskType === 'assigned' ? (
              selectedWorkerId && selectedProjectId && selectedProcessId && selectedEpisodes.length > 0 && (
                <button
                  onClick={handleAddTask}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  배정된 작업 추가 ({selectedEpisodes.length}개)
                </button>
              )
            ) : (
              selectedWorkerId && customTaskContent.trim() && (
                <button
                  onClick={handleAddTask}
                  className="px-6 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                >
                  기타 업무 추가
                </button>
              )
            )}
          </div>
        </div>
      </div>
      )}

      {/* 검색 기능 - 리스트 뷰에서만 */}
      {viewMode === 'list' && (
      <div className="bg-white p-4 rounded-lg shadow-md border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-sm font-medium text-slate-700">검색:</span>
          </div>
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="작업자명, 할일 내용, 프로젝트명으로 검색..."
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
              title="검색 초기화"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        
        {searchQuery && (
          <div className="mt-2 text-sm text-slate-500">
            "{searchQuery}" 검색 결과: {isOverviewMode ? 
              `${overviewData.reduce((sum, item) => sum + item.totalCount, 0)}개 할일` : 
              `${filteredTasks.length}개 할일`
            }
          </div>
        )}
      </div>
      )}

      {/* 작업자 필터 - 리스트 뷰의 개별보기 모드와 캘린더 모드에서 표시 */}
      {((viewMode === 'list' && !isOverviewMode) || viewMode === 'calendar') && (
      <div className="bg-white p-4 rounded-lg shadow-md border border-slate-200">
        <div className="mb-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">작업자 필터</span>
            <button
              onClick={() => setSelectedWorkerId('')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                !selectedWorkerId
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              전체 보기
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {Object.entries(workersByTeam).map(([team, teamWorkers]) => {
            if (teamWorkers.length === 0) return null;
            
            const isCollapsed = collapsedTeams.has(team);
            const getTeamStyles = (team: string) => {
              switch (team) {
                case '0팀':
                  return {
                    header: 'bg-blue-50 hover:bg-blue-100',
                    dot: 'bg-blue-500',
                    text: 'text-blue-800',
                    arrow: 'text-blue-600',
                    buttonActive: 'bg-blue-600 text-white',
                    buttonInactive: 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                  };
                case '1팀':
                  return {
                    header: 'bg-green-50 hover:bg-green-100',
                    dot: 'bg-green-500',
                    text: 'text-green-800',
                    arrow: 'text-green-600',
                    buttonActive: 'bg-green-600 text-white',
                    buttonInactive: 'bg-green-100 text-green-800 hover:bg-green-200'
                  };
                default: // 공통
                  return {
                    header: 'bg-blue-50 hover:bg-blue-100',
                    dot: 'bg-blue-500',
                    text: 'text-blue-800',
                    arrow: 'text-blue-600',
                    buttonActive: 'bg-blue-600 text-white',
                    buttonInactive: 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                  };
              }
            };

            const styles = getTeamStyles(team);
            
            return (
              <div key={team} className="border border-slate-200 rounded-lg overflow-hidden">
                {/* 팀 헤더 */}
                <button
                  onClick={() => toggleTeam(team)}
                  className={`w-full px-3 py-2 ${styles.header} transition-colors flex items-center justify-between`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${styles.dot}`}></div>
                    <span className={`font-medium ${styles.text}`}>{team}</span>
                    <span className="text-xs text-slate-500">({teamWorkers.length}명)</span>
                  </div>
                  <svg 
                    className={`w-4 h-4 ${styles.arrow} transition-transform duration-200 ${
                      isCollapsed ? '' : 'rotate-180'
                    }`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* 팀 작업자 목록 */}
                {!isCollapsed && (
                  <div className="p-3 bg-white">
                    <div className="flex flex-wrap gap-2">
                      {teamWorkers.map(worker => (
                        <button
                          key={worker.id}
                          onClick={() => setSelectedWorkerId(worker.id)}
                          className={`px-3 py-1 text-sm rounded-md transition-colors ${
                            selectedWorkerId === worker.id
                              ? styles.buttonActive
                              : styles.buttonInactive
                          }`}
                        >
                          {worker.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* 전체보기 모드 - 리스트 뷰에서만 */}
      {viewMode === 'list' && isOverviewMode ? (
        <div className="bg-white rounded-lg shadow-md border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800">
              {selectedDate}의 전체 할일 현황 (팀별/가나다순)
            </h3>
          </div>

          <div className="p-6">
            {overviewData.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-slate-500">작업자 정보를 불러오는 중...</div>
              </div>
            ) : (
              <div className="space-y-3">
                {overviewData.map(({ worker, tasks, completedCount, totalCount }) => (
                  <div
                    key={worker.id}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {/* 작업자 정보 */}
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          worker.team === '0팀' ? 'bg-blue-500' : 
                          worker.team === '1팀' ? 'bg-green-500' : 'bg-blue-500'
                        }`}></div>
                        <div>
                          <div className="font-medium text-slate-800">
                            {highlightSearchTerm(worker.name, searchQuery)}
                          </div>
                          <div className="text-xs text-slate-500">{worker.team}</div>
                        </div>
                      </div>

                      {/* 할일 목록 */}
                      <div className="flex-1">
                        {tasks.length === 0 ? (
                          <div className="text-sm text-slate-400 italic">할일 없음</div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {tasks.map((task, index) => (
                              <span
                                key={task.id}
                                className={`text-sm px-2 py-1 rounded ${
                                  task.completed
                                    ? 'bg-green-100 text-green-800'
                                    : task.projectTitle
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-orange-100 text-orange-800'
                                }`}
                              >
                                {task.projectTitle ? '' : '📋 '}
                                {highlightSearchTerm(task.task, searchQuery)}
                                {task.completed && ' ✓'}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 진행률 */}
                    <div className="flex items-center gap-2">
                      {totalCount > 0 && (
                        <div className="text-sm font-medium">
                          <span className={completedCount === totalCount ? 'text-green-600' : 'text-slate-600'}>
                            {completedCount}/{totalCount}
                          </span>
                        </div>
                      )}
                      {completedCount === totalCount && totalCount > 0 && (
                        <span className="px-2 py-1 bg-green-600 text-white text-xs font-bold rounded-full">
                          완료!
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : viewMode === 'list' ? (
        /* 개별보기 모드 - 기존 할일 목록 */
        <div className="bg-white rounded-lg shadow-md border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">
            {selectedDate}의 할일 목록 ({filteredTasks.length}개)
          </h3>
        </div>

        <div className="p-6">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-slate-500">
                {selectedWorkerId 
                  ? `${workers.find(w => w.id === selectedWorkerId)?.name}님의 할일이 없습니다.`
                  : '등록된 할일이 없습니다.'
                }
              </div>
              <div className="text-sm text-slate-400 mt-2">위에서 새로운 할일을 추가해보세요.</div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTasks.map(task => (
                <div
                  key={task.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    task.completed
                      ? 'bg-green-50 border-green-200'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      {/* 완료 체크박스 */}
                      <button
                        onClick={() => handleToggleComplete(task)}
                        className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          task.completed
                            ? 'bg-green-600 border-green-600 text-white'
                            : 'border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        {task.completed && (
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>

                      <div className="flex-1">
                        {/* 작업자 정보 */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-slate-800">
                            {highlightSearchTerm(task.workerName, searchQuery)}
                          </span>
                          {task.projectTitle ? (
                            <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {highlightSearchTerm(task.projectTitle, searchQuery)}
                            </span>
                          ) : (
                            <span className="text-sm bg-orange-100 text-orange-800 px-2 py-1 rounded">
                              기타 업무
                            </span>
                          )}
                        </div>

                        {/* 할일 내용 */}
                        {editingTaskId === task.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingTask}
                              onChange={(e) => setEditingTask(e.target.value)}
                              className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') handleSaveEdit();
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                              autoFocus
                            />
                            <button
                              onClick={handleSaveEdit}
                              className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                            >
                              저장
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="px-3 py-2 bg-slate-500 text-white rounded-md hover:bg-slate-600 text-sm"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <p className="text-slate-700 flex-1">
                              {highlightSearchTerm(task.task, searchQuery)}
                            </p>
                            {task.completed && (
                              <span className="px-3 py-1 bg-green-600 text-white text-sm font-bold rounded-full animate-pulse">
                                완료!
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 액션 버튼들 */}
                    {editingTaskId !== task.id && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleStartEdit(task)}
                          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="수정"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="삭제"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      ) : null}

      {/* 캘린더 뷰 */}
      {viewMode === 'calendar' && (
        <CalendarView
          dailyTasks={filteredTasks}
          workers={workers}
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          onDateDoubleClick={handleCalendarDoubleClick}
        />
      )}
    </div>
  );
};

export default DailyTasks;