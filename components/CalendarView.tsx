import React, { useState, useMemo } from 'react';
import { isKoreanToday } from '../utils/dateUtils';
import type { DailyTask, Worker } from '../types';

interface CalendarViewProps {
  dailyTasks: DailyTask[];
  workers: Worker[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onDateDoubleClick?: (date: string) => void;
}

interface DayDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  tasks: DailyTask[];
}

// 날짜별 할일 상세 모달 컴포넌트
const DayDetailModal: React.FC<DayDetailModalProps> = ({ isOpen, onClose, date, tasks }) => {
  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${year}년 ${month}월 ${day}일 (${dayOfWeek})`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="p-4 bg-blue-50 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">
              {formatDate(date)} 할일 목록
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-blue-100 rounded-full transition-colors"
              title="닫기"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-slate-600 mt-1">총 {tasks.length}개의 할일</p>
        </div>

        {/* 할일 목록 */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              이 날에는 할일이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-3 rounded-lg border ${
                    task.completed
                      ? 'bg-green-50 border-green-200'
                      : task.projectTitle
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-orange-50 border-orange-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* 작업자 이름 */}
                      <div className="text-sm font-medium text-slate-800 mb-1">
                        👤 {task.workerName}
                      </div>
                      
                      {/* 할일 내용 */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="text-sm text-slate-700 flex-1">
                          {task.task}
                        </div>
                        {task.completed && (
                          <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full font-medium">
                            완료!
                          </span>
                        )}
                      </div>
                      
                      {/* 프로젝트 정보 */}
                      {task.projectTitle && (
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            📋 {task.projectTitle}
                          </span>
                          {task.processName && (
                            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded">
                              ⚙️ {task.processName}
                            </span>
                          )}
                          {task.episode && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-600 rounded">
                              📺 {task.episode}화
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* 완료 상태 */}
                    <div className="ml-3">
                      {task.completed ? (
                        <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-6 h-6 border-2 border-slate-300 rounded-full"></div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CalendarView: React.FC<CalendarViewProps> = ({ 
  dailyTasks, 
  workers, 
  selectedDate, 
  onDateSelect,
  onDateDoubleClick
}) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const date = new Date(selectedDate + 'T00:00:00'); // 시간대 문제 방지
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  // 모달 상태
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    date: string;
    tasks: DailyTask[];
  }>({
    isOpen: false,
    date: '',
    tasks: []
  });

  // 모달 열기
  const openModal = (date: string, tasks: DailyTask[]) => {
    setModalState({
      isOpen: true,
      date,
      tasks
    });
  };

  // 모달 닫기
  const closeModal = () => {
    setModalState({
      isOpen: false,
      date: '',
      tasks: []
    });
  };

  // 현재 월의 캘린더 데이터 생성
  const calendarData = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // 월의 첫 날
    const firstDay = new Date(year, month, 1);
    
    // 캘린더 시작일 계산 (월요일부터 시작하도록)
    const startDate = new Date(firstDay);
    const dayOfWeek = firstDay.getDay();
    // 일요일=0, 월요일=1, ... 토요일=6
    // 월요일부터 시작하려면: 일요일이면 6일 빼기, 아니면 (요일-1)일 빼기
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate.setDate(firstDay.getDate() - daysToSubtract);
    
    // 6주 * 7일 = 42일 생성
    const days = [];
    const currentDate = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
      const date = new Date(currentDate);
      
      // 로컬 시간 기준으로 날짜 문자열 생성
      const year = date.getFullYear();
      const month_num = String(date.getMonth() + 1).padStart(2, '0');
      const day_num = String(date.getDate()).padStart(2, '0');
      const dateString = `${year}-${month_num}-${day_num}`;
      
      const dayTasks = dailyTasks.filter(task => task.date === dateString);
      
       
      days.push({
        date: new Date(date), // 새 객체로 복사
        dateString: dateString,
        isCurrentMonth: date.getMonth() === month,
        isToday: isKoreanToday(dateString),
        isSelected: dateString === selectedDate,
        tasks: dayTasks,
        completedCount: dayTasks.filter(task => task.completed).length,
        totalCount: dayTasks.length
      });
      
      // 다음 날로 이동
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  }, [currentMonth, dailyTasks, selectedDate]);

  // 월 변경
  const changeMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(newMonth.getMonth() - 1);
      } else {
        newMonth.setMonth(newMonth.getMonth() + 1);
      }
      return newMonth;
    });
  };

  // 오늘로 이동
  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    onDateSelect(today.toISOString().split('T')[0]);
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
      {/* 캘린더 헤더 */}
      <div className="p-4 bg-blue-50 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold text-slate-800">
              {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => changeMonth('prev')}
                className="p-2 hover:bg-blue-100 rounded-full transition-colors"
                title="이전 달"
              >
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => changeMonth('next')}
                className="p-2 hover:bg-blue-100 rounded-full transition-colors"
                title="다음 달"
              >
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          
          <button
            onClick={goToToday}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
          >
            오늘
          </button>
        </div>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 bg-slate-100">
        {['월', '화', '수', '목', '금', '토', '일'].map(day => (
          <div key={day} className="p-3 text-center text-sm font-medium text-slate-600 border-r border-slate-200 last:border-r-0">
            {day}
          </div>
        ))}
      </div>

      {/* 캘린더 그리드 */}
      <div className="grid grid-cols-7">
        {calendarData.map((day, index) => (
           <div
             key={index}
             onClick={() => onDateSelect(day.dateString)}
             onDoubleClick={() => {
               if (onDateDoubleClick && day.isCurrentMonth) {
                 onDateDoubleClick(day.dateString);
               }
             }}
             className={`min-h-[100px] p-2 border-r border-b border-slate-200 last:border-r-0 cursor-pointer transition-colors ${
               day.isSelected
                 ? 'bg-blue-100'
                 : day.isToday
                 ? 'bg-green-50'
                 : day.isCurrentMonth
                 ? 'bg-white hover:bg-slate-50'
                 : 'bg-slate-50 text-slate-400'
             }`}
             title={day.isCurrentMonth ? `${day.dateString} 더블클릭하여 할일 추가` : ''}
           >
            {/* 날짜 */}
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${
                day.isToday ? 'text-green-700' : 
                day.isSelected ? 'text-blue-700' :
                day.isCurrentMonth ? 'text-slate-800' : 'text-slate-400'
              }`}>
                {day.date.getDate()}
              </span>
              
              {/* 할일 개수 표시 */}
              {day.totalCount > 0 && (
                <div className="flex items-center gap-1">
                  <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${
                    day.completedCount === day.totalCount
                      ? 'bg-green-600 text-white'
                      : day.completedCount > 0
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-400 text-white'
                  }`}>
                    {day.totalCount}
                  </span>
                </div>
              )}
            </div>

            {/* 할일 미리보기 */}
            {day.tasks.length > 0 && (
              <div className="space-y-1">
                {day.tasks.slice(0, 3).map((task, taskIndex) => (
                  <div
                    key={taskIndex}
                    className={`text-xs px-2 py-1 rounded truncate ${
                      task.completed
                        ? 'bg-green-100 text-green-800'
                        : task.projectTitle
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-orange-100 text-orange-800'
                    }`}
                    title={task.task}
                  >
                    {task.workerName}: {task.task.length > 15 ? task.task.substring(0, 15) + '...' : task.task}
                  </div>
                ))}
                {day.tasks.length > 3 && (
                  <div 
                    className="text-xs text-slate-500 text-center cursor-pointer hover:text-blue-600 hover:underline transition-colors"
                    onClick={(e) => {
                      e.stopPropagation(); // 날짜 클릭 이벤트와 분리
                      openModal(day.dateString, day.tasks);
                    }}
                    title={`${day.dateString}의 모든 할일 보기`}
                  >
                    +{day.tasks.length - 3}개 더
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 범례 */}
      <div className="p-4 bg-slate-50 border-t border-slate-200">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-50 border border-green-200 rounded"></div>
            <span className="text-slate-600">오늘</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-100 rounded"></div>
            <span className="text-slate-600">선택된 날짜</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-600 rounded-full"></div>
            <span className="text-slate-600">모든 할일 완료</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
            <span className="text-slate-600">일부 할일 완료</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-slate-400 rounded-full"></div>
            <span className="text-slate-600">미완료 할일</span>
          </div>
        </div>
      </div>

      {/* 날짜별 할일 상세 모달 */}
      <DayDetailModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        date={modalState.date}
        tasks={modalState.tasks}
      />
    </div>
  );
};

export default CalendarView;
