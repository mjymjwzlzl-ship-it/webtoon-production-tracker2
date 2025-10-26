import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, where, getDocs, writeBatch, orderBy } from 'firebase/firestore';
import { db, storage } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

import TrackerTable from './components/TrackerTable';
import WorkerManager from './components/WorkerManager';
import ProjectSidebar from './components/ProjectSidebar';
import WorkerAssignments from './components/WorkerAssignments';
import ConfirmationModal from './components/ConfirmationModal';
import AddProjectModal from './components/AddProjectModal';
import ProjectDetails from './components/ProjectDetails';
// import LaunchStatus from './components/LaunchStatus';
import LaunchSidebar from './components/LaunchSidebar';
import BulkView from './components/BulkView';
import ZoomViewer from './components/ZoomViewer';
import WebtoonTracker from './components/WebtoonTracker';
import DailyTasks from './components/DailyTasks';
import UrgentNoticeModal from './components/UrgentNoticeModal';
import UrgentNoticeBoard from './components/UrgentNoticeBoard';
import HideEpisodesModal from './components/HideEpisodesModal';
import SettlementView from './components/SettlementView';
import { getKoreanToday } from './utils/dateUtils';
import { INITIAL_PROJECT_TITLE, ADULT_PROCESSES, GENERAL_PROCESSES, EPISODE_COUNT, getAdultProcesses } from './constants';
import type { Statuses, Process, Project, CellState, ProjectStatus, ProjectType, Team, Worker, AdultSubType, CopeInterSubType } from './types';

const categoryStyles: { [key: string]: { border: string, tagBg: string, tagText: string, button: string } } = {
  art: {
    border: "border-blue-500",
    tagBg: "bg-blue-100",
    tagText: "text-blue-700",
    button: "bg-blue-500 hover:bg-blue-600"
  },
  text: {
    border: "border-green-500",
    tagBg: "bg-green-100",
    tagText: "text-green-700",
    button: "bg-green-500 hover:bg-green-600"
  },
  production: {
    border: "border-yellow-500",
    tagBg: "bg-yellow-100",
    tagText: "text-yellow-700",
    button: "bg-yellow-500 hover:bg-yellow-600"
  },
  other: {
    border: "border-gray-500",
    tagBg: "bg-gray-100",
    tagText: "text-gray-700",
    button: "bg-gray-500 hover:bg-gray-600"
  }
};

const categoryNames: { [key: string]: string } = {
  art: "그림",
  text: "글",
  production: "제작",
  other: "기타"
};

const getInitialStatuses = (episodeCount: number, processes: Process[]): Statuses => {
  const initial: Statuses = {};
  for (let i = 1; i <= episodeCount; i++) {
    processes.forEach(proc => {
      const key = `${proc.id}-${i}`;
      initial[key] = { status: 'none', text: '' };
    });
  }
  return initial;
};

const createProject = (type: ProjectType, team: Team, adultSubType?: AdultSubType): Omit<Project, 'id'> => {
  const processes = type === 'adult' 
    ? (adultSubType ? getAdultProcesses(adultSubType) : ADULT_PROCESSES)
    : GENERAL_PROCESSES;

  const base = {
    title: INITIAL_PROJECT_TITLE,
    type: type,
    // adultSubType/copeInterSubType는 일반 작품일 경우 저장 안 함
    internalAiWeight: '',
    team: team,
    storyWriter: '',
    artWriter: '',
    identifierType: 'isbn',
    identifierValue: '',
    synopsis: '',
    processes: processes.map(p => ({ ...p, assignee: '' })),
    episodeCount: EPISODE_COUNT,
    startEpisode: 1,
    statuses: getInitialStatuses(EPISODE_COUNT, processes),
    hasGeneralCover: false,
    hasAdultCover: false,
    hasLogo: false,
    hasCharacterSheet: false,
    hasSynopsis: false,
    hasProposal: false,
    lastModified: Date.now(),
    status: 'production' as const,
  };

  if (type === 'adult') {
    const adultBase = { ...base, adultSubType } as Omit<Project, 'id'>;
    if (adultSubType === 'cope-inter') {
      return { ...adultBase, copeInterSubType: 'v1-brush' } as Omit<Project, 'id'>;
    }
    return adultBase;
  }
  return { ...base } as Omit<Project, 'id'>;
};

// Helper function to aggressively sanitize data from Firestore. It converts any object-like
// structure (including class instances from Firestore like Timestamps) into plain objects and arrays.
const sanitizeFirestoreData = (data: any): any => {
    if (data === null || data === undefined) {
        return data;
    }

    // Firestore Timestamps have a toMillis method. This is our primary target.
    if (typeof data.toMillis === 'function') {
        return data.toMillis();
    }
    
    // Recurse into arrays, sanitizing each item.
    if (Array.isArray(data)) {
        return data.map(item => sanitizeFirestoreData(item));
    }

    // This is the key change: handle ANY object-like value that isn't null or an array.
    // This will catch class instances returned by Firestore (other than Timestamps) and convert them
    // into plain objects, stripping them of their prototype chain and internal circular references.
    if (typeof data === 'object') {
        const sanitizedObject: { [key: string]: any } = {};
        for (const key in data) {
            // Ensure it's an own property before processing to avoid inherited properties.
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                sanitizedObject[key] = sanitizeFirestoreData(data[key]);
            }
        }
        return sanitizedObject;
    }

    // Return primitive values (string, number, boolean) directly.
    return data;
};


const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectSortOrder, setProjectSortOrder] = useState<'lastModified' | 'alphabetical' | 'subType' | 'progress'>('lastModified');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | 'all'>('all');
  const [view, setView] = useState<'tracker' | 'workers' | 'dailyTasks'>('tracker');
  const [mainTab, setMainTab] = useState<'schedule' | 'launch2'>('schedule');
  const [isBulkView, setIsBulkView] = useState(false);
  const [showCompletedOnly, setShowCompletedOnly] = useState(false);
  const [bulkViewState, setBulkViewState] = useState<any>(null);
  
  // 줌 상태
  const [zoom, setZoom] = useState(100);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; title: string } | null>(null);
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [workerTeamFilter, setWorkerTeamFilter] = useState<Team | 'all'>('all');
  const [searchedWorkers, setSearchedWorkers] = useState<Worker[]>([]);
  const [isWorkerCompactView, setIsWorkerCompactView] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [isWorkFilterCollapsed, setIsWorkFilterCollapsed] = useState(true);
  const [isUrgentNoticeModalOpen, setIsUrgentNoticeModalOpen] = useState(false);
  const [isUrgentNoticeBoardOpen, setIsUrgentNoticeBoardOpen] = useState(false);
  const [hasUrgentNotices, setHasUrgentNotices] = useState(false);
  const [isProjectEditing, setIsProjectEditing] = useState(false);
  const [isHideEpisodesModalOpen, setIsHideEpisodesModalOpen] = useState(false);
  
  // 사이드바에서 필터링된 작품 목록
  const [filteredProjectsFromSidebar, setFilteredProjectsFromSidebar] = useState<Project[]>([]);
  
  // AI링크 관련 상태
  const [currentPage, setCurrentPage] = useState<'main' | 'ai-links' | 'settlement'>('main');
  const [passwordInput, setPasswordInput] = useState('');
  const [isPasswordCorrect, setIsPasswordCorrect] = useState(false);
  
  // 업체 정산 비밀번호 관련 상태
  const [showSettlementPasswordModal, setShowSettlementPasswordModal] = useState(false);
  const [settlementPasswordInput, setSettlementPasswordInput] = useState('');
  const SETTLEMENT_PASSWORD = '900228';
  const [aiSites, setAiSites] = useState<any[]>([]);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [newSiteDescription, setNewSiteDescription] = useState('');
  const [newSiteCategory, setNewSiteCategory] = useState('art');

  const [editingSite, setEditingSite] = useState<any | null>(null);
  const draggedItemIndex = useRef<number | null>(null);
  const draggedOverItemIndex = useRef<number | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // --- Real-time data listeners ---
  useEffect(() => {
    // One-time data seeding to Firestore
    const seedData = async () => {
      const seeded = localStorage.getItem('aiLinksSeeded_v1');
      if (seeded) return;

      const linksCollection = collection(db, "ai_links");
      const snapshot = await getDocs(linksCollection);
      
      if (snapshot.empty) {
        console.log("Firestore 'ai_links' is empty. Seeding data...");
        const initialSites = [
            { name: '우주의 기운1 (유료)', url: '#', description: '전반적인 웹툰 제작을 돕는 AI툴 (유료버전)', category: 'art' },
            { name: '우주의 기운2 (유료)', url: '#', description: '모듈 활용한 웹툰 제작에 최적화된 AI툴 (유료버전)', category: 'art' },
            { name: '우주의 기운3 (유료)', url: '#', description: '웹툰 편집에 최적화 된 AI툴 (유료버전)', category: 'art' },
            { name: '우주의 기운1 (무료)', url: '#', description: '전반적인 웹툰 제작을 돕는 AI툴 (하루 100회 제한)', category: 'art' },
            { name: '우주의 기운2 (무료)', url: '#', description: '모듈 활용한 웹툰 제작에 최적화된 AI툴 (하루 100회 제한)', category: 'art' },
            { name: '우주의 기운3 (무료)', url: '#', description: '웹툰 편집에 최적화 된 AI툴 (하루 100회 제한)', category: 'art' },
            { name: '우주의 기운4 (무료)', url: '#', description: '흑백만화에 최적화 된 AI툴 (하루 100회 제한)', category: 'art' },
            { name: '우주의 기운 (VN)', url: '#', description: '베트남에서 쓸 수 있게 만든 우주의 기운 (하루 100회 제한)', category: 'art' },
            { name: '신화창조의 기운', url: '#', description: '작품 소개글을 넣으면 기획서로 만들어주는 AI', category: 'text' },
            { name: '극치정점', url: '#', description: '글작가들에게 도움을 주는 AI툴', category: 'text' },
            { name: '컷콘티 제작', url: '#', description: '글콘티를 넣으면 컷콘티 스크립트로 제작해주는 AI', category: 'text' },
            { name: '문페인터', url: '#', description: '코페인터 벤치마킹하여 제작한 AI툴', category: 'production' },
            { name: '원고 생성기', url: '#', description: '캐릭터,배경,스토리를 삽입하여 원고를 한번에 만들어주는 툴', category: 'production' },
            { name: 'be blessed with God', url: '#', description: '포토샵 처럼 인터페이스가 되어있고 AI웹툰을 만들 수 있는 툴', category: 'production' },
        ];
        
        const batch = writeBatch(db);
        initialSites.forEach((site, index) => {
          const newDocRef = doc(linksCollection);
          batch.set(newDocRef, { ...site, order: index });
        });
        await batch.commit();
        console.log("Data seeding complete!");
      }
      localStorage.setItem('aiLinksSeeded_v1', 'true');
    };
    seedData();
    
    // AI 링크 실시간 리스너
    const aiLinksQuery = query(collection(db, "ai_links"), orderBy("order"));
    const unsubscribeAiLinks = onSnapshot(aiLinksQuery, (snapshot) => {
      const fetchedLinks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAiSites(fetchedLinks);
    });
    
    let unsubscribeProjects: () => void;
    let unsubscribeWorkers: () => void;

    try {
      // const projectsQuery = query(collection(db, "projects"));
      // unsubscribeProjects = onSnapshot(projectsQuery, (snapshot) => {
      //   const fetchedProjects: Project[] = snapshot.docs.map(doc => {
      //       const rawData = doc.data();
      //       // Sanitize the entire raw data object to prevent circular references
      //       const sanitizedData = sanitizeFirestoreData(rawData);
            
      //       // Reconstruct the object with type safety and defaults
      //       const project: Project = {
      //         id: doc.id,
      //         title: sanitizedData.title || '',
      //         type: sanitizedData.type || 'adult',
      //         team: sanitizedData.team || '0팀',
      //         storyWriter: sanitizedData.storyWriter || '',
      //         artWriter: sanitizedData.artWriter || '',
      //         isbn: sanitizedData.isbn || '',
      //         processes: sanitizedData.processes || [],
      //         episodeCount: sanitizedData.episodeCount || 0,
      //         statuses: sanitizedData.statuses || {},
      //         hasCover: sanitizedData.hasCover || false,
      //         hasLogo: sanitizedData.hasLogo || false,
      //         lastModified: sanitizedData.lastModified || Date.now(),
      //         status: sanitizedData.status || 'production',
      //       };
      //       return project;
      //   });
      //   setProjects(fetchedProjects);
      //   setLoading(false);
      // }, (err) => {
      //   console.error("Error fetching projects:", err);
      //   setError("프로젝트 데이터를 불러오는 데 실패했습니다. Firebase 설정을 확인하세요.");
      //   setLoading(false);
      // });

      // const workersQuery = query(collection(db, "workers"));
      // unsubscribeWorkers = onSnapshot(workersQuery, (snapshot) => {
      //   const fetchedWorkers: Worker[] = snapshot.docs.map(doc => {
      //     const rawData = doc.data();
      //     const sanitizedData = sanitizeFirestoreData(rawData);
      //     const worker: Worker = {
      //         id: doc.id,
      //         name: sanitizedData.name || '',
      //         team: sanitizedData.team || '0팀'
      //     };
      //     return worker;
      //   });
      //   setWorkers(fetchedWorkers.sort((a,b) => a.name.localeCompare(b.name)));
      // }, (err) => {
      //   console.error("Error fetching workers:", err);
      //   setError("작업자 데이터를 불러오는 데 실패했습니다.");
      // });

      const projectsQuery = query(collection(db, "projects"));
      unsubscribeProjects = onSnapshot(projectsQuery, (snapshot) => {
        const fetchedProjects: Project[] = snapshot.docs.map(doc => {
            const rawData = doc.data();
            // Sanitize the entire raw data object to prevent circular references
            const sanitizedData = sanitizeFirestoreData(rawData);
            
            // Reconstruct the object with type safety and defaults
            const project: Project = {
              id: doc.id,
              title: sanitizedData.title || '',
              type: sanitizedData.type || 'adult',
              adultSubType: sanitizedData.adultSubType || undefined,
              copeInterSubType: sanitizedData.copeInterSubType || undefined,
              internalAiWeight: sanitizedData.internalAiWeight || '',
              team: sanitizedData.team || '0팀',
              storyWriter: sanitizedData.storyWriter || '',
              artWriter: sanitizedData.artWriter || '',
              identifierType: sanitizedData.identifierType || 'isbn',
              identifierValue: sanitizedData.identifierValue || '',
              synopsis: sanitizedData.synopsis || '',
              processes: sanitizedData.processes || [],
              episodeCount: sanitizedData.episodeCount || 0,
              statuses: sanitizedData.statuses || {},
              // IMPORTANT: persist newly added fields
              startEpisode: sanitizedData.startEpisode || 1,
              hiddenEpisodes: sanitizedData.hiddenEpisodes || [],
              hasGeneralCover: sanitizedData.hasGeneralCover || sanitizedData.hasCover || false,
              hasAdultCover: sanitizedData.hasAdultCover || false,
              hasLogo: sanitizedData.hasLogo || false,
              hasCharacterSheet: sanitizedData.hasCharacterSheet || false,
              hasSynopsis: sanitizedData.hasSynopsis || false,
              hasProposal: sanitizedData.hasProposal || false,
              memo: sanitizedData.memo || '', // 메모 필드 추가
              lastModified: sanitizedData.lastModified || Date.now(),
              status: sanitizedData.status || 'production',
            };
            return project;
        });
        setProjects(fetchedProjects);
        setLoading(false);
      }, (err) => {
        console.error("Error fetching projects:", err);
        setError("프로젝트 데이터를 불러오는 데 실패했습니다. Firebase 설정을 확인하세요.");
        setLoading(false);
      });

      const workersQuery = query(collection(db, "workers"));
      unsubscribeWorkers = onSnapshot(workersQuery, (snapshot) => {
        const fetchedWorkers: Worker[] = snapshot.docs.map(doc => {
          const rawData = doc.data();
          const sanitizedData = sanitizeFirestoreData(rawData);
          const worker: Worker = {
              id: doc.id,
              name: sanitizedData.name || '',
              team: sanitizedData.team || '0팀'
          };
          return worker;
        });
        setWorkers(fetchedWorkers.sort((a,b) => a.name.localeCompare(b.name)));
      }, (err) => {
        console.error("Error fetching workers:", err);
        setError("작업자 데이터를 불러오는 데 실패했습니다.");
      });

    } catch(err) {
        console.error("Firebase setup error:", err);
        setError("데이터베이스 연결에 실패했습니다. firebase.ts 파일의 설정을 확인하세요.");
        setLoading(false);
    }

    return () => {
      if (unsubscribeAiLinks) unsubscribeAiLinks();
      if (unsubscribeProjects) unsubscribeProjects();
      if (unsubscribeWorkers) unsubscribeWorkers();
    };
  }, []);

  // 마지막으로 본 메인 탭 복원
  useEffect(() => {
    try {
      const saved = localStorage.getItem('wt_main_tab');
      if (saved === 'schedule' || saved === 'launch2') {
        setMainTab(saved as any);
      } else if (saved === 'launch') {
        // 과거 저장값이 있는 경우 런칭2로 매핑
        setMainTab('launch2');
      }
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem('wt_main_tab', mainTab); } catch {}
  }, [mainTab]);

  // 공지사항 데이터 실시간 가져오기
  useEffect(() => {
    let unsubscribeNotices: () => void;
    
    try {
      const noticesQuery = query(collection(db, "urgentNotices"));
      unsubscribeNotices = onSnapshot(noticesQuery, (snapshot) => {
        const notices = snapshot.docs.map(doc => doc.data());
        console.log("공지사항 데이터:", notices);
        
        // 한국 시간으로 오늘 날짜 가져오기
        const now = new Date();
        const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
        const today = koreaTime.toISOString().split('T')[0];
        console.log("오늘 날짜:", today);
        
        const hasTodayNotices = notices.some(notice => {
          console.log("공지사항 날짜:", notice.date, "제목:", notice.title);
          // 날짜 형식이 다를 수 있으므로 더 유연하게 비교
          const noticeDate = notice.date ? notice.date.toString().split('T')[0] : '';
          const hasValidTitle = notice.title && notice.title.trim() !== '';
          const isToday = noticeDate === today;
          console.log("날짜 비교:", noticeDate, "===", today, "결과:", isToday);
          console.log("제목 유효:", hasValidTitle);
          return isToday && hasValidTitle;
        });
        
        console.log("오늘 공지사항 있음:", hasTodayNotices);
        setHasUrgentNotices(hasTodayNotices);
      }, (err) => {
        console.error("Error fetching notices:", err);
      });
    } catch (err) {
      console.error("Firebase setup error for notices:", err);
    }

    return () => {
      if (unsubscribeNotices) unsubscribeNotices();
    };
  }, []);
  
  // Effect to ensure the active project ID is always valid.
  useEffect(() => {
    if (projects.length > 0) {
      if (!activeProjectId || !projects.some(p => p.id === activeProjectId)) {
        // 완결작이 아닌 작품들을 우선으로 선택
        const nonCompletedProjects = projects.filter(p => p.status !== 'completed');
        
        if (nonCompletedProjects.length > 0) {
          // 완결작이 아닌 작품 중에서 가장 최근에 수정된 것 선택
          const sorted = [...nonCompletedProjects].sort((a, b) => b.lastModified - a.lastModified);
          setActiveProjectId(sorted[0]?.id || null);
        } else {
          // 완결작만 있는 경우에만 완결작 중에서 선택
          const sorted = [...projects].sort((a, b) => b.lastModified - a.lastModified);
          setActiveProjectId(sorted[0]?.id || null);
        }
      }
    } else {
      setActiveProjectId(null);
    }
  }, [projects, activeProjectId]);

  const activeProject = useMemo(() => {
    return projects.find(p => p.id === activeProjectId);
  }, [projects, activeProjectId]);

  // AI 사이트 목록을 로컬 스토리지에서 불러오기
  // useEffect(() => {
  //   const savedSites = localStorage.getItem('aiSites');
  //   if (savedSites) {
  //     setAiSites(JSON.parse(savedSites));
  //   }
  // }, []);

  // AI 사이트 목록을 로컬 스토리지에 저장
  // useEffect(() => {
  //   localStorage.setItem('aiSites', JSON.stringify(aiSites));
  // }, [aiSites]);

  // AI링크 비밀번호 확인 함수
  const handlePasswordCheck = () => {
    if (passwordInput === '900228') {
      setIsPasswordCorrect(true);
      setPasswordInput('');
      setCurrentPage('ai-links');
    } else {
      alert('비밀번호가 올바르지 않습니다.');
      setPasswordInput('');
    }
  };

  // AI링크 페이지로 이동
  const handleGoToAiLinks = () => {
    setCurrentPage('ai-links');
  };

  // 업체 정산 페이지로 이동 (비밀번호 확인 후)
  const handleGoToSettlement = () => {
    setShowSettlementPasswordModal(true);
  };

  // 업체 정산 비밀번호 확인
  const handleSettlementPasswordSubmit = () => {
    if (settlementPasswordInput === SETTLEMENT_PASSWORD) {
      setCurrentPage('settlement');
      setShowSettlementPasswordModal(false);
      setSettlementPasswordInput('');
    } else {
      alert('비밀번호가 틀렸습니다.');
      setSettlementPasswordInput('');
    }
  };

  // 업체 정산 비밀번호 모달 닫기
  const handleCloseSettlementPasswordModal = () => {
    setShowSettlementPasswordModal(false);
    setSettlementPasswordInput('');
  };

  // 메인 페이지로 돌아가기
  const handleGoToMain = () => {
    setCurrentPage('main');
    setIsPasswordCorrect(false);
    setPasswordInput('');
  };

  const filteredAiSites = useMemo(() => {
    return aiSites
      .filter(site => {
        // Category filter
        if (activeCategory === 'all') return true;
        return site.category === activeCategory;
      })
      .filter(site => {
        // Search term filter
        const term = searchTerm.toLowerCase();
        return (
          site.name.toLowerCase().includes(term) ||
          site.description.toLowerCase().includes(term)
        );
      });
  }, [aiSites, searchTerm, activeCategory]);

  // AI 사이트 추가
  const handleAddAiSite = async () => {
    if (newSiteName.trim() && newSiteUrl.trim()) {
      const newSite = {
        name: newSiteName.trim(),
        url: newSiteUrl.trim(),
        description: newSiteDescription.trim(),
        category: newSiteCategory,
        order: aiSites.length // Add order field
      };
      await addDoc(collection(db, "ai_links"), newSite);
      setNewSiteName('');
      setNewSiteUrl('');
      setNewSiteDescription('');
      setNewSiteCategory('art');
    }
  };

  // AI 사이트 삭제
  const handleDeleteAiSite = async (id: string) => {
    await deleteDoc(doc(db, "ai_links", id));
  };

  // AI 사이트 수정
  const handleUpdateAiSite = async (updatedSite: any) => {
    const { id, ...dataToUpdate } = updatedSite;
    const siteRef = doc(db, "ai_links", id);
    await updateDoc(siteRef, dataToUpdate);
    setEditingSite(null);
  };

  // 드래그 앤 드롭 핸들러
  const handleDragStart = (index: number) => {
    draggedItemIndex.current = index;
  };

  const handleDragEnter = (index: number) => {
    draggedOverItemIndex.current = index;
  };

  const handleDrop = async () => {
    const newAiSites = [...aiSites];
    const draggedItem = newAiSites.splice(draggedItemIndex.current!, 1)[0];
    newAiSites.splice(draggedOverItemIndex.current!, 0, draggedItem);
    
    draggedItemIndex.current = null;
    draggedOverItemIndex.current = null;
    
    setAiSites(newAiSites); // Optimistically update UI

    // Update order in Firestore
    const batch = writeBatch(db);
    newAiSites.forEach((site, index) => {
      const siteRef = doc(db, "ai_links", site.id);
      batch.update(siteRef, { order: index });
    });
    await batch.commit();
  };
  
  const updateActiveProject = useCallback(async (updates: Partial<Project>) => {
    if (!activeProjectId) return;
    try {
      console.log('프로젝트 업데이트 시작:', updates);
      const projectRef = doc(db, "projects", activeProjectId);
      
      // Firestore에 undefined 값을 전달하지 않도록 필터링
      const sanitizedUpdates: { [key: string]: any } = {};
      for (const key in updates) {
        if (Object.prototype.hasOwnProperty.call(updates, key)) {
          const value = (updates as any)[key];
          // memo 필드는 빈 문자열도 허용
          if (value !== undefined && (key === 'memo' || value !== '')) {
            sanitizedUpdates[key] = value;
          }
        }
      }

      console.log('Firestore 업데이트 데이터:', sanitizedUpdates);
      await updateDoc(projectRef, { ...sanitizedUpdates, lastModified: Date.now() });
      console.log('프로젝트 업데이트 완료');
      
      // 제목이 변경된 경우 런칭현황에서도 동기화
      if (updates.title) {
        const launchProjectsQuery = query(collection(db, "launchProjects"), where("projectId", "==", activeProjectId));
        const launchProjectsSnapshot = await getDocs(launchProjectsQuery);
        const updatePromises = launchProjectsSnapshot.docs.map(doc => 
          updateDoc(doc.ref, { title: updates.title })
        );
        await Promise.all(updatePromises);
      }
    } catch (err) {
      console.error("Error updating project:", err);
      alert("프로젝트 업데이트에 실패했습니다.");
    }
  }, [activeProjectId]);

  const handleCellChange = useCallback(async (processId: number, episode: number, newCellState: CellState) => {
    if(!activeProject) return;
    const key = `statuses.${processId}-${episode}`;
    
    try {
      // 일정관리 상태 업데이트
      await updateActiveProject({ [key]: newCellState });

      // 오늘의 할일과 연동 (오늘 날짜인 경우만)
      const today = getKoreanToday();
      if (newCellState.status === 'done' || newCellState.status === 'none') {
        // 해당 프로젝트, 프로세스, 에피소드에 대한 오늘의 할일 찾기
        const dailyTasksQuery = query(
          collection(db, 'dailyTasks'),
          where('date', '==', today),
          where('projectId', '==', activeProject.id),
          where('processId', '==', processId),
          where('episode', '==', episode)
        );

        const snapshot = await getDocs(dailyTasksQuery);
        const updatePromises = snapshot.docs.map(docSnapshot => {
          return updateDoc(docSnapshot.ref, {
            completed: newCellState.status === 'done',
            updatedAt: Date.now()
          });
        });

        await Promise.all(updatePromises);
      }
    } catch (error) {
      console.error('Error syncing cell change:', error);
    }
  }, [activeProject, updateActiveProject]);

  const handleAssigneeChange = useCallback((processId: number, newAssigneeId: string) => {
    if(!activeProject) return;
    const newProcesses = activeProject.processes.map(p =>
      p.id === processId ? { ...p, assignee: newAssigneeId } : p
    );
    updateActiveProject({ processes: newProcesses });
  }, [activeProject, updateActiveProject]);

  const handleEpisodeCompletionToggle = useCallback((episode: number, shouldBeComplete: boolean) => {
     if(!activeProject) return;
      const newStatus = shouldBeComplete ? 'done' : 'none';
      const updates: { [key: string]: CellState } = {};
      activeProject.processes.forEach(process => {
        const key = `${process.id}-${episode}`;
        const currentCell = activeProject.statuses[key] || { status: 'none', text: '' };
        updates[`statuses.${key}`] = { ...currentCell, status: newStatus };
      });
      updateActiveProject(updates);
  }, [activeProject, updateActiveProject]);

  const handleAddWorker = async (name: string, team: Team) => {
    const trimmedName = name.trim();
    if (trimmedName) {
      try {
        const q = query(collection(db, "workers"), where("name", "==", trimmedName));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            alert("이미 동일한 이름의 작업자가 존재합니다.");
            return;
        }
        await addDoc(collection(db, "workers"), { name: trimmedName, team });
      } catch (err) {
        console.error("Error adding worker:", err);
        alert("작업자 추가에 실패했습니다.");
      }
    }
  };

  const handleDeleteWorker = async (workerIdToDelete: string) => {
    try {
      const batch = writeBatch(db);
      
      const workerRef = doc(db, "workers", workerIdToDelete);
      batch.delete(workerRef);

      const projectsSnapshot = await getDocs(query(collection(db, "projects")));
      projectsSnapshot.forEach(projectDoc => {
        const project = projectDoc.data() as Project;
        let needsUpdate = false;
        const updatedProcesses = project.processes.map(p => {
          if (p.assignee === workerIdToDelete) {
            needsUpdate = true;
            return { ...p, assignee: "" };
          }
          return p;
        });

        if (needsUpdate) {
          const projectRef = doc(db, "projects", projectDoc.id);
          batch.update(projectRef, { processes: updatedProcesses });
        }
      });
      
      await batch.commit();

      setActiveFilter(prevFilter => (prevFilter === workerIdToDelete ? null : prevFilter));
    } catch (err) {
      console.error("Error deleting worker:", err);
      alert("작업자 삭제에 실패했습니다.");
    }
  };

  const handleUpdateWorker = async (workerId: string, newName: string, newTeam: Team) => {
    try {
      const workerRef = doc(db, "workers", workerId);
      await updateDoc(workerRef, { 
        name: newName, 
        team: newTeam 
      });
      alert("작업자 정보가 성공적으로 수정되었습니다.");
    } catch (err) {
      console.error("Error updating worker:", err);
      alert("작업자 정보 수정에 실패했습니다.");
    }
  };

  const handleSetFilter = (workerId: string | null) => {
    setActiveFilter(workerId);
  };
  
  const handleAddEpisode = () => {
    if(!activeProject) return;
    updateActiveProject({ episodeCount: activeProject.episodeCount + 1 });
  };

  const handleRemoveEpisode = () => {
    if(!activeProject || activeProject.episodeCount <= 1) return;
      const lastEpisode = activeProject.episodeCount;
      const updates: any = { episodeCount: activeProject.episodeCount - 1 };
      
      // Firestore does not directly support deleting map fields.
      // We read the map, remove keys, and write it back.
      const newStatuses = { ...activeProject.statuses };
      activeProject.processes.forEach(process => {
        delete newStatuses[`${process.id}-${lastEpisode}`];
      });
      updates.statuses = newStatuses;
      updateActiveProject(updates);
  };

  const handleProjectStatusChange = (newStatus: ProjectStatus) => {
    updateActiveProject({ status: newStatus });
  };

  const handleSelectProject = useCallback((id: string) => {
      setActiveProjectId(id);
      setActiveFilter(null);
  }, []);

  const handleSelectProjectFromBulkView = useCallback((projectId: string, bulkViewState?: any) => {
    // 일괄보기 상태를 브라우저 히스토리에 저장
    const bulkViewHistoryState = {
      isBulkView: true,
      scrollPosition: window.pageYOffset,
      activeProjectId: null, // 일괄보기에서는 특정 작품이 선택되지 않은 상태
      bulkViewState: bulkViewState || {} // BulkView의 현재 상태 (검색어, 정렬, 필터, 작게보기 등)
    };
    
    // 현재 상태를 히스토리에 추가 (pushState 사용)
    window.history.pushState(bulkViewHistoryState, '', window.location.pathname);
    
    // 개별 작품 상태를 히스토리에 추가
    const individualViewState = {
      isBulkView: false,
      activeProjectId: projectId,
      scrollPosition: 0
    };
    
    setActiveProjectId(projectId);
    setIsBulkView(false);
    // 뷰 전환 시 최상단으로 스크롤
    window.scrollTo(0, 0);
    
    // 개별 작품 상태도 히스토리에 추가
    setTimeout(() => {
      window.history.pushState(individualViewState, '', window.location.pathname);
    }, 100);
  }, []);

  const handleAddProject = () => {
    setIsAddProjectModalOpen(true);
  };

  const handleAddProjectFromLaunch = async (projectName: string) => {
    // 런칭현황에서 작품 추가 시 기본값으로 일반 작품, 0팀으로 설정
    const newProjectData = createProject('general', '0팀');
    newProjectData.title = projectName;
    
    try {
      const docRef = await addDoc(collection(db, "projects"), newProjectData);
      
      // 런칭현황에 국내비독점[라이브]와 해외비독점[라이브] 둘 다 추가
      await Promise.all([
        addDoc(collection(db, "launchProjects"), {
          title: projectName,
          category: '국내비독점 [라이브]',
          status: 'live',
          projectId: docRef.id // 메인 프로젝트와 연결
        }),
        addDoc(collection(db, "launchProjects"), {
          title: projectName,
          category: '해외비독점 [라이브]',
          status: 'live',
          projectId: docRef.id // 메인 프로젝트와 연결
        })
      ]);
      
      alert(`작품 "${projectName}"이 성공적으로 추가되었습니다.`);
    } catch (error) {
      console.error("Error adding project: ", error);
      alert("작품 추가 중 오류가 발생했습니다.");
    }
  };

  const handleAddPlatform = () => {
    alert('플랫폼 추가 기능은 준비 중입니다.');
  };

  const handleZoomChange = (newZoom: number) => {
    setZoom(newZoom);
  };
  
  const handleConfirmAddProject = async (type: ProjectType, team: Team, adultSubType?: AdultSubType) => {
      const newProjectData = createProject(type, team, adultSubType);
      try {
        const docRef = await addDoc(collection(db, "projects"), newProjectData);
        
        // 런칭현황에 국내비독점[라이브]와 해외비독점[라이브] 둘 다 추가
        await Promise.all([
          addDoc(collection(db, "launchProjects"), {
            title: newProjectData.title,
            category: '국내비독점 [라이브]',
            status: 'live',
            projectId: docRef.id // 메인 프로젝트와 연결
          }),
          addDoc(collection(db, "launchProjects"), {
            title: newProjectData.title,
            category: '해외비독점 [라이브]',
            status: 'live',
            projectId: docRef.id // 메인 프로젝트와 연결
          })
        ]);
        
        setActiveProjectId(docRef.id);
        setIsAddProjectModalOpen(false);
      } catch (err) {
        console.error("Error adding project:", err);
        alert("프로젝트 추가에 실패했습니다.");
      }
  };

  const handleDeleteProject = (idToDelete: string, title: string) => {
    setProjectToDelete({ id: idToDelete, title });
    setIsDeleteModalOpen(true);
  };
  
  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      // 메인 프로젝트 삭제
      await deleteDoc(doc(db, "projects", projectToDelete.id));
      
      // 런칭현황에서도 해당 프로젝트 삭제
      const launchProjectsQuery = query(collection(db, "launchProjects"), where("projectId", "==", projectToDelete.id));
      const launchProjectsSnapshot = await getDocs(launchProjectsQuery);
      const deletePromises = launchProjectsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // 삭제 완료 후 모달 닫기 및 상태 초기화
      setIsDeleteModalOpen(false);
      setProjectToDelete(null);
    } catch (err) {
      console.error("Error deleting project:", err);
      alert("프로젝트 삭제에 실패했습니다.");
    }
  };
  
  const handleSortOrderChange = (order: 'lastModified' | 'alphabetical' | 'subType' | 'progress') => {
    if (projectSortOrder === order) {
      // 같은 정렬 기준을 다시 클릭하면 방향을 토글
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // 다른 정렬 기준을 클릭하면 해당 기준으로 변경하고 기본 방향 설정
      setProjectSortOrder(order);
      setSortDirection('desc'); // 기본값은 내림차순
    }
  };

  const sortedProjects = useMemo(() => {
    let sortable = [...projects];
    
    // 완결작 필터 적용 - 기본적으로는 완결작이 아닌 것들만, "완결작만 보기"일 때는 완결작만
    if (showCompletedOnly) {
      sortable = sortable.filter(project => project.status === 'completed');
    } else {
      sortable = sortable.filter(project => project.status !== 'completed');
    }
    
    const direction = sortDirection === 'asc' ? 1 : -1;
    
    if (projectSortOrder === 'alphabetical') {
      sortable.sort((a, b) => direction * a.title.localeCompare(b.title));
    } else if (projectSortOrder === 'subType') {
      sortable.sort((a, b) => {
        // 19금 작품을 먼저, 그 다음 하위 유형별로 정렬
        if (a.type !== b.type) {
          const result = a.type === 'adult' ? -1 : 1;
          return direction * result;
        }
        if (a.type === 'adult' && b.type === 'adult') {
          const aSubType = a.adultSubType || 'internal-ai';
          const bSubType = b.adultSubType || 'internal-ai';
          return direction * aSubType.localeCompare(bSubType);
        }
        return 0;
      });
    } else if (projectSortOrder === 'progress') {
      sortable.sort((a, b) => {
        // 진행상황별 정렬: 완결 > 라이브중 > 연재예정 > 제작중 순서
        const statusOrder = { 'completed': 4, 'live': 3, 'scheduled': 2, 'production': 1 };
        const aOrder = statusOrder[a.status] || 0;
        const bOrder = statusOrder[b.status] || 0;
        return direction * (bOrder - aOrder);
      });
    } else { // 'lastModified'
      sortable.sort((a, b) => direction * (b.lastModified - a.lastModified));
    }
    return sortable;
  }, [projects, projectSortOrder, sortDirection, showCompletedOnly]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        
        // 사이드바에서 필터링된 작품 목록이 있으면 그것을 사용, 없으면 기본 정렬된 목록 사용
        const projectsToUse = filteredProjectsFromSidebar.length > 0 ? filteredProjectsFromSidebar : sortedProjects;
        
        const currentIndex = projectsToUse.findIndex(p => p.id === activeProjectId);
        if (currentIndex === -1) return;

        let nextIndex;
        if (e.key === 'ArrowUp') {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : projectsToUse.length - 1;
        } else { // ArrowDown
          nextIndex = currentIndex < projectsToUse.length - 1 ? currentIndex + 1 : 0;
        }
        
        const nextProject = projectsToUse[nextIndex];
        if (nextProject) {
          setActiveProjectId(nextProject.id);
        }
      }
      
      // 백스페이스 키 처리 (뒤로가기)
      if (e.key === 'Backspace' && !isBulkView && !(e.target as Element).matches('input, textarea, [contenteditable]')) {
        e.preventDefault();
        console.log('백스페이스 키로 뒤로가기 실행');
        window.history.back();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [sortedProjects, filteredProjectsFromSidebar, activeProjectId, isBulkView]);

  // 브라우저 뒤로가기 버튼 이벤트 처리 및 초기 히스토리 설정
  useEffect(() => {
    // 초기 히스토리 상태 설정
    if (!window.history.state) {
      const initialState = {
        isBulkView: false,
        activeProjectId: activeProjectId,
        scrollPosition: 0
      };
      window.history.replaceState(initialState, '', window.location.pathname);
    }

    const handlePopState = (event: PopStateEvent) => {
      console.log('popstate 이벤트 발생:', event.state);
      
      if (event.state) {
        // 납품(유통) → 일정 이동 후 뒤로가기 시 유통 탭으로 복귀
        if ((event.state as any).returnToDelivery) {
          setMainTab('launch2');
          // 스크롤 상단으로
          setTimeout(() => window.scrollTo(0, 0), 0);
          return;
        }
        if (event.state.isBulkView) {
          // 일괄보기 상태로 복원
          console.log('일괄보기 상태로 복원', event.state.bulkViewState);
          setIsBulkView(true);
          setActiveProjectId(event.state.activeProjectId);
          setBulkViewState(event.state.bulkViewState || null);
          
          // 스크롤 위치 복원
          setTimeout(() => {
            window.scrollTo(0, event.state.scrollPosition || 0);
          }, 100);
        } else {
          // 개별 작품 상태로 복원
          console.log('개별 작품 상태로 복원');
          setIsBulkView(false);
          setActiveProjectId(event.state.activeProjectId);
          setBulkViewState(null);
          
          // 스크롤 위치 복원
          setTimeout(() => {
            window.scrollTo(0, event.state.scrollPosition || 0);
          }, 100);
        }
      } else {
        // 히스토리 상태가 없는 경우 (페이지 처음 로드 등)
        console.log('히스토리 상태 없음');
        setBulkViewState(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [activeProjectId]);

  const filteredProcesses = useMemo(() => {
    if (!activeProject) return [];
    if (!activeFilter) return activeProject.processes;
    return activeProject.processes.filter(p => p.assignee === activeFilter);
  }, [activeFilter, activeProject]);

  const filteredWorkers = useMemo(() => {
    let filtered = workers;
    
    // 팀 필터링
    if (workerTeamFilter !== 'all') {
      filtered = filtered.filter(w => w.team === workerTeamFilter);
    }
    
    // 선택된 작업자가 있으면 해당 작업자만 표시
    if (selectedWorkerId) {
      filtered = filtered.filter(w => w.id === selectedWorkerId);
    }
    
    return filtered;
  }, [workers, workerTeamFilter, selectedWorkerId]);

  // 팀 필터가 변경될 때 검색 결과 및 작게보기 상태 초기화
  useEffect(() => {
    setSearchedWorkers([]);
    setIsWorkerCompactView(false);
  }, [workerTeamFilter]);

  // 선택된 팀의 작업자들만 필터링 (공통 팀 포함)
  const teamWorkers = useMemo(() => {
    if (selectedTeam === 'all') {
      return workers;
    }
    // 선택된 팀의 작업자들 + 공통 팀의 작업자들
    return workers.filter(w => w.team === selectedTeam || w.team === '공통');
  }, [workers, selectedTeam]);

  const handleUpdateProjectDetails = (details: Partial<Project>) => {
    updateActiveProject(details);
  };

  const handleStartEpisodeChange = async (newStartEpisode: number) => {
    if (!activeProject) return;
    
    try {
      const projectRef = doc(db, "projects", activeProject.id);
      await updateDoc(projectRef, { 
        startEpisode: newStartEpisode,
        lastModified: Date.now() 
      });
      
      // 로컬 상태 업데이트
      setProjects(prev => prev.map(p => 
        p.id === activeProject.id 
          ? { ...p, startEpisode: newStartEpisode, lastModified: Date.now() }
          : p
      ));
    } catch (err) {
      console.error("Error updating start episode:", err);
      alert("시작 회차 변경에 실패했습니다.");
    }
  };

  const handleProcessNameChange = async (processId: number, newName: string) => {
    if (!activeProject) return;
    
    try {
      const updatedProcesses = activeProject.processes.map(p => 
        p.id === processId ? { ...p, name: newName } : p
      );
      
      const projectRef = doc(db, "projects", activeProject.id);
      await updateDoc(projectRef, { 
        processes: updatedProcesses,
        lastModified: Date.now() 
      });
      
      // 로컬 상태 업데이트
      setProjects(prev => prev.map(p => 
        p.id === activeProject.id 
          ? { ...p, processes: updatedProcesses, lastModified: Date.now() }
          : p
      ));
    } catch (err) {
      console.error("Error updating process name:", err);
      alert("작업 공정 이름 변경에 실패했습니다.");
    }
  };

  const handleAddProcess = async () => {
    if (!activeProject) return;
    
    const newProcessId = Math.max(...activeProject.processes.map(p => p.id)) + 1;
    const newProcess = {
      id: newProcessId,
      name: `${newProcessId}_새작업공정`,
      assignee: ''
    };
    
    try {
      const updatedProcesses = [...activeProject.processes, newProcess];
      
      const projectRef = doc(db, "projects", activeProject.id);
      await updateDoc(projectRef, { 
        processes: updatedProcesses,
        lastModified: Date.now() 
      });
      
      // 로컬 상태 업데이트
      setProjects(prev => prev.map(p => 
        p.id === activeProject.id 
          ? { ...p, processes: updatedProcesses, lastModified: Date.now() }
          : p
      ));
    } catch (err) {
      console.error("Error adding process:", err);
      alert("작업 공정 추가에 실패했습니다.");
    }
  };

  const handleRemoveProcess = async (processId: number) => {
    if (!activeProject) return;
    
    if (!confirm('정말로 이 작업 공정을 삭제하시겠습니까?')) {
      return;
    }
    
    try {
      const updatedProcesses = activeProject.processes.filter(p => p.id !== processId);
      
      const projectRef = doc(db, "projects", activeProject.id);
      await updateDoc(projectRef, { 
        processes: updatedProcesses,
        lastModified: Date.now() 
      });
      
      // 로컬 상태 업데이트
      setProjects(prev => prev.map(p => 
        p.id === activeProject.id 
          ? { ...p, processes: updatedProcesses, lastModified: Date.now() }
          : p
      ));
    } catch (err) {
      console.error("Error removing process:", err);
      alert("작업 공정 삭제에 실패했습니다.");
    }
  };

  const handleHideEpisodes = async (start: number, end: number) => {
    console.log('🔥 handleHideEpisodes 호출됨!', { start, end, activeProject: activeProject?.title });
    
    if (!activeProject) {
      console.log('❌ activeProject가 없음');
      return;
    }
    
    const episodesToHide = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    const newHiddenEpisodes = [...new Set([...(activeProject.hiddenEpisodes || []), ...episodesToHide])];

    console.log('📝 숨길 회차:', episodesToHide);
    console.log('📝 새로운 hiddenEpisodes:', newHiddenEpisodes);

    // Optimistic UI Update
    setProjects(prev => {
      const updated = prev.map(p => 
        p.id === activeProject.id 
          ? { ...p, hiddenEpisodes: newHiddenEpisodes, lastModified: Date.now() }
          : p
      );
      console.log('🔄 projects 업데이트됨:', updated.find(p => p.id === activeProject.id)?.hiddenEpisodes);
      return updated;
    });
    setIsHideEpisodesModalOpen(false);

    try {
      const projectRef = doc(db, "projects", activeProject.id);
      await updateDoc(projectRef, { 
        hiddenEpisodes: newHiddenEpisodes,
        lastModified: Date.now() 
      });
      console.log('✅ Firestore 업데이트 완료');
    } catch (err) {
      console.error("Error hiding episodes:", err);
      alert("회차 숨기기에 실패했습니다.");
    }
  };

  const handleShowAllEpisodes = async () => {
    if (!activeProject) return;

    // Optimistic UI Update
    setProjects(prev => prev.map(p => 
      p.id === activeProject.id 
        ? { ...p, hiddenEpisodes: [], lastModified: Date.now() }
        : p
    ));
    setIsHideEpisodesModalOpen(false);

    try {
      const projectRef = doc(db, "projects", activeProject.id);
      await updateDoc(projectRef, { 
        hiddenEpisodes: [],
        lastModified: Date.now() 
      });
    } catch (err) {
      console.error("Error showing all episodes:", err);
      alert("모든 회차를 다시 보이게 하는 데 실패했습니다.");
    }
  };


  // BulkView용 프로젝트 업데이트 함수
  const updateProjectById = async (projectId: string, updates: Partial<Project>) => {
    try {
      const projectRef = doc(db, "projects", projectId);
      await updateDoc(projectRef, { ...updates, lastModified: Date.now() });
    } catch (err) {
      console.error("Error updating project:", err);
      alert("프로젝트 업데이트에 실패했습니다.");
    }
  };

  const getMainTabClass = (tabName: 'schedule' | 'launch2') => {
    const baseClasses = "px-4 py-2 font-bold text-sm rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue/50 flex items-center justify-center h-10";
    if (mainTab === tabName) {
      return `${baseClasses} bg-primary-blue text-white shadow`;
    }
    return `${baseClasses} bg-white text-slate-600 hover:bg-slate-100 border border-slate-300`;
  }

  const getUrgentNoticeButtonClass = () => {
    const baseClasses = "px-4 py-2 font-bold text-sm rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue/50 flex items-center justify-center gap-2 h-10 bg-white text-slate-600 hover:bg-slate-100 border border-slate-300";
    const blinkClasses = hasUrgentNotices ? "animate-pulse bg-red-50 border-red-300 text-red-600" : "";
    return `${baseClasses} ${blinkClasses}`;
  };

  const getBulkViewButtonClass = () => {
    const baseClasses = "px-4 py-2 font-bold text-sm rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue/50 flex items-center justify-center h-10";
    if (isBulkView) {
      return `${baseClasses} bg-primary-blue text-white shadow`;
    }
    return `${baseClasses} bg-white text-slate-600 hover:bg-slate-100 border border-slate-300`;
  };

  const getTabClass = (tabName: 'tracker' | 'workers' | 'dailyTasks') => {
    const baseClasses = "px-3 py-1.5 font-semibold text-sm rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue/50 h-8 flex items-center justify-center";
    if (view === tabName) {
      return `${baseClasses} bg-primary-blue text-white shadow`;
    }
    return `${baseClasses} bg-slate-100 text-slate-600 hover:bg-slate-200`;
  }
  
  const getFilterButtonClass = (workerId: string | null) => {
    const baseClasses = "py-1 px-2 text-xs font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white rounded-md min-h-[24px] flex items-center justify-center";
    if (activeFilter === workerId) {
        return `${baseClasses} bg-primary-blue text-white shadow`;
    }
    return `${baseClasses} bg-white text-slate-600 hover:bg-slate-100 border border-slate-300`;
  };

  const Logo = () => (
    <img 
      src="/logo.png" 
      alt="문테크놀러지 로고" 
      width="40" 
      height="40" 
      className="object-contain"
    />
  );

  const renderContent = () => {
    console.log('🚀 App.tsx renderContent - 상태:', { loading, error, projectsLength: projects.length });
    
    if (loading) {
      return <div className="flex items-center justify-center h-full min-h-[300px] sm:min-h-[400px]"><div className="text-base sm:text-lg md:text-xl font-semibold text-slate-600">데이터를 불러오는 중...</div></div>;
    }
    if (error) {
       return <div className="flex flex-col items-center justify-center h-full min-h-[300px] sm:min-h-[400px] bg-red-50 rounded-lg p-3 sm:p-4 border border-red-200">
           <div className="text-base sm:text-lg md:text-xl font-bold text-red-700">오류 발생</div>
           <p className="text-red-600 mt-2 text-xs sm:text-sm md:text-base text-center">{error}</p>
        </div>;
    }

    // 런칭2 탭
    if (mainTab === 'launch2') {
      return (
        <div className="flex-1 p-2 sm:p-3 lg:p-6">
          <div className="w-full">
            <WebtoonTracker
              syncProjects={projects.map(p => ({ id: p.id, title: p.title, status: p.status, completedCount: (() => { try { const maxProcessId = Math.max(...(p.processes || []).map(pr => pr.id || 0)); const start = (p.startEpisode || 1); const end = (p.episodeCount || 0) + start - 1; let cnt = 0; for (let ep = start; ep <= end; ep++) { const key = `${maxProcessId}-${ep}`; const cell = (p.statuses || {})[key]; if (cell && (cell.status === 'done')) cnt++; } return cnt; } catch { return 0; } })(), totalEpisodes: (() => { try { const start = (p.startEpisode || 1); const end = (p.episodeCount || 0) + start - 1; return end - start + 1; } catch { return p.episodeCount || 0; } })() }))}
              onJumpToSchedule={(projectId) => {
                try {
                  // 뒤로가기로 납품(Delivery)로 복귀할 수 있도록 히스토리 스택에 상태 추가
                  window.history.pushState({ returnToDelivery: true }, '');
                } catch {}
                // 일정 탭으로 전환 후 해당 작품 선택
                setMainTab('schedule');
                setActiveProjectId(projectId);
                // 스크롤 상단으로 이동
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </div>
        </div>
      );
    }


    // 일정관리 탭
    if (view === 'tracker') {
        // 일괄보기 모드
        if (isBulkView) {
            return (
                <BulkView
                    projects={projects}
                    workers={workers}
                    onCellChange={(projectId, processId, episode, newCellState) => {
                        const project = projects.find(p => p.id === projectId);
                        if (project) {
                            const key = `${processId}-${episode}`;
                            const updatedStatuses = { ...project.statuses, [key]: newCellState };
                            updateProjectById(projectId, { statuses: updatedStatuses });
                        }
                    }}
                    onAssigneeChange={(projectId, processId, newAssigneeId) => {
                        const project = projects.find(p => p.id === projectId);
                        if (project) {
                            const updatedProcesses = project.processes.map(p => 
                                p.id === processId ? { ...p, assignee: newAssigneeId } : p
                            );
                            updateProjectById(projectId, { processes: updatedProcesses });
                        }
                    }}
                    onEpisodeCompletionToggle={(projectId, episode, isComplete) => {
                        const project = projects.find(p => p.id === projectId);
                        if (project) {
                            const updatedStatuses = { ...project.statuses };
                            project.processes.forEach(process => {
                                const key = `${process.id}-${episode}`;
                                if (isComplete) {
                                    updatedStatuses[key] = { status: 'done', text: '' };
                                } else {
                                    updatedStatuses[key] = { status: 'none', text: '' };
                                }
                            });
                            updateProjectById(projectId, { statuses: updatedStatuses });
                        }
                    }}
                    onSelectProject={handleSelectProjectFromBulkView}
                    restoredBulkViewState={bulkViewState}
                />
            );
        }
        
        return (
            <div className="space-y-2 sm:space-y-3">
            {activeProject ? (
                <>
                <ProjectDetails 
                    project={activeProject}
                    onUpdate={handleUpdateProjectDetails}
                    onClose={() => {}}
                />
                
                {/* 작업 필터링 섹션 */}
                <div className="bg-white p-2 rounded-lg shadow-md border border-slate-200 mb-2">
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="text-xs font-semibold text-slate-700">작업자 필터링</h3>
                            <button
                                onClick={() => setIsWorkFilterCollapsed(!isWorkFilterCollapsed)}
                                className="p-0.5 hover:bg-slate-100 rounded transition-colors"
                            >
                                <svg 
                                    className={`w-3 h-3 text-slate-600 transition-transform duration-200 ${
                                        isWorkFilterCollapsed ? 'rotate-180' : ''
                                    }`} 
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                        </div>
                        
                        {!isWorkFilterCollapsed && (
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <select
                                        value={selectedTeam}
                                        onChange={(e) => {
                                            setSelectedTeam(e.target.value as Team | 'all');
                                            setActiveFilter(null); // 팀 변경시 필터 초기화
                                            setSelectedWorkerId(null); // 작업자 선택 초기화
                                        }}
                                        className="px-2 py-1 bg-slate-50 border border-slate-300 rounded-md text-xs text-slate-700 focus:ring-2 focus:ring-primary-blue focus:border-primary-blue min-h-[28px]"
                                    >
                                        <option value="all">전체 팀</option>
                                        <option value="0팀">0팀</option>
                                        <option value="1팀">1팀</option>
                                        <option value="공통">공통</option>
                                    </select>
                                </div>
                                
                                {/* 선택된 팀의 작업자들 */}
                                <div className="flex flex-wrap items-center gap-1">
                                    <button onClick={() => handleSetFilter(null)} className={getFilterButtonClass(null)}>
                                        전체 보기
                                    </button>
                                    {teamWorkers.map(worker => (
                                        <button 
                                            key={worker.id} 
                                            onClick={() => handleSetFilter(worker.id)} 
                                            className={getFilterButtonClass(worker.id)}
                                        >
                                            {worker.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                </div>
                
                <TrackerTable
                  key={`${activeProject.id}-${JSON.stringify(activeProject.hiddenEpisodes || [])}`}
                  title={activeProject.title}
                  processes={filteredProcesses}
                  allProcesses={activeProject.processes}
                  episodeCount={activeProject.episodeCount}
                  startEpisode={activeProject.startEpisode || 1}
                  statuses={activeProject.statuses}
                  workers={workers}
                  projectTeam={activeProject.team}
                  onCellChange={handleCellChange}
                  onAssigneeChange={handleAssigneeChange}
                  onEpisodeCompletionToggle={handleEpisodeCompletionToggle}
                  onAddEpisode={handleAddEpisode}
                  onRemoveEpisode={handleRemoveEpisode}
                  onStartEpisodeChange={handleStartEpisodeChange}
                  onProcessNameChange={handleProcessNameChange}
                  onAddProcess={handleAddProcess}
                  onRemoveProcess={handleRemoveProcess}
                  onToggleEditing={() => setIsProjectEditing(!isProjectEditing)}
                  isEditing={isProjectEditing}
                  hiddenEpisodes={activeProject.hiddenEpisodes || []}
                />

                {!isBulkView && activeProject && (
                  <div className="mt-4 flex justify-center gap-3">
                    <button
                      onClick={() => setIsProjectEditing(!isProjectEditing)}
                      className={`px-4 py-2 text-sm rounded-lg font-semibold transition-colors shadow-sm ${
                        isProjectEditing 
                          ? 'bg-red-500 text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500' 
                          : 'bg-blue-500 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                      }`}
                    >
                      {isProjectEditing ? '수정 완료' : '수정 모드'}
                    </button>
                    
                    {!isProjectEditing && (
                      <button
                        onClick={() => setIsHideEpisodesModalOpen(true)}
                        className="px-4 py-2 text-sm rounded-lg font-semibold transition-colors shadow-sm bg-gray-500 text-white hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                      >
                        회차 숨김
                      </button>
                    )}
                  </div>
                )}
                </>
            ) : (
                <div className="flex items-center justify-center h-full min-h-[300px] sm:min-h-[400px] bg-white rounded-lg border-2 border-dashed border-slate-300">
                    <div className="text-center px-3 sm:px-4">
                        <h2 className="text-base sm:text-lg md:text-xl font-bold text-slate-700">첫 작품을 추가하여 시작하세요.</h2>
                        <p className="text-slate-500 mt-2 text-xs sm:text-sm md:text-base">왼쪽 사이드바에서 작품을 관리할 수 있습니다.</p>
                    </div>
                </div>
            )}
            </div>
        );
     }
      if (view === 'workers') {
          return (
            <div className="space-y-2 sm:space-y-4">
              <WorkerManager
                  workers={workers}
                  displayWorkers={filteredWorkers}
                  onAddWorker={handleAddWorker}
                  onDeleteWorker={handleDeleteWorker}
                  onUpdateWorker={handleUpdateWorker}
                  activeFilter={workerTeamFilter}
                  onFilterChange={setWorkerTeamFilter}
                  onSearchResultsChange={setSearchedWorkers}
                  onCompactViewChange={setIsWorkerCompactView}
              />
              <WorkerAssignments 
                  workers={searchedWorkers.length > 0 ? searchedWorkers : filteredWorkers} 
                  allWorkers={workers}
                  projects={projects}
                  onWorkerClick={setSelectedWorkerId}
                  selectedWorkerId={selectedWorkerId}
                  isCompactView={isWorkerCompactView}
              />
            </div>
          );
      }
      
      if (view === 'dailyTasks') {
          return (
            <DailyTasks 
              workers={workers}
              projects={projects}
              onTaskStatusChange={async (projectId, processId, episode, status) => {
                try {
                  const projectRef = doc(db, "projects", projectId);
                  const key = `statuses.${processId}-${episode}`;
                  const project = projects.find(p => p.id === projectId);
                  
                  if (project) {
                    const currentCell = project.statuses[`${processId}-${episode}`] || { status: 'none', text: '' };
                    await updateDoc(projectRef, {
                      [key]: { ...currentCell, status },
                      lastModified: Date.now()
                    });
                  }
                } catch (error) {
                  console.error('Error syncing task status:', error);
                }
              }}
            />
          );
      }
      
      return null;
  }

  return (
    <div className="flex h-full bg-slate-50 text-slate-800 font-sans">
      {/* 데스크톱 사이드바 - lg 이상에서만 표시 (일정관리 탭에서만, 업체 정산 제외) */}
      {mainTab === 'schedule' && currentPage !== 'settlement' && (
        <div className={`hidden lg:block transition-all duration-300 ease-in-out ${
          isDesktopSidebarCollapsed ? 'w-0' : 'w-96'
        }`}>
          <div className={`h-full transition-all duration-300 ease-in-out ${
            isDesktopSidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}>
            <ProjectSidebar
              projects={sortedProjects}
              workers={workers}
              activeProjectId={activeProjectId}
              sortOrder={projectSortOrder}
              sortDirection={sortDirection}
              showCompletedOnly={showCompletedOnly}
              onSelectProject={(id) => {
                handleSelectProject(id);
                setIsSidebarOpen(false);
              }}
              onAddProject={() => {
                handleAddProject();
                setIsSidebarOpen(false);
              }}
              onDeleteProject={handleDeleteProject}
              onSortOrderChange={handleSortOrderChange}
              onCompletedFilterChange={setShowCompletedOnly}
              onFilteredProjectsChange={setFilteredProjectsFromSidebar}
            />
          </div>
        </div>
      )}
      
      {/* 사이드바 토글 버튼 (일정관리 탭에서만, 업체 정산 제외) */}
      {mainTab === 'schedule' && currentPage !== 'settlement' && (
        <div className="hidden lg:block">
          <button
            onClick={() => setIsDesktopSidebarCollapsed(!isDesktopSidebarCollapsed)}
            className="fixed top-1/2 z-40 bg-white border border-slate-300 rounded-r-lg shadow-lg hover:shadow-xl transition-all duration-200"
            style={{ 
              left: isDesktopSidebarCollapsed ? '0px' : '384px',
              transform: 'translateY(-50%)'
            }}
          >
            <div className="p-2">
              <svg 
                className={`w-4 h-4 text-slate-600 transition-transform duration-200 ${
                  isDesktopSidebarCollapsed ? 'rotate-180' : ''
                }`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
          </button>
        </div>
      )}
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {currentPage === 'main' && (
        <header className="bg-white border-b border-slate-200 px-2 sm:px-4 lg:px-8 py-2 sm:py-2 shrink-0">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 lg:gap-0">
            <div className="flex items-center gap-2 sm:gap-3">
              {/* 모바일 메뉴 버튼 - lg 미만에서만 표시 (일정관리 탭에서만) */}
              {mainTab === 'schedule' && (
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className="lg:hidden p-1.5 rounded-md hover:bg-slate-100"
                >
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              )}
              
              <Logo/>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-800 tracking-tight">문테크놀러지 프로덕션 트래커</h1>
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full self-start sm:self-center">
                  총 {projects.length}작품
                </span>
              </div>
            </div>
            
            {/* 메인 탭 네비게이션 */}
            <div className="flex items-center gap-2">
              <nav className="flex items-center gap-2" aria-label="Main Tabs">
                <button onClick={() => setMainTab('schedule')} className={getMainTabClass('schedule')}>
                  일정
                </button>
                {mainTab === 'schedule' && (
                  <button
                    onClick={() => setIsBulkView(!isBulkView)}
                    className={getBulkViewButtonClass()}
                  >
                    {isBulkView ? '개별' : '일괄'}
                  </button>
                )}
                <button
                  onClick={() => setIsUrgentNoticeBoardOpen(true)}
                  className={getUrgentNoticeButtonClass()}
                  title="공지 게시판"
                >
                  <span>공지</span>
                </button>
                {/* 런칭 탭 제거 */}
                <button onClick={() => setMainTab('launch2')} className={getMainTabClass('launch2')}>
                  유통
                </button>
                {mainTab === 'schedule' && null}
                {mainTab === 'schedule' && (
                  <>
                    <button
                      onClick={handleGoToAiLinks}
                      className="px-4 py-2 font-bold text-sm rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue/50 flex items-center justify-center h-10 bg-white text-slate-600 hover:bg-slate-100 border border-slate-300"
                    >
                      AI링크
                    </button>
                    <button
                      onClick={handleGoToSettlement}
                      className="px-4 py-2 font-bold text-sm rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue/50 flex items-center justify-center h-10 bg-white text-slate-600 hover:bg-slate-100 border border-slate-300"
                    >
                      업체 정산
                    </button>
                  </>
                )}
              </nav>
              
              {/* 줌 뷰어 */}
              <div className="hidden sm:block">
                  <ZoomViewer onZoomChange={handleZoomChange} initialZoom={zoom} />
              </div>
            </div>
          </div>
        </header>
        )}
        <main className={`flex-1 overflow-y-auto ${currentPage === 'settlement' ? 'p-0' : 'p-2 sm:p-3 lg:p-6'}`}>
          <div className={`${currentPage === 'settlement' ? 'h-full' : 'w-full'}`} style={currentPage === 'main' ? { transform: `scale(${zoom / 100})`, transformOrigin: 'top left', width: `${100 / (zoom / 100)}%` } : {}}>
            
            {/* 서브 탭 네비게이션 (일정관리 탭에서만 표시) */}
            {mainTab === 'schedule' && currentPage === 'main' && (
              <div className="mb-2 sm:mb-3 lg:mb-4">
                  <nav className="flex items-center gap-2" aria-label="Sub Tabs">
                      <button onClick={() => setView('tracker')} className={getTabClass('tracker')}>
                          프로젝트 트래커
                      </button>
                      <button onClick={() => setView('workers')} className={getTabClass('workers')}>
                          작업자 관리
                      </button>
                      <button onClick={() => setView('dailyTasks')} className={getTabClass('dailyTasks')}>
                          오늘의 할일
                      </button>
                  </nav>
              </div>
            )}

            {currentPage === 'main' && renderContent()}

            {/* AI링크 페이지 */}
            {currentPage === 'ai-links' && (
              <div className="min-h-screen bg-gray-50">
                <div className="max-w-6xl mx-auto p-6">
                  {/* 헤더 */}
                  <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">AI링크</h1>
                    <button
                      onClick={handleGoToMain}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                    >
                      메인으로 돌아가기
                    </button>
                  </div>

                  {/* 필터 및 검색 */}
                  {isPasswordCorrect && (
                    <>
                      <div className="mb-6 bg-white p-4 rounded-xl shadow-lg">
                        <div className="flex flex-col md:flex-row gap-4">
                          {/* 검색창 */}
                          <div className="flex-grow">
                            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">검색</label>
                            <input
                              type="text"
                              id="search"
                              placeholder="이름 또는 설명으로 검색..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                          {/* 카테고리 필터 */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                              {['all', 'art', 'text', 'production', 'other'].map(category => (
                                <button
                                  key={category}
                                  onClick={() => setActiveCategory(category)}
                                  className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${
                                    activeCategory === category 
                                    ? 'bg-white text-primary-blue shadow' 
                                    : 'text-gray-500 hover:bg-white hover:text-primary-blue'
                                  }`}
                                >
                                  {category === 'all' ? '전체' : categoryNames[category]}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* 수정 모달 */}
                  {editingSite && (
                    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                      <div className="bg-white rounded-xl shadow-2xl p-8 m-4 max-w-lg w-full">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">AI 사이트 수정</h2>
                        {/* 수정 폼은 여기에 구현됩니다 */}
                        <div className="grid grid-cols-1 gap-5">
                          <div>
                            <label htmlFor="editSiteName" className="block text-sm font-medium text-gray-700 mb-1">사이트 이름</label>
                            <input
                              type="text"
                              id="editSiteName"
                              value={editingSite.name}
                              onChange={(e) => setEditingSite({ ...editingSite, name: e.target.value })}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue"
                            />
                          </div>
                          <div>
                            <label htmlFor="editSiteUrl" className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                            <input
                              type="url"
                              id="editSiteUrl"
                              value={editingSite.url}
                              onChange={(e) => setEditingSite({ ...editingSite, url: e.target.value })}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue"
                            />
                          </div>
                          <div>
                            <label htmlFor="editSiteDesc" className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                            <input
                              type="text"
                              id="editSiteDesc"
                              value={editingSite.description}
                              onChange={(e) => setEditingSite({ ...editingSite, description: e.target.value })}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue"
                            />
                          </div>
                          <div>
                            <label htmlFor="editSiteCategory" className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                            <select
                              id="editSiteCategory"
                              value={editingSite.category}
                              onChange={(e) => setEditingSite({ ...editingSite, category: e.target.value })}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue"
                            >
                              <option value="art">그림</option>
                              <option value="text">글</option>
                              <option value="production">제작</option>
                              <option value="other">기타</option>
                            </select>
                          </div>
                        </div>
                        <div className="mt-8 flex justify-end gap-3">
                          <button
                            onClick={() => setEditingSite(null)}
                            className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
                          >
                            취소
                          </button>
                          <button
                            onClick={() => handleUpdateAiSite(editingSite)}
                            className="px-6 py-3 bg-primary-blue text-white rounded-lg hover:bg-blue-800 transition-colors font-semibold"
                          >
                            저장
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {!isPasswordCorrect ? (
                    <div className="max-w-md mx-auto mt-20">
                      <div className="bg-white p-8 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">AI링크 접근</h2>
                        <p className="text-gray-600 mb-6">AI링크에 접근하려면 비밀번호를 입력하세요.</p>
                        <div className="space-y-4">
                          <input
                            type="password"
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handlePasswordCheck()}
                            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue"
                            placeholder="비밀번호를 입력하세요"
                            autoFocus
                          />
                          <div className="flex gap-3">
                            <button
                              onClick={handleGoToMain}
                              className="flex-1 px-4 py-3 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                              취소
                            </button>
                            <button
                              onClick={handlePasswordCheck}
                              className="flex-1 px-4 py-3 bg-primary-blue text-white rounded-md hover:bg-blue-800"
                            >
                              확인
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* AI 사이트 목록 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-8">
                        {filteredAiSites.map((site, index) => (
                          <div 
                            key={site.id} 
                            className="bg-white rounded-lg shadow-md overflow-hidden transform hover:-translate-y-1 transition-transform duration-300 ease-in-out flex flex-col cursor-grab"
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragEnter={() => handleDragEnter(index)}
                            onDragEnd={handleDrop}
                            onDragOver={(e) => e.preventDefault()}
                          >
                            <div className={`p-3 flex-grow border-l-4 ${categoryStyles[site.category]?.border || 'border-gray-300'}`}>
                              <div className="flex justify-between items-start">
                                <h3 className="text-base font-bold text-gray-800 pr-2">{site.name}</h3>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <button
                                    onClick={() => setEditingSite(site)}
                                    className="text-gray-400 hover:text-primary-blue transition-colors"
                                  >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"></path>
                                      <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd"></path>
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAiSite(site.id)}
                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                  >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                              <div className="mt-1.5 mb-2">
                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${categoryStyles[site.category]?.tagBg || 'bg-gray-100'} ${categoryStyles[site.category]?.tagText || 'text-gray-700'}`}>
                                  {categoryNames[site.category] || '미분류'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 flex-grow">{site.description}</p>
                            </div>
                            <a
                              href={site.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`block p-2 text-center text-sm font-semibold text-white transition-colors ${categoryStyles[site.category]?.button || 'bg-gray-500'}`}
                            >
                              바로가기
                            </a>
                          </div>
                        ))}
                      </div>

                      {/* AI 사이트 추가 폼 */}
                      <div className="bg-white p-6 rounded-xl shadow-lg">
                        <h3 className="text-xl font-bold text-gray-800 mb-5">새 AI 사이트 추가</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="md:col-span-2">
                            <label htmlFor="siteName" className="block text-sm font-medium text-gray-700 mb-1">사이트 이름</label>
                            <input
                              type="text"
                              id="siteName"
                              value={newSiteName}
                              onChange={(e) => setNewSiteName(e.target.value)}
                              placeholder="예: Google"
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label htmlFor="siteUrl" className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                            <input
                              type="url"
                              id="siteUrl"
                              value={newSiteUrl}
                              onChange={(e) => setNewSiteUrl(e.target.value)}
                              placeholder="https://google.com"
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label htmlFor="siteDesc" className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                            <input
                              type="text"
                              id="siteDesc"
                              value={newSiteDescription}
                              onChange={(e) => setNewSiteDescription(e.target.value)}
                              placeholder="예: 세계 최대 검색 엔진"
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue"
                            />
                          </div>
                          <div>
                            <label htmlFor="siteCategory" className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                            <select
                              id="siteCategory"
                              value={newSiteCategory}
                              onChange={(e) => setNewSiteCategory(e.target.value)}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue"
                            >
                              <option value="art">그림</option>
                              <option value="text">글</option>
                              <option value="production">제작</option>
                              <option value="other">기타</option>
                            </select>
                          </div>
                          <div className="self-end">
                            <button
                              onClick={handleAddAiSite}
                              className="w-full px-4 py-3 bg-primary-blue text-white rounded-lg hover:bg-blue-800 transition-colors font-semibold"
                            >
                              추가
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 업체 정산 페이지 */}
            {currentPage === 'settlement' && (
              <SettlementView
                projects={projects}
                onBack={handleGoToMain}
              />
            )}
            
            {currentPage !== 'settlement' && (
              <footer className="text-center mt-2 sm:mt-4 lg:mt-6 text-slate-500 text-xs">
                <p>MOON TECHNOLOGY Production Tracker</p>
              </footer>
            )}
          </div>
        </main>
      </div>

      {/* 모바일 사이드바 모달 - lg 미만에서만 표시 (일정관리 탭에서만) */}
      {isSidebarOpen && mainTab === 'schedule' && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setIsSidebarOpen(false)}></div>
          <div className="fixed left-0 top-0 h-full w-72 bg-white shadow-lg transform transition-transform duration-300 ease-in-out">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800">작품 목록</h2>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 rounded-md hover:bg-slate-100"
                >
                  <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="overflow-y-auto h-full">
              <ProjectSidebar
                projects={sortedProjects}
                workers={workers}
                activeProjectId={activeProjectId}
                sortOrder={projectSortOrder}
                sortDirection={sortDirection}
                showCompletedOnly={showCompletedOnly}
                onSelectProject={(id) => {
                  handleSelectProject(id);
                  setIsSidebarOpen(false);
                }}
                onAddProject={() => {
                  handleAddProject();
                  setIsSidebarOpen(false);
                }}
                onDeleteProject={handleDeleteProject}
                onSortOrderChange={handleSortOrderChange}
                onCompletedFilterChange={setShowCompletedOnly}
                onFilteredProjectsChange={setFilteredProjectsFromSidebar}
              />
            </div>
          </div>
        </div>
      )}
      
       <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDeleteProject}
        title="작품 삭제 확인"
        message={
            <>
                정말로 <strong>'{projectToDelete?.title}'</strong>을(를) 삭제하시겠습니까? <br />
                이 작업은 되돌릴 수 없습니다.
            </>
        }
    />
    <AddProjectModal
        isOpen={isAddProjectModalOpen}
        onClose={() => setIsAddProjectModalOpen(false)}
        onAddProject={handleConfirmAddProject}
    />
    <UrgentNoticeModal
        isOpen={isUrgentNoticeModalOpen}
        onClose={() => setIsUrgentNoticeModalOpen(false)}
        onSuccess={() => setIsUrgentNoticeBoardOpen(true)}
    />
    <UrgentNoticeBoard
        isOpen={isUrgentNoticeBoardOpen}
        onClose={() => setIsUrgentNoticeBoardOpen(false)}
        onCreateNotice={() => {
          setIsUrgentNoticeBoardOpen(false);
          setIsUrgentNoticeModalOpen(true);
        }}
    />
    {activeProject && (
      <HideEpisodesModal
        isOpen={isHideEpisodesModalOpen}
        onClose={() => setIsHideEpisodesModalOpen(false)}
        onHide={handleHideEpisodes}
        onShowAll={handleShowAllEpisodes}
        maxEpisode={activeProject.episodeCount + (activeProject.startEpisode || 1) - 1}
      />
    )}

    {/* 업체 정산 비밀번호 모달 */}
    {showSettlementPasswordModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">업체 정산 비밀번호 입력</h3>
          <input
            type="password"
            value={settlementPasswordInput}
            onChange={(e) => setSettlementPasswordInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSettlementPasswordSubmit();
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue focus:border-primary-blue mb-4"
            placeholder="비밀번호를 입력하세요"
          />
          <div className="flex justify-end space-x-2">
            <button
              onClick={handleCloseSettlementPasswordModal}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm"
            >
              취소
            </button>
            <button
              onClick={handleSettlementPasswordSubmit}
              className="px-4 py-2 bg-primary-blue text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    )}

    </div>
  );
};

export default App;