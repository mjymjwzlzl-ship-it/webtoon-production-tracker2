import React, { useState, useEffect, useRef } from 'react';

interface EditableCellProps {
  initialValue: string | null;
  onSave: (newValue: string) => void;
  isEditable: boolean;
  isHeader?: boolean;
}

// 상태 타입 정의
type CellStatus = 'empty' | 'launched' | 'submitted' | 'rejected';

// 상태별 스타일 매핑 (작은 사각형 색상)
const getStatusStyle = (status: CellStatus): string => {
  switch (status) {
    case 'launched': return 'bg-green-500 text-white'; // 녹색 - 런칭 확정
    case 'submitted': return 'bg-orange-400 text-white'; // 주황색 - 투고
    case 'rejected': return 'bg-red-500 text-white'; // 빨간색 - 런칭 불가
    default: return 'text-gray-400'; // 빈 값
  }
};

// 값에서 상태와 메모 추출
const parseValue = (value: string | null): { status: CellStatus; memo: string } => {
  if (!value || value.trim() === '') return { status: 'empty', memo: '' };
  
  // 기존 단순 값들 처리
  if (value === 'launched') return { status: 'launched', memo: '' };
  if (value === 'submitted') return { status: 'submitted', memo: '' };
  if (value === 'rejected') return { status: 'rejected', memo: '' };
  
  // 상태:메모 형식 처리 (예: "launched:10/25")
  if (value.includes(':')) {
    const [statusPart, ...memoParts] = value.split(':');
    const memo = memoParts.join(':');
    if (statusPart === 'launched') return { status: 'launched', memo };
    if (statusPart === 'submitted') return { status: 'submitted', memo };
    if (statusPart === 'rejected') return { status: 'rejected', memo };
  }
  
  // 메모만 있는 경우는 대기 중으로 처리
  return { status: 'empty', memo: value };
};

// 상태와 메모를 값으로 변환
const formatValue = (status: CellStatus, memo: string): string => {
  if (status === 'empty') return memo;
  return `${status}:${memo}`;
};

// 다음 상태로 순환
const getNextStatus = (currentStatus: CellStatus): CellStatus => {
  switch (currentStatus) {
    case 'empty': return 'launched';
    case 'launched': return 'submitted';
    case 'submitted': return 'rejected';
    case 'rejected': return 'empty';
    default: return 'launched';
  }
};

const getCellStyle = (value: string | null, isHeader?: boolean): string => {
  if (isHeader) return 'font-bold';
  if (value && value.trim() !== '') {
    if (value.includes('확인필요')) return 'bg-cyan-100 text-cyan-800';
    if (value.includes('완결') || value.includes('되어있음')) return 'text-white';
    if (value.includes('대기')) return 'bg-purple-100 text-purple-800';
    if (/^\d{1,2}\/\d{1,2}$/.test(value)) return 'bg-indigo-100 text-indigo-800';
    return 'bg-gray-50 text-gray-800';
  }
  return 'text-gray-400';
};

const EditableCell: React.FC<EditableCellProps> = ({ initialValue, onSave, isEditable, isHeader = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<CellStatus>('empty');
  const [memo, setMemo] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 초기값 파싱
  useEffect(() => {
    const parsed = parseValue(initialValue);
    setCurrentStatus(parsed.status);
    setMemo(parsed.memo);
  }, [initialValue]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    const newValue = formatValue(currentStatus, memo);
    if (newValue !== initialValue) {
      onSave(newValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSave();
    else if (e.key === 'Escape') {
      const parsed = parseValue(initialValue);
      setCurrentStatus(parsed.status);
      setMemo(parsed.memo);
      setIsEditing(false);
    }
  };

  const handleCellClick = () => {
    if (!isHeader && !isEditing) {
      // 플랫폼 셀의 경우 상태 순환
      const nextStatus = getNextStatus(currentStatus);
      setCurrentStatus(nextStatus);
      const newValue = formatValue(nextStatus, memo);
      onSave(newValue);
    } else if (isEditable && isHeader) {
      // 헤더 셀의 경우 편집 모드에서만 편집 가능
      setIsEditing(true);
    }
  };

  const handleCellDoubleClick = () => {
    if (!isHeader) {
      // 플랫폼 셀 더블클릭 시 메모 편집 모드
      setIsEditing(true);
    }
  };

  if (isEditing && isEditable) {
    return (
       <td className={`p-0 ${isHeader ? '' : 'border'}`}>
        <input
          ref={inputRef}
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={`w-full h-full p-2 text-center outline-none z-10 relative ${isHeader ? 'font-bold' : ''}`}
          style={{ ringColor: '#00529b' }}
          placeholder="날짜나 메모 입력..."
        />
       </td>
    );
  }
  
  // Special handling for header cells so they dont get wrapped in a <td>
  if(isHeader) {
      return (
        <div 
            className={`${isEditable ? 'cursor-pointer' : ''} w-full`}
            onClick={handleCellClick}
        >
            {memo || ''}
        </div>
      )
  }

  // 플랫폼 셀의 경우 상태에 따른 스타일 적용
  const getDisplayStyle = () => {
    if (isHeader) return getCellStyle(memo, isHeader);
    
    if (currentStatus !== 'empty') {
      return getStatusStyle(currentStatus);
    }
    
    return 'text-gray-400';
  };

  return (
    <td 
        className={`border p-0 text-center w-[48px] min-w-[48px] max-w-[48px] mobile-table-cell table-cell ${!isHeader ? 'cursor-pointer' : (isEditable ? 'cursor-pointer' : '')}`}
        onClick={handleCellClick}
        onDoubleClick={handleCellDoubleClick}
    >
      <div className={`w-[40px] h-[40px] mx-auto my-[2px] flex items-center justify-center text-[11px] mobile-compact ${getDisplayStyle()}`}>
        {currentStatus === 'empty' ? '' : (memo || '')}
      </div>
    </td>
  );
};

export default EditableCell;
