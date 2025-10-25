import React, { useState, useMemo, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import type { Project } from '../types';

interface LaunchStatusProps {
  projects: Project[];
  onAddProject: (projectName: string) => void;
}

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

const LaunchStatus: React.FC<LaunchStatusProps> = ({ projects, onAddProject }) => {
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

  // 현재 카테고리에 따른 플랫폼 선택
  const platforms = categoryFilter.includes('해외') ? overseasPlatforms : domesticPlatforms;

  // 런칭 상태/메모를 상태로 관리
  const [launchStatuses, setLaunchStatuses] = useState<{[key: string]: 'none' | 'launched' | 'pending' | 'rejected'}>({});
  const [launchNotes, setLaunchNotes] = useState<{[key: string]: string}>({});
  const [loadingStatuses, setLoadingStatuses] = useState(true);
  // 인라인 편집 상태
  const [editingCellKey, setEditingCellKey] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  // 작품 목록을 상태로 관리 (런칭현황 전용)
  const [launchProjects, setLaunchProjects] = useState<LaunchProject[]>([]);
  const [loading, setLoading] = useState(true);

  // 프로젝트 상태에 따라 초기 카테고리 설정 (한 번만)
  const [hasInitializedCategory, setHasInitializedCategory] = useState(false);
  
  useEffect(() => {
    if (projects.length > 0 && !hasInitializedCategory) {
      const hasCompleted = projects.some(p => p.status === 'completed');
      
      // 완결 작품이 있으면 완결 카테고리를 기본으로 설정 (초기 로딩시에만)
      if (hasCompleted) {
        setCategoryFilter('국내비독점 [완결]');
      }
      setHasInitializedCategory(true);
    }
  }, [projects, hasInitializedCategory]);

  // Firestore에서 런칭현황 작품 데이터 가져오기
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "launchProjects"), (snapshot) => {
      const fetchedProjects: LaunchProject[] = snapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().title || '',
        category: doc.data().category || '국내비독점 [라이브]',
        status: doc.data().status || 'live',
        projectId: doc.data().projectId || doc.id
      }));
      setLaunchProjects(fetchedProjects);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching launch projects:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Firestore에서 런칭 상태/메모 데이터 가져오기
  useEffect(() => {
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
  }, []);

  // 플랫폼별 배포 상태 계산 함수
  const getDistributionCount = (project: LaunchProject) => {
    return platforms.filter(platform => {
      const status = getLaunchStatus(project.id, platform.id, project.category || categoryFilter);
      return status === 'launched';
    }).length;
  };

  const filteredProjects = useMemo(() => {
    if (!Array.isArray(launchProjects)) {
      return [];
    }
    let filteredLaunchProjects = launchProjects.filter(p => p.category === categoryFilter);
    
    // 프로젝트 상태 필터링 완전 제거 - 모든 프로젝트 표시
    // filteredLaunchProjects = filteredLaunchProjects.filter(launchProject => {
    //   const mainProject = projects.find(mp => mp.id === launchProject.projectId);
    //   if (!mainProject) return true;
    //   return true;
    // });
    
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
    return index % 2 === 0 ? 'bg-slate-50' : 'bg-white';
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
      if (platforms.some(p => p.id === newId)) {
        alert('이미 존재하는 플랫폼입니다.');
        return;
      }
      setPlatforms(prev => [...prev, { 
        id: newId, 
        name: newPlatformName.trim(), 
        color: 'bg-gray-200' 
      }].sort((a, b) => a.name.localeCompare(b.name)));
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

  const handleDeletePlatform = (platformId: string) => {
    if (window.confirm('정말로 이 플랫폼을 삭제하시겠습니까?')) {
      setPlatforms(prev => prev.filter(p => p.id !== platformId));
      // 관련된 런칭 상태도 삭제
      setLaunchStatuses(prev => {
        const newStatuses = { ...prev };
        Object.keys(newStatuses).forEach(key => {
          if (key.endsWith(`-${platformId}`)) {
            delete newStatuses[key];
          }
        });
        return newStatuses;
      });
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

  if (loading || loadingStatuses) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg font-semibold text-slate-600">런칭현황 데이터를 불러오는 중...</div>
      </div>
    );
  }

  return (
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
                    ? 'bg-primary-blue text-white'
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
      <div className="bg-white p-4 rounded-lg shadow-md border border-slate-200">
        <div className="flex flex-col gap-4">
          {/* 첫 번째 행: 검색, 정렬, 플랫폼 필터 */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            {/* 검색 필드 */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="작품명 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 w-48"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                  title="검색 초기화"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 정렬 컨트롤 */}
            <div className="flex gap-2 items-center">
              <span className="text-sm text-slate-600">정렬:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'title' | 'distribution')}
                className="px-3 py-1 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="title">작품명</option>
                <option value="distribution">유통상황</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-2 py-1 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
                title={`${sortOrder === 'asc' ? '내림차순' : '오름차순'}으로 변경`}
              >
                {sortBy === 'title' ? (sortOrder === 'asc' ? '가나다 ↑' : '가나다 ↓') : (sortOrder === 'desc' ? '많은순 ↓' : '적은순 ↑')}
              </button>
            </div>

            {/* 플랫폼 필터 */}
            <div className="flex gap-2 items-center">
              <span className="text-sm text-slate-600">플랫폼:</span>
              <div className="flex flex-wrap gap-1 max-w-md">
                {platforms.slice(0, 8).map(platform => (
                  <label key={platform.id} className="flex items-center gap-1 text-xs">
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
                      className="rounded border-slate-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="whitespace-nowrap">{platform.name}</span>
                  </label>
                ))}
                {platforms.length > 8 && (
                  <span className="text-xs text-slate-500">+{platforms.length - 8}개 더</span>
                )}
              </div>
              {selectedPlatforms.length > 0 && (
                <button
                  onClick={() => setSelectedPlatforms([])}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 border border-slate-300 rounded"
                  title="플랫폼 필터 초기화"
                >
                  전체 해제
                </button>
              )}
            </div>
          </div>

          {/* 두 번째 행: 작품/플랫폼 추가 */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex gap-2">
            <input
              type="text"
              placeholder="새 작품명"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="px-3 py-1 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <select
              value={newProjectCategory}
              onChange={(e) => setNewProjectCategory(e.target.value)}
              className="px-3 py-1 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="국내비독점 [라이브]">국내비독점 [라이브]</option>
              <option value="해외비독점 [라이브]">해외비독점 [라이브]</option>
              <option value="국내비독점 [완결]">국내비독점 [완결]</option>
              <option value="해외비독점 [완결]">해외비독점 [완결]</option>
            </select>
              <button
                onClick={handleAddProject}
                className="px-4 py-1 bg-primary-blue text-white rounded-md text-sm hover:opacity-90 transition-opacity"
              >
                작품 추가
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="새 플랫폼"
                value={newPlatformName}
                onChange={(e) => setNewPlatformName(e.target.value)}
                className="px-3 py-1 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <button
                onClick={handleAddPlatform}
                className="px-4 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors"
              >
                플랫폼 추가
              </button>
            </div>
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`px-4 py-1 rounded-md text-sm transition-colors ${
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



      {/* 런칭 현황 테이블 */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200">
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="w-full" style={{ minWidth: `${filteredPlatforms.length * 80 + 192}px` }}>
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 text-left text-sm font-semibold text-slate-700 border-r border-slate-200 w-48 sticky left-0 top-0 z-30 bg-slate-50">
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
                  <th key={platform.id} className="text-center text-xs font-semibold text-slate-700 border-r border-slate-200 last:border-r-0 sticky top-0 z-20 bg-slate-50" style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}>
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
                          className="w-full text-xs text-center bg-white border border-primary-blue rounded px-1"
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
                <tr key={project.id} className={`border-b border-slate-200 ${getRowBgClass(index)}`}>
                  <td className="px-3 py-3 text-sm font-medium text-slate-800 border-r border-slate-200 w-48 sticky left-0 z-10 bg-white">
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
                          className="flex-1 text-sm bg-white border border-primary-blue rounded px-2 py-1"
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
                          return 'bg-primary-green hover:opacity-90';
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
                        className={`relative text-center text-[11px] border-r border-slate-200 last:border-r-0 cursor-pointer transition-colors duration-150 ease-in-out ${getStatusColor(status)}`}
                        style={{ width: '80px', minWidth: '80px', maxWidth: '80px', height: '48px' }}
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
                            className="absolute inset-0 w-full h-full px-1 bg-white/95 outline-none border-2 border-primary-blue rounded-sm"
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
  );
};

export default LaunchStatus;