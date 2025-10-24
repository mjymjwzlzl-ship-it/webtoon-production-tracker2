
import React, { useState, useEffect, useRef } from 'react';
import type { CellState, CellStatus } from '../types';

interface StatusCellProps {
  cellState: CellState;
  onCellChange: (newState: CellState) => void;
}

const statusCycle: CellStatus[] = ['none', 'inProgress', 'done', 'final'];
const statusColors: Record<CellStatus, string> = {
  none: 'bg-transparent hover:bg-slate-200',
  inProgress: 'bg-yellow-200 hover:bg-yellow-300',
  done: 'bg-green-500 hover:bg-green-600',
  final: 'bg-red-400 hover:bg-red-500',
};

const StatusCell: React.FC<StatusCellProps> = ({ cellState, onCellChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(cellState.text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  const handleClick = () => {
    if (isEditing) return;
    
    // 클릭 시 녹색(done)으로 변경, 이미 녹색이면 흰색(none)으로 변경
    const newStatus: CellStatus = cellState.status === 'done' ? 'none' : 'done';
    onCellChange({ ...cellState, status: newStatus });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isEditing) return;

    // 오른쪽 클릭 시 녹색을 건너뛰고: none -> inProgress -> final -> none
    let newStatus: CellStatus;
    switch (cellState.status) {
      case 'none':
        newStatus = 'inProgress';
        break;
      case 'inProgress':
        newStatus = 'final';
        break;
      case 'final':
        newStatus = 'none';
        break;
      case 'done':
        // 녹색 상태에서는 노란색으로 시작
        newStatus = 'inProgress';
        break;
      default:
        newStatus = 'inProgress';
    }
    
    onCellChange({ ...cellState, status: newStatus });
  };

  const handleDoubleClick = () => {
    setEditText(cellState.text);
    setIsEditing(true);
  };

  const handleSaveChanges = () => {
    setIsEditing(false);
    if (editText.trim() !== cellState.text) {
      onCellChange({ ...cellState, text: editText.trim() });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveChanges();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditText(cellState.text); // Revert changes
    }
  };

  const bgColor = statusColors[cellState.status];

  return (
    <td
      className={`relative border border-slate-300 cursor-pointer transition-colors duration-150 ease-in-out ${bgColor}`}
      style={{ 
        width: '72px', 
        height: '48px', 
        minWidth: '72px', 
        maxWidth: '72px',
        padding: '0',
        margin: '0',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
      onMouseDown={(e) => {
        if (e.button === 2) { // 오른쪽 마우스 버튼
          e.preventDefault();
        }
      }}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleSaveChanges}
          onKeyDown={handleKeyDown}
          className="absolute inset-0 w-full h-full p-1 sm:p-0.5 bg-white border-2 border-primary-blue text-xs text-slate-800 outline-none z-10"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center p-1 sm:p-0.5 text-xs text-slate-800 font-medium break-words text-center overflow-hidden">
          {cellState.text}
        </div>
      )}
    </td>
  );
};

export default StatusCell;
