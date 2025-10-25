
import type { Process, ProjectStatus, ProjectType, Team, Worker, AdultSubType, Webtoon, SubmissionInfo, UploadInfo } from './types';

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

// 웹툰 배포 추적 관련 상수
export const WEBTOON_TYPES = [
  '국내비독점 [라이브]',
  '해외비독점 [라이브]',
  '국내비독점 [완결]',
  '해외비독점 [완결]',
] as const;

// 동기화 그룹 정의
export const SYNC_GROUPS = [
  {
    name: '라이브',
    types: ['국내비독점 [라이브]', '해외비독점 [라이브]']
  },
  {
    name: '완결',
    types: ['국내비독점 [완결]', '해외비독점 [완결]']
  }
] as const;

export const DOMESTIC_PLATFORMS: string[] = [
  '교보E북', '구루컴퍼니', '네이버 시리즈', '두리요', '레진', '리디북스', '만화365', '무툰',
  '미스터블루', '미툰', '봄툰', '북큐브', '블라이스', '애니툰', '원스토리', '인터넷 만화방',
  '케이툰', '투믹스', '픽미툰', '왓챠', '북팔', '울툰', '큐툰', '코미코'
];

export const OVERSEAS_PLATFORMS: string[] = [
  '펀플', 'DLSITE (누온)', '탑툰 재팬', '툰허브', '허니툰', '만타', '투믹스 (북미)', '투믹스 (일본)',
  '투믹스 (이탈리아)', '투믹스 (포루투갈)', '투믹스 (프랑스)', '투믹스 중문(간체)', '투믹스 중문(번체)',
  '투믹스 (독일)', '투믹스 (스페인)', '투믹스 (남미)', '레진 (북미)', '레진 (일본)'
];

// 기본값은 국내 플랫폼 (하위 호환성)
export const INITIAL_PLATFORMS: string[] = DOMESTIC_PLATFORMS;

// 웹툰 플랫폼별 투고 정보
export const SUBMISSION_INFO: SubmissionInfo[] = [
  {
    id: '1',
    companyName: '투믹스',
    submissionMethod: '담당자에게 1화 원고 및 작품 정보 이메일 발송',
    submissionSchedule: '',
    launchConditions: '오픈 1일 전까지 런칭 회차 모두 업로드',
    contactPersonName: '양하나 팀장, 황선아 대리, 노선영 주임',
    contactPersonEmail: 'hnyang@toomics.com, hsuna51@toomics.com, no18842@toomics.com (참조: sout@toomics.com)',
    contactNumber: '양하나 팀장 - 010-3945-1195, 황선아 대리 - 010-3797-3807, 노선영 주임 - 010-6292-4104',
    remarks: ''
  },
  {
    id: '2',
    companyName: '미툰',
    submissionMethod: '담당자에게 1화 원고 및 작품 정보 이메일 발송',
    submissionSchedule: '최소 1주일 전 원고 런칭',
    launchConditions: '오픈 2-3일 전까지 런칭 회차 모두 업로드',
    contactPersonName: '류창수 부장, 이승연 매니저',
    contactPersonEmail: 'willow@me.co.kr, leesyng10@me.co.kr',
    contactNumber: '류창수 부장 - 010-9999-9686, 이승연 매니저 - 010-6737-6981',
    remarks: ''
  },
  {
    id: '3',
    companyName: '북팔',
    submissionMethod: '신청서 제출 후 담당자 연락',
    submissionSchedule: '최소 1주일 전 원고 런칭',
    launchConditions: '오픈 2-3일 전까지 런칭 회차 모두 업로드',
    contactPersonName: '김현나 매니저',
    contactPersonEmail: 'wcp@bookp.al',
    contactNumber: '02-6380-9898',
    remarks: ''
  },
  {
    id: '4',
    companyName: '북큐브',
    submissionMethod: '담당자에게 1화 원고 및 작품 정보 이메일 발송',
    submissionSchedule: '최소 1주일 전 원고 런칭',
    launchConditions: '오픈 2-3일 전까지 런칭 회차 모두 업로드',
    contactPersonName: '양영민 대리',
    contactPersonEmail: 'bmyym1011@bookcube.com',
    contactNumber: '010-6763-1080',
    remarks: ''
  },
  {
    id: '5',
    companyName: '무툰',
    submissionMethod: '담당자에게 1-3화 원고 및 작품 정보 이메일 발송',
    submissionSchedule: '최소 1주일 전 원고 런칭',
    launchConditions: '오픈 2-3일 전까지 런칭 회차 모두 업로드',
    contactPersonName: '박윤서 주임',
    contactPersonEmail: 'topmanys21@fingerstory.com (참조: 최종환 대리), myeonghae@fingerstory.com (간명해 대리)',
    contactNumber: '02-6271-1521, 010-4753-3023',
    remarks: '큐툰과 동일'
  },
  {
    id: '6',
    companyName: '케이툰',
    submissionMethod: '담당자에게 런칭 회차 수량 원고 및 작품 정보 이메일 발송',
    submissionSchedule: '최소 1주일 전 원고 런칭',
    launchConditions: '오픈 2-3일 전까지 런칭 회차 모두 업로드',
    contactPersonName: '유창선 MD',
    contactPersonEmail: 'cs1.yoo@kt.com',
    contactNumber: '010-3411-5250',
    remarks: ''
  },
  {
    id: '7',
    companyName: '블라이스',
    submissionMethod: '담당자에게 1화 원고 및 작품 정보 이메일 발송',
    submissionSchedule: '최소 1주일 전 원고 런칭',
    launchConditions: '오픈 7일 전까지 런칭 회차 모두 업로드',
    contactPersonName: '홍은설 MD',
    contactPersonEmail: 'es1.hong@kt.com',
    contactNumber: '010-5915-9760',
    remarks: ''
  },
  {
    id: '8',
    companyName: '원스토리',
    submissionMethod: 'CP 업체 페이지 등록 후 제안서 이메일 제출',
    submissionSchedule: '',
    launchConditions: '',
    contactPersonName: '윤현경 대리',
    contactPersonEmail: '9001237@partner.onestorecorp.com, 원고 검수 요청 이메일: review.webtoon@onestorecorp.com',
    contactNumber: '010-5009-6502',
    remarks: '주 1화 업로드 시 서비스 날짜 입력, 해당 날짜에 승인 완료 후 업로드'
  },
  {
    id: '9',
    companyName: '미스터블루',
    submissionMethod: 'CP 업체 등록 후 프로모션 관련 이메일 답신 가능',
    submissionSchedule: '최소 1주일 전 원고 런칭',
    launchConditions: '작품 등록 및 오픈 5일 전까지 런칭 회차 모두 업로드',
    contactPersonName: '김희나 매니저, 이현승 주임',
    contactPersonEmail: 'gmlskrla94@mrblue.com, leehsjj@mrblue.com',
    contactNumber: '010-4705-0633, 010-2495-7455',
    remarks: ''
  },
  {
    id: '10',
    companyName: '인터넷 만화방',
    submissionMethod: '담당자에게 1화 원고 및 작품 정보 이메일 발송',
    submissionSchedule: '최소 1주일 전 원고 런칭',
    launchConditions: '오픈 2-3일 전까지 런칭 회차 모두 업로드',
    contactPersonName: '안지연 대리',
    contactPersonEmail: 'ajy319@hanarum.com',
    contactNumber: '070-7433-3208',
    remarks: ''
  },
  {
    id: '11',
    companyName: '애니툰',
    submissionMethod: '담당자에게 1화 원고 및 작품 정보 이메일 발송, CP 업체 페이지 등록',
    submissionSchedule: '최소 2주일 전 원고 런칭',
    launchConditions: '작품 등록 및 오픈 7일 전까지 런칭 회차 모두 업로드',
    contactPersonName: '윤예슬 PD',
    contactPersonEmail: 'yess05@anytoon.kr',
    contactNumber: '010-2628-7473',
    remarks: ''
  },
  {
    id: '12',
    companyName: '네이버 시리즈',
    submissionMethod: 'CP 업체 페이지 등록',
    submissionSchedule: '최소 1주일 전 원고 런칭',
    launchConditions: '작품 등록 및 오픈 3일 전까지 런칭 회차 모두 업로드',
    contactPersonName: '오정민',
    contactPersonEmail: 'jungminoh@webtoonscorp.com, 네이버 원고 등록 이메일: dl_series_comix@webtoonscorp.com',
    contactNumber: '010-8222-5196',
    remarks: '주 1화 업로드 시 서비스 날짜 입력, 해당 날짜에 승인 완료 후 업로드'
  },
  {
    id: '13',
    companyName: '리디북스',
    submissionMethod: 'CP 업체 페이지 등록',
    submissionSchedule: '최소 1주일 전 원고 런칭',
    launchConditions: '작품 등록 및 오픈 2일 전까지 런칭 회차 모두 업로드',
    contactPersonName: '리디 웹툰 운영팀',
    contactPersonEmail: 'webtoon.operation@ridi.com',
    contactNumber: '-',
    remarks: '주 1화 업로드 시 서비스 날짜 입력, 해당 날짜에 승인 완료 후 업로드'
  }
];

// 웹툰 플랫폼별 업로드 정보
export const UPLOAD_INFO: UploadInfo[] = [
  {
    id: '1',
    companyName: '투믹스',
    deliveryDeadline: '당일 오후 5시',
    registrationLink: 'http://toomicsgb3.synology.me:5000/',
    loginId: 'forupload_only',
    password: 'W(S8*2kr',
    contactPersonName: '양하나 팀장, 황선아 대리, 노선영 주임',
    contactPersonEmail: '조한상: hjpj5@toomics.com; 양하나: hnyang@toomics.com; 황선아: hsuna51@toomics.com; 노선영: no18842@toomics.com (참조: sout@toomics.com)',
    contactNumber: '양하나: 010-3945-1195, 황선아: 010-3797-3807, 노선영: 010-6292-4104',
    manuscriptSpec: '720x4000',
    coverBannerSpec: '-',
    thumbnailSpec: '-'
  },
  {
    id: '2',
    companyName: '미툰',
    deliveryDeadline: '원고 오픈 2~3일전',
    registrationLink: '알마인트 설치 후 FTP 서버에 등록\nFTP 서버 IP : 115.165.177.254\n포트 : 21',
    loginId: 'meent89',
    password: 'rciqgq$#$!',
    contactPersonName: '류창수 부장, 이승연 매니저',
    contactPersonEmail: '류창수: willow@me.co.kr; 이승연: leesyng10@me.co.kr',
    contactNumber: '류창수: 010-9999-9686, 이승연: 010-6737-6981',
    manuscriptSpec: '720x4000',
    coverBannerSpec: '-',
    thumbnailSpec: '-'
  },
  {
    id: '3',
    companyName: '북팔',
    deliveryDeadline: '원고 오픈 2~3일전',
    registrationLink: 'http://118.33.81.131:5023/webman/index.cgi',
    loginId: 'moontech',
    password: '@moon123',
    contactPersonName: '김현나 매니저',
    contactPersonEmail: 'wcp@bookp.al',
    contactNumber: '02-6380-9898',
    manuscriptSpec: '720x4000',
    coverBannerSpec: '900x1350 psd',
    thumbnailSpec: '300x200'
  },
  {
    id: '4',
    companyName: '북큐브',
    deliveryDeadline: '원고 오픈 2~3일전',
    registrationLink: 'www.webhard.co.kr (폴더명: 문테크놀러지)',
    loginId: 'bookcube7',
    password: '1004 (폴더 비밀번호 : 20250109)',
    contactPersonName: '양영민 대리',
    contactPersonEmail: 'bmyym1011@bookcube.com, cubewebtoon@naver.com (원고 마스터 계정)',
    contactNumber: '010-6763-1080',
    manuscriptSpec: '720x3000',
    coverBannerSpec: '일반표지: 500x700 / 정사각형표지: 600x600',
    thumbnailSpec: '640x250'
  },
  {
    id: '5',
    companyName: '리얼툰',
    deliveryDeadline: '',
    registrationLink: '메일로 전달',
    loginId: '-',
    password: '-',
    contactPersonName: '조서영 제작팀장',
    contactPersonEmail: 'achiulsys01@gmail.com',
    contactNumber: '010-2023-0415',
    manuscriptSpec: '720x2000',
    coverBannerSpec: '-',
    thumbnailSpec: '-'
  },
  {
    id: '6',
    companyName: '무툰',
    deliveryDeadline: '원고 오픈 2~3일전',
    registrationLink: '메일로 전달',
    loginId: '-',
    password: '-',
    contactPersonName: '최종환 대리',
    contactPersonEmail: '무툰 공용메일: contents@gtf-group.co.kr; 최종환(참조): kinan4@fingerstory.com; 간명해(참조): myeonghae@fingerstory.com',
    contactNumber: '010-4753-3023',
    manuscriptSpec: '720x2000(jpg)',
    coverBannerSpec: '-',
    thumbnailSpec: '-'
  },
  {
    id: '7',
    companyName: '케이툰',
    deliveryDeadline: '원고 오픈 2~3일전',
    registrationLink: 'https://ims.myktoon.com/auth/login.kt',
    loginId: 'moontech',
    password: 'moontech123!',
    contactPersonName: '유창선 MD',
    contactPersonEmail: 'cs1.yoo@kt.com',
    contactNumber: '010-3411-5250',
    manuscriptSpec: '720* 페이지',
    coverBannerSpec: '-',
    thumbnailSpec: '300x300'
  },
  {
    id: '8',
    companyName: '블라이스',
    deliveryDeadline: '원고 오픈 2~3일전',
    registrationLink: 'https://www.blice.co.kr/web/homescreen/main.kt (업로드 후, 메일 검수 요청 필요)',
    loginId: 'creammedia@naver.com',
    password: 'moontech123!',
    contactPersonName: '홍은설 MD',
    contactPersonEmail: 'es1.hong@kt.com',
    contactNumber: '010-5915-9760',
    manuscriptSpec: '720x2000',
    coverBannerSpec: '720x972',
    thumbnailSpec: '-'
  },
  {
    id: '9',
    companyName: '원스토리',
    deliveryDeadline: '',
    registrationLink: 'https://dev.onestore.net/devpoc/index.omp',
    loginId: 'creammedia',
    password: 'moontech123!',
    contactPersonName: '윤현경 대리',
    contactPersonEmail: '9001237@partner.onestorecorp.com; review.webtoon@onestorecorp.com',
    contactNumber: '010-5009-6502',
    manuscriptSpec: '720x2000',
    coverBannerSpec: '720x448',
    thumbnailSpec: '300x300'
  },
  {
    id: '10',
    companyName: '미스터블루',
    deliveryDeadline: '원고 오픈 2~3일전',
    registrationLink: 'https://cp-manage.mrblue.com/',
    loginId: 'moon_w',
    password: 'moontg1234!',
    contactPersonName: '김희나 매니저',
    contactPersonEmail: 'gmlskrla94@mrblue.com; webtoon_conts@mrblue.com; (참고) chy1006@mrblue.com; comic_conts@mrblue.com',
    contactNumber: '김희나: 010-4705-0633',
    manuscriptSpec: '720x2000',
    coverBannerSpec: '580x838, 1600x520, 600x360, 300x300',
    thumbnailSpec: '640x496'
  },
  {
    id: '11',
    companyName: '인터넷 만화방',
    deliveryDeadline: '원고 오픈 2~3일전',
    registrationLink: 'http://cp-update.manhwa.co.kr/',
    loginId: 'moontech',
    password: 'moontech123!',
    contactPersonName: '안지연 대리',
    contactPersonEmail: 'ajy319@hanarum.com',
    contactNumber: '070-7433-3208',
    manuscriptSpec: '720x2000',
    coverBannerSpec: '-',
    thumbnailSpec: '-'
  },
  {
    id: '12',
    companyName: '애니툰',
    deliveryDeadline: '원고 오픈 2~3일전',
    registrationLink: 'https://anycp.anytoon.co.kr/login',
    loginId: 'moontech',
    password: 'moontech123!',
    contactPersonName: '윤예슬 PD',
    contactPersonEmail: 'yess05@anytoon.kr',
    contactNumber: '010-2628-7473',
    manuscriptSpec: '720x2500',
    coverBannerSpec: '640x324',
    thumbnailSpec: '150x100'
  },
  {
    id: '13',
    companyName: '네이버 시리즈',
    deliveryDeadline: '원고 오픈 2~3일전',
    registrationLink: 'https://friend.navercorp.com/main/welcome (업로드 후, 메일 검수 요청 필요)',
    loginId: 'FRA24816',
    password: 'moontg0313@@',
    contactPersonName: '오정민',
    contactPersonEmail: 'jungminoh@webtoonscorp.com; dl_bookscomic_part@gwebscorp.com',
    contactNumber: '010-8222-5196',
    manuscriptSpec: '720x3000',
    coverBannerSpec: '300x213',
    thumbnailSpec: '세로형: 300x430 / 가로형: 650x760'
  },
  {
    id: '14',
    companyName: '리디북스',
    deliveryDeadline: '원고 오픈 2~3일전',
    registrationLink: 'https://cp.ridibooks.com/cp/login',
    loginId: '690-81-00705',
    password: 'moontech123!',
    contactPersonName: '리디웹툰 운영팀',
    contactPersonEmail: 'webtoon.operation@ridi.com',
    contactNumber: '-',
    manuscriptSpec: '720x2000',
    coverBannerSpec: '720x1044',
    thumbnailSpec: '720x448'
  },
  {
    id: '15',
    companyName: '레진코믹스',
    deliveryDeadline: '원고 오픈 2~3일전',
    registrationLink: 'https://partner.lezhin.com',
    loginId: 'creammedia',
    password: 'Moontg0313@@',
    contactPersonName: '',
    contactPersonEmail: '',
    contactNumber: '-',
    manuscriptSpec: '720x5216',
    coverBannerSpec: '',
    thumbnailSpec: '300x400'
  },
  {
    id: '16',
    companyName: '교보문고',
    deliveryDeadline: '',
    registrationLink: 'https://partner.kyobobook.co.kr/login',
    loginId: 'moontech',
    password: 'qwert12345',
    contactPersonName: '',
    contactPersonEmail: '',
    contactNumber: '',
    manuscriptSpec: '',
    coverBannerSpec: '',
    thumbnailSpec: ''
  },
];

export const INITIAL_WEBTOONS: Webtoon[] = [
  // 국내비독점 [라이브]
  { id: '1', title: '감금연휴: 미화원 아줌마의 본망', type: '국내비독점 [라이브]', platforms: { '투믹스': 'pending', '무툰': 'pending', '미툰': 'pending', '애니툰': 'pending', '큐툰': 'pending', '네이버 시리즈': 'pending', '케이툰': 'pending', '블라이스': 'pending', '리디북스': 'pending', '미스터블루': 'pending', '왓챠': 'pending' } },
  { id: '2', title: '교환 부부 여행기', type: '국내비독점 [라이브]', platforms: { '투믹스': 'pending', '무툰': 'pending', '미툰': 'pending', '애니툰': 'pending', '큐툰': 'pending', '네이버 시리즈': 'pending', '케이툰': 'pending', '블라이스': 'pending', '리디북스': 'pending', '미스터블루': 'pending', '왓챠': 'pending' } },
  // ... 더 많은 작품들 (간소화를 위해 일부만 표시)
];