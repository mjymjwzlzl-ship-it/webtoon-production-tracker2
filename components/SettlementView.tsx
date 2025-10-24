import React, { useState, useEffect, useMemo } from 'react';
import { Project, MonthlySettlementData, MonthlyProjectSettlement, PlatformEarnings, MonthlySettlementCollection } from '../types';
import { db } from '../firebase';
import { collection, doc, getDocs, setDoc, onSnapshot, deleteDoc, addDoc } from 'firebase/firestore';
import AIAssistant from './AIAssistant';

interface SettlementViewProps {
  projects: Project[];
  onBack: () => void;
}

// 기본 플랫폼 리스트 (캡처된 리스트 기준)
const DEFAULT_PLATFORM_LIST = [
  '구루컴퍼니',
  '교보E북',
  '네이버 시리즈',
  '레진',
  '리디북스',
  '무툰',
  '미스터블루',
  '미툰(미소설)',
  '봄툰',
  '북큐브',
  '북팔',
  '블라이스',
  '애니툰',
  '원스토리',
  '인터넷만화방',
  '왓챠',
  '픽미툰',
  '케이툰',
  '코미코',
  '큐툰',
  '탑툰',
  '투믹스',
  '만화365'
];

const SettlementView: React.FC<SettlementViewProps> = ({ projects, onBack }) => {
  // 탭 상태
  const [activeTab, setActiveTab] = useState<'settlement' | 'ai-assistant'>('settlement');
  
  // 월별 데이터 관리 상태
  const [monthlyData, setMonthlyData] = useState<MonthlySettlementCollection>({});
  const [currentYearMonth, setCurrentYearMonth] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 플랫폼 관리 상태
  const [platforms, setPlatforms] = useState<string[]>(DEFAULT_PLATFORM_LIST);
  const [showAddPlatformModal, setShowAddPlatformModal] = useState(false);
  const [newPlatformName, setNewPlatformName] = useState('');
  
  // 작품 관리 상태
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [selectedProjectToRemove, setSelectedProjectToRemove] = useState<string | null>(null);
  
  // 월 추가 상태
  const [showAddMonthModal, setShowAddMonthModal] = useState(false);
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [newMonth, setNewMonth] = useState(new Date().getMonth() + 1);
 
  // 월 수정 상태
  const [showEditMonthModal, setShowEditMonthModal] = useState(false);
  const [editYear, setEditYear] = useState(new Date().getFullYear());
  const [editMonth, setEditMonth] = useState(new Date().getMonth() + 1);
 
  // 플랫폼(업체) 수정 상태
  const [showEditPlatformModal, setShowEditPlatformModal] = useState<null | string>(null); // 수정할 플랫폼 이름
  const [editedPlatformName, setEditedPlatformName] = useState('');
 
  // 작품명 수정 상태
  const [showEditProjectModal, setShowEditProjectModal] = useState<null | string>(null); // 수정할 projectId
  const [editedProjectTitle, setEditedProjectTitle] = useState('');
  
  // 입력 필드 포맷팅 상태 (projectId-platform 조합으로 관리)
  const [inputValues, setInputValues] = useState<{[key: string]: string}>({});
  
  // 화면 비율 조정 상태
  const [zoom, setZoom] = useState(100);
  
  // 정렬 상태
  const [sortOrder, setSortOrder] = useState<'title' | 'totalEarnings' | 'lastModified'>('title');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // 현재 년월 초기화 (현재 달로 설정)
  useEffect(() => {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setCurrentYearMonth(yearMonth);
  }, []);

  // Firebase에서 월별 정산 데이터 로드
  useEffect(() => {
    const loadMonthlyData = async () => {
      try {
        const monthlySnapshot = await getDocs(collection(db, 'monthlySettlements'));
        const monthlyDataCollection: MonthlySettlementCollection = {};
        
        monthlySnapshot.forEach((doc) => {
          const data = doc.data() as MonthlySettlementData;
          const key = `${data.year}-${String(data.month).padStart(2, '0')}`;
          monthlyDataCollection[key] = data;
        });
        
        setMonthlyData(monthlyDataCollection);
        
        // 현재 년월 데이터가 없으면 생성
        if (currentYearMonth && !monthlyDataCollection[currentYearMonth]) {
          await createMonthlyData(currentYearMonth);
        }
      } catch (error) {
        console.error('월별 데이터 로드 중 오류:', error);
      } finally {
        setLoading(false);
      }
    };

    if (currentYearMonth) {
      loadMonthlyData();
    }
  }, [currentYearMonth]);

  // 월별 데이터 생성
  const createMonthlyData = async (yearMonth: string) => {
    try {
      const [year, month] = yearMonth.split('-').map(Number);
      const monthlyData: MonthlySettlementData = {
        year,
        month,
        projects: [],
        platforms: [...DEFAULT_PLATFORM_LIST],
        totalAllProjects: 0,
        lastModified: Date.now()
      };
      
      await setDoc(doc(db, 'monthlySettlements', yearMonth), monthlyData);
      
      setMonthlyData(prev => ({
        ...prev,
        [yearMonth]: monthlyData
      }));
    } catch (error) {
      console.error('월별 데이터 생성 중 오류:', error);
    }
  };

  // 월별 데이터 변경 핸들러
  const handleYearMonthChange = (yearMonth: string) => {
    setCurrentYearMonth(yearMonth);
    setSearchTerm(''); // 검색어 초기화
  };

  // AI 비서에서 정산 데이터 업데이트
  const handleUpdateSettlementFromAI = (projectId: string, platformEarnings: { [platform: string]: number }) => {
    if (!currentYearMonth) return;
    
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    const settlement = getOrCreateSettlement(project);
    const updatedEarnings = { ...settlement.platformEarnings, ...platformEarnings };
    
    updateEarnings(projectId, updatedEarnings);
  };

  // 현재 월의 데이터 가져오기
  const currentMonthData = monthlyData[currentYearMonth];
  const currentSettlements = currentMonthData?.projects || [];
  const currentPlatforms = currentMonthData?.platforms || DEFAULT_PLATFORM_LIST;

  // 입력 필드 초기화는 나중에 처리

  // 프로젝트별 정산 데이터 초기화 또는 가져오기 (월별)
  const getOrCreateSettlement = (project: Project): MonthlyProjectSettlement => {
    const existingSettlement = currentSettlements.find(s => s.projectId === project.id);
    
    if (existingSettlement) {
      return existingSettlement;
    }

    // 새로운 정산 데이터 생성
    const platformEarnings: PlatformEarnings = {};
    currentPlatforms.forEach(platform => {
      platformEarnings[platform] = 0;
    });

    return {
      id: `settlement_${project.id}`,
      projectId: project.id,
      projectTitle: project.title,
      platformEarnings,
      totalEarnings: 0,
      lastModified: Date.now()
    };
  };

  // 수익 업데이트 (월별)
  const updateEarnings = async (projectId: string, platform: string, amount: number) => {
    try {
      if (!currentYearMonth || !currentMonthData) return;

      const project = projects.find(p => p.id === projectId);
      if (!project) return;

      const settlement = getOrCreateSettlement(project);
      const updatedEarnings = { ...settlement.platformEarnings };
      updatedEarnings[platform] = amount;

      // 총 수익 계산
      const totalEarnings = Object.values(updatedEarnings).reduce((sum, val) => sum + val, 0);

      const updatedSettlement: MonthlyProjectSettlement = {
        ...settlement,
        platformEarnings: updatedEarnings,
        totalEarnings,
        lastModified: Date.now()
      };

      // 현재 월의 프로젝트 목록 업데이트
      const updatedProjects = currentSettlements.filter(s => s.projectId !== projectId);
      updatedProjects.push(updatedSettlement);

      // 총 수익 재계산
      const totalAllProjects = updatedProjects.reduce((sum, s) => sum + s.totalEarnings, 0);

      const updatedMonthlyData: MonthlySettlementData = {
        ...currentMonthData,
        projects: updatedProjects,
        totalAllProjects,
        lastModified: Date.now()
      };

      await setDoc(doc(db, 'monthlySettlements', currentYearMonth), updatedMonthlyData);
      
      // 로컬 상태 업데이트
      setMonthlyData(prev => ({
        ...prev,
        [currentYearMonth]: updatedMonthlyData
      }));
    } catch (error) {
      console.error('수익 업데이트 실패:', error);
      alert('수익 업데이트에 실패했습니다.');
    }
  };

  // 플랫폼 추가 (월별)
  const addPlatform = async () => {
    if (!newPlatformName.trim() || !currentYearMonth || !currentMonthData) return;
    
    try {
      const platformName = newPlatformName.trim();
      const updatedPlatforms = [...currentPlatforms, platformName];
      
      // 현재 월의 모든 프로젝트에 새 플랫폼 추가
      const updatedProjects = currentSettlements.map(settlement => ({
        ...settlement,
        platformEarnings: {
          ...settlement.platformEarnings,
          [platformName]: 0
        },
        lastModified: Date.now()
      }));

      const updatedMonthlyData: MonthlySettlementData = {
        ...currentMonthData,
        platforms: updatedPlatforms,
        projects: updatedProjects,
        lastModified: Date.now()
      };

      await setDoc(doc(db, 'monthlySettlements', currentYearMonth), updatedMonthlyData);
      
      // 로컬 상태 업데이트
      setMonthlyData(prev => ({
        ...prev,
        [currentYearMonth]: updatedMonthlyData
      }));
      
      setNewPlatformName('');
      setShowAddPlatformModal(false);
    } catch (error) {
      console.error('플랫폼 추가 실패:', error);
      alert('플랫폼 추가에 실패했습니다.');
    }
  };

  // 플랫폼 제거 (월별)
  const removePlatform = async (platformName: string) => {
    if (!confirm(`"${platformName}" 플랫폼을 제거하시겠습니까?`) || !currentYearMonth || !currentMonthData) return;
    
    try {
      const updatedPlatforms = currentPlatforms.filter(p => p !== platformName);
      
      // 현재 월의 모든 프로젝트에서 해당 플랫폼 제거
      const updatedProjects = currentSettlements.map(settlement => {
        const updatedEarnings = { ...settlement.platformEarnings };
        delete updatedEarnings[platformName];
        
        // 총 수익 재계산
        const totalEarnings = Object.values(updatedEarnings).reduce((sum, val) => sum + val, 0);
        
        return {
          ...settlement,
          platformEarnings: updatedEarnings,
          totalEarnings,
          lastModified: Date.now()
        };
      });

      // 총 수익 재계산
      const totalAllProjects = updatedProjects.reduce((sum, s) => sum + s.totalEarnings, 0);

      const updatedMonthlyData: MonthlySettlementData = {
        ...currentMonthData,
        platforms: updatedPlatforms,
        projects: updatedProjects,
        totalAllProjects,
        lastModified: Date.now()
      };

      await setDoc(doc(db, 'monthlySettlements', currentYearMonth), updatedMonthlyData);
      
      // 로컬 상태 업데이트
      setMonthlyData(prev => ({
        ...prev,
        [currentYearMonth]: updatedMonthlyData
      }));
    } catch (error) {
      console.error('플랫폼 제거 실패:', error);
      alert('플랫폼 제거에 실패했습니다.');
    }
  };

  // 작품 추가 (월별)
  const addProject = async () => {
    if (!newProjectTitle.trim() || !currentYearMonth || !currentMonthData) return;
    
    try {
      const newProjectId = `custom_${Date.now()}`;
      const platformEarnings: PlatformEarnings = {};
      currentPlatforms.forEach(platform => {
        platformEarnings[platform] = 0;
      });

      const newSettlement: MonthlyProjectSettlement = {
        id: `settlement_${newProjectId}`,
        projectId: newProjectId,
        projectTitle: newProjectTitle.trim(),
        platformEarnings,
        totalEarnings: 0,
        lastModified: Date.now()
      };

      // 현재 월의 프로젝트 목록에 추가
      const updatedProjects = [...currentSettlements, newSettlement];
      const totalAllProjects = updatedProjects.reduce((sum, s) => sum + s.totalEarnings, 0);

      const updatedMonthlyData: MonthlySettlementData = {
        ...currentMonthData,
        projects: updatedProjects,
        totalAllProjects,
        lastModified: Date.now()
      };

      await setDoc(doc(db, 'monthlySettlements', currentYearMonth), updatedMonthlyData);
      
      // 로컬 상태 업데이트
      setMonthlyData(prev => ({
        ...prev,
        [currentYearMonth]: updatedMonthlyData
      }));
      
      setNewProjectTitle('');
      setShowAddProjectModal(false);
    } catch (error) {
      console.error('작품 추가 실패:', error);
      alert('작품 추가에 실패했습니다.');
    }
  };

  // 작품 제거 (월별)
  const removeProject = async (projectId: string) => {
    if (!confirm('이 작품을 제거하시겠습니까?') || !currentYearMonth || !currentMonthData) return;
    
    try {
      // 현재 월의 프로젝트 목록에서 제거
      const updatedProjects = currentSettlements.filter(s => s.projectId !== projectId);
      const totalAllProjects = updatedProjects.reduce((sum, s) => sum + s.totalEarnings, 0);

      const updatedMonthlyData: MonthlySettlementData = {
        ...currentMonthData,
        projects: updatedProjects,
        totalAllProjects,
        lastModified: Date.now()
      };

      await setDoc(doc(db, 'monthlySettlements', currentYearMonth), updatedMonthlyData);
      
      // 로컬 상태 업데이트
      setMonthlyData(prev => ({
        ...prev,
        [currentYearMonth]: updatedMonthlyData
      }));
    } catch (error) {
      console.error('작품 제거 실패:', error);
      alert('작품 제거에 실패했습니다.');
    }
  };

  // 월 추가
  const addMonth = async () => {
    try {
      const yearMonth = `${newYear}-${String(newMonth).padStart(2, '0')}`;
      
      // 이미 존재하는 월인지 확인
      if (monthlyData[yearMonth]) {
        alert('이미 존재하는 월입니다.');
        return;
      }

      // 새 월 데이터 생성
      const newMonthlyData: MonthlySettlementData = {
        year: newYear,
        month: newMonth,
        projects: [],
        platforms: [...DEFAULT_PLATFORM_LIST],
        totalAllProjects: 0,
        lastModified: Date.now()
      };
      
      await setDoc(doc(db, 'monthlySettlements', yearMonth), newMonthlyData);
      
      // 로컬 상태 업데이트
      setMonthlyData(prev => ({
        ...prev,
        [yearMonth]: newMonthlyData
      }));

      // 새로 추가된 월로 이동
      setCurrentYearMonth(yearMonth);
      
      setShowAddMonthModal(false);
      setNewYear(new Date().getFullYear());
      setNewMonth(new Date().getMonth() + 1);
    } catch (error) {
      console.error('월 추가 실패:', error);
      alert('월 추가에 실패했습니다.');
    }
  };

  // 월 이름(문서 키) 변경
  const renameMonth = async () => {
    try {
      if (!currentYearMonth || !currentMonthData) return;
      const newKey = `${editYear}-${String(editMonth).padStart(2, '0')}`;
      if (monthlyData[newKey] && newKey !== currentYearMonth) {
        alert('이미 존재하는 월입니다.');
        return;
      }

      const newDocData: MonthlySettlementData = {
        ...currentMonthData,
        year: editYear,
        month: editMonth,
        lastModified: Date.now()
      };

      // 새 문서로 저장 후 기존 문서 삭제
      await setDoc(doc(db, 'monthlySettlements', newKey), newDocData);
      await deleteDoc(doc(db, 'monthlySettlements', currentYearMonth));

      // 로컬 상태 갱신
      setMonthlyData(prev => {
        const copy = { ...prev } as MonthlySettlementCollection;
        delete (copy as any)[currentYearMonth];
        (copy as any)[newKey] = newDocData;
        return copy;
      });

      setCurrentYearMonth(newKey);
      setShowEditMonthModal(false);
    } catch (e) {
      console.error('월 이름 변경 실패:', e);
      alert('월 이름 변경에 실패했습니다.');
    }
  };

  // 플랫폼 이름 변경
  const renamePlatform = async (oldName: string, newName: string) => {
    try {
      if (!currentYearMonth || !currentMonthData) return;
      const trimmed = newName.trim();
      if (!trimmed) return;
      if (currentPlatforms.includes(trimmed)) {
        alert('이미 존재하는 업체명입니다.');
        return;
      }

      const updatedPlatforms = currentPlatforms.map(p => (p === oldName ? trimmed : p));

      const updatedProjects = currentSettlements.map(s => {
        const earnings = { ...s.platformEarnings } as PlatformEarnings;
        if (Object.prototype.hasOwnProperty.call(earnings, oldName)) {
          const val = earnings[oldName] || 0;
          delete earnings[oldName];
          earnings[trimmed] = val;
        }
        // 총합은 금액 이동이므로 동일
        return { ...s, platformEarnings: earnings, lastModified: Date.now() };
      });

      const updated: MonthlySettlementData = {
        ...currentMonthData,
        platforms: updatedPlatforms,
        projects: updatedProjects,
        lastModified: Date.now()
      };

      await setDoc(doc(db, 'monthlySettlements', currentYearMonth), updated);
      setMonthlyData(prev => ({ ...prev, [currentYearMonth]: updated }));
      setShowEditPlatformModal(null);
      setEditedPlatformName('');
    } catch (e) {
      console.error('업체명 변경 실패:', e);
      alert('업체명 변경에 실패했습니다.');
    }
  };

  // 작품명 변경
  const renameProject = async (projectId: string, newTitle: string) => {
    try {
      if (!currentYearMonth || !currentMonthData) return;
      const trimmed = newTitle.trim();
      if (!trimmed) return;

      const updatedProjects = currentSettlements.map(s =>
        s.projectId === projectId ? { ...s, projectTitle: trimmed, lastModified: Date.now() } : s
      );

      const updated: MonthlySettlementData = {
        ...currentMonthData,
        projects: updatedProjects,
        lastModified: Date.now()
      };

      await setDoc(doc(db, 'monthlySettlements', currentYearMonth), updated);
      setMonthlyData(prev => ({ ...prev, [currentYearMonth]: updated }));
      setShowEditProjectModal(null);
      setEditedProjectTitle('');
    } catch (e) {
      console.error('작품명 변경 실패:', e);
      alert('작품명 변경에 실패했습니다.');
    }
  };

  // 화면 비율 조정
  const handleZoomChange = (newZoom: number) => {
    setZoom(newZoom);
  };

  // 정렬 변경
  const handleSortChange = (newSortOrder: 'title' | 'totalEarnings' | 'lastModified') => {
    if (sortOrder === newSortOrder) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortOrder(newSortOrder);
      setSortDirection('asc');
    }
  };

  // 정렬된 프로젝트 목록
  const sortedProjects = useMemo(() => {
    const allProjects = [...projects];
    
    // 현재 월의 정산 데이터가 있는 작품들도 포함
    const settlementProjects = currentSettlements
      .filter(settlement => !projects.find(p => p.id === settlement.projectId))
      .map(settlement => ({
        id: settlement.projectId,
        title: settlement.projectTitle,
        type: 'general' as const,
        team: '0팀' as const,
        storyWriter: '',
        artWriter: '',
        identifierType: 'isbn' as const,
        identifierValue: '',
        synopsis: '',
        processes: [],
        episodeCount: 0,
        startEpisode: 1,
        hiddenEpisodes: [],
        statuses: {},
        hasGeneralCover: false,
        hasAdultCover: false,
        hasLogo: false,
        hasCharacterSheet: false,
        hasSynopsis: false,
        hasProposal: false,
        memo: '',
        lastModified: settlement.lastModified,
        status: 'production' as const
      }));
    
    const combinedProjects = [...allProjects, ...settlementProjects];
    
    return combinedProjects.sort((a, b) => {
      let comparison = 0;
      
      if (sortOrder === 'title') {
        comparison = a.title.localeCompare(b.title);
      } else if (sortOrder === 'totalEarnings') {
        const aEarnings = currentSettlements.find(s => s.projectId === a.id)?.totalEarnings || 0;
        const bEarnings = currentSettlements.find(s => s.projectId === b.id)?.totalEarnings || 0;
        comparison = aEarnings - bEarnings;
      } else if (sortOrder === 'lastModified') {
        comparison = a.lastModified - b.lastModified;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [projects, currentSettlements, sortOrder, sortDirection]);

  // 검색된 프로젝트들 (띄어쓰기 무시하고 검색)
  const filteredProjects = useMemo(() => {
    if (!searchTerm.trim()) return sortedProjects;
    const normalizedSearchTerm = searchTerm.toLowerCase().replace(/\s+/g, '');
    return sortedProjects.filter(project => {
      const normalizedTitle = project.title.toLowerCase().replace(/\s+/g, '');
      return normalizedTitle.includes(normalizedSearchTerm);
    });
  }, [sortedProjects, searchTerm]);

  // 입력 필드 초기화 (월이 변경될 때)
  useEffect(() => {
    const newInputValues: {[key: string]: string} = {};
    
    filteredProjects.forEach(project => {
      const settlement = getOrCreateSettlement(project);
      currentPlatforms.forEach(platform => {
        const key = `${project.id}-${platform}`;
        const amount = settlement.platformEarnings[platform] || 0;
        newInputValues[key] = formatNumberForInput(amount.toString());
      });
    });
    
    setInputValues(newInputValues);
  }, [currentYearMonth, filteredProjects, currentPlatforms]);

  // 현재 월의 모든 작품의 총 수익
  const totalAllProjects = useMemo(() => {
    return currentMonthData?.totalAllProjects || 0;
  }, [currentMonthData]);

  // 통계 데이터 계산 (월별)
  const statistics = useMemo(() => {
    if (currentSettlements.length === 0) {
      return {
        highestEarningProject: null,
        lowestEarningProject: null,
        highestEarningPlatform: null,
        lowestEarningPlatform: null,
        averageProjectEarnings: 0,
        averagePlatformEarnings: {},
        totalProjects: 0,
        totalPlatforms: currentPlatforms.length
      };
    }

    // 작품별 통계
    const projectEarnings = currentSettlements.map(s => ({
      title: s.projectTitle,
      earnings: s.totalEarnings
    })).sort((a, b) => b.earnings - a.earnings);

    const highestEarningProject = projectEarnings[0];
    const lowestEarningProject = projectEarnings[projectEarnings.length - 1];
    const averageProjectEarnings = Math.round(projectEarnings.reduce((sum, p) => sum + p.earnings, 0) / projectEarnings.length);

    // 플랫폼별 통계
    const platformEarnings: { [key: string]: number } = {};
    currentPlatforms.forEach(platform => {
      platformEarnings[platform] = currentSettlements.reduce((sum, settlement) => {
        return sum + (settlement.platformEarnings[platform] || 0);
      }, 0);
    });

    const platformEarningsArray = Object.entries(platformEarnings)
      .map(([platform, earnings]) => ({ platform, earnings }))
      .sort((a, b) => b.earnings - a.earnings);

    const highestEarningPlatform = platformEarningsArray[0];
    const lowestEarningPlatform = platformEarningsArray[platformEarningsArray.length - 1];
    
    const averagePlatformEarnings: { [key: string]: number } = {};
    Object.entries(platformEarnings).forEach(([platform, total]) => {
      averagePlatformEarnings[platform] = Math.round(total / currentSettlements.length);
    });

    return {
      highestEarningProject,
      lowestEarningProject,
      highestEarningPlatform,
      lowestEarningPlatform,
      averageProjectEarnings,
      averagePlatformEarnings,
      totalProjects: currentSettlements.length,
      totalPlatforms: currentPlatforms.length
    };
  }, [currentSettlements, currentPlatforms]);

  // 숫자 포맷팅
  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('ko-KR').format(num);
  };

  // 숫자 포맷팅 (입력용)
  const formatNumberForInput = (value: string): string => {
    const num = parseInt(value.replace(/,/g, '')) || 0;
    return new Intl.NumberFormat('ko-KR').format(num);
  };

  // 숫자 파싱 (입력값에서 숫자만 추출)
  const parseNumber = (value: string): number => {
    return parseInt(value.replace(/,/g, '')) || 0;
  };

  // 입력 필드 값 가져오기
  const getInputValue = (projectId: string, platform: string): string => {
    const key = `${projectId}-${platform}`;
    const value = inputValues[key];
    
    // 값이 없으면 settlement에서 가져와서 포맷팅
    if (!value) {
      const project = filteredProjects.find(p => p.id === projectId);
      if (project) {
        const settlement = getOrCreateSettlement(project);
        const amount = settlement.platformEarnings[platform] || 0;
        return formatNumberForInput(amount.toString());
      }
    }
    
    return value || '0';
  };

  // 입력 필드 값 설정하기
  const setInputValue = (projectId: string, platform: string, value: string) => {
    const key = `${projectId}-${platform}`;
    setInputValues(prev => ({ ...prev, [key]: value }));
  };

  // 입력 필드 변경 핸들러
  const handleInputChange = (projectId: string, platform: string, value: string) => {
    // 숫자만 추출
    const numericValue = value.replace(/[^0-9]/g, '');
    
    // 포맷팅된 값으로 설정
    const formattedValue = formatNumberForInput(numericValue);
    setInputValue(projectId, platform, formattedValue);
    
    // 실제 숫자 값으로 업데이트
    const amount = parseNumber(formattedValue);
    updateEarnings(projectId, platform, amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">정산 데이터를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50 p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-bold text-gray-900">업체 정산</h1>
          
          {/* 탭 네비게이션 */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('settlement')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                activeTab === 'settlement'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              정산 관리
            </button>
            <button
              onClick={() => setActiveTab('ai-assistant')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                activeTab === 'ai-assistant'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              AI 비서
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="px-4 py-2 font-bold text-sm rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue/50 flex items-center justify-center h-10 bg-white text-slate-600 hover:bg-slate-100 border border-slate-300"
          >
            뒤로가기
          </button>
          {activeTab === 'settlement' && (
            <>
              <button
                onClick={() => setShowAddProjectModal(true)}
                className="px-4 py-2 font-bold text-sm rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue/50 flex items-center justify-center h-10 bg-primary-blue text-white shadow hover:bg-blue-700"
              >
                + 작품 추가
              </button>
              <button
                onClick={() => setShowAddPlatformModal(true)}
                className="px-4 py-2 font-bold text-sm rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue/50 flex items-center justify-center h-10 bg-primary-blue text-white shadow hover:bg-blue-700"
              >
                + 업체 추가
              </button>
            </>
          )}
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 'settlement' ? (
        <>
          {/* 년.월 탭 */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-medium text-gray-700">월별 선택:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.keys(monthlyData)
            .sort((a, b) => b.localeCompare(a)) // 최신순 정렬
            .map(yearMonth => {
              const [year, month] = yearMonth.split('-');
              const isActive = currentYearMonth === yearMonth;
              return (
                <button
                  key={yearMonth}
                  onClick={() => handleYearMonthChange(yearMonth)}
                  onDoubleClick={() => {
                    const [y, m] = yearMonth.split('-');
                    setEditYear(parseInt(y));
                    setEditMonth(parseInt(m));
                    setShowEditMonthModal(true);
                  }}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue/50 cursor-pointer ${
                    isActive
                      ? 'bg-primary-blue text-white shadow'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  title="더블클릭하여 월 수정"
                >
                  {year}년 {parseInt(month)}월
                </button>
              );
            })}
          <button
            onClick={() => {
              const now = new Date();
              const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
              if (!monthlyData[yearMonth]) {
                createMonthlyData(yearMonth);
              }
              handleYearMonthChange(yearMonth);
            }}
            className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue/50 bg-green-100 text-green-700 hover:bg-green-200"
          >
            + 이번 달
          </button>
          <button
            onClick={() => setShowAddMonthModal(true)}
            className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue/50 bg-blue-100 text-blue-700 hover:bg-blue-200"
          >
            + 월 추가
          </button>
        </div>
      </div>

      {/* 컨트롤 패널 */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          {/* 정렬 컨트롤 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">정렬:</span>
            <div className="flex items-center gap-1">
              {[
                { key: 'title', label: '작품명' },
                { key: 'totalEarnings', label: '총수익' },
                { key: 'lastModified', label: '수정일' }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleSortChange(key as any)}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue/50 ${
                    sortOrder === key
                      ? 'bg-primary-blue text-white shadow'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label}
                  {sortOrder === key && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* 화면 비율 조정 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">화면 비율:</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleZoomChange(Math.max(50, zoom - 10))}
                className="px-2 py-1 text-sm font-semibold rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                -
              </button>
              <span className="px-3 py-1 text-sm font-medium text-gray-700 min-w-[3rem] text-center">
                {zoom}%
              </span>
              <button
                onClick={() => handleZoomChange(Math.min(200, zoom + 10))}
                className="px-2 py-1 text-sm font-semibold rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 검색 및 컨트롤 */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="작품 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="text-sm text-gray-600">
          총 {filteredProjects.length}개 작품
        </div>
      </div>

      {/* 정산 테이블 */}
      <div 
        className="bg-white rounded-lg shadow overflow-hidden"
        style={{ 
          transform: `scale(${zoom / 100})`, 
          transformOrigin: 'top left',
          width: `${100 / (zoom / 100)}%`
        }}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                  작품명
                </th>
                {currentPlatforms.map((platform) => (
                  <th key={platform} className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px] group">
                    <div className="flex items-center justify-between">
                      <span 
                        className="text-left cursor-pointer hover:text-blue-600"
                        onDoubleClick={() => {
                          setShowEditPlatformModal(platform);
                          setEditedPlatformName(platform);
                        }}
                        title="더블클릭하여 수정"
                      >
                        {platform}
                      </span>
                      <button
                        onClick={() => removePlatform(platform)}
                        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity"
                        title="플랫폼 제거"
                      >
                        ×
                      </button>
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                  총합계
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProjects.map((project, index) => {
                const settlement = getOrCreateSettlement(project);
                return (
                  <tr key={project.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 group">
                      <div className="flex items-center justify-between">
                        <span 
                          className="text-left cursor-pointer hover:text-blue-600"
                          onDoubleClick={() => {
                            setShowEditProjectModal(project.id);
                            setEditedProjectTitle(project.title);
                          }}
                          title="더블클릭하여 수정"
                        >
                          {project.title}
                        </span>
                        <button
                          onClick={() => removeProject(project.id)}
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity ml-2"
                          title="작품 제거"
                        >
                          ×
                        </button>
                      </div>
                    </td>
                    {currentPlatforms.map((platform) => (
                      <td key={platform} className="px-2 py-3 text-left">
                        <input
                          type="text"
                          value={getInputValue(project.id, platform)}
                          onChange={(e) => handleInputChange(project.id, platform, e.target.value)}
                          className="w-full px-2 py-1 text-sm text-left border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0"
                        />
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                      ₩{formatNumber(settlement.totalEarnings)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-100">
              <tr>
                <td colSpan={currentPlatforms.length + 2} className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                  총 {filteredProjects.length}개 총계
                </td>
                <td className="px-4 py-3 text-center text-sm font-bold text-gray-900">
                  ₩{formatNumber(totalAllProjects)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 통계 섹션 */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-900">매출 통계</h2>
        
        {/* 작품별 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 최고 매출 작품 */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">최고 매출 작품</p>
                <p className="text-lg font-bold text-gray-900">
                  {statistics.highestEarningProject?.title || '데이터 없음'}
                </p>
                <p className="text-sm text-green-600 font-semibold">
                  ₩{formatNumber(statistics.highestEarningProject?.earnings || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>

          {/* 최저 매출 작품 */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">최저 매출 작품</p>
                <p className="text-lg font-bold text-gray-900">
                  {statistics.lowestEarningProject?.title || '데이터 없음'}
                </p>
                <p className="text-sm text-red-600 font-semibold">
                  ₩{formatNumber(statistics.lowestEarningProject?.earnings || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
              </div>
            </div>
          </div>

          {/* 작품별 평균 매출 */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">작품별 평균 매출</p>
                <p className="text-2xl font-bold text-gray-900">
                  ₩{formatNumber(statistics.averageProjectEarnings)}
                </p>
                <p className="text-sm text-gray-500">
                  총 {statistics.totalProjects}개 작품
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* 플랫폼별 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 최고 매출 플랫폼 */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">최고 매출 플랫폼</p>
                <p className="text-lg font-bold text-gray-900">
                  {statistics.highestEarningPlatform?.platform || '데이터 없음'}
                </p>
                <p className="text-sm text-green-600 font-semibold">
                  ₩{formatNumber(statistics.highestEarningPlatform?.earnings || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>

          {/* 최저 매출 플랫폼 */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">최저 매출 플랫폼</p>
                <p className="text-lg font-bold text-gray-900">
                  {statistics.lowestEarningPlatform?.platform || '데이터 없음'}
                </p>
                <p className="text-sm text-red-600 font-semibold">
                  ₩{formatNumber(statistics.lowestEarningPlatform?.earnings || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
              </div>
            </div>
          </div>

          {/* 플랫폼별 평균 매출 */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">플랫폼별 평균 매출</p>
                <p className="text-2xl font-bold text-gray-900">
                  ₩{formatNumber(
                    Object.values(statistics.averagePlatformEarnings).reduce((sum, avg) => sum + avg, 0) / 
                    Object.keys(statistics.averagePlatformEarnings).length || 0
                  )}
                </p>
                <p className="text-sm text-gray-500">
                  총 {statistics.totalPlatforms}개 플랫폼
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* 플랫폼별 상세 통계 */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">플랫폼별 평균 매출 상세</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Object.entries(statistics.averagePlatformEarnings)
              .sort(([,a], [,b]) => b - a)
              .map(([platform, average]) => (
                <div key={platform} className="text-center p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-600 truncate" title={platform}>
                    {platform}
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    ₩{formatNumber(average)}
                  </p>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* 작품 추가 모달 */}
      {showAddProjectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">작품 추가</h3>
            <input
              type="text"
              value={newProjectTitle}
              onChange={(e) => setNewProjectTitle(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  addProject();
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 mb-4"
              placeholder="작품 제목을 입력하세요"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowAddProjectModal(false);
                  setNewProjectTitle('');
                }}
                className="px-4 py-2 font-semibold text-sm rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500/50 bg-white text-slate-600 hover:bg-slate-100 border border-slate-300"
              >
                취소
              </button>
              <button
                onClick={addProject}
                className="px-4 py-2 font-semibold text-sm rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue/50 bg-primary-blue text-white shadow hover:bg-blue-700"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 월 추가 모달 */}
      {showAddMonthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">월 추가</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">년도</label>
                <select
                  value={newYear}
                  onChange={(e) => setNewYear(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Array.from({ length: 10 }, (_, i) => {
                    const year = new Date().getFullYear() - 5 + i;
                    return (
                      <option key={year} value={year}>
                        {year}년
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">월</label>
                <select
                  value={newMonth}
                  onChange={(e) => setNewMonth(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}월
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowAddMonthModal(false);
                  setNewYear(new Date().getFullYear());
                  setNewMonth(new Date().getMonth() + 1);
                }}
                className="px-4 py-2 font-semibold text-sm rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500/50 bg-white text-slate-600 hover:bg-slate-100 border border-slate-300"
              >
                취소
              </button>
              <button
                onClick={addMonth}
                className="px-4 py-2 font-semibold text-sm rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue/50 bg-primary-blue text-white shadow hover:bg-blue-700"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 월 수정 모달 */}
      {showEditMonthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">월 수정</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">년도</label>
                <select
                  value={editYear}
                  onChange={(e) => setEditYear(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Array.from({ length: 10 }, (_, i) => {
                    const year = new Date().getFullYear() - 5 + i;
                    return (
                      <option key={year} value={year}>
                        {year}년
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">월</label>
                <select
                  value={editMonth}
                  onChange={(e) => setEditMonth(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}월
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowEditMonthModal(false)}
                className="px-4 py-2 font-semibold text-sm rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500/50 bg-white text-slate-600 hover:bg-slate-100 border border-slate-300"
              >
                취소
              </button>
              <button
                onClick={renameMonth}
                className="px-4 py-2 font-semibold text-sm rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue/50 bg-primary-blue text-white shadow hover:bg-blue-700"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 업체명 수정 모달 */}
      {showEditPlatformModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">업체명 수정</h3>
            <input
              type="text"
              value={editedPlatformName}
              onChange={(e) => setEditedPlatformName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && showEditPlatformModal) {
                  renamePlatform(showEditPlatformModal, editedPlatformName);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
              placeholder="업체명을 입력하세요"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowEditPlatformModal(null)}
                className="px-4 py-2 font-semibold text-sm rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500/50 bg-white text-slate-600 hover:bg-slate-100 border border-slate-300"
              >
                취소
              </button>
              <button
                onClick={() => showEditPlatformModal && renamePlatform(showEditPlatformModal, editedPlatformName)}
                className="px-4 py-2 font-semibold text-sm rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue/50 bg-primary-blue text-white shadow hover:bg-blue-700"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 작품명 수정 모달 */}
      {showEditProjectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">작품명 수정</h3>
            <input
              type="text"
              value={editedProjectTitle}
              onChange={(e) => setEditedProjectTitle(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && showEditProjectModal) {
                  renameProject(showEditProjectModal, editedProjectTitle);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
              placeholder="작품명을 입력하세요"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowEditProjectModal(null)}
                className="px-4 py-2 font-semibold text-sm rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500/50 bg-white text-slate-600 hover:bg-slate-100 border border-slate-300"
              >
                취소
              </button>
              <button
                onClick={() => showEditProjectModal && renameProject(showEditProjectModal, editedProjectTitle)}
                className="px-4 py-2 font-semibold text-sm rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue/50 bg-primary-blue text-white shadow hover:bg-blue-700"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 업체 추가 모달 */}
      {showAddPlatformModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">업체 추가</h3>
            <input
              type="text"
              value={newPlatformName}
              onChange={(e) => setNewPlatformName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  addPlatform();
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
              placeholder="업체명을 입력하세요"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowAddPlatformModal(false);
                  setNewPlatformName('');
                }}
                className="px-4 py-2 font-semibold text-sm rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500/50 bg-white text-slate-600 hover:bg-slate-100 border border-slate-300"
              >
                취소
              </button>
              <button
                onClick={addPlatform}
                className="px-4 py-2 font-semibold text-sm rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue/50 bg-primary-blue text-white shadow hover:bg-blue-700"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      ) : (
        /* AI 비서 탭 */
        <div className="flex-1 overflow-hidden">
          <AIAssistant
            projects={projects}
            currentYearMonth={currentYearMonth}
            onUpdateSettlement={handleUpdateSettlementFromAI}
            onGoBack={() => setActiveTab('settlement')}
          />
        </div>
      )}
    </div>
  );
};

export default SettlementView;
