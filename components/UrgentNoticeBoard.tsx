import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import type { UrgentNotice } from '../types';

interface UrgentNoticeBoardProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateNotice: () => void;
}

const UrgentNoticeBoard: React.FC<UrgentNoticeBoardProps> = ({ 
  isOpen, 
  onClose, 
  onCreateNotice 
}) => {
  const [notices, setNotices] = useState<UrgentNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotice, setSelectedNotice] = useState<UrgentNotice | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // Firebase에서 공지사항 실시간 구독
  useEffect(() => {
    if (!isOpen) return;

    const q = query(
      collection(db, 'urgentNotices'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const noticesList: UrgentNotice[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as UrgentNotice));
      setNotices(noticesList);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching notices:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen]);

  // 공지 완료 상태 토글
  const handleToggleComplete = async (notice: UrgentNotice) => {
    try {
      const updatedNotice = { ...notice, completed: !notice.completed };
      await updateDoc(doc(db, 'urgentNotices', notice.id), {
        completed: updatedNotice.completed,
        updatedAt: Date.now()
      });
    } catch (error) {
      console.error('Error updating notice:', error);
      alert('공지 상태 업데이트에 실패했습니다.');
    }
  };

  // 공지 삭제
  const handleDeleteNotice = async (noticeId: string) => {
    if (!confirm('정말로 이 공지를 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, 'urgentNotices', noticeId));
      alert('공지가 삭제되었습니다.');
      setSelectedNotice(null); // 선택된 공지 초기화
    } catch (error) {
      console.error('Error deleting notice:', error);
      alert('공지 삭제에 실패했습니다.');
    }
  };

  // 완료된 공지 일괄 삭제
  const handleDeleteCompletedNotices = async () => {
    const completedNotices = notices.filter(notice => notice.completed);
    
    if (completedNotices.length === 0) {
      alert('삭제할 완료된 공지가 없습니다.');
      return;
    }

    if (!confirm(`완료된 공지 ${completedNotices.length}개를 모두 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      const deletePromises = completedNotices.map(notice => 
        deleteDoc(doc(db, 'urgentNotices', notice.id))
      );
      
      await Promise.all(deletePromises);
      alert(`완료된 공지 ${completedNotices.length}개가 삭제되었습니다.`);
      setSelectedNotice(null); // 선택된 공지 초기화
    } catch (error) {
      console.error('Error deleting completed notices:', error);
      alert('완료된 공지 삭제에 실패했습니다.');
    }
  };

  // 필터링된 공지 목록
  const filteredNotices = notices.filter(notice => {
    if (filter === 'pending') return !notice.completed;
    if (filter === 'completed') return notice.completed;
    return true;
  });

  // 우선순위별 색상
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // 우선순위 아이콘
  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="p-6 border-b border-slate-200 bg-blue-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-800">급한일 공지 게시판</h2>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                {notices.length}개 공지
              </span>
            </div>
            <div className="flex items-center gap-3">
              {/* 완료된 공지 일괄 삭제 버튼 */}
              {notices.filter(n => n.completed).length > 0 && (
                <button
                  onClick={handleDeleteCompletedNotices}
                  className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-2"
                  title="완료된 공지 모두 삭제"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span className="hidden sm:inline">완료된 공지 삭제</span>
                </button>
              )}
              
                <button
                  onClick={onCreateNotice}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  + 새 공지 작성
                </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* 필터 탭 */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex gap-2">
              {[
                { key: 'all', label: '전체', count: notices.length },
                { key: 'pending', label: '진행중', count: notices.filter(n => !n.completed).length },
                { key: 'completed', label: '완료', count: notices.filter(n => n.completed).length }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key as any)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    filter === tab.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
            
            {/* 완료 탭에서만 일괄 삭제 버튼 표시 */}
            {filter === 'completed' && notices.filter(n => n.completed).length > 0 && (
              <button
                onClick={handleDeleteCompletedNotices}
                className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                완료된 공지 모두 삭제
              </button>
            )}
          </div>
        </div>

        {/* 콘텐츠 영역 */}
        <div className="flex flex-1 overflow-hidden">
          {/* 공지 목록 */}
          <div className="w-1/2 border-r border-slate-200 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-slate-500">공지를 불러오는 중...</div>
              </div>
            ) : filteredNotices.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 p-6">
                <div className="text-slate-500 text-center">
                  <div className="text-lg font-medium">등록된 공지가 없습니다</div>
                  <div className="text-sm mt-2">새 공지를 작성해보세요</div>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {filteredNotices.map(notice => (
                  <div
                    key={notice.id}
                    onClick={() => setSelectedNotice(notice)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                      selectedNotice?.id === notice.id
                        ? 'border-blue-300 bg-blue-50'
                        : notice.completed
                        ? 'border-green-200 bg-green-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 text-xs rounded border ${getPriorityColor(notice.priority)}`}>
                            {getPriorityIcon(notice.priority)} 
                            {notice.priority === 'high' ? '긴급' : notice.priority === 'medium' ? '보통' : '낮음'}
                          </span>
                          {notice.completed && (
                            <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                              완료
                            </span>
                          )}
                        </div>
                        <h3 className={`font-medium text-slate-800 mb-1 ${notice.completed ? 'line-through opacity-60' : ''}`}>
                          {notice.title}
                        </h3>
                        <p className="text-sm text-slate-600 line-clamp-2">
                          {notice.content}
                        </p>
                        <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                          <span>작성자: {notice.authorName}</span>
                          <span>{new Date(notice.createdAt).toLocaleDateString('ko-KR')}</span>
                        </div>
                      </div>
                      
                      {/* 완료 체크박스 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleComplete(notice);
                        }}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          notice.completed
                            ? 'bg-green-600 border-green-600 text-white'
                            : 'border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        {notice.completed && (
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 상세 보기 */}
          <div className="w-1/2 overflow-y-auto">
            {selectedNotice ? (
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 text-sm rounded-full border ${getPriorityColor(selectedNotice.priority)}`}>
                      {getPriorityIcon(selectedNotice.priority)} 
                      {selectedNotice.priority === 'high' ? '긴급' : selectedNotice.priority === 'medium' ? '보통' : '낮음'}
                    </span>
                    {selectedNotice.completed && (
                      <span className="px-3 py-1 bg-green-600 text-white text-sm rounded-full">
                        완료됨
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteNotice(selectedNotice.id)}
                    className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
                    title="공지 삭제"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                <h1 className={`text-2xl font-bold text-slate-800 mb-4 ${selectedNotice.completed ? 'line-through opacity-60' : ''}`}>
                  {selectedNotice.title}
                </h1>

                <div className="bg-slate-50 p-4 rounded-lg mb-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-600">작성자:</span>
                      <span className="ml-2 font-medium">{selectedNotice.authorName}</span>
                    </div>
                    <div>
                      <span className="text-slate-600">작성일:</span>
                      <span className="ml-2">{new Date(selectedNotice.createdAt).toLocaleString('ko-KR')}</span>
                    </div>
                    <div>
                      <span className="text-slate-600">메일 발송:</span>
                      <span className="ml-2">{selectedNotice.emailNotification ? '발송됨' : '발송안함'}</span>
                    </div>
                    {selectedNotice.emailNotification && selectedNotice.emailRecipients.length > 0 && (
                      <div>
                        <span className="text-slate-600">수신자:</span>
                        <span className="ml-2 text-xs">{selectedNotice.emailRecipients.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="prose max-w-none">
                  <div className="text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {selectedNotice.content}
                  </div>
                </div>

                {/* 완료 처리 버튼 */}
                <div className="mt-8 pt-6 border-t border-slate-200">
                  <button
                    onClick={() => handleToggleComplete(selectedNotice)}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                      selectedNotice.completed
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {selectedNotice.completed ? '완료 취소' : '완료 처리'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-slate-500">
                  <div className="text-lg font-medium">공지를 선택해주세요</div>
                  <div className="text-sm mt-2">왼쪽 목록에서 공지를 클릭하면 상세 내용을 볼 수 있습니다</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UrgentNoticeBoard;
