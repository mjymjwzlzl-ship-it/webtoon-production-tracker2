import React, { useState, useEffect, useRef } from 'react';
import type { Project, ProjectStatus, AdultSubType, IdentifierType, CopeInterSubType } from '../types';
import LaunchStatus from './LaunchStatus';
import { db } from '../firebase';
import { onSnapshot, collection } from 'firebase/firestore';
import { getAdultProcesses } from '../constants';

interface ProjectDetailsProps {
  project: Project;
  onUpdate: (details: Partial<Project>) => void;
  onClose: () => void;
}

const ProjectDetails: React.FC<ProjectDetailsProps> = ({
  project,
  onUpdate,
  onClose
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showSynopsisModal, setShowSynopsisModal] = useState(false);
  const [isEditingSynopsis, setIsEditingSynopsis] = useState(false);
  const [showLaunchStatus, setShowLaunchStatus] = useState(false);
  const [launchStatuses, setLaunchStatuses] = useState<{[key: string]: 'none' | 'launched' | 'pending' | 'rejected'}>({});
  const [loadingLaunchStatus, setLoadingLaunchStatus] = useState(false);
  const [isDetailsCollapsed, setIsDetailsCollapsed] = useState(false);
  const [showMemoModal, setShowMemoModal] = useState(false);
  const [isEditingMemo, setIsEditingMemo] = useState(false);
  const [details, setDetails] = useState({
    title: project.title,
    team: project.team,
    status: project.status,
    storyWriter: project.storyWriter,
    artWriter: project.artWriter,
    identifierType: project.identifierType,
    identifierValue: project.identifierValue,
    synopsis: project.synopsis || '',
    hasGeneralCover: project.hasGeneralCover,
    hasAdultCover: project.hasAdultCover,
    hasLogo: project.hasLogo,
    hasCharacterSheet: project.hasCharacterSheet,
    hasSynopsis: project.hasSynopsis,
    hasProposal: project.hasProposal ?? false,
    adultSubType: project.adultSubType,
    copeInterSubType: project.copeInterSubType,
    internalAiWeight: project.internalAiWeight,
    memo: project.memo || ''
  });

  // 프로젝트가 변경될 때마다 details 상태 업데이트
  useEffect(() => {
    setDetails({
      title: project.title,
      team: project.team,
      status: project.status,
      storyWriter: project.storyWriter,
      artWriter: project.artWriter,
      identifierType: project.identifierType,
      identifierValue: project.identifierValue,
      synopsis: project.synopsis || '',
      hasGeneralCover: project.hasGeneralCover,
      hasAdultCover: project.hasAdultCover,
      hasLogo: project.hasLogo,
      hasCharacterSheet: project.hasCharacterSheet,
      hasSynopsis: project.hasSynopsis,
      hasProposal: project.hasProposal ?? false,
      adultSubType: project.adultSubType,
      copeInterSubType: project.copeInterSubType,
      internalAiWeight: project.internalAiWeight,
      memo: project.memo || ''
    });
  }, [project.id, project.title, project.team, project.status, project.storyWriter, project.artWriter, project.identifierType, project.identifierValue, project.synopsis, project.hasGeneralCover, project.hasAdultCover, project.hasLogo, project.hasCharacterSheet, project.hasSynopsis, project.hasProposal, project.adultSubType, project.copeInterSubType, project.internalAiWeight, project.memo]);

  // 런칭 상태 가져오기
  useEffect(() => {
    if (!showLaunchStatus) {
      console.log(`🚫 런칭상태 가져오기 건너뜀: showLaunchStatus=${showLaunchStatus}`);
      return;
    }
    
    console.log(`🔍 런칭상태 가져오기 시작: projectId=${project.id}`);
    setLoadingLaunchStatus(true);
    
    // 실시간 리스너 설정
    const unsubscribe = onSnapshot(collection(db, "launchStatuses"), (snapshot) => {
      console.log(`📊 실시간 업데이트 받음: ${snapshot.docs.length}개 문서`);
      
      const statuses: {[key: string]: 'none' | 'launched' | 'pending' | 'rejected'} = {};
      let matchCount = 0;
      
      // 현재 프로젝트의 상태만 필터링
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.projectId === project.id) {
          statuses[data.key] = data.status || 'none';
          matchCount++;
          console.log(`✅ 매칭: ${data.platformId} -> ${data.status}`);
        }
      });
      
      console.log(`🎯 매칭된 문서: ${matchCount}개`);
      console.log(`🎯 프로젝트 ${project.id} 상태:`, statuses);
      
      // 상태 업데이트
      setLaunchStatuses(statuses);
      setLoadingLaunchStatus(false);
    }, (error) => {
      console.error("❌ 런칭상태 가져오기 실패:", error);
      setLoadingLaunchStatus(false);
    });

    return () => {
      console.log(`🧹 런칭상태 리스너 해제`);
      unsubscribe();
    };
  }, [showLaunchStatus, project.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 상태가 변경된 경우 런칭현황도 동기화
    if (details.status !== project.status) {
      try {
        await syncLaunchStatusCategory(project.id, project.status, details.status);
      } catch (error) {
        console.error('런칭현황 동기화 중 오류:', error);
      }
    }
    
    onUpdate(details);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDetails({
      title: project.title,
      team: project.team,
      status: project.status,
      storyWriter: project.storyWriter,
      artWriter: project.artWriter,
      identifierType: project.identifierType,
      identifierValue: project.identifierValue,
      synopsis: project.synopsis || '',
      hasGeneralCover: project.hasGeneralCover,
      hasAdultCover: project.hasAdultCover,
      hasLogo: project.hasLogo,
      hasCharacterSheet: project.hasCharacterSheet,
      hasSynopsis: project.hasSynopsis,
      hasProposal: project.hasProposal ?? false,
      adultSubType: project.adultSubType,
      copeInterSubType: project.copeInterSubType,
      internalAiWeight: project.internalAiWeight
    });
    setIsEditing(false);
  };

  const handleStatusChange = async (newStatus: ProjectStatus) => {
    if (isEditing) {
      setDetails({ ...details, status: newStatus });
      
      // 상태 변경시 런칭현황 카테고리도 동기화
      try {
        await syncLaunchStatusCategory(project.id, project.status, newStatus);
      } catch (error) {
        console.error('런칭현황 동기화 중 오류:', error);
      }
    }
  };

  const handleCheckboxChange = (field: 'hasGeneralCover' | 'hasAdultCover' | 'hasLogo' | 'hasCharacterSheet' | 'hasSynopsis' | 'hasProposal') => {
    if (isEditing) {
      setDetails({ ...details, [field]: !details[field] });
    }
  };

  const handleIdentifierTypeChange = (newIdentifierType: IdentifierType) => {
    if (isEditing) {
      setDetails({ ...details, identifierType: newIdentifierType });
    }
  };

  const handleCopeInterSubTypeChange = (newSubType: CopeInterSubType) => {
    // 편집 모드와 상관없이 하위 유형 변경 허용
    const updatedDetails = { ...details, copeInterSubType: newSubType };
    setDetails(updatedDetails);
    onUpdate({ copeInterSubType: newSubType });
  };

  const handleSubTypeChange = (newSubType: AdultSubType) => {
    // 편집 모드와 상관없이 하위 유형 변경 허용
    // 새로운 프로세스 가져오기
    const newProcesses = getAdultProcesses(newSubType);
    
    // 기존 담당자 정보 보존을 위한 매핑
    const existingAssignments: { [key: number]: string } = {};
    project.processes.forEach(process => {
      if (process.assignee) {
        existingAssignments[process.id] = process.assignee;
      }
    });
    
    // 새 프로세스에 기존 담당자 정보 적용
    const processesWithAssignees = newProcesses.map(process => ({
      ...process,
      assignee: existingAssignments[process.id] || ''
    }));
    
    // 기존 상태 데이터 보존 (프로세스 ID가 동일한 경우)
    const newStatuses: { [key: string]: any } = {};
    Object.keys(project.statuses).forEach(key => {
      const [processIdStr, episode] = key.split('-');
      const processId = parseInt(processIdStr);
      
      // 새 프로세스에 해당 ID가 있으면 상태 보존
      if (newProcesses.some(p => p.id === processId)) {
        newStatuses[key] = project.statuses[key];
      }
    });
    
    // 새 프로세스에 대해 누락된 상태 초기화
    for (let episode = 1; episode <= project.episodeCount; episode++) {
      newProcesses.forEach(process => {
        const key = `${process.id}-${episode}`;
        if (!newStatuses[key]) {
          newStatuses[key] = { status: 'none', text: '' };
        }
      });
    }
    
    const updatedDetails: Partial<Project> = { 
      adultSubType: newSubType,
      processes: processesWithAssignees,
      statuses: newStatuses
    };

    const newDetails = {
      ...details,
      adultSubType: newSubType,
    }

    if (newSubType === 'cope-inter') {
      newDetails.copeInterSubType = project.copeInterSubType || 'v1-brush';
      updatedDetails.copeInterSubType = project.copeInterSubType || 'v1-brush';
      newDetails.internalAiWeight = null; // 로컬 상태에서도 undefined 대신 null 사용
      updatedDetails.internalAiWeight = null; // Firestore는 undefined를 허용하지 않음
    } else {
      newDetails.copeInterSubType = null; // 로컬 상태에서도 undefined 대신 null 사용
      updatedDetails.copeInterSubType = null; // Firestore는 undefined를 허용하지 않음
      newDetails.internalAiWeight = project.internalAiWeight || '';
      updatedDetails.internalAiWeight = project.internalAiWeight || '';
    }
    
    setDetails(newDetails);
    
    // 하위 유형, 프로세스, 상태 모두 업데이트
    onUpdate(updatedDetails);
  };

  const handleSynopsisChange = (newSynopsis: string) => {
    setDetails({ ...details, synopsis: newSynopsis });
  };

  const handleSynopsisSave = () => {
    onUpdate({ synopsis: details.synopsis });
    setIsEditingSynopsis(false);
  };

  const handleSynopsisCancel = () => {
    setDetails({ ...details, synopsis: project.synopsis || '' });
    setIsEditingSynopsis(false);
  };

  const handleMemoChange = (newMemo: string) => {
    setDetails({ ...details, memo: newMemo });
  };

  const handleMemoSave = async () => {
    console.log('메모 저장 시도:', details.memo);
    try {
      await onUpdate({ memo: details.memo });
      setIsEditingMemo(false);
      alert('메모가 저장되었습니다.');
    } catch (error) {
      console.error('메모 저장 실패:', error);
      alert('메모 저장에 실패했습니다.');
    }
  };

  const handleMemoCancel = () => {
    setDetails({ ...details, memo: project.memo || '' });
    setIsEditingMemo(false);
  };

  const handleDownloadBookInfo = () => {
    try {
      // xlsx 라이브러리 동적 import
      import('xlsx').then((XLSX) => {
        // 서지정보 데이터 준비 - 가로 형태
        const bookInfo = [
          // 첫 번째 행: 항목명들
          [
            '제목', '글작가', '그림작가', '회차수', '줄거리', '팀', '작품 타입', '제작방식', 
            '상태', details.identifierType === 'isbn' ? 'ISBN' : 'UCI', '일반표지', '성인표지', '로고', '캐릭터시트', '줄거리 완료', '소개서'
          ],
          // 두 번째 행: 실제 데이터
          [
            project.title,
            project.storyWriter || '미지정',
            project.artWriter || '미지정',
            project.episodeCount.toString(),
            project.synopsis || '줄거리 없음',
            project.team,
            project.type === 'adult' ? '19금' : '일반',
            project.type === 'adult' && project.adultSubType ? 
              (project.adultSubType === 'internal-ai' ? '사내AI' : '코페인터') : '-',
            project.status === 'production' ? '제작중' : 
              project.status === 'scheduled' ? '연재예정' : 
              project.status === 'live' ? '라이브중' : '완결',
            project.identifierValue || '미지정',
            project.hasGeneralCover ? 'O' : 'X',
            project.hasAdultCover ? 'O' : 'X',
            project.hasLogo ? 'O' : 'X',
            project.hasCharacterSheet ? 'O' : 'X',
            project.hasSynopsis ? 'O' : 'X',
            (project.hasProposal ?? false) ? 'O' : 'X'
          ]
        ];

        // 워크시트 생성
        const ws = XLSX.utils.aoa_to_sheet(bookInfo);
        
        // 컬럼 너비 설정 - 가로 형태에 맞게 조정
        ws['!cols'] = [
          { width: 20 }, // 제목
          { width: 15 }, // 글작가
          { width: 15 }, // 그림작가
          { width: 8 },  // 회차수
          { width: 50 }, // 줄거리
          { width: 8 },  // 팀
          { width: 12 }, // 작품 타입
          { width: 12 }, // 제작방식
          { width: 10 }, // 상태
          { width: 15 }, // ISBN or UCI
          { width: 10 }, // 일반표지
          { width: 10 }, // 성인표지
          { width: 8 },  // 로고
          { width: 12 }, // 캐릭터시트
          { width: 12 }, // 줄거리 완료
          { width: 10 }  // 소개서
        ];
        
        // 워크북 생성
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '서지정보');
        
        // 파일명 생성 (작품명 + 현재 날짜)
        const today = new Date().toISOString().split('T')[0];
        const fileName = `${project.title}_서지정보_${today}.xlsx`;
        
        // 파일 다운로드
        XLSX.writeFile(wb, fileName);
      });
    } catch (error) {
      console.error('서지정보 다운로드 중 오류:', error);
      alert('서지정보 다운로드에 실패했습니다.');
    }
  };

  const handleMoveToComplete = async () => {
    if (window.confirm('이 작품을 완결작으로 이동하시겠습니까?\n완결작으로 이동하면 기본 목록에서 사라지고 "완결작만 보기"를 눌러야 볼 수 있습니다.')) {
      try {
        // 1. 프로젝트 상태를 completed로 변경
        onUpdate({ status: 'completed' });
        
        // 2. 런칭현황 데이터 복사 (라이브 -> 완결)
        await copyLaunchStatusToCompleted(project.id);
        
      } catch (error) {
        console.error('완결로 이동 중 오류 발생:', error);
        alert('완결로 이동하는 중 오류가 발생했습니다.');
      }
    }
  };

  const copyLaunchStatusToCompleted = async (projectId: string) => {
    const { collection, query, where, getDocs, addDoc, updateDoc } = await import('firebase/firestore');
    const { db } = await import('../firebase');
    
    try {
      // 라이브 상태의 런칭현황 데이터 조회
      const launchStatusQuery = query(
        collection(db, "launchStatuses"), 
        where("projectId", "==", projectId)
      );
      const launchStatusSnapshot = await getDocs(launchStatusQuery);
      
      // 각 런칭현황 데이터를 완결용으로 복사
      const copyPromises = launchStatusSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        const originalKey = data.key;
        
        // 키에서 카테고리 부분을 라이브에서 완결로 변경
        let newKey = originalKey;
        let newCategory = data.category;
        
        if (originalKey.includes('라이브')) {
          newKey = originalKey.replace('라이브', '완결');
          newCategory = data.category ? data.category.replace('라이브', '완결') : '국내비독점 [완결]';
        } else if (originalKey.includes('::')) {
          // 신규 포맷이지만 라이브가 없는 경우
          const parts = originalKey.split('::');
          if (parts.length >= 3) {
            newCategory = parts[1].includes('국내') ? '국내비독점 [완결]' : '해외비독점 [완결]';
            newKey = `${parts[0]}::${newCategory}::${parts[2]}`;
          }
        } else {
          // 레거시 키 형태인 경우 완결 카테고리로 새로 생성
          newKey = `${projectId}::국내비독점 [완결]::${data.platformId}`;
          newCategory = '국내비독점 [완결]';
        }
        
        // 완결용 런칭현황 데이터 생성
        await addDoc(collection(db, "launchStatuses"), {
          key: newKey,
          projectId: projectId,
          platformId: data.platformId,
          category: newCategory,
          status: data.status,
          note: data.note || '',
          timestamp: Date.now()
        });
      });
      
      await Promise.all(copyPromises);
      
      // launchProjects 컬렉션도 업데이트 (라이브 -> 완결)
      const launchProjectQuery = query(
        collection(db, "launchProjects"), 
        where("projectId", "==", projectId)
      );
      const launchProjectSnapshot = await getDocs(launchProjectQuery);
      
      const updatePromises = launchProjectSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        if (data.category && data.category.includes('라이브')) {
          const newCategory = data.category.replace('라이브', '완결');
          await updateDoc(doc.ref, { 
            category: newCategory,
            status: 'completed'
          });
        }
      });
      
      await Promise.all(updatePromises);
      
      // 완결 카테고리가 없다면 새로 생성
      if (launchProjectSnapshot.empty) {
        await Promise.all([
          addDoc(collection(db, "launchProjects"), {
            title: project.title,
            category: '국내비독점 [완결]',
            status: 'completed',
            projectId: projectId
          }),
          addDoc(collection(db, "launchProjects"), {
            title: project.title,
            category: '해외비독점 [완결]',
            status: 'completed',
            projectId: projectId
          })
        ]);
      }
      
      console.log('런칭현황 데이터가 완결로 성공적으로 복사되었습니다.');
      
    } catch (error) {
      console.error('런칭현황 데이터 복사 중 오류:', error);
      throw error;
    }
  };

  const syncLaunchStatusCategory = async (projectId: string, oldStatus: ProjectStatus, newStatus: ProjectStatus) => {
    const { collection, query, where, getDocs, updateDoc, addDoc } = await import('firebase/firestore');
    const { db } = await import('../firebase');
    
    try {
      // 상태 변경에 따른 카테고리 매핑
      const getTargetCategory = (status: ProjectStatus, isOverseas: boolean = false) => {
        const region = isOverseas ? '해외비독점' : '국내비독점';
        if (status === 'completed') {
          return `${region} [완결]`;
        } else {
          return `${region} [라이브]`;
        }
      };

      // 기존 런칭현황 데이터 조회
      const launchStatusQuery = query(
        collection(db, "launchStatuses"), 
        where("projectId", "==", projectId)
      );
      const launchStatusSnapshot = await getDocs(launchStatusQuery);
      
      // 각 런칭현황 데이터의 카테고리 업데이트
      const updatePromises = launchStatusSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        const isOverseas = data.category && data.category.includes('해외');
        const targetCategory = getTargetCategory(newStatus, isOverseas);
        
        // 새로운 키 생성
        const newKey = `${projectId}::${targetCategory}::${data.platformId}`;
        
        // 기존 데이터 삭제하고 새 카테고리로 복사
        if (data.category !== targetCategory) {
          await addDoc(collection(db, "launchStatuses"), {
            key: newKey,
            projectId: projectId,
            platformId: data.platformId,
            category: targetCategory,
            status: data.status,
            note: data.note || '',
            timestamp: Date.now()
          });
          
          // 기존 데이터는 삭제하지 않고 유지 (혹시 모를 상황을 위해)
        }
      });
      
      await Promise.all(updatePromises);
      
      // launchProjects 컬렉션도 업데이트
      const launchProjectQuery = query(
        collection(db, "launchProjects"), 
        where("projectId", "==", projectId)
      );
      const launchProjectSnapshot = await getDocs(launchProjectQuery);
      
      const projectUpdatePromises = launchProjectSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        const isOverseas = data.category && data.category.includes('해외');
        const targetCategory = getTargetCategory(newStatus, isOverseas);
        
        await updateDoc(doc.ref, { 
          category: targetCategory,
          status: newStatus
        });
      });
      
      await Promise.all(projectUpdatePromises);
      
      console.log(`런칭현황이 ${oldStatus}에서 ${newStatus}로 동기화되었습니다.`);
      
    } catch (error) {
      console.error('런칭현황 동기화 중 오류:', error);
      throw error;
    }
  };

  return (
    <div className="bg-white rounded-lg p-2 shadow-md border border-slate-200">
      {/* 접기/펼치기 버튼 */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-semibold text-slate-700">작품 상세 정보</h3>
        <button
          type="button"
          onClick={() => setIsDetailsCollapsed(!isDetailsCollapsed)}
          className="p-0.5 hover:bg-slate-100 rounded transition-colors"
        >
          <svg 
            className={`w-3 h-3 text-slate-600 transition-transform duration-200 ${
              isDetailsCollapsed ? 'rotate-180' : ''
            }`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {!isDetailsCollapsed && (
        <form onSubmit={handleSubmit} className="space-y-2">
        {/* 첫 번째 행: 작품명, 팀, 작품 상태 */}
        <div className="flex flex-col md:flex-row md:items-end md:gap-2 space-y-2 md:space-y-0">
          
          {/* 작품명 */}
          <div className="flex-grow min-w-[200px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">작품명</label>
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={details.title}
                onChange={(e) => isEditing && setDetails({ ...details, title: e.target.value })}
                className={`flex-grow border rounded-md px-2 py-1 text-xs h-7 ${
                  isEditing 
                    ? 'border-gray-300 bg-white' 
                    : 'border-gray-200 bg-gray-50'
                }`}
                placeholder="작품명"
                disabled={!isEditing}
              />
              {project.type === 'adult' && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleSubTypeChange('internal-ai')}
                    className={`px-2 py-1 text-xs font-medium rounded-md transition-colors h-7 ${
                      details.adultSubType === 'internal-ai'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    사내AI
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubTypeChange('cope-inter')}
                    className={`px-2 py-1 text-xs font-medium rounded-md transition-colors h-7 ${
                      details.adultSubType === 'cope-inter'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    코페인터
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* 코페인터 타입 */}
          {details.adultSubType === 'cope-inter' && (
            <div className="min-w-[200px]">
              <label className="block text-xs font-medium text-gray-700 mb-1">코페인터 타입</label>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1 h-9 items-center">
                <button
                  type="button"
                  onClick={() => handleCopeInterSubTypeChange('v1-brush')}
                  className={`flex-1 py-1 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    details.copeInterSubType === 'v1-brush'
                      ? 'bg-white text-primary-blue shadow-sm'
                      : 'bg-transparent text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  V1 브러시
                </button>
                <button
                  type="button"
                  onClick={() => handleCopeInterSubTypeChange('v1-ani')}
                  className={`flex-1 py-1 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    details.copeInterSubType === 'v1-ani'
                      ? 'bg-white text-primary-blue shadow-sm'
                      : 'bg-transparent text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  V1 애니
                </button>
                <button
                  type="button"
                  onClick={() => handleCopeInterSubTypeChange('v2-brush')}
                  className={`flex-1 py-1 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    details.copeInterSubType === 'v2-brush'
                      ? 'bg-white text-primary-blue shadow-sm'
                      : 'bg-transparent text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  V2 브러시
                </button>
              </div>
            </div>
          )}

          {/* 웨이트 */}
          {details.adultSubType === 'internal-ai' && (
            <div className="min-w-[200px]">
              <label className="block text-xs font-medium text-gray-700 mb-1">웨이트</label>
              <input
                type="text"
                value={details.internalAiWeight || ''}
                onChange={(e) => isEditing && setDetails({ ...details, internalAiWeight: e.target.value })}
                className={`w-full border rounded-md px-2 py-1 text-xs h-7 ${
                  isEditing
                    ? 'border-gray-300 bg-white'
                    : 'border-gray-200 bg-gray-50'
                }`}
                placeholder="웨이트 이름 입력"
                disabled={!isEditing}
              />
            </div>
          )}

          {/* 팀 */}
          <div className="w-full md:w-auto">
            <label className="block text-xs font-medium text-gray-700 mb-1">팀</label>
            <select
              value={details.team}
              onChange={(e) => isEditing && setDetails({ ...details, team: e.target.value as any })}
              className={`w-full md:w-24 border rounded-md px-2 py-1 text-xs h-7 ${
                isEditing 
                  ? 'border-gray-300 bg-white' 
                  : 'border-gray-200 bg-gray-50'
              }`}
              disabled={!isEditing}
            >
              <option value="0팀">0팀</option>
              <option value="1팀">1팀</option>
            </select>
          </div>
          
          {/* 작품 상태 */}
          <div className="flex-grow min-w-[250px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">작품 상태</label>
            <div className="flex bg-gray-100 rounded-lg p-1 h-7 items-center">
              <button
                type="button"
                onClick={() => handleStatusChange('production')}
                className={`flex-1 py-1 px-2 text-xs font-medium rounded-md transition-colors ${
                  details.status === 'production'
                    ? 'bg-primary-blue text-white shadow-sm'
                    : 'bg-transparent text-gray-600 hover:bg-gray-200'
                }`}
              >
                제작중
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('scheduled')}
                className={`flex-1 py-1 px-2 text-xs font-medium rounded-md transition-colors ${
                  details.status === 'scheduled'
                    ? 'bg-primary-blue text-white shadow-sm'
                    : 'bg-transparent text-gray-600 hover:bg-gray-200'
                }`}
              >
                연재예정
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('live')}
                className={`flex-1 py-1 px-2 text-xs font-medium rounded-md transition-colors ${
                  details.status === 'live'
                    ? 'bg-primary-blue text-white shadow-sm'
                    : 'bg-transparent text-gray-600 hover:bg-gray-200'
                }`}
              >
                라이브중
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('completed')}
                className={`flex-1 py-1 px-2 text-xs font-medium rounded-md transition-colors ${
                  details.status === 'completed'
                    ? 'bg-primary-blue text-white shadow-sm'
                    : 'bg-transparent text-gray-600 hover:bg-gray-200'
                }`}
              >
                완결
              </button>
            </div>
          </div>
        </div>

        {/* 두 번째 행: 글작가, 그림작가, ISBN */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">글작가</label>
            <input
              type="text"
              value={details.storyWriter}
              onChange={(e) => isEditing && setDetails({ ...details, storyWriter: e.target.value })}
              className={`w-full border rounded-md px-2 py-2 sm:py-1.5 text-xs h-9 ${
                isEditing 
                  ? 'border-gray-300 bg-white' 
                  : 'border-gray-200 bg-gray-50'
              }`}
              placeholder="미지정"
              disabled={!isEditing}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">그림작가</label>
            <input
              type="text"
              value={details.artWriter}
              onChange={(e) => isEditing && setDetails({ ...details, artWriter: e.target.value })}
              className={`w-full border rounded-md px-2 py-2 sm:py-1.5 text-xs h-9 ${
                isEditing 
                  ? 'border-gray-300 bg-white' 
                  : 'border-gray-200 bg-gray-50'
              }`}
              placeholder="미지정"
              disabled={!isEditing}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{details.identifierType === 'isbn' ? 'ISBN' : 'UCI'}</label>
            <div className="flex gap-2">
              {isEditing && (
                <div className="flex">
                  <button
                    type="button"
                    onClick={() => handleIdentifierTypeChange('isbn')}
                    className={`px-2 py-1 text-xs font-medium rounded-l-md transition-colors ${
                      details.identifierType === 'isbn'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    ISBN
                  </button>
                  <button
                    type="button"
                    onClick={() => handleIdentifierTypeChange('uci')}
                    className={`px-2 py-1 text-xs font-medium rounded-r-md transition-colors ${
                      details.identifierType === 'uci'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    UCI
                  </button>
                </div>
              )}
              <input
                type="text"
                value={details.identifierValue}
                onChange={(e) => isEditing && setDetails({ ...details, identifierValue: e.target.value })}
                className={`flex-1 border rounded-md px-2 py-2 sm:py-1.5 text-xs w-full h-9 ${
                  isEditing 
                    ? 'border-gray-300 bg-white' 
                    : 'border-gray-200 bg-gray-50'
                }`}
                placeholder="미지정"
                disabled={!isEditing}
              />
              <button
                type="button"
                onClick={() => setShowSynopsisModal(true)}
                className="px-3 py-2 sm:py-1.5 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 transition-colors text-xs font-medium whitespace-nowrap h-9"
              >
                줄거리
              </button>
              <button
                type="button"
                onClick={() => setShowMemoModal(true)}
                className="px-3 py-2 sm:py-1.5 bg-green-100 text-green-800 rounded-md hover:bg-green-200 transition-colors text-xs font-medium whitespace-nowrap h-9"
              >
                메모
              </button>
            </div>
          </div>
        </div>

        {/* 체크박스와 버튼들 */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className={`flex items-center space-x-2 ${!isEditing ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                checked={details.hasGeneralCover}
                onChange={() => handleCheckboxChange('hasGeneralCover')}
                className={`rounded border-2 h-3 w-3 transition-all duration-200 ${
                  details.hasGeneralCover
                    ? 'border-blue-500 bg-blue-500 text-white focus:ring-blue-500 focus:ring-2'
                    : 'border-gray-400 bg-white hover:border-blue-400 focus:ring-blue-500 focus:ring-2'
                } ${!isEditing ? 'cursor-not-allowed pointer-events-none' : ''}`}
                style={{ 
                  pointerEvents: !isEditing ? 'none' : 'auto',
                  opacity: !isEditing ? 1 : 1
                }}
              />
              <span className={`text-xs font-medium ${details.hasGeneralCover ? 'text-blue-700' : 'text-gray-700'}`}>일반표지</span>
            </label>
            <label className={`flex items-center space-x-2 ${!isEditing ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                checked={details.hasAdultCover}
                onChange={() => handleCheckboxChange('hasAdultCover')}
                className={`rounded border-2 h-3 w-3 transition-all duration-200 ${
                  details.hasAdultCover
                    ? 'border-red-500 bg-red-500 text-white focus:ring-red-500 focus:ring-2'
                    : 'border-gray-400 bg-white hover:border-red-400 focus:ring-red-500 focus:ring-2'
                } ${!isEditing ? 'cursor-not-allowed pointer-events-none' : ''}`}
                style={{ 
                  pointerEvents: !isEditing ? 'none' : 'auto',
                  opacity: !isEditing ? 1 : 1
                }}
              />
              <span className={`text-xs font-medium ${details.hasAdultCover ? 'text-red-700' : 'text-gray-700'}`}>성인표지</span>
            </label>
            <label className={`flex items-center space-x-2 ${!isEditing ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                checked={details.hasLogo}
                onChange={() => handleCheckboxChange('hasLogo')}
                className={`rounded border-2 h-3 w-3 transition-all duration-200 ${
                  details.hasLogo
                    ? 'border-blue-500 bg-blue-500 text-white focus:ring-blue-500 focus:ring-2'
                    : 'border-gray-400 bg-white hover:border-blue-400 focus:ring-blue-500 focus:ring-2'
                } ${!isEditing ? 'cursor-not-allowed pointer-events-none' : ''}`}
                style={{ 
                  pointerEvents: !isEditing ? 'none' : 'auto',
                  opacity: !isEditing ? 1 : 1
                }}
              />
              <span className={`text-xs font-medium ${details.hasLogo ? 'text-blue-700' : 'text-gray-700'}`}>로고</span>
            </label>
            <label className={`flex items-center space-x-2 ${!isEditing ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                checked={details.hasCharacterSheet}
                onChange={() => handleCheckboxChange('hasCharacterSheet')}
                className={`rounded border-2 h-3 w-3 transition-all duration-200 ${
                  details.hasCharacterSheet
                    ? 'border-blue-500 bg-blue-500 text-white focus:ring-blue-500 focus:ring-2'
                    : 'border-gray-400 bg-white hover:border-blue-400 focus:ring-blue-500 focus:ring-2'
                } ${!isEditing ? 'cursor-not-allowed pointer-events-none' : ''}`}
                style={{ 
                  pointerEvents: !isEditing ? 'none' : 'auto',
                  opacity: !isEditing ? 1 : 1
                }}
              />
              <span className={`text-xs font-medium ${details.hasCharacterSheet ? 'text-blue-700' : 'text-gray-700'}`}>캐릭터시트</span>
            </label>
            <label className={`flex items-center space-x-2 ${!isEditing ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                checked={details.hasSynopsis}
                onChange={() => handleCheckboxChange('hasSynopsis')}
                className={`rounded border-2 h-3 w-3 transition-all duration-200 ${
                  details.hasSynopsis
                    ? 'border-blue-500 bg-blue-500 text-white focus:ring-blue-500 focus:ring-2'
                    : 'border-gray-400 bg-white hover:border-blue-400 focus:ring-blue-500 focus:ring-2'
                } ${!isEditing ? 'cursor-not-allowed pointer-events-none' : ''}`}
                style={{ 
                  pointerEvents: !isEditing ? 'none' : 'auto',
                  opacity: !isEditing ? 1 : 1
                }}
              />
              <span className={`text-xs font-medium ${details.hasSynopsis ? 'text-blue-700' : 'text-gray-700'}`}>줄거리</span>
            </label>
            <label className={`flex items-center space-x-2 ${!isEditing ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                checked={details.hasProposal}
                onChange={() => handleCheckboxChange('hasProposal')}
                className={`rounded border-2 h-3 w-3 transition-all duration-200 ${
                  details.hasProposal
                    ? 'border-blue-500 bg-blue-500 text-white focus:ring-blue-500 focus:ring-2'
                    : 'border-gray-400 bg-white hover:border-blue-400 focus:ring-blue-500 focus:ring-2'
                } ${!isEditing ? 'cursor-not-allowed pointer-events-none' : ''}`}
                style={{ 
                  pointerEvents: !isEditing ? 'none' : 'auto',
                  opacity: !isEditing ? 1 : 1
                }}
              />
              <span className={`text-xs font-medium ${details.hasProposal ? 'text-blue-700' : 'text-gray-700'}`}>소개서</span>
            </label>
          </div>
          
          <div className="flex flex-wrap justify-start sm:justify-end gap-2 w-full sm:w-auto">
            {!isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1.5 bg-primary-blue text-white rounded-lg hover:opacity-90 transition-opacity text-xs font-semibold flex-grow sm:flex-grow-0 whitespace-nowrap flex items-center justify-center"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={handleDownloadBookInfo}
                  className="px-3 py-1.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-xs font-semibold flex-grow sm:flex-grow-0 whitespace-nowrap flex items-center justify-center"
                >
                  서지정보 다운받기
                </button>


                {project.status !== 'completed' && (
                  <button
                    type="button"
                    onClick={handleMoveToComplete}
                    className="px-3 py-1.5 bg-primary-green text-white rounded-lg hover:opacity-90 transition-opacity text-xs font-semibold flex-grow sm:flex-grow-0 whitespace-nowrap flex items-center justify-center"
                  >
                    완결로 이동
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-3 py-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-xs font-semibold flex-grow sm:flex-grow-0 whitespace-nowrap flex items-center justify-center"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-primary-green text-white rounded-lg hover:opacity-90 transition-opacity text-xs font-semibold flex-grow sm:flex-grow-0 whitespace-nowrap flex items-center justify-center"
                >
                  저장
                </button>
              </>
            )}
          </div>
        </div>
        </form>
      )}

      {/* 런칭현황보기 버튼 */}
      <div className="mt-2 pt-2 border-t border-gray-200">
        <button
          type="button"
          onClick={() => setShowLaunchStatus(!showLaunchStatus)}
          className="w-full px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors text-xs font-medium flex items-center justify-center gap-2"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          런칭현황보기
          <svg className={`w-3 h-3 transition-transform duration-200 ${showLaunchStatus ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* 줄거리 모달 */}
      {showSynopsisModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">줄거리</h3>
              <button
                onClick={() => {
                  setShowSynopsisModal(false);
                  setIsEditingSynopsis(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 flex flex-col">
              {isEditingSynopsis ? (
                <div className="flex-1 flex flex-col">
                  <textarea
                    value={details.synopsis}
                    onChange={(e) => handleSynopsisChange(e.target.value)}
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="줄거리를 입력하세요..."
                  />
                  <div className="flex justify-end space-x-2 mt-4">
                    <button
                      onClick={handleSynopsisCancel}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleSynopsisSave}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                    >
                      저장
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  <div className="flex-1 border border-gray-200 rounded px-3 py-2 text-sm bg-gray-50 overflow-y-auto">
                    {details.synopsis || '줄거리가 없습니다.'}
                  </div>
                  <div className="flex justify-end space-x-2 mt-4">
                    <button
                      onClick={() => setIsEditingSynopsis(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                    >
                      수정
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 메모 모달 */}
      {showMemoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">작품 메모</h3>
              <button
                onClick={() => {
                  setShowMemoModal(false);
                  setIsEditingMemo(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 flex flex-col">
              {isEditingMemo ? (
                <div className="flex-1 flex flex-col">
                  <textarea
                    value={details.memo}
                    onChange={(e) => handleMemoChange(e.target.value)}
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="작품에 대한 메모나 비고를 입력하세요..."
                  />
                  <div className="flex justify-end space-x-2 mt-4">
                    <button
                      onClick={handleMemoCancel}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleMemoSave}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
                    >
                      저장
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  <div className="flex-1 border border-gray-200 rounded px-3 py-2 text-sm bg-gray-50 overflow-y-auto">
                    {details.memo || '메모가 없습니다.'}
                  </div>
                  <div className="flex justify-end space-x-2 mt-4">
                    <button
                      onClick={() => setIsEditingMemo(true)}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
                    >
                      수정
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 런칭현황 섹션 */}
      {showLaunchStatus && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            "{project.title}" 런칭현황
          </h3>
          
          {/* 실제 런칭현황 표시 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            {loadingLaunchStatus ? (
              <div className="text-center py-4">
                <div className="text-gray-500">런칭 상태를 불러오는 중...</div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 국내비독점 섹션 - 프로젝트 상태에 따라 라이브/완결 표시 */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">
                    국내비독점 [{project.status === 'completed' ? '완결' : '라이브'}]
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse" style={{ minWidth: '1920px' }}>
                      <thead>
                        <tr>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">교보E북</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">구루컴퍼니</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">네이버시리즈</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">두리요</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">레진</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">리디북스</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">만화365</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">미스터블루</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">미툰</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">무툰</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">블라이스</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">봄툰</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">북큐브</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">북팔</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">애니툰</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">올툰</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">왓챠</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">원스토리</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">인터넷만화방</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">케이툰</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">코미코</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">큐툰</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">투믹스</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">픽미툰</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {['교보E북', '구루컴퍼니', '네이버시리즈', '두리요', '레진', '리디북스', '만화365', '미스터블루', '미툰', '무툰', '블라이스', '봄툰', '북큐브', '북팔', '애니툰', '올툰', '왓챠', '원스토리', '인터넷만화방', '케이툰', '코미코', '큐툰', '투믹스', '픽미툰'].map((platform) => {
                            const platformId = platform === '애니툰' ? 'anitoon' :
                                             platform === '올툰' ? 'alltoon' :
                                             platform === '봄툰' ? 'bomtoon' :
                                             platform === '블라이스' ? 'blice' :
                                             platform === '북큐브' ? 'bookcube' :
                                             platform === '북팔' ? 'bookpal' :
                                             platform === '코미코' ? 'comico' :
                                             platform === '교보E북' ? 'kyobo-ebook' :
                                             platform === '구루컴퍼니' ? 'guru-company' :
                                             platform === '케이툰' ? 'ktoon' :
                                             platform === '만화365' ? 'manhwa365' :
                                             platform === '미스터블루' ? 'mrblue' :
                                             platform === '무툰' ? 'muto' :
                                             platform === '미툰' ? 'muto2' :
                                             platform === '네이버시리즈' ? 'naver-series' :
                                             platform === '픽미툰' ? 'pickme' :
                                             platform === '리디북스' ? 'ridibooks' :
                                             platform === '레진' ? 'lezhin' :
                                             platform === '투믹스' ? 'toomics' :
                                             platform === '큐툰' ? 'qtoon' :
                                             platform === '왓챠' ? 'watcha' :
                                             platform === '원스토리' ? 'onestory' :
                                             platform === '인터넷만화방' ? 'internet-manhwabang' :
                                             platform === '두리요' ? 'duri' : platform;
                            // 국내 섹션: 프로젝트 상태에 따라 적절한 카테고리 키 사용
                            const domesticCategory = project.status === 'completed' ? '국내비독점 [완결]' : '국내비독점 [라이브]';
                            const newKey = `${project.id}::${domesticCategory}::${platformId}`;
                            const legacyKey = `${project.id}-${platformId}`;
                            const key = launchStatuses[newKey] ? newKey : legacyKey;
                            const status = launchStatuses[key] || 'none';
                            console.log(`🔍 ${platform} -> ${platformId} -> ${key} -> ${status}`);
                            
                            const getStatusColor = (status: string) => {
                              switch (status) {
                                case 'launched': return 'bg-green-500';
                                case 'pending': return 'bg-yellow-500';
                                case 'rejected': return 'bg-red-500';
                                default: return 'bg-gray-200';
                              }
                            };
                            
                            console.log(`🎨 ${platform} 렌더링: status=${status}, color=${getStatusColor(status)}`);
                            
                            return (
                              <td key={platform} className="p-1 text-center">
                                <div 
                                  className={`w-8 h-8 mx-auto rounded ${getStatusColor(status)}`}
                                  style={{
                                    backgroundColor: status === 'launched' ? '#10b981' : 
                                                   status === 'pending' ? '#f59e0b' : 
                                                   status === 'rejected' ? '#ef4444' : '#e5e7eb'
                                  }}
                                ></div>
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 해외비독점 섹션 - 프로젝트 상태에 따라 라이브/완결 표시 */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">
                    해외비독점 [{project.status === 'completed' ? '완결' : '라이브'}]
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse" style={{ minWidth: '1920px' }}>
                      <thead>
                        <tr>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">펀플</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">DLSITE(누온)</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">탑툰 재팬</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">툰허브</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">허니툰</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">만타</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">투믹스(북미)</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">투믹스(일본)</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">투믹스(이탈리아)</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">투믹스(포루투갈)</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">투믹스(프랑스)</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">투믹스중문(간체)</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">투믹스중문(번체)</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">투믹스(독일)</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">투믹스(스페인)</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">투믹스(남미)</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">레진(북미)</th>
                          <th className="text-xs text-gray-600 font-medium py-2 px-1 border-b border-gray-200 w-20 whitespace-nowrap">레진(일본)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {['펀플', 'DLSITE(누온)', '탑툰 재팬', '툰허브', '허니툰', '만타', '투믹스(북미)', '투믹스(일본)', '투믹스(이탈리아)', '투믹스(포루투갈)', '투믹스(프랑스)', '투믹스중문(간체)', '투믹스중문(번체)', '투믹스(독일)', '투믹스(스페인)', '투믹스(남미)', '레진(북미)', '레진(일본)'].map((platform) => {
                            const platformId = platform === '펀플' ? 'funple' :
                                             platform === 'DLSITE(누온)' ? 'dlsite' :
                                             platform === '탑툰 재팬' ? 'toptoon-japan' :
                                             platform === '툰허브' ? 'toonhub' :
                                             platform === '허니툰' ? 'honeytoon' :
                                             platform === '만타' ? 'manta' :
                                             platform === '투믹스(북미)' ? 'toomics-north-america' :
                                             platform === '투믹스(일본)' ? 'toomics-japan' :
                                             platform === '투믹스(이탈리아)' ? 'toomics-italy' :
                                             platform === '투믹스(포루투갈)' ? 'toomics-portugal' :
                                             platform === '투믹스(프랑스)' ? 'toomics-france' :
                                             platform === '투믹스중문(간체)' ? 'toomics-china-simplified' :
                                             platform === '투믹스중문(번체)' ? 'toomics-china-traditional' :
                                             platform === '투믹스(독일)' ? 'toomics-germany' :
                                             platform === '투믹스(스페인)' ? 'toomics-spain' :
                                             platform === '투믹스(남미)' ? 'toomics-south-america' :
                                             platform === '레진(북미)' ? 'lezhin-north-america' :
                                             platform === '레진(일본)' ? 'lezhin-japan' : platform;
                            // 해외 섹션: 프로젝트 상태에 따라 적절한 카테고리 키 사용
                            const overseasCategory = project.status === 'completed' ? '해외비독점 [완결]' : '해외비독점 [라이브]';
                            const newKey = `${project.id}::${overseasCategory}::${platformId}`;
                            const legacyKey = `${project.id}-${platformId}`;
                            const key = launchStatuses[newKey] ? newKey : legacyKey;
                            const status = launchStatuses[key] || 'none';
                            console.log(`🔍 ${platform} -> ${platformId} -> ${key} -> ${status}`);
                            
                            const getStatusColor = (status: string) => {
                              switch (status) {
                                case 'launched': return 'bg-green-500';
                                case 'pending': return 'bg-yellow-500';
                                case 'rejected': return 'bg-red-500';
                                default: return 'bg-gray-200';
                              }
                            };
                            
                            console.log(`🎨 ${platform} 렌더링: status=${status}, color=${getStatusColor(status)}`);
                            
                            return (
                              <td key={platform} className="p-1 text-center">
                                <div 
                                  className={`w-8 h-8 mx-auto rounded ${getStatusColor(status)}`}
                                  style={{
                                    backgroundColor: status === 'launched' ? '#10b981' : 
                                                   status === 'pending' ? '#f59e0b' : 
                                                   status === 'rejected' ? '#ef4444' : '#e5e7eb'
                                  }}
                                ></div>
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default ProjectDetails;
