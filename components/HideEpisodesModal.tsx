import React, { useState } from 'react';

interface HideEpisodesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onHide: (start: number, end: number) => void;
  onShowAll: () => void;
  maxEpisode: number;
}

const HideEpisodesModal: React.FC<HideEpisodesModalProps> = ({
  isOpen,
  onClose,
  onHide,
  onShowAll,
  maxEpisode,
}) => {
  const [start, setStart] = useState(1);
  const [end, setEnd] = useState(maxEpisode);

  if (!isOpen) return null;

  const handleHide = () => {
    if (start > end) {
      alert('시작 회차가 종료 회차보다 클 수 없습니다.');
      return;
    }
    if (start < 1 || end > maxEpisode) {
      alert(`회차 범위는 1과 ${maxEpisode} 사이여야 합니다.`);
      return;
    }
    onHide(start, end);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">회차 숨김</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                시작 회차
              </label>
              <input
                type="number"
                min="1"
                max={maxEpisode}
                value={start}
                onChange={(e) => setStart(parseInt(e.target.value) || 1)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                종료 회차
              </label>
              <input
                type="number"
                min="1"
                max={maxEpisode}
                value={end}
                onChange={(e) => setEnd(parseInt(e.target.value) || 1)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            onClick={handleHide}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            선택한 회차 숨기기
          </button>
          <button
            onClick={onShowAll}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            숨겨진 모든 회차 표시
          </button>
        </div>
      </div>
    </div>
  );
};

export default HideEpisodesModal;
