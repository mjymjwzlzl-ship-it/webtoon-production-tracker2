import React, { useState, useEffect } from 'react';

interface ZoomViewerProps {
  onZoomChange: (zoom: number) => void;
  initialZoom?: number;
}

const ZoomViewer: React.FC<ZoomViewerProps> = ({ onZoomChange, initialZoom = 100 }) => {
  const [zoom, setZoom] = useState(initialZoom);

  const zoomLevels = [25, 50, 75, 100, 125, 150, 200, 300, 400];

  const handleZoomIn = () => {
    const currentIndex = zoomLevels.findIndex(level => level >= zoom);
    const nextIndex = Math.min(currentIndex + 1, zoomLevels.length - 1);
    const newZoom = zoomLevels[nextIndex];
    setZoom(newZoom);
    onZoomChange(newZoom);
  };

  const handleZoomOut = () => {
    const currentIndex = zoomLevels.findIndex(level => level >= zoom);
    const prevIndex = Math.max(currentIndex - 1, 0);
    const newZoom = zoomLevels[prevIndex];
    setZoom(newZoom);
    onZoomChange(newZoom);
  };

  const handleZoomSelect = (newZoom: number) => {
    setZoom(newZoom);
    onZoomChange(newZoom);
  };

  // 키보드 단축키 처리
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        if (e.key === '=' || e.key === '+' || e.keyCode === 187) {
          e.preventDefault();
          handleZoomIn();
        } else if (e.key === '-' || e.keyCode === 189) {
          e.preventDefault();
          handleZoomOut();
        } else if (e.key === '0') {
          e.preventDefault();
          handleZoomSelect(100);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoom]);

  return (
    <div className="flex items-center bg-white rounded-md shadow-sm border border-gray-200 px-2 py-1">
      <button
        onClick={handleZoomOut}
        className="w-6 h-6 rounded bg-gray-500 text-white flex items-center justify-center hover:bg-gray-600 transition-colors text-xs"
        title="줌 아웃 (Ctrl + -)"
      >
        -
      </button>
      
      <div className="mx-2 min-w-[50px] text-center">
        <select
          value={zoom}
          onChange={(e) => handleZoomSelect(Number(e.target.value))}
          className="text-xs font-medium text-gray-700 bg-transparent border-none outline-none cursor-pointer"
        >
          {zoomLevels.map(level => (
            <option key={level} value={level}>
              {level}%
            </option>
          ))}
        </select>
      </div>
      
      <button
        onClick={handleZoomIn}
        className="w-6 h-6 rounded bg-gray-500 text-white flex items-center justify-center hover:bg-gray-600 transition-colors text-xs"
        title="줌 인 (Ctrl + +)"
      >
        +
      </button>
    </div>
  );
};

export default ZoomViewer;
