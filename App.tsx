import React, { useState, useMemo, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import type { Project } from './types';

interface Platform {
  id: string;
  name: string;
  color: string;
}

interface LaunchData {
  projectId: string;
  platformId: string;
  status: 'launched' | 'pending' | 'error' | 'completed';
  date?: string;
  note?: string;
}

interface LaunchProject {
  id: string;
  title: string;
  category: string;
  status: 'live' | 'completed';
  projectId: string; // 메인 projects 컬렉션의 ID
}

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('일정');
  
  // 런칭 탭 관련 상태
  const [categoryFilter, setCategoryFilter] = useState<string>('국내비독점 [라이브]');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCategory, setNewProjectCategory] = useState('국내비독점 [라이브]');
  const [newPlatformName, setNewPlatformName] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingPlatformId, setEditingPlatformId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [editingPlatformName, setEditingPlatformName] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'title' | 'distribution'>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isPlatformFilterExpanded, setIsPlatformFilterExpanded] = useState(false);
  const [deletedPlatforms, setDeletedPlatforms] = useState<Set<string>>(new Set());

  // 카테고리별 플랫폼 목록
  const domesticPlatforms: Platform[] = [
    { id: 'anitoon', name: '애니툰', color: 'bg-indigo-100' },
    { id: 'alltoon', name: '올툰', color: 'bg-green-100' },
    { id: 'bomtoon', name: '봄툰', color: 'bg-pink-100' },
    { id: 'blice', name: '블라이스', color: 'bg-cyan-100' },
    { id: 'bookcube', name: '북큐브', color: 'bg-yellow-100' },
    { id: 'bookpal', name: '북팔', color: 'bg-amber-100' },
    { id: 'comico', name: '코미코', color: 'bg-violet-100' },
    { id: 'kyobo-ebook', name: '교보E북', color: 'bg-emerald-100' },
    { id: 'guru-company', name: '구루컴퍼니', color: 'bg-orange-100' },
    { id: 'ktoon', name: '케이툰', color: 'bg-red-100' },
    { id: 'manhwa365', name: '만화365', color: 'bg-slate-100' },
    { id: 'mrblue', name: '미스터블루', color: 'bg-purple-100' },
    { id: 'muto', name: '무툰', color: 'bg-lime-100' },
    { id: 'muto2', name: '미툰', color: 'bg-teal-100' },
    { id: 'naver-series', name: '네이버시리즈', color: 'bg-green-100' },
    { id: 'pickme', name: '픽미툰', color: 'bg-rose-100' },
    { id: 'ridibooks', name: '리디북스', color: 'bg-blue-100' },
    { id: 'lezhin', name: '레진', color: 'bg-fuchsia-100' },
    { id: 'toomics', name: '투믹스', color: 'bg-sky-100' },
    { id: 'qtoon', name: '큐툰', color: 'bg-pink-100' },
    { id: 'watcha', name: '왓챠', color: 'bg-gray-100' },
    { id: 'onestory', name: '원스토리', color: 'bg-indigo-100' },
    { id: 'internet-manhwabang', name: '인터넷만화방', color: 'bg-blue-100' },
    { id: 'duri', name: '두리요', color: 'bg-yellow-100' },
  ].sort((a, b) => a.name.localeCompare(b.name));

  const overseasPlatforms: Platform[] = [
    { id: 'funple', name: '펀플', color: 'bg-purple-100' },
    { id: 'dlsite', name: 'DLSITE\n(누온)', color: 'bg-blue-100' },
    { id: 'toptoon-japan', name: '탑툰\n재팬', color: 'bg-red-100' },
    { id: 'toonhub', name: '툰허브', color: 'bg-green-100' },
    { id: 'honeytoon', name: '허니툰', color: 'bg-yellow-100' },
    { id: 'manta', name: '만타', color: 'bg-orange-100' },
    { id: 'toomics-north-america', name: '투믹스\n(EN)', color: 'bg-sky-100' },
    { id: 'toomics-japan', name: '투믹스\n(JP)', color: 'bg-red-100' },
    { id: 'toomics-italy', name: '투믹스\n(IT)', color: 'bg-green-100' },
    { id: 'toomics-portugal', name: '투믹스\n(PT)', color: 'bg-yellow-100' },
    { id: 'toomics-france', name: '투믹스\n(FR)', color: 'bg-blue-100' },
    { id: 'toomics-china-simplified', name: '투믹스\n(간체)', color: 'bg-red-100' },
    { id: 'toomics-china-traditional', name: '투믹스\n(번체)', color: 'bg-yellow-100' },
    { id: 'toomics-germany', name: '투믹스\n(DE)', color: 'bg-gray-100' },
    { id: 'toomics-spain', name: '투믹스\n(ES)', color: 'bg-red-100' },
    { id: 'toomics-south-america', name: '투믹스\n(남미)', color: 'bg-green-100' },
    { id: 'lezhin-north-america', name: '레진\n(EN)', color: 'bg-fuchsia-100' },
    { id: 'lezhin-japan', name: '레진\n(JP)', color: 'bg-pink-100' },
  ].sort((a, b) => a.name.localeCompare(b.name));

  // 현재 카테고리에 따른 플랫폼 선택 (삭제된 플랫폼 제외)
  const allPlatforms = categoryFilter.includes('해외') ? overseasPlatforms : domesticPlatforms;
  const platforms = allPlatforms.filter(platform => !deletedPlatforms.has(platform.id));

  // 런칭 상태/메모를 상태로 관리
  const [launchStatuses, setLaunchStatuses] = useState<{[key: string]: 'none' | 'launched' | 'pending' | 'rejected'}>({});
  const [launchNotes, setLaunchNotes] = useState<{[key: string]: string}>({});
  const [loadingStatuses, setLoadingStatuses] = useState(true);
  // 인라인 편집 상태
  const [editingCellKey, setEditingCellKey] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  // 작품 목록을 상태로 관리 (런칭현황 전용)
  const [launchProjects, setLaunchProjects] = useState<LaunchProject[]>([]);
  const [launchLoading, setLaunchLoading] = useState(true);

  // 프로젝트 상태에 따라 초기 카테고리 설정 (한 번만)
  const [hasInitializedCategory, setHasInitializedCategory] = useState(false);
  
  // 초기 데이터 로드
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "projects"), (snapshot) => {
      const fetchedProjects: Project[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Project));
      setProjects(fetchedProjects);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching projects:", error);
      setError("데이터를 불러오는 중 오류가 발생했습니다.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 런칭 탭 초기 데이터
  useEffect(() => {
    if (activeTab === '런칭') {
      // Firestore에서 런칭현황 작품 데이터 가져오기
      const unsubscribe = onSnapshot(collection(db, "launchProjects"), (snapshot) => {
        const fetchedProjects: LaunchProject[] = snapshot.docs.map(doc => ({
          id: doc.id,
          title: doc.data().title || '',
          category: doc.data().category || '국내비독점 [라이브]',
          status: doc.data().status || 'live',
          projectId: doc.data().projectId || doc.id
        }));
        setLaunchProjects(fetchedProjects);
        setLaunchLoading(false);
      }, (error) => {
        console.error("Error fetching launch projects:", error);
        setLaunchLoading(false);
      });

      return () => unsubscribe();
    }
  }, [activeTab]);

  // Firestore에서 런칭 상태/메모 데이터 가져오기
  useEffect(() => {
    if (activeTab === '런칭') {
      const unsubscribe = onSnapshot(collection(db, "launchStatuses"), (snapshot) => {
        const statuses: {[key: string]: 'none' | 'launched' | 'pending' | 'rejected'} = {};
        const notes: {[key: string]: string} = {};
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          statuses[data.key] = data.status || 'none';
          if (typeof data.note === 'string') {
            notes[data.key] = data.note;
          }
        });
        setLaunchStatuses(statuses);
        setLaunchNotes(notes);
        setLoadingStatuses(false);
      }, (error) => {
        console.error("Error fetching launch statuses:", error);
        setLoadingStatuses(false);
      });

      return () => unsubscribe();
    }
  }, [activeTab]);

  // 플랫폼별 배포 상태 계산 함수
  const getDistributionCount = (project: LaunchProject) => {
    return platforms.filter(platform => {
      const status = getLaunchStatus(project.id, platform.id, project.category || categoryFilter);
      return status === 'launched';
    }).length;
  };

  const filteredProjects = useMemo(() => {
    let filteredLaunchProjects = launchProjects.filter(p => p.category === categoryFilter);
    
    // 프로젝트 상태에 따라 적절한 카테고리만 표시
    // 메인 projects에서 해당 프로젝트의 실제 상태 확인
    filteredLaunchProjects = filteredLaunchProjects.filter(launchProject => {
      const mainProject = projects.find(mp => mp.id === launchProject.projectId);
      if (!mainProject) return true; // 메인 프로젝트를 찾을 수 없으면 표시
      
      // 라이브/완결 상태에 따라 적절한 카테고리만 표시
      const isLiveCategory = categoryFilter.includes('[라이브]');
      const isCompletedCategory = categoryFilter.includes('[완결]');
      
      if (isLiveCategory) {
        return mainProject.status === 'live';
      } else if (isCompletedCategory) {
        return mainProject.status === 'completed';
      }
      
      return true;
    });
    
    // 검색 기능 추가
    if (searchQuery.trim()) {
      filteredLaunchProjects = filteredLaunchProjects.filter(p => 
        p.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // 정렬 기능 추가
    const sortedProjects = [...filteredLaunchProjects].sort((a, b) => {
      if (sortBy === 'title') {
        const comparison = a.title.localeCompare(b.title, 'ko');
        return sortOrder === 'asc' ? comparison : -comparison;
      } else if (sortBy === 'distribution') {
        const aCount = getDistributionCount(a);
        const bCount = getDistributionCount(b);
        return sortOrder === 'desc' ? bCount - aCount : aCount - bCount;
      }
      return 0;
    });
    
    return sortedProjects;
  }, [launchProjects, categoryFilter, searchQuery, projects, sortBy, sortOrder, platforms, launchStatuses]);

  // 플랫폼 필터링된 플랫폼 목록
  const filteredPlatforms = useMemo(() => {
    if (selectedPlatforms.length === 0) {
      return platforms;
    }
    return platforms.filter(platform => selectedPlatforms.includes(platform.id));
  }, [platforms, selectedPlatforms]);

  // 카테고리(국내/해외 등)까지 포함한 키 생성 (신규 포맷)
  const buildStatusKey = (actualProjectId: string, category: string, platformId: string) => {
    // 카테고리 공백 포함 그대로 저장 (일관된 키 생성을 위해 트림만)
    const normalizedCategory = (category || '').trim();
    return `${actualProjectId}::${normalizedCategory}::${platformId}`;
  };

  const getLaunchStatus = (projectId: string, platformId: string, category: string) => {
    // launchProjects에서 실제 projectId 찾기
    const launchProject = launchProjects.find(lp => lp.id === projectId);
    const actualProjectId = launchProject?.projectId || projectId;
    const newKey = buildStatusKey(actualProjectId, category, platformId);
    const legacyKey = `${actualProjectId}-${platformId}`; // 이전 포맷 호환
    return launchStatuses[newKey] || launchStatuses[legacyKey] || 'none';
  };

  const getCellKey = (projectId: string, platformId: string, category: string) => {
    const launchProject = launchProjects.find(lp => lp.id === projectId);
    const actualProjectId = launchProject?.projectId || projectId;
    return buildStatusKey(actualProjectId, category, platformId);
  };

  // 모든 변경사항을 Firestore에 저장
  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      console.log('💾 모든 변경사항 저장 시작...');
      // 상태와 메모의 모든 키 기준으로 저장
      const allKeys = new Set<string>([...Object.keys(launchStatuses), ...Object.keys(launchNotes)]);
      for (const key of allKeys) {
        const status = launchStatuses[key] || 'none';
        const note = launchNotes[key];
        if (status !== 'none' || (note && note.trim() !== '')) {
          // 기존 문서 찾기
          const q = query(collection(db, "launchStatuses"), where("key", "==", key));
          const querySnapshot = await getDocs(q);
          
          if (querySnapshot.docs.length > 0) {
            // 기존 문서 업데이트
            const docRef = querySnapshot.docs[0].ref;
            await updateDoc(docRef, {
              status: status,
              note: note || '',
              timestamp: Date.now()
            });
          } else {
            // 새 문서 생성 (신규 포맷과 레거시 포맷 모두 대응)
            let projectId = '';
            let platformId = '';
            let category = undefined as string | undefined;
            const parts = key.split('::');
            if (parts.length === 3) {
              projectId = parts[0];
              category = parts[1];
              platformId = parts[2];
            } else {
              const legacy = key.split('-');
              projectId = legacy[0];
              platformId = legacy.slice(1).join('-');
            }
            await addDoc(collection(db, "launchStatuses"), {
              key: key,
              projectId: projectId,
              platformId: platformId,
              category: category,
              status: status,
              note: note || '',
              timestamp: Date.now()
            });
          }
        }
      }
      
      console.log('✅ 모든 변경사항 저장 완료');
      setHasUnsavedChanges(false);
      alert('저장되었습니다!');
    } catch (error) {
      console.error('❌ 저장 실패:', error);
      alert('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCellClick = async (projectId: string, platformId: string, category: string, event: React.MouseEvent) => {
    console.log(`🖱️ 셀 클릭됨: projectId=${projectId}, platformId=${platformId}, button=${event.button}`);
    
    // launchProjects에서 실제 projectId 찾기
    const launchProject = launchProjects.find(lp => lp.id === projectId);
    const actualProjectId = launchProject?.projectId || projectId;
    console.log(`🔍 실제 projectId: ${actualProjectId}`);
    
    const newKey = buildStatusKey(actualProjectId, category, platformId);
    // 편집 중인 셀은 상태 토글 무시
    if (editingCellKey === newKey) {
      return;
    }
    const legacyKey = `${actualProjectId}-${platformId}`;
    const currentStatus = launchStatuses[newKey] || launchStatuses[legacyKey] || 'none';
    
    let newStatus: 'none' | 'launched' | 'pending' | 'rejected';
    
    if (event.button === 0) { // 왼쪽 클릭
      newStatus = currentStatus === 'launched' ? 'none' : 'launched';
    } else if (event.button === 2) { // 오른쪽 클릭
      switch (currentStatus) {
        case 'none':
          newStatus = 'pending';
          break;
        case 'pending':
          newStatus = 'rejected';
          break;
        case 'rejected':
          newStatus = 'none';
          break;
        default:
          newStatus = 'pending';
      }
    } else {
      return; // 다른 버튼 클릭은 무시
    }
    
    console.log(`🔄 상태 변경: ${currentStatus} -> ${newStatus}`);
    
    // 먼저 로컬 상태 업데이트 (신규 키로 저장, 레거시 키는 제거)
    setLaunchStatuses(prev => {
      const next = { ...prev, [newKey]: newStatus } as typeof prev;
      if (legacyKey in next) {
        delete (next as any)[legacyKey];
      }
      return next;
    });
    
    // 변경사항 있음을 표시
    setHasUnsavedChanges(true);

    // Firestore에 상태 저장 (비동기로 처리하되 실패해도 로컬 상태는 유지)
    try {
      console.log(`💾 Firestore에 저장 시도: ${newKey} -> ${newStatus} (category=${category})`);
      
      if (newStatus === 'none') {
        // 'none' 상태는 문서를 삭제
        const statusQuery = query(collection(db, "launchStatuses"), where("key", "==", newKey));
        const statusSnapshot = await getDocs(statusQuery);
        if (!statusSnapshot.empty) {
          await deleteDoc(statusSnapshot.docs[0].ref);
          console.log(`✅ 런칭상태 삭제됨: ${newKey}`);
        } else {
          console.log(`ℹ️ 삭제할 문서가 없음: ${newKey}`);
        }
        // 레거시 키가 남아있다면 정리
        const legacyQuery = query(collection(db, "launchStatuses"), where("key", "==", legacyKey));
        const legacySnap = await getDocs(legacyQuery);
        if (!legacySnap.empty) {
          await deleteDoc(legacySnap.docs[0].ref);
          console.log(`🧹 레거시 키 삭제: ${legacyKey}`);
        }
      } else {
        // 다른 상태는 문서를 생성하거나 업데이트
        const statusQuery = query(collection(db, "launchStatuses"), where("key", "==", newKey));
        const statusSnapshot = await getDocs(statusQuery);
        
        if (statusSnapshot.empty) {
          // 새 문서 생성
          const docRef = await addDoc(collection(db, "launchStatuses"), {
            key: newKey,
            projectId: actualProjectId,
            platformId: platformId,
            category: category,
            status: newStatus,
            timestamp: Date.now()
          });
          console.log(`✅ 런칭상태 생성됨: ${newKey} -> ${newStatus} (docId: ${docRef.id})`);
        } else {
          // 기존 문서 업데이트
          await updateDoc(statusSnapshot.docs[0].ref, {
            status: newStatus,
            timestamp: Date.now()
          });
          console.log(`✅ 런칭상태 업데이트됨: ${newKey} -> ${newStatus} (docId: ${statusSnapshot.docs[0].id})`);
        }
        // 레거시 키가 남아있다면 정리
        const legacyQuery = query(collection(db, "launchStatuses"), where("key", "==", legacyKey));
        const legacySnap = await getDocs(legacyQuery);
        if (!legacySnap.empty) {
          await deleteDoc(legacySnap.docs[0].ref);
          console.log(`🧹 레거시 키 삭제: ${legacyKey}`);
        }
      }
    } catch (error) {
      console.error("❌ 런칭상태 저장 실패:", error);
      // 실패해도 로컬 상태는 유지 (사용자 경험 개선)
      console.log("로컬 상태는 유지됩니다. 페이지를 새로고침하면 서버 상태로 복원됩니다.");
    }
  };

  const handleCellDoubleClick = (projectId: string, platformId: string, category: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const key = getCellKey(projectId, platformId, category);
    setEditingCellKey(key);
    setEditingText(launchNotes[key] || '');
  };

  const handleCellNoteSave = async (projectId: string, platformId: string, category: string) => {
    const key = getCellKey(projectId, platformId, category);
    const text = editingText.trim();
    setEditingCellKey(null);
    // 로컬 업데이트
    setLaunchNotes(prev => ({ ...prev, [key]: text }));
    setHasUnsavedChanges(true);
    // Firestore 저장
    try {
      const status = launchStatuses[key] || 'none';
      const q = query(collection(db, "launchStatuses"), where("key", "==", key));
      const snap = await getDocs(q);
      if (snap.empty) {
        // 새 문서 생성
        let projectIdActual = '';
        let platformIdActual = '';
        let categoryActual = undefined as string | undefined;
        const parts = key.split('::');
        if (parts.length === 3) {
          projectIdActual = parts[0];
          categoryActual = parts[1];
          platformIdActual = parts[2];
        } else {
          const legacy = key.split('-');
          projectIdActual = legacy[0];
          platformIdActual = legacy.slice(1).join('-');
        }
        await addDoc(collection(db, "launchStatuses"), {
          key,
          projectId: projectIdActual,
          platformId: platformIdActual,
          category: categoryActual,
          status,
          note: text,
          timestamp: Date.now()
        });
      } else {
        await updateDoc(snap.docs[0].ref, {
          note: text,
          timestamp: Date.now()
        });
      }
    } catch (err) {
      console.error('❌ 메모 저장 실패:', err);
      // 실패해도 로컬 유지
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'launched':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRowBgClass = (index: number) => {
    return index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
  };

  const handleAddProject = async () => {
    if (newProjectName.trim()) {
      try {
        await addDoc(collection(db, "launchProjects"), {
          title: newProjectName.trim(),
          category: newProjectCategory,
          status: 'live'
        });
        setNewProjectName('');
        setNewProjectCategory('국내비독점 [라이브]'); // Reset to default
      } catch (error) {
        console.error("Error adding project:", error);
        alert('작품 추가에 실패했습니다.');
      }
    } else {
      alert('작품명을 입력해주세요.');
    }
  };

  const handleAddPlatform = () => {
    if (newPlatformName.trim()) {
      const newId = newPlatformName.trim().toLowerCase().replace(/\s+/g, '-');
      
      // 이미 존재하는 플랫폼인지 확인
      if (allPlatforms.some(p => p.id === newId)) {
        alert('이미 존재하는 플랫폼입니다.');
        return;
      }
      
      // 삭제된 플랫폼 목록에서 제거 (복원)
      if (deletedPlatforms.has(newId)) {
        setDeletedPlatforms(prev => {
          const newSet = new Set(prev);
          newSet.delete(newId);
          return newSet;
        });
        alert('플랫폼이 복원되었습니다.');
      } else {
        alert('새 플랫폼을 추가하려면 코드를 수정해야 합니다.\n\n현재는 삭제된 플랫폼을 복원하는 기능만 지원됩니다.');
      }
      
      setNewPlatformName('');
    } else {
      alert('플랫폼명을 입력해주세요.');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (window.confirm('정말로 이 작품을 삭제하시겠습니까?')) {
      try {
        await deleteDoc(doc(db, "launchProjects", projectId));
        // 관련된 런칭 상태도 삭제
        setLaunchStatuses(prev => {
          const newStatuses = { ...prev };
          Object.keys(newStatuses).forEach(key => {
            if (key.startsWith(`${projectId}-`)) {
              delete newStatuses[key];
            }
          });
          return newStatuses;
        });
      } catch (error) {
        console.error("Error deleting project:", error);
        alert('작품 삭제에 실패했습니다.');
      }
    }
  };

  const handleDeletePlatform = async (platformId: string) => {
    if (window.confirm('정말로 이 플랫폼을 삭제하시겠습니까?\n\n주의: 이 플랫폼과 관련된 모든 런칭 상태 데이터가 삭제됩니다.')) {
      try {
        // 관련된 런칭 상태 데이터 삭제
        const statusKeysToDelete: string[] = [];
        Object.keys(launchStatuses).forEach(key => {
          if (key.includes(`::${platformId}`) || key.endsWith(`-${platformId}`)) {
            statusKeysToDelete.push(key);
          }
        });

        // Firestore에서 관련 문서들 삭제
        const deletePromises = statusKeysToDelete.map(async (key) => {
          const q = query(collection(db, "launchStatuses"), where("key", "==", key));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            await deleteDoc(querySnapshot.docs[0].ref);
          }
        });

        await Promise.all(deletePromises);

        // 로컬 상태에서도 제거
        setLaunchStatuses(prev => {
          const newStatuses = { ...prev };
          statusKeysToDelete.forEach(key => {
            delete newStatuses[key];
          });
          return newStatuses;
        });

        // 플랫폼 목록에서 제거
        setDeletedPlatforms(prev => new Set([...prev, platformId]));
        
        // 선택된 플랫폼에서도 제거
        setSelectedPlatforms(prev => prev.filter(id => id !== platformId));
        
        alert('플랫폼이 삭제되었습니다.');
      } catch (error) {
        console.error('플랫폼 삭제 중 오류:', error);
        alert('플랫폼 삭제에 실패했습니다. 다시 시도해주세요.');
      }
    }
  };

  const handleEditProject = (projectId: string, currentName: string) => {
    setEditingProjectId(projectId);
    setEditingProjectName(currentName);
  };

  const handleSaveProjectEdit = async () => {
    if (editingProjectId && editingProjectName.trim()) {
      try {
        await updateDoc(doc(db, "launchProjects", editingProjectId), {
          title: editingProjectName.trim()
        });
        setEditingProjectId(null);
        setEditingProjectName('');
      } catch (error) {
        console.error("Error updating project:", error);
        alert('작품 수정에 실패했습니다.');
      }
    }
  };

  const handleCancelProjectEdit = () => {
    setEditingProjectId(null);
    setEditingProjectName('');
  };

  const handleEditPlatform = (platformId: string, currentName: string) => {
    setEditingPlatformId(platformId);
    setEditingPlatformName(currentName);
  };

  const handleSavePlatformEdit = () => {
    if (editingPlatformId && editingPlatformName.trim()) {
      setPlatforms(prev => prev.map(p => 
        p.id === editingPlatformId ? { ...p, name: editingPlatformName.trim() } : p
      ));
      setEditingPlatformId(null);
      setEditingPlatformName('');
    }
  };

  const handleCancelPlatformEdit = () => {
    setEditingPlatformId(null);
    setEditingPlatformName('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg font-semibold text-slate-600">데이터를 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg font-semibold text-red-600">{error}</div>
      </div>
    );
  }

  const tabs = ['일정', '공지', '런칭', '납품', '일괄', 'AI링크', '업체 정산'];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-8">웹툰 제작 트래커</h1>
        
        {/* 탭 버튼들 */}
        <div className="flex space-x-2 mb-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-slate-700 mb-4">{activeTab} 관리</h2>
          
          {activeTab === '일정' && (
            <div>
              {projects.length === 0 ? (
                <p className="text-slate-500">등록된 프로젝트가 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {projects.map(project => (
                    <div key={project.id} className="p-3 border border-slate-200 rounded-lg">
                      <h3 className="font-medium text-slate-800">{project.title}</h3>
                      <p className="text-sm text-slate-600">상태: {project.status}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === '런칭' && (
            <div className="space-y-6">
              {/* 분류 필터 */}
              <div className="bg-white p-4 rounded-lg shadow-md border border-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-wrap gap-1">
                    {[
                      { value: '국내비독점 [라이브]', label: '국내비독점 [라이브]' },
                      { value: '해외비독점 [라이브]', label: '해외비독점 [라이브]' },
                      { value: '국내비독점 [완결]', label: '국내비독점 [완결]' },
                      { value: '해외비독점 [완결]', label: '해외비독점 [완결]' }
                    ].map((category) => (
                      <button
                        key={category.value}
                        onClick={() => setCategoryFilter(category.value)}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                          categoryFilter === category.value
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {category.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* 세이브 버튼 */}
                <div className="mt-4 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {hasUnsavedChanges && (
                      <span className="text-orange-500 text-sm font-medium">
                        ⚠️ 저장되지 않은 변경사항이 있습니다
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleSaveAll}
                    disabled={!hasUnsavedChanges || isSaving}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      hasUnsavedChanges && !isSaving
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {isSaving ? '저장 중...' : '💾 모든 변경사항 저장'}
                  </button>
                </div>
              </div>

              {/* 작품/플랫폼 추가 및 수정 모드 */}
              <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
                <div className="space-y-6">
                  {/* 검색 및 정렬 컨트롤 */}
                  <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
                    {/* 검색 필드 */}
                    <div className="flex gap-2 items-center">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="작품명 검색..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
                        />
                        <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            title="검색 초기화"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 정렬 컨트롤 */}
                    <div className="flex gap-3 items-center">
                      <span className="text-sm font-medium text-slate-700">정렬:</span>
                      <div className="flex gap-2">
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as 'title' | 'distribution')}
                          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        >
                          <option value="title">작품명</option>
                          <option value="distribution">유통상황</option>
                        </select>
                        <button
                          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                          className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 bg-white font-medium"
                          title={`${sortOrder === 'asc' ? '내림차순' : '오름차순'}으로 변경`}
                        >
                          {sortBy === 'title' ? (sortOrder === 'asc' ? '가나다 ↑' : '가나다 ↓') : (sortOrder === 'desc' ? '많은순 ↓' : '적은순 ↑')}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 플랫폼 필터 */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setIsPlatformFilterExpanded(!isPlatformFilterExpanded)}
                        className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
                      >
                        <svg 
                          className={`w-4 h-4 transition-transform duration-200 ${isPlatformFilterExpanded ? 'rotate-90' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span>플랫폼 필터</span>
                        {selectedPlatforms.length > 0 && (
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full font-medium">
                            {selectedPlatforms.length}개 선택
                          </span>
                        )}
                      </button>
                      {selectedPlatforms.length > 0 && (
                        <button
                          onClick={() => setSelectedPlatforms([])}
                          className="px-3 py-1 text-xs text-slate-500 hover:text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                          title="플랫폼 필터 초기화"
                        >
                          전체 해제
                        </button>
                      )}
                    </div>
                    
                    {isPlatformFilterExpanded && (
                      <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                          {platforms.map(platform => (
                            <label key={platform.id} className="flex items-center gap-3 text-sm cursor-pointer hover:bg-white hover:shadow-sm p-3 rounded-lg transition-all duration-200 border border-transparent hover:border-slate-200">
                              <input
                                type="checkbox"
                                checked={selectedPlatforms.includes(platform.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPlatforms(prev => [...prev, platform.id]);
                                  } else {
                                    setSelectedPlatforms(prev => prev.filter(id => id !== platform.id));
                                  }
                                }}
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                              />
                              <span className="text-slate-700 font-medium">{platform.name}</span>
                            </label>
                          ))}
                        </div>
                        
                        {/* 선택된 플랫폼 미리보기 */}
                        {selectedPlatforms.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-200">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium text-slate-600">선택된 플랫폼:</span>
                              <span className="text-xs text-slate-500">({selectedPlatforms.length}개)</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {selectedPlatforms.map(platformId => {
                                const platform = platforms.find(p => p.id === platformId);
                                return platform ? (
                                  <span key={platformId} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-md font-medium">
                                    {platform.name}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 작품/플랫폼 추가 */}
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end">
                      {/* 작품 추가 */}
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-medium text-slate-600">새 작품 추가</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="작품명을 입력하세요"
                              value={newProjectName}
                              onChange={(e) => setNewProjectName(e.target.value)}
                              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-48"
                            />
                            <select
                              value={newProjectCategory}
                              onChange={(e) => setNewProjectCategory(e.target.value)}
                              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white w-40"
                            >
                              <option value="국내비독점 [라이브]">국내비독점 [라이브]</option>
                              <option value="해외비독점 [라이브]">해외비독점 [라이브]</option>
                              <option value="국내비독점 [완결]">국내비독점 [완결]</option>
                              <option value="해외비독점 [완결]">해외비독점 [완결]</option>
                            </select>
                            <button
                              onClick={handleAddProject}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors font-medium"
                            >
                              작품 추가
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 플랫폼 추가/복원 */}
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-medium text-slate-600">플랫폼 복원</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="삭제된 플랫폼명을 입력하세요"
                              value={newPlatformName}
                              onChange={(e) => setNewPlatformName(e.target.value)}
                              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 w-48"
                            />
                            <button
                              onClick={handleAddPlatform}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors font-medium"
                            >
                              플랫폼 복원
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 수정 모드 */}
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-600">편집 모드</label>
                        <button
                          onClick={() => setIsEditMode(!isEditMode)}
                          className={`px-4 py-2 rounded-lg text-sm transition-colors font-medium ${
                            isEditMode 
                              ? 'bg-red-600 text-white hover:bg-red-700' 
                              : 'bg-slate-600 text-white hover:bg-slate-700'
                          }`}
                        >
                          {isEditMode ? '수정 모드 종료' : '수정 모드'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 런칭 현황 테이블 */}
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                  <table className="w-full" style={{ minWidth: `${filteredPlatforms.length * 80 + 192}px` }}>
                    <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-4 text-left text-sm font-bold text-slate-800 border-r border-slate-200 w-48 sticky left-0 top-0 z-30 bg-gradient-to-r from-slate-50 to-slate-100">
                          <div className="flex items-center gap-2">
                            <span>작품명</span>
                            <div className="flex flex-col">
                              <button
                                onClick={() => {
                                  setSortBy('title');
                                  setSortOrder('asc');
                                }}
                                className={`text-xs ${sortBy === 'title' && sortOrder === 'asc' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                title="가나다순 정렬"
                              >
                                ↑
                              </button>
                              <button
                                onClick={() => {
                                  setSortBy('title');
                                  setSortOrder('desc');
                                }}
                                className={`text-xs ${sortBy === 'title' && sortOrder === 'desc' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                title="가나다 역순 정렬"
                              >
                                ↓
                              </button>
                            </div>
                            <button
                              onClick={() => {
                                setSortBy('distribution');
                                setSortOrder('desc');
                              }}
                              className={`text-xs px-1 py-0.5 rounded ${sortBy === 'distribution' ? 'text-blue-600 bg-blue-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                              title="유통상황 많은순 정렬"
                            >
                              유통
                            </button>
                          </div>
                        </th>
                        {filteredPlatforms.map(platform => (
                          <th key={platform.id} className="text-center text-xs font-bold text-slate-800 border-r border-slate-200 last:border-r-0 sticky top-0 z-20 bg-gradient-to-r from-slate-50 to-slate-100" style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}>
                            <div className="flex flex-col items-center justify-center gap-0.5 h-12 px-1">
                              {editingPlatformId === platform.id ? (
                                <input
                                  type="text"
                                  value={editingPlatformName}
                                  onChange={(e) => setEditingPlatformName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSavePlatformEdit();
                                    if (e.key === 'Escape') handleCancelPlatformEdit();
                                  }}
                                  onBlur={handleSavePlatformEdit}
                                  className="w-full text-xs text-center bg-white border border-blue-600 rounded px-1"
                                  autoFocus
                                />
                              ) : (
                                <span 
                                  className="leading-tight text-xs cursor-pointer hover:bg-slate-100 px-1 rounded whitespace-pre-line text-center"
                                  onClick={() => isEditMode && handleEditPlatform(platform.id, platform.name)}
                                  title={isEditMode ? "클릭하여 편집" : ""}
                                >
                                  {platform.name}
                                </span>
                              )}
                              {isEditMode && editingPlatformId !== platform.id && (
                                <button
                                  onClick={() => handleDeletePlatform(platform.id)}
                                  className="text-red-500 hover:text-red-700 text-xs"
                                  title="플랫폼 삭제"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProjects.length === 0 ? (
                        <tr>
                          <td 
                            colSpan={filteredPlatforms.length + 1} 
                            className="px-3 py-8 text-center text-gray-500"
                          >
                            {searchQuery ? (
                              <div className="flex flex-col items-center gap-2">
                                <span>검색 결과가 없습니다</span>
                                <span className="text-sm text-gray-400">"{searchQuery}"에 해당하는 작품을 찾을 수 없습니다</span>
                                <button
                                  onClick={() => setSearchQuery('')}
                                  className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 underline"
                                >
                                  검색 초기화
                                </button>
                              </div>
                            ) : (
                              <span>작품이 없습니다</span>
                            )}
                          </td>
                        </tr>
                      ) : (
                        filteredProjects.map((project, index) => (
                        <tr key={project.id} className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${getRowBgClass(index)}`}>
                          <td className="px-4 py-4 text-sm font-medium text-slate-800 border-r border-slate-200 w-48 sticky left-0 z-10 bg-white">
                            <div className="flex items-center justify-between">
                              {editingProjectId === project.id ? (
                                <input
                                  type="text"
                                  value={editingProjectName}
                                  onChange={(e) => setEditingProjectName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveProjectEdit();
                                    if (e.key === 'Escape') handleCancelProjectEdit();
                                  }}
                                  onBlur={handleSaveProjectEdit}
                                  className="flex-1 text-sm bg-white border border-blue-600 rounded px-2 py-1"
                                  autoFocus
                                />
                              ) : (
                                <div className="flex flex-col">
                                  <span 
                                    className="truncate cursor-pointer hover:bg-slate-100 px-2 py-1 rounded"
                                    onClick={() => isEditMode && handleEditProject(project.id, project.title)}
                                    title={isEditMode ? "클릭하여 편집" : ""}
                                  >
                                    {project.title}
                                  </span>
                                  <span className="text-xs text-slate-500 px-2">
                                    유통: {getDistributionCount(project)}/{filteredPlatforms.length}
                                  </span>
                                </div>
                              )}
                              {isEditMode && editingProjectId !== project.id && (
                                <button
                                  onClick={() => handleDeleteProject(project.id)}
                                  className="text-red-500 hover:text-red-700 text-xs ml-2 flex-shrink-0"
                                  title="작품 삭제"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </td>
                          {filteredPlatforms.map(platform => {
                            const status = getLaunchStatus(project.id, platform.id, project.category || categoryFilter);
                            const cellKey = getCellKey(project.id, platform.id, project.category || categoryFilter);
                            const noteText = launchNotes[cellKey] || '';
                            const getStatusColor = (status: string) => {
                              switch (status) {
                                case 'launched':
                                  return 'bg-green-500 hover:opacity-90';
                                case 'pending':
                                  return 'bg-yellow-500 hover:opacity-90';
                                case 'rejected':
                                  return 'bg-red-500 hover:opacity-90';
                                default:
                                  return 'bg-transparent hover:bg-slate-200';
                              }
                            };
                            
                            return (
                              <td 
                                key={platform.id} 
                                className={`relative text-center text-[11px] border-r border-slate-100 last:border-r-0 cursor-pointer transition-all duration-200 ease-in-out hover:scale-105 ${getStatusColor(status)}`}
                                style={{ width: '80px', minWidth: '80px', maxWidth: '80px', height: '52px' }}
                                onClick={(e) => handleCellClick(project.id, platform.id, project.category || categoryFilter, e)}
                                onDoubleClick={(e) => handleCellDoubleClick(project.id, platform.id, project.category || categoryFilter, e)}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  handleCellClick(project.id, platform.id, project.category || categoryFilter, e);
                                }}
                              >
                                {editingCellKey === cellKey ? (
                                  <input
                                    autoFocus
                                    value={editingText}
                                    onChange={(e) => setEditingText(e.target.value)}
                                    onBlur={() => handleCellNoteSave(project.id, platform.id, project.category || categoryFilter)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleCellNoteSave(project.id, platform.id, project.category || categoryFilter);
                                      } else if (e.key === 'Escape') {
                                        setEditingCellKey(null);
                                        setEditingText(noteText);
                                      }
                                    }}
                                    className="absolute inset-0 w-full h-full px-1 bg-white/95 outline-none border-2 border-blue-600 rounded-sm"
                                    placeholder="메모..."
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center px-1">
                                    <span className="line-clamp-2 break-words whitespace-pre-wrap text-slate-900/90">
                                      {noteText}
                                    </span>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === '공지' && (
            <p className="text-slate-500">공지사항 관리 기능이 여기에 표시됩니다.</p>
          )}
          {activeTab === '납품' && (
            <p className="text-slate-500">납품 관리 기능이 여기에 표시됩니다.</p>
          )}
          {activeTab === '일괄' && (
            <p className="text-slate-500">일괄 처리 기능이 여기에 표시됩니다.</p>
          )}
          {activeTab === 'AI링크' && (
            <p className="text-slate-500">AI 링크 관리 기능이 여기에 표시됩니다.</p>
          )}
          {activeTab === '업체 정산' && (
            <p className="text-slate-500">업체 정산 관리 기능이 여기에 표시됩니다.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;