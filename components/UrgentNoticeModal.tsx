import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { sendUrgentNoticeEmail, isEmailServiceConfigured } from '../emailService';
import type { UrgentNotice } from '../types';

interface UrgentNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const UrgentNoticeModal: React.FC<UrgentNoticeModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('high');
  const [emailNotification, setEmailNotification] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailOptions = [
    'mjymjwmai@naver.com',
    'real-sketchup@naver.com'
  ];

  const handleEmailToggle = (email: string) => {
    setSelectedEmails(prev => 
      prev.includes(email) 
        ? prev.filter(e => e !== email)
        : [...prev, email]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !content.trim() || !authorName.trim()) {
      alert('제목, 내용, 작성자를 모두 입력해주세요.');
      return;
    }

    if (emailNotification && selectedEmails.length === 0) {
      alert('메일 알림을 선택하셨다면 수신자를 선택해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      const noticeData: Omit<UrgentNotice, 'id'> = {
        title: title.trim(),
        content: content.trim(),
        authorName: authorName.trim(),
        priority,
        emailNotification,
        emailRecipients: emailNotification ? selectedEmails : [],
        completed: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await addDoc(collection(db, 'urgentNotices'), noticeData);

      // 메일 알림 기능
      if (emailNotification && selectedEmails.length > 0) {
        if (isEmailServiceConfigured()) {
          const emailSuccess = await sendUrgentNoticeEmail({
            to_emails: selectedEmails,
            subject: `[급한일 공지] ${title}`,
            title: title,
            content: content,
            author_name: authorName,
            priority: priority === 'high' ? '🔴 긴급' : priority === 'medium' ? '🟡 보통' : '🟢 낮음',
            created_at: new Date().toLocaleString('ko-KR')
          });

          if (emailSuccess) {
            alert('급한일 공지가 등록되었고 메일 알림이 발송되었습니다!');
          } else {
            alert('급한일 공지는 등록되었지만 메일 발송에 실패했습니다.');
          }
        } else {
          console.log('EmailJS가 설정되지 않아 메일 전송을 시뮬레이션합니다:', {
            to: selectedEmails,
            subject: `[급한일 공지] ${title}`,
            content: content
          });
          alert('급한일 공지가 등록되었습니다! (메일 전송: 개발 모드)');
        }
      } else {
        alert('급한일 공지가 성공적으로 등록되었습니다!');
      }
      
      // 폼 초기화
      setTitle('');
      setContent('');
      setAuthorName('');
      setPriority('high');
      setEmailNotification(false);
      setSelectedEmails([]);
      onClose();
      
      // 성공 콜백 호출 (게시판으로 돌아가기)
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error adding urgent notice:', error);
      alert('공지 등록에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setContent('');
    setAuthorName('');
    setPriority('high');
    setEmailNotification(false);
    setSelectedEmails([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-800">급한일 공지 작성</h2>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 작성자 */}
          <div>
            <label htmlFor="author" className="block text-sm font-medium text-slate-700 mb-2">
              작성자 *
            </label>
            <input
              id="author"
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="작성자 이름을 입력하세요"
              required
            />
          </div>

          {/* 제목 */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-2">
              제목 *
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="급한일 공지 제목을 입력하세요"
              required
            />
          </div>

          {/* 우선순위 */}
          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-slate-700 mb-2">
              우선순위
            </label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'high' | 'medium' | 'low')}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="high">🔴 긴급</option>
              <option value="medium">🟡 보통</option>
              <option value="low">🟢 낮음</option>
            </select>
          </div>

          {/* 내용 */}
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-slate-700 mb-2">
              내용 *
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="급한일 공지 내용을 자세히 입력하세요"
              required
            />
          </div>

          {/* 메일 알림 */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                id="emailNotification"
                checked={emailNotification}
                onChange={(e) => {
                  setEmailNotification(e.target.checked);
                  if (!e.target.checked) {
                    setSelectedEmails([]);
                  }
                }}
                className="w-4 h-4 text-red-600 focus:ring-red-500 border-slate-300 rounded"
              />
              <label htmlFor="emailNotification" className="text-sm font-medium text-slate-700">
                📧 메일 알림 보내기
              </label>
            </div>

            {emailNotification && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  수신자 선택:
                </label>
                {!isEmailServiceConfigured() && (
                  <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <div className="text-sm text-yellow-800">
                      ⚠️ EmailJS가 설정되지 않았습니다. 메일 전송은 시뮬레이션 모드로 동작합니다.
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {emailOptions.map(email => (
                    <div key={email} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={email}
                        checked={selectedEmails.includes(email)}
                        onChange={() => handleEmailToggle(email)}
                        className="w-4 h-4 text-red-600 focus:ring-red-500 border-slate-300 rounded"
                      />
                      <label htmlFor={email} className="text-sm text-slate-700">
                        {email}
                      </label>
                    </div>
                  ))}
                </div>
                {selectedEmails.length > 0 && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-md">
                    <div className="text-sm text-blue-800">
                      선택된 수신자: {selectedEmails.join(', ')}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors"
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? '등록 중...' : '공지 등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UrgentNoticeModal;
