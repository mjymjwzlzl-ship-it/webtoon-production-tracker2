
export interface Worker {
  id: string;
  name: string;
  team: Team;
}

export interface Process {
  id: number;
  name: string;
  assignee: string; // Worker['id']
}

export type CellStatus = 'none' | 'inProgress' | 'done' | 'final';

export interface CellState {
  status: CellStatus;
  text: string;
}

export type Statuses = {
  [key: string]: CellState;
};

export type ProjectStatus = 'production' | 'scheduled' | 'live' | 'completed';

export type ProjectType = 'general' | 'adult';
export type AdultSubType = 'internal-ai' | 'cope-inter';
export type CopeInterSubType = 'v1-brush' | 'v2-brush' | 'v3-brush';

export type IdentifierType = 'isbn' | 'uci';

export type Team = '0팀' | '1팀' | '공통';

export interface Project {
  id: string;
  title: string;
  type: ProjectType;
  adultSubType?: AdultSubType; // 19금 작품의 하위 유형
  copeInterSubType?: CopeInterSubType; // 코페인터 하위 유형
  internalAiWeight?: string; // 사내AI 가중치
  team: Team;
  storyWriter: string;
  artWriter: string;
  identifierType: IdentifierType; // ISBN 또는 UCI
  identifierValue: string; // ISBN 또는 UCI 값
  synopsis: string; // 줄거리
  processes: Process[];
  episodeCount: number;
  startEpisode: number; // 시작 회차 (기본값: 1)
  hiddenEpisodes?: number[]; // 숨겨진 회차 목록
  statuses: Statuses;
  hasGeneralCover: boolean; // 일반표지
  hasAdultCover: boolean; // 성인표지
  hasLogo: boolean; // 로고
  hasCharacterSheet: boolean; // 캐릭터시트
  hasSynopsis: boolean; // 줄거리
  hasProposal: boolean; // 소개서
  memo?: string; // 작품별 메모/비고
  lastModified: number;
  status: ProjectStatus;
}

export interface DailyTask {
  id: string;
  workerId: string;
  workerName: string;
  date: string; // YYYY-MM-DD 형식
  task: string;
  projectId?: string; // 관련 프로젝트 ID (선택사항)
  projectTitle?: string; // 관련 프로젝트 제목 (선택사항)
  processId?: number; // 작업 프로세스 ID (선택사항)
  processName?: string; // 작업 프로세스 이름 (선택사항)
  episode?: number; // 에피소드 번호 (선택사항)
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface UrgentNotice {
  id: string;
  title: string;
  content: string;
  authorName: string;
  priority: 'high' | 'medium' | 'low';
  emailNotification: boolean;
  emailRecipients: string[];
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}

// 업체 정산 관련 타입
export interface PlatformEarnings {
  [platformName: string]: number; // 플랫폼별 수익 (원 단위)
}

export interface ProjectSettlement {
  id: string;
  projectId: string;
  projectTitle: string;
  platformEarnings: PlatformEarnings;
  totalEarnings: number; // 총 수익
  lastModified: number;
}

export interface SettlementData {
  projects: ProjectSettlement[];
  totalAllProjects: number; // 모든 작품의 총 수익
  lastModified: number;
}

// 월별 매출 관리 타입
export interface MonthlyProjectSettlement {
  id: string;
  projectId: string;
  projectTitle: string;
  platformEarnings: PlatformEarnings;
  totalEarnings: number; // 총 수익
  lastModified: number;
}

export interface MonthlySettlementData {
  year: number;
  month: number; // 1-12
  projects: MonthlyProjectSettlement[];
  platforms: string[]; // 해당 월에 사용된 플랫폼 목록
  totalAllProjects: number; // 모든 작품의 총 수익
  lastModified: number;
}

export interface MonthlySettlementCollection {
  [key: string]: MonthlySettlementData; // key: "2024-01" 형태
}
