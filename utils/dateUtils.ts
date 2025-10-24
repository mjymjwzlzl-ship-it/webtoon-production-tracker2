// 로컬 시간 기준 날짜 유틸리티 함수들 (사용자 컴퓨터 시간 사용)

// 로컬 시간 기준 오늘 날짜 (YYYY-MM-DD) - 사용자 컴퓨터 시간 그대로 사용
export const getKoreanToday = (): string => {
  const now = new Date();
  
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  console.log('현재 로컬 시간 기준 오늘:', `${year}-${month}-${day}`);
  return `${year}-${month}-${day}`;
};

// 로컬 시간 기준 특정 날짜가 오늘인지 확인
export const isKoreanToday = (dateString: string): boolean => {
  const today = getKoreanToday();
  console.log('오늘 비교:', dateString, '===', today, '?', dateString === today);
  return dateString === today;
};

// 로컬 시간 기준 현재 시간
export const getKoreanNow = (): Date => {
  return new Date();
};
