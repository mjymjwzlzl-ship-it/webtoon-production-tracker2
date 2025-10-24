
import type { Process, ProjectStatus, ProjectType, Team, Worker, AdultSubType } from './types';

export const INITIAL_PROJECT_TITLE = "작품명";

export const GENERAL_PROCESSES: Process[] = [
  { id: 1, name: "1_줄거리", assignee: "" },
  { id: 2, name: "2_콘티", assignee: "" },
  { id: 3, name: "3_컷콘티", assignee: "" },
  { id: 4, name: "4_제작", assignee: "" },
  { id: 5, name: "5_편집", assignee: "" },
];

// 19금 작품 - 사내AI 프로세스
export const ADULT_INTERNAL_AI_PROCESSES: Process[] = [
  { id: 1, name: "1_줄거리", assignee: "" },
  { id: 2, name: "2_콘티", assignee: "" },
  { id: 3, name: "3_컷콘티", assignee: "" },
  { id: 4, name: "4_일반씬 제작", assignee: "" },
  { id: 5, name: "5_다즈,모듈", assignee: "" },
  { id: 6, name: "6_로퀄", assignee: "" },
  { id: 7, name: "7_추출 및 디벨롭", assignee: "" },
  { id: 8, name: "8_편집", assignee: "" },
];

// 19금 작품 - 코페인터 프로세스
export const ADULT_COPE_INTER_PROCESSES: Process[] = [
  { id: 1, name: "1_줄거리", assignee: "" },
  { id: 2, name: "2_콘티", assignee: "" },
  { id: 3, name: "3_컷콘티", assignee: "" },
  { id: 4, name: "4_일반씬 제작", assignee: "" },
  { id: 5, name: "5_다즈 및 모듈", assignee: "" },
  { id: 6, name: "6_로퀄 및 코페인터", assignee: "" },
  { id: 7, name: "7_디벨롭 및 소재", assignee: "" },
  { id: 8, name: "8_편집", assignee: "" },
];

// 기존 호환성을 위한 기본 19금 프로세스 (사내AI와 동일)
export const ADULT_PROCESSES: Process[] = ADULT_INTERNAL_AI_PROCESSES;

// 19금 작품 하위 유형별 프로세스 가져오기
export const getAdultProcesses = (subType: AdultSubType): Process[] => {
  switch (subType) {
    case 'internal-ai':
      return ADULT_INTERNAL_AI_PROCESSES;
    case 'cope-inter':
      return ADULT_COPE_INTER_PROCESSES;
    default:
      return ADULT_INTERNAL_AI_PROCESSES;
  }
};

export const EPISODE_COUNT = 10;

export const INITIAL_WORKERS: Worker[] = [];

export const TEAMS: Team[] = ['0팀', '1팀', '공통'];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  production: '제작중',
  scheduled: '연재예정',
  live: '라이브중',
  completed: '완결',
};

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  production: 'bg-blue-100 text-blue-800 border-blue-300',
  scheduled: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  live: 'bg-green-100 text-green-800 border-green-300',
  completed: 'bg-gray-100 text-gray-800 border-gray-300',
};

export const PROJECT_STATUS_DOT_COLORS: Record<ProjectStatus, string> = {
  production: 'bg-blue-500',
  scheduled: 'bg-yellow-500',
  live: 'bg-green-500',
  completed: 'bg-gray-500',
};

export const PROJECT_STATUS_BADGE_COLORS: Record<ProjectStatus, string> = {
  production: 'bg-blue-100 text-blue-800',
  scheduled: 'bg-yellow-100 text-yellow-800',
  live: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
};

export const PROJECT_TYPE_DOT_COLORS: Record<ProjectType, string> = {
  adult: 'bg-red-500',
  general: 'bg-green-500',
};

export const TEAM_BADGE_COLORS: Record<Team, string> = {
  '0팀': 'bg-blue-100 text-blue-800',
  '1팀': 'bg-green-100 text-green-800',
  '공통': 'bg-purple-100 text-purple-800',
};