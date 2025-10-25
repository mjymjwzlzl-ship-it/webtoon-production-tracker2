import React, { useState, useMemo, useEffect, ChangeEvent } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Webtoon, SortConfig, SortDirection, SubmissionInfo, UploadInfo } from '../types';
import { INITIAL_WEBTOONS, INITIAL_PLATFORMS, WEBTOON_TYPES, SYNC_GROUPS, DOMESTIC_PLATFORMS, OVERSEAS_PLATFORMS, SUBMISSION_INFO, UPLOAD_INFO } from '../constants';
import EditableCell from './EditableCell';

interface SyncProjectLite { id: string; title: string; status?: string }

interface WebtoonTrackerProps { syncProjects?: SyncProjectLite[] }

const WebtoonTracker: React.FC<WebtoonTrackerProps> = ({ syncProjects }) => {
  const [webtoons, setWebtoons] = useState<Webtoon[]>(INITIAL_WEBTOONS);
  const [platforms, setPlatforms] = useState<string[]>(INITIAL_PLATFORMS);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'title', direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [visiblePlatforms, setVisiblePlatforms] = useState<string[]>(INITIAL_PLATFORMS);
  const [isEditMode, setIsEditMode] = useState(false);
  const [newWebtoonTitle, setNewWebtoonTitle] = useState('');
  const [newPlatformName, setNewPlatformName] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>('국내비독점 [라이브]');
  const [isPlatformFilterExpanded, setIsPlatformFilterExpanded] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [bannerPosition, setBannerPosition] = useState({ x: 0, y: 0 });
  const [selectedWebtoon, setSelectedWebtoon] = useState<string | null>(null);
  const [webtoonBannerPosition, setWebtoonBannerPosition] = useState({ x: 0, y: 0 });
  const [activeMode, setActiveMode] = useState<'launch' | 'submission' | 'upload'>('launch');
  const [isSubmissionEditMode, setIsSubmissionEditMode] = useState(false);
  const [submissionInfo, setSubmissionInfo] = useState<SubmissionInfo[]>(SUBMISSION_INFO);
  const [newSubmissionInfo, setNewSubmissionInfo] = useState<SubmissionInfo>({
    id: '',
    companyName: '',
    submissionMethod: '',
    submissionSchedule: '',
    launchConditions: '',
    contactPersonName: '',
    contactPersonEmail: '',
    contactNumber: '',
    remarks: ''
  });
  const [isUploadEditMode, setIsUploadEditMode] = useState(false);
  const [uploadInfo, setUploadInfo] = useState<UploadInfo[]>(UPLOAD_INFO);
  const [newUploadInfo, setNewUploadInfo] = useState<UploadInfo>({
    id: '',
    companyName: '',
    deliveryDeadline: '',
    registrationLink: '',
    loginId: '',
    password: '',
    contactPersonName: '',
    contactPersonEmail: '',
    contactNumber: '',
    manuscriptSpec: '',
    coverBannerSpec: '',
    thumbnailSpec: ''
  });

  useEffect(() => {
    setVisiblePlatforms(platforms);
  }, [platforms]);

  // 초기 데이터: 라이브 카테고리는 국내/해외 양쪽에 동일 제목이 존재하도록 보정
  useEffect(() => {
    setWebtoons(prev => {
      const liveTypes = new Set(['국내비독점 [라이브]', '해외비독점 [라이브]']);
      const byTitle = new Map<string, Set<string>>();
      prev.forEach(w => {
        if (liveTypes.has(w.type)) {
          const set = byTitle.get(w.title) || new Set<string>();
          set.add(w.type);
          byTitle.set(w.title, set);
        }
      });
      const additions: Webtoon[] = [];
      byTitle.forEach((types, title) => {
        if (!types.has('국내비독점 [라이브]')) {
          additions.push({ id: `auto-${Date.now()}-${Math.random()}`, title, type: '국내비독점 [라이브]', platforms: {} });
        }
        if (!types.has('해외비독점 [라이브]')) {
          additions.push({ id: `auto-${Date.now()}-${Math.random()}`, title, type: '해외비독점 [라이브]', platforms: {} });
        }
      });
      return additions.length ? [...additions, ...prev] : prev;
    });
  }, []);

  // 로컬 저장소에서 업로드/투고 정보 복구
  useEffect(() => {
    try {
      const savedUpload = localStorage.getItem('wt_upload_info');
      if (savedUpload) {
        const parsed = JSON.parse(savedUpload) as UploadInfo[];
        if (Array.isArray(parsed)) setUploadInfo(parsed);
      }
    } catch {}
    try {
      const savedSubmission = localStorage.getItem('wt_submission_info');
      if (savedSubmission) {
        const parsed = JSON.parse(savedSubmission) as SubmissionInfo[];
        if (Array.isArray(parsed)) setSubmissionInfo(parsed);
      }
    } catch {}
  }, []);

  // 변경 시 자동 저장
  useEffect(() => {
    try { localStorage.setItem('wt_upload_info', JSON.stringify(uploadInfo)); } catch {}
  }, [uploadInfo]);
  useEffect(() => {
    try { localStorage.setItem('wt_submission_info', JSON.stringify(submissionInfo)); } catch {}
  }, [submissionInfo]);

  // 외부 프로젝트 목록과 동기화 (id/제목 기준, 플랫폼/메모 등 기존 데이터 보존)
  useEffect(() => {
    if (!syncProjects) return;
    setWebtoons(prev => {
      const compositeKey = (id: string, type: string) => `${id}__${type}`;
      const prevMap = new Map(prev.map(w => [compositeKey(w.id, w.type), w]));
      const result: Webtoon[] = [];
      for (const p of syncProjects) {
        const isCompleted = (p.status as any) === 'completed';
        const domesticType = isCompleted ? '국내비독점 [완결]' : '국내비독점 [라이브]';
        const overseasType = isCompleted ? '해외비독점 [완결]' : '해외비독점 [라이브]';
        const domesticKey = compositeKey(`${p.id}-domestic`, domesticType);
        const overseasKey = compositeKey(`${p.id}-overseas`, overseasType);
        const prevDomestic = prevMap.get(domesticKey);
        const prevOverseas = prevMap.get(overseasKey);
        result.push(prevDomestic ? { ...prevDomestic, title: p.title } : { id: `${p.id}-domestic`, title: p.title, type: domesticType, platforms: {} });
        result.push(prevOverseas ? { ...prevOverseas, title: p.title } : { id: `${p.id}-overseas`, title: p.title, type: overseasType, platforms: {} });
      }
      return result;
    });
  }, [syncProjects]);

  useEffect(() => {
    if (activeCategory) {
      const isOverseas = activeCategory.includes('해외');
      const newPlatforms = isOverseas ? OVERSEAS_PLATFORMS : DOMESTIC_PLATFORMS;
      setPlatforms(newPlatforms);
      setVisiblePlatforms(newPlatforms);
    }
  }, [activeCategory]);

  const getActualCellStatus = (value: string | undefined): 'empty' | 'launched' | 'submitted' | 'rejected' => {
    if (!value) return 'empty';
    if (value.startsWith('launched:')) return 'launched';
    if (value.startsWith('submitted:')) return 'submitted';
    if (value.startsWith('rejected:')) return 'rejected';
    return 'empty';
  };

  const getPlatformStats = (platformName: string) => {
    const currentWebtoons = webtoons.filter(webtoon => webtoon.type === activeCategory);
    const totalWebtoons = currentWebtoons.length;

    const launchedWebtoons = currentWebtoons.filter(webtoon => getActualCellStatus(webtoon.platforms[platformName]) === 'launched');
    const submittedWebtoons = currentWebtoons.filter(webtoon => getActualCellStatus(webtoon.platforms[platformName]) === 'submitted');
    const rejectedWebtoons = currentWebtoons.filter(webtoon => getActualCellStatus(webtoon.platforms[platformName]) === 'rejected');
    const pendingWebtoons = currentWebtoons.filter(webtoon => getActualCellStatus(webtoon.platforms[platformName]) === 'empty');

    return {
      total: totalWebtoons,
      launched: launchedWebtoons.length,
      submitted: submittedWebtoons.length,
      rejected: rejectedWebtoons.length,
      pending: pendingWebtoons.length,
      launchedWebtoons: launchedWebtoons.map(w => w.title),
      submittedWebtoons: submittedWebtoons.map(w => w.title),
      rejectedWebtoons: rejectedWebtoons.map(w => w.title),
      pendingWebtoons: pendingWebtoons.map(w => w.title)
    };
  };

  const filteredAndSortedWebtoons = useMemo(() => {
    let filtered = webtoons.filter(webtoon => webtoon.title.toLowerCase().includes(searchTerm.toLowerCase()));
    if (activeCategory) {
      filtered = filtered.filter(webtoon => webtoon.type === activeCategory);
    }
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;
        if (sortConfig.key === 'launchStatus') {
          aValue = Object.values(a.platforms).filter(value => getActualCellStatus(value as string) === 'launched').length;
          bValue = Object.values(b.platforms).filter(value => getActualCellStatus(value as string) === 'launched').length;
        } else if (sortConfig.key === 'title' || sortConfig.key === 'type') {
          aValue = (a as any)[sortConfig.key];
          bValue = (b as any)[sortConfig.key];
        } else {
          aValue = a.platforms[sortConfig.key] || '';
          bValue = b.platforms[sortConfig.key] || '';
        }
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [webtoons, searchTerm, sortConfig, activeCategory]);

  const requestSort = (key: string) => {
    let direction: SortDirection = 'asc';
    if (key === 'launchStatus') {
      direction = 'desc';
      if (sortConfig.key === key && sortConfig.direction === 'desc') {
        direction = 'asc';
      }
    } else {
      if (sortConfig.key === key && sortConfig.direction === 'asc') {
        direction = 'desc';
      }
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: string) => {
    if (sortConfig.key !== key) return ' ↕';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  const getSyncGroup = (type: string): readonly string[] => {
    const group = SYNC_GROUPS.find(g => (g.types as readonly string[]).includes(type));
    return group ? group.types : [type];
  };

  const getSyncWebtoons = (webtoonId: string, platform: string) => {
    const currentWebtoon = webtoons.find(w => w.id === webtoonId);
    if (!currentWebtoon) return [];
    const syncGroup = getSyncGroup(currentWebtoon.type);
    return webtoons.filter(w => w.title === currentWebtoon.title && syncGroup.includes(w.type) && w.id !== webtoonId);
  };

  const handleCellUpdate = (webtoonId: string, platform: string, value: string) => {
    setWebtoons(prev => {
      const updatedWebtoons = prev.map(w => w.id === webtoonId ? { ...w, platforms: { ...w.platforms, [platform]: value } } : w);
      const currentWebtoon = prev.find(w => w.id === webtoonId);
      if (currentWebtoon) {
        const syncWebtoons = getSyncWebtoons(webtoonId, platform);
        return updatedWebtoons.map(w => syncWebtoons.some(sw => sw.id === w.id) ? { ...w, platforms: { ...w.platforms, [platform]: value } } : w);
      }
      return updatedWebtoons;
    });

    // Firestore 런칭현황 동기화
    try {
      const webtoon = webtoons.find(w => w.id === webtoonId);
      const category = webtoon?.type || '국내비독점 [라이브]';
      const status = getActualCellStatus(value as any);
      const mapped = mapPlatformNameToId(platform);
      if (!mapped) return;
      const statusForLaunch: 'launched' | 'pending' | 'rejected' | 'none' =
        status === 'launched' ? 'launched' : status === 'submitted' ? 'pending' : status === 'rejected' ? 'rejected' : 'none';
      void upsertLaunchStatus(webtoonId, category, mapped, statusForLaunch);
    } catch (err) {
      // ignore syncing error silently
    }
  };

  // 플랫폼 한글명 -> LaunchStatus 플랫폼 ID 매핑
  const mapPlatformNameToId = (name: string): string | null => {
    const mapping: Record<string, string> = {
      '교보E북': 'kyobo-ebook',
      '구루컴퍼니': 'guru-company',
      '네이버 시리즈': 'naver-series',
      '두리요': 'duri',
      '레진': 'lezhin',
      '리디북스': 'ridibooks',
      '만화365': 'manhwa365',
      '무툰': 'muto',
      '미스터블루': 'mrblue',
      '미툰': 'muto2',
      '봄툰': 'bomtoon',
      '북큐브': 'bookcube',
      '블라이스': 'blice',
      '애니툰': 'anitoon',
      '원스토리': 'onestory',
      '인터넷 만화방': 'internet-manhwabang',
      '케이툰': 'ktoon',
      '투믹스': 'toomics',
      '픽미툰': 'pickme',
      '왓챠': 'watcha',
      '북팔': 'bookpal',
      '울툰': 'alltoon',
      '큐툰': 'qtoon',
      '코미코': 'comico',
      // 해외
      '펀플': 'funple',
      'DLSITE (누온)': 'dlsite',
      '탑툰 재팬': 'toptoon-japan',
      '툰허브': 'toonhub',
      '허니툰': 'honeytoon',
      '만타': 'manta',
      '투믹스 (북미)': 'toomics-north-america',
      '투믹스 (일본)': 'toomics-japan',
      '투믹스 (이탈리아)': 'toomics-italy',
      '투믹스 (포루투갈)': 'toomics-portugal',
      '투믹스 (프랑스)': 'toomics-france',
      '투믹스 중문(간체)': 'toomics-china-simplified',
      '투믹스 중문(번체)': 'toomics-china-traditional',
      '투믹스 (독일)': 'toomics-germany',
      '투믹스 (스페인)': 'toomics-spain',
      '투믹스 (남미)': 'toomics-south-america',
      '레진 (북미)': 'lezhin-north-america',
      '레진 (일본)': 'lezhin-japan'
    };
    return mapping[name] || null;
  };

  const buildLaunchKey = (projectId: string, category: string, platformId: string) =>
    `${projectId}::${(category || '').trim()}::${platformId}`;

  const upsertLaunchStatus = async (
    projectId: string,
    category: string,
    platformId: string,
    status: 'launched' | 'pending' | 'rejected' | 'none'
  ) => {
    const key = buildLaunchKey(projectId, category, platformId);
    try {
      if (status === 'none') {
        const qSnap = await getDocs(query(collection(db, 'launchStatuses'), where('key', '==', key)));
        if (!qSnap.empty) {
          await deleteDoc(qSnap.docs[0].ref);
        }
        return;
      }
      const qSnap = await getDocs(query(collection(db, 'launchStatuses'), where('key', '==', key)));
      if (qSnap.empty) {
        await addDoc(collection(db, 'launchStatuses'), {
          key,
          projectId,
          platformId,
          category,
          status,
          timestamp: Date.now()
        });
      } else {
        await updateDoc(qSnap.docs[0].ref, { status, timestamp: Date.now() });
      }
    } catch {}
  };

  const handleUpdateWebtoonTitle = (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    const currentWebtoon = webtoons.find(w => w.id === id);
    if (!currentWebtoon) return;
    const syncGroup = getSyncGroup(currentWebtoon.type);
    setWebtoons(webtoons.map(w => w.title === currentWebtoon.title && syncGroup.includes(w.type) ? { ...w, title: newTitle } : w));
  };

  const handleUpdateWebtoonDeliveryDay = (id: string, deliveryDay: string) => {
    setWebtoons(prev => prev.map(webtoon => webtoon.id === id ? { ...webtoon, deliveryDay } : webtoon));
  };

  const handleDeleteWebtoon = (id: string) => {
    const webtoonToDelete = webtoons.find(w => w.id === id);
    if (!webtoonToDelete) return;
    const syncGroup = getSyncGroup(webtoonToDelete.type);
    const syncWebtoons = webtoons.filter(w => w.title === webtoonToDelete.title && syncGroup.includes(w.type));
    if (window.confirm(`정말로 이 작품을 삭제하시겠습니까?\n${syncWebtoons.length}개의 동기화된 작품이 함께 삭제됩니다.`)) {
      const syncIds = syncWebtoons.map(w => w.id);
      setWebtoons(webtoons.filter(w => !syncIds.includes(w.id)));
    }
  };

  const handleAddWebtoon = () => {
    if (!newWebtoonTitle.trim()) {
      alert('작품명을 입력해주세요.');
      return;
    }
    if (!activeCategory) {
      alert('카테고리를 선택해주세요.');
      return;
    }
    const syncGroup = getSyncGroup(activeCategory);
    const newWebtoons: Webtoon[] = syncGroup.map((type, index) => ({ id: `webtoon-${Date.now()}-${index}`, title: newWebtoonTitle, type: type, platforms: {} }));
    setWebtoons([...newWebtoons, ...webtoons]);
    setNewWebtoonTitle('');
  };

  const handleAddPlatform = () => {
    if (!newPlatformName.trim()) {
      alert('플랫폼명을 입력해주세요.');
      return;
    }
    if (platforms.includes(newPlatformName)) {
      alert('이미 존재하는 플랫폼입니다.');
      return;
    }
    setPlatforms([...platforms, newPlatformName]);
    setVisiblePlatforms([...visiblePlatforms, newPlatformName]);
    setNewPlatformName('');
  };

  const handleUpdatePlatformName = (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) return;
    if (platforms.includes(newName)) {
      alert('이미 존재하는 플랫폼명입니다.');
      return;
    }
    setPlatforms(platforms.map(p => p === oldName ? newName : p));
    setWebtoons(webtoons.map(w => {
      const newPlatforms = { ...w.platforms } as Record<string, string | null>;
      if (oldName in newPlatforms) {
        (newPlatforms as any)[newName] = newPlatforms[oldName];
        delete (newPlatforms as any)[oldName];
      }
      return { ...w, platforms: newPlatforms };
    }));
  };

  const handleDeletePlatform = (platformNameToDelete: string) => {
    if (window.confirm(`정말로 '${platformNameToDelete}' 플랫폼을 삭제하시겠습니까? 모든 관련 데이터가 사라집니다.`)) {
      setPlatforms(platforms.filter(p => p !== platformNameToDelete));
      setVisiblePlatforms(visiblePlatforms.filter(p => p !== platformNameToDelete));
      setWebtoons(webtoons.map(w => {
        const newPlatforms = { ...w.platforms } as Record<string, string | null>;
        delete (newPlatforms as any)[platformNameToDelete];
        return { ...w, platforms: newPlatforms };
      }));
    }
  };

  const handleMoveToLive = (webtoonId: string) => {
    if (window.confirm('이 작품을 라이브 카테고리로 이동하시겠습니까?')) {
      setWebtoons(prevWebtoons => prevWebtoons.map(webtoon => {
        if (webtoon.id === webtoonId) {
          const newType = webtoon.type === '국내비독점 [완결]' ? '국내비독점 [라이브]' : webtoon.type === '해외비독점 [완결]' ? '해외비독점 [라이브]' : webtoon.type;
          return { ...webtoon, type: newType };
        }
        return webtoon;
      }));
    }
  };

  const handleMoveToCompleted = (webtoonId: string) => {
    if (window.confirm('이 작품을 완결 카테고리로 이동하시겠습니까?')) {
      setWebtoons(prevWebtoons => prevWebtoons.map(webtoon => {
        if (webtoon.id === webtoonId) {
          const newType = webtoon.type === '국내비독점 [라이브]' ? '국내비독점 [완결]' : webtoon.type === '해외비독점 [라이브]' ? '해외비독점 [완결]' : webtoon.type;
          return { ...webtoon, type: newType };
        }
        return webtoon;
      }));
    }
  };

  const handlePlatformVisibilityChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setVisiblePlatforms(prev => checked ? [...prev, name] : prev.filter(p => p !== name));
  };

  const handleCategoryFilter = (category: string) => {
    setActiveCategory(prev => (prev === category ? null : category));
  };

  const handlePlatformClick = (platformName: string, event: React.MouseEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setBannerPosition({ x: rect.left + rect.width / 2, y: rect.bottom + 10 });
    setSelectedPlatform(platformName);
  };

  const handleCloseBanner = () => { setSelectedPlatform(null); };
  const handleWebtoonClick = (webtoonId: string, event: React.MouseEvent) => {
    setSelectedWebtoon(webtoonId);
    setWebtoonBannerPosition({ x: (event as any).clientX, y: (event as any).clientY });
  };
  const handleCloseWebtoonBanner = () => { setSelectedWebtoon(null); };

  // 브라우저 뒤로가기로 배너 닫기
  useEffect(() => {
    if (activeMode !== 'launch') return;
    const shouldHandle = selectedPlatform || selectedWebtoon;
    if (shouldHandle) {
      // 상태 진입 시 히스토리 스택에 더미 상태 push
      window.history.pushState({ modal: true }, '');
    }
    const onPopState = (e: PopStateEvent) => {
      if (selectedPlatform) setSelectedPlatform(null);
      if (selectedWebtoon) setSelectedWebtoon(null);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [selectedPlatform, selectedWebtoon, activeMode]);

  const getWebtoonDetails = (webtoonId: string) => {
    const webtoon = webtoons.find(w => w.id === webtoonId);
    if (!webtoon) return null;
    const launchedPlatforms: string[] = [];
    const submittedPlatforms: string[] = [];
    const rejectedPlatforms: string[] = [];
    const pendingPlatforms: string[] = [];
    visiblePlatforms.forEach(platform => {
      const value = webtoon.platforms[platform];
      const status = getActualCellStatus(value as any);
      switch (status) {
        case 'launched': launchedPlatforms.push(platform); break;
        case 'submitted': submittedPlatforms.push(platform); break;
        case 'rejected': rejectedPlatforms.push(platform); break;
        default: pendingPlatforms.push(platform); break;
      }
    });
    return { webtoon, launchedPlatforms, submittedPlatforms, rejectedPlatforms, pendingPlatforms, totalPlatforms: visiblePlatforms.length };
  };

  const handleAddSubmissionInfo = () => {
    if (!newSubmissionInfo.companyName.trim()) { alert('업체명을 입력해주세요.'); return; }
    if (submissionInfo.some(info => info.companyName === newSubmissionInfo.companyName)) { alert('이미 존재하는 업체명입니다.'); return; }
    setSubmissionInfo([...submissionInfo, { ...newSubmissionInfo, id: Date.now().toString() }]);
    setNewSubmissionInfo({ id: '', companyName: '', submissionMethod: '', submissionSchedule: '', launchConditions: '', contactPersonName: '', contactPersonEmail: '', contactNumber: '', remarks: '' });
  };

  const handleUpdateSubmissionInfo = (index: number, field: keyof SubmissionInfo, value: string) => {
    setSubmissionInfo(prev => prev.map((info, i) => i === index ? { ...info, [field]: value } : info));
  };

  const handleDeleteSubmissionInfo = (index: number) => {
    if (window.confirm('정말로 이 업체 정보를 삭제하시겠습니까?')) {
      setSubmissionInfo(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleUpdateUploadInfo = (index: number, field: keyof UploadInfo, value: string) => {
    setUploadInfo(prev => prev.map((info, i) => i === index ? { ...info, [field]: value } : info));
  };

  const handleAddUploadInfo = () => {
    if (!newUploadInfo.companyName.trim()) { alert('업체명을 입력해주세요.'); return; }
    if (uploadInfo.some(info => info.companyName === newUploadInfo.companyName)) { alert('이미 존재하는 업체명입니다.'); return; }
    setUploadInfo(prev => [...prev, { ...newUploadInfo, id: Date.now().toString() }]);
    setNewUploadInfo({ id: '', companyName: '', deliveryDeadline: '', registrationLink: '', loginId: '', password: '', contactPersonName: '', contactPersonEmail: '', contactNumber: '', manuscriptSpec: '', coverBannerSpec: '', thumbnailSpec: '' });
  };

  const handleDeleteUploadInfo = (index: number) => {
    if (window.confirm('정말로 이 업체를 삭제하시겠습니까?')) {
      setUploadInfo(prev => prev.filter((_, i) => i !== index));
    }
  };

  // 업로드 탭: 링크/이메일 표시 유틸
  const extractFirstUrl = (text: string): { url: string | null; note: string } => {
    if (!text) return { url: null, note: '' };
    const urlMatch = text.match(/https?:\/\/[^\s)]+|www\.[^\s)]+/i);
    const url = urlMatch ? (urlMatch[0].startsWith('http') ? urlMatch[0] : `http://${urlMatch[0]}`) : null;
    const note = text.replace(urlMatch ? urlMatch[0] : '', '').trim();
    return { url, note };
  };

  const renderEmails = (value: string) => {
    if (!value) return <span className="text-gray-400">-</span>;
    // 분리: 세미콜론/쉼표/줄바꿈 기준
    const parts = value
      .split(/\n|;|,/) // 1차 분리
      .map(v => v.trim())
      .filter(v => v.length > 0);
    return (
      <div className="space-y-0.5 leading-relaxed">
        {parts.map((p, idx) => {
          // 메일 주소만 추출
          const emailMatch = p.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
          if (emailMatch) {
            const email = emailMatch[0];
            const label = p.replace(email, '').replace(/[:]/g, '').trim();
            return (
              <div key={idx} className="flex items-center gap-1 text-xs">
                {label && <span className="text-gray-600 whitespace-nowrap">{label}</span>}
                <a href={`mailto:${email}`} className="text-blue-600 hover:underline break-all">{email}</a>
              </div>
            );
          }
          // 라벨만 있는 경우
          return (
            <div key={idx} className="text-xs text-gray-700 break-all">{p}</div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-white p-1 sm:p-2 rounded-lg">
      <div className="flex justify-end mb-4">
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button onClick={() => setActiveMode('launch')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeMode === 'launch' ? 'text-white shadow' : 'text-gray-600 hover:text-gray-800'}`} style={activeMode === 'launch' ? { backgroundColor: '#00529b' } : {}}>런칭</button>
          <button onClick={() => setActiveMode('submission')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeMode === 'submission' ? 'text-white shadow' : 'text-gray-600 hover:text-gray-800'}`} style={activeMode === 'submission' ? { backgroundColor: '#00529b' } : {}}>투고정보</button>
          <button onClick={() => setActiveMode('upload')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeMode === 'upload' ? 'text-white shadow' : 'text-gray-600 hover:text-gray-800'}`} style={activeMode === 'upload' ? { backgroundColor: '#00529b' } : {}}>업로드 정보</button>
        </div>
      </div>

      {activeMode === 'launch' ? (
        <>
          <div className="mb-2 p-2 sm:p-3 border rounded-md">
            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
              {WEBTOON_TYPES.map(type => (
                <button key={type} onClick={() => handleCategoryFilter(type)} className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${activeCategory === type ? 'text-white shadow' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`} style={activeCategory === type ? { backgroundColor: '#00529b' } : {}}>{type}</button>
              ))}
            </div>
          </div>

          <div className="p-2 border rounded-md mb-2 space-y-2">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <div className="flex items-center gap-2 flex-1">
                <input type="text" placeholder="작품명 검색..." className="p-2.5 border rounded-md text-sm sm:text-base flex-1 max-w-xs" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                <div className="flex items-center gap-1">
                  <label className="text-sm whitespace-nowrap">정렬:</label>
                  <select className="p-2.5 border rounded-md text-sm sm:text-base w-24" value={sortConfig.key} onChange={(e) => requestSort(e.target.value)}>
                    <option value="title">작품명</option>
                    <option value="launchStatus">런칭현황</option>
                  </select>
                  <button className="px-2.5 py-2.5 border rounded-md text-sm sm:text-base whitespace-nowrap" onClick={() => requestSort(sortConfig.key)}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</button>
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <label className="font-bold text-sm sm:text-base">플랫폼 필터:</label>
                <button onClick={() => setIsPlatformFilterExpanded(!isPlatformFilterExpanded)} className="text-xs sm:text-sm font-medium" style={{ color: '#00529b' }}>{isPlatformFilterExpanded ? '접기 ▲' : '펼치기 ▼'}</button>
              </div>
              {isPlatformFilterExpanded && (
                <div className="flex flex-wrap gap-x-2 sm:gap-x-4 gap-y-1 sm:gap-y-2 mt-1 max-h-24 sm:max-h-32 overflow-y-auto">
                  {platforms.map(p => (
                    <label key={p} className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm">
                      <input type="checkbox" name={p} checked={visiblePlatforms.includes(p)} onChange={handlePlatformVisibilityChange} className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="whitespace-nowrap">{p}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col lg:flex-row gap-1 items-end">
              <div className="flex flex-col sm:flex-row gap-2">
                <input type="text" placeholder="새 작품명" className="p-2 border rounded-md w-48 text-sm" value={newWebtoonTitle} onChange={(e) => setNewWebtoonTitle(e.target.value)} />
                <button className="p-2 text-white rounded-md whitespace-nowrap disabled:bg-gray-400 text-sm" style={{ backgroundColor: '#00529b' }} onClick={handleAddWebtoon} disabled={!activeCategory}>작품 추가</button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input type="text" placeholder="새 플랫폼" className="p-2 border rounded-md w-48 text-sm" value={newPlatformName} onChange={e => setNewPlatformName(e.target.value)} />
                <div className="flex gap-2">
                  <button className="p-2 text-white rounded-md whitespace-nowrap text-sm flex-1" style={{ backgroundColor: '#478b37' }} onClick={handleAddPlatform}>플랫폼 추가</button>
                  <button className={`p-2 rounded-md whitespace-nowrap text-xs sm:text-sm ${isEditMode ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-white'}`} onClick={() => setIsEditMode(!isEditMode)}>수정 {isEditMode ? 'ON' : 'OFF'}</button>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-hidden border rounded-md mx-0">
            <table className="w-full text-sm sm:text-base table-fixed">
              <thead className="bg-gray-100 sticky top-0 z-20">
                <tr>
                  <th className="p-1 text-left font-bold sticky left-0 bg-gray-100 z-10 w-[180px] min-w-[180px] max-w-[180px] border-r">
                    <div onClick={() => requestSort('title')} className="cursor-pointer flex items-center">
                      <span className="hidden sm:inline">작품명</span>
                      <span className="sm:hidden">작품</span>
                      {getSortIndicator('title')}
                    </div>
                  </th>
                  {visiblePlatforms.map(platform => (
                    <th
                      key={platform}
                      className="font-bold w-[40px] min-w-[40px] max-w-[40px] border-l mobile-table-cell p-0 align-middle text-center"
                      onClick={(e) => handlePlatformClick(platform, e)}
                      title={platform}
                    >
                      <div className="relative h-[40px] w-full flex items-center justify-center px-1">
                        {isEditMode && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeletePlatform(platform); }}
                            className="absolute top-0.5 right-0.5 text-red-500 hover:text-red-700 text-[10px] sm:text-xs leading-none"
                            title="삭제"
                          >
                            🗑️
                          </button>
                        )}
                        <div
                          className="platform-header-text text-center cursor-pointer text-[10px] leading-tight break-keep whitespace-normal"
                          style={{ display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                        >
                          {platform}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredAndSortedWebtoons.map(webtoon => (
                  <tr key={webtoon.id}>
                    <td className="p-1.5 sticky left-0 bg-white z-10 border-r">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <div className="flex-1 min-w-0">
                          {isEditMode ? (
                            <div className="flex gap-2">
                              <input type="text" value={webtoon.title} onChange={(e) => handleUpdateWebtoonTitle(webtoon.id, e.target.value)} className="flex-1 p-1 border rounded text-xs sm:text-sm" placeholder="작품명" />
                              <select value={webtoon.deliveryDay || ''} onChange={(e) => handleUpdateWebtoonDeliveryDay(webtoon.id, e.target.value)} className="p-1 border rounded text-xs sm:text-sm w-20">
                                <option value="">요일</option>
                                <option value="monday">월</option>
                                <option value="tuesday">화</option>
                                <option value="wednesday">수</option>
                                <option value="thursday">목</option>
                                <option value="friday">금</option>
                                <option value="saturday">토</option>
                                <option value="sunday">일</option>
                              </select>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="text-xs sm:text-sm font-medium leading-relaxed cursor-pointer hover:underline flex-1" style={{ color: '#00529b' }} title={webtoon.title} onClick={(e) => handleWebtoonClick(webtoon.id, e)}>{webtoon.title}</div>
                              {webtoon.deliveryDay && (<div className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">{webtoon.deliveryDay}</div>)}
                            </div>
                          )}
                          <div className="text-xs text-gray-500 mt-1">유통: {Object.values(webtoon.platforms).filter(value => value && typeof value === 'string' && (value as string).trim() !== '').length}/{visiblePlatforms.length}</div>
                        </div>
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {isEditMode && (webtoon.type === '국내비독점 [라이브]' || webtoon.type === '해외비독점 [라이브]') && (
                            <button onClick={() => handleMoveToCompleted(webtoon.id)} className="text-xs sm:text-sm px-1 py-0.5 border rounded" style={{ color: '#00529b', borderColor: '#00529b' }} title="완결로 이동">완결로이동</button>
                          )}
                          {isEditMode && (webtoon.type === '국내비독점 [완결]' || webtoon.type === '해외비독점 [완결]') && (
                            <button onClick={() => handleMoveToLive(webtoon.id)} className="text-green-500 hover:text-green-700 text-xs sm:text-sm px-1 py-0.5 border border-green-300 rounded" title="라이브로 이동">라이브로이동</button>
                          )}
                          {isEditMode && (<button onClick={() => handleDeleteWebtoon(webtoon.id)} className="text-red-500 hover:text-red-700 text-xs sm:text-sm">🗑️</button>)}
                        </div>
                      </div>
                    </td>
                    {visiblePlatforms.map(platform => (
                      <EditableCell key={`${webtoon.id}-${platform}`} initialValue={webtoon.platforms[platform] || null} onSave={(newValue) => handleCellUpdate(webtoon.id, platform, newValue)} isEditable={true} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {activeMode === 'launch' && selectedPlatform && (
            <>
              <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={handleCloseBanner} />
              <div className="fixed z-50 bg-white border border-gray-300 rounded-xl shadow-2xl p-6 max-w-4xl w-full mx-4 top-20 left-1/2 transform -translate-x-1/2 max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-gray-800">{selectedPlatform}</h3>
                  <button onClick={handleCloseBanner} className="text-gray-400 hover:text-gray-600 text-2xl font-light">×</button>
                </div>
                {(() => {
                  const stats = getPlatformStats(selectedPlatform);
                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div className="bg-green-100 border border-green-200 p-3 rounded-lg"><div className="font-semibold text-green-800">런칭 확정</div><div className="text-2xl font-bold text-green-900">{stats.launched}/{stats.total}</div></div>
                        <div className="bg-orange-100 border border-orange-200 p-3 rounded-lg"><div className="font-semibold text-orange-800">투고 중</div><div className="text-2xl font-bold text-orange-900">{stats.submitted}</div></div>
                        <div className="bg-red-100 border border-red-200 p-3 rounded-lg"><div className="font-semibold text-red-800">투고 불가</div><div className="text-2xl font-bold text-red-900">{stats.rejected}</div></div>
                        <div className="bg-gray-100 border border-gray-200 p-3 rounded-lg"><div className="font-semibold text-gray-800">대기 중</div><div className="text-2xl font-bold text-gray-900">{stats.pending}</div></div>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        {stats.launchedWebtoons.length > 0 && (<div><h4 className="font-semibold text-gray-800 mb-3 text-base">런칭 확정된 작품</h4><div className="text-sm space-y-2">{stats.launchedWebtoons.map((title, index) => (<div key={index} className="p-2 bg-green-50 border border-green-200 rounded-lg text-left hover:bg-green-100 transition-colors text-green-800">{title}</div>))}</div></div>)}
                        {stats.submittedWebtoons.length > 0 && (<div><h4 className="font-semibold text-gray-800 mb-3 text-base">투고 중인 작품</h4><div className="text-sm space-y-2">{stats.submittedWebtoons.map((title, index) => (<div key={index} className="p-2 bg-orange-50 border border-orange-200 rounded-lg text-left hover:bg-orange-100 transition-colors text-orange-800">{title}</div>))}</div></div>)}
                        {stats.rejectedWebtoons.length > 0 && (<div><h4 className="font-semibold text-gray-800 mb-3 text-base">투고 불가 작품</h4><div className="text-sm space-y-2">{stats.rejectedWebtoons.map((title, index) => (<div key={index} className="p-2 bg-red-50 border border-red-200 rounded-lg text-left hover:bg-red-100 transition-colors text-red-800">{title}</div>))}</div></div>)}
                        {stats.pendingWebtoons.length > 0 && (<div><h4 className="font-semibold text-gray-800 mb-3 text-base">대기 중인 작품</h4><div className="text-sm space-y-2">{stats.pendingWebtoons.map((title, index) => (<div key={index} className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-left hover:bg-gray-100 transition-colors text-gray-700">{title}</div>))}</div></div>)}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </>
          )}

          {activeMode === 'launch' && selectedWebtoon && (
            <>
              <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={handleCloseWebtoonBanner} />
              <div className="fixed z-50 bg-white border border-gray-300 rounded-xl shadow-2xl p-6 max-w-4xl w-full mx-4 top-20 left-1/2 transform -translate-x-1/2 max-h-[80vh] overflow-y-auto">
                {(() => {
                  const details = getWebtoonDetails(selectedWebtoon);
                  if (!details) return null;
                  return (
                    <>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-gray-800">{details.webtoon.title}</h3>
                        <button onClick={handleCloseWebtoonBanner} className="text-red-600 hover:text-red-800 text-4xl font-black bg-red-100 hover:bg-red-200 rounded-full w-10 h-10 flex items-center justify-center transition-colors duration-200 border-2 border-red-300 shadow-lg" title="닫기">×</button>
                      </div>
                      <div className="space-y-4">
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div className="bg-green-100 border border-green-200 p-3 rounded-lg"><div className="font-semibold text-green-800">런칭 확정</div><div className="text-2xl font-bold text-green-900">{details.launchedPlatforms.length}</div></div>
                          <div className="bg-orange-100 border border-orange-200 p-3 rounded-lg"><div className="font-semibold text-orange-800">투고 중</div><div className="text-2xl font-bold text-orange-900">{details.submittedPlatforms.length}</div></div>
                          <div className="bg-red-100 border border-red-200 p-3 rounded-lg"><div className="font-semibold text-red-800">투고 불가</div><div className="text-2xl font-bold text-red-900">{details.rejectedPlatforms.length}</div></div>
                          <div className="bg-gray-100 border border-gray-200 p-3 rounded-lg"><div className="font-semibold text-gray-800">대기 중</div><div className="text-2xl font-bold text-gray-900">{details.pendingPlatforms.length}</div></div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          {details.launchedPlatforms.length > 0 && (<div><h4 className="font-semibold text-gray-800 mb-3 text-base flex items-center"><span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>런칭 확정된 플랫폼</h4><div className="text-sm text-gray-700 space-y-2">{details.launchedPlatforms.map((platform, index) => (<div key={index} className="p-2 bg-green-50 border border-green-200 rounded-lg text-left">{platform}</div>))}</div></div>)}
                          {details.submittedPlatforms.length > 0 && (<div><h4 className="font-semibold text-gray-800 mb-3 text-base flex items-center"><span className="w-3 h-3 bg-orange-400 rounded-full mr-2"></span>투고 중인 플랫폼</h4><div className="text-sm text-gray-700 space-y-2">{details.submittedPlatforms.map((platform, index) => (<div key={index} className="p-2 bg-orange-50 border border-orange-200 rounded-lg text-left">{platform}</div>))}</div></div>)}
                          {details.rejectedPlatforms.length > 0 && (<div><h4 className="font-semibold text-gray-800 mb-3 text-base flex items-center"><span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>투고 불가 플랫폼</h4><div className="text-sm text-gray-700 space-y-2">{details.rejectedPlatforms.map((platform, index) => (<div key={index} className="p-2 bg-red-50 border border-red-200 rounded-lg text-left">{platform}</div>))}</div></div>)}
                          {details.pendingPlatforms.length > 0 && (<div><h4 className="font-semibold text-gray-800 mb-3 text-base flex items-center"><span className="w-3 h-3 bg-gray-300 rounded-full mr-2"></span>대기 중인 플랫폼</h4><div className="text-sm text-gray-700 space-y-2">{details.pendingPlatforms.map((platform, index) => (<div key={index} className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-left">{platform}</div>))}</div></div>)}
                        </div>
                        <div className="mt-6">
                          <h4 className="font-semibold text-gray-800 mb-3 text-base">전체 진행률</h4>
                          <div className="w-full bg-gray-200 rounded-full h-3"><div className="h-3 rounded-full transition-all duration-300" style={{ backgroundColor: '#00529b', width: `${(details.launchedPlatforms.length / details.totalPlatforms) * 100}%` }}></div></div>
                          <div className="text-sm text-gray-600 mt-2">{details.launchedPlatforms.length} / {details.totalPlatforms} 플랫폼 런칭 완료</div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </>
          )}
        </>
      ) : activeMode === 'submission' ? (
        <>
          <div className="space-y-4">
            <div className="p-4 border border-gray-200 rounded-lg bg-gradient-to-r from-gray-50 to-blue-50 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg"><svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">웹툰 플랫폼별 투고 정보</h3>
                    <p className="text-xs text-gray-600 mt-1">각 플랫폼의 투고 방법, 일정, 담당자 정보를 확인할 수 있습니다.</p>
                  </div>
                </div>
                <button onClick={() => setIsSubmissionEditMode(!isSubmissionEditMode)} className={`px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-2 ${isSubmissionEditMode ? 'bg-indigo-600 text-white shadow-md hover:bg-indigo-700' : 'bg-gray-600 text-white shadow-md hover:bg-gray-700'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  수정 {isSubmissionEditMode ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            {isSubmissionEditMode && (
              <div className="p-4 border border-blue-200 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 mb-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3"><svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg><h4 className="text-sm font-semibold text-gray-700">새 업체 추가</h4></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                  <input type="text" placeholder="업체명" className="px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={newSubmissionInfo.companyName} onChange={(e) => setNewSubmissionInfo(prev => ({ ...prev, companyName: e.target.value }))} />
                  <input type="text" placeholder="투고 방법" className="px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={newSubmissionInfo.submissionMethod} onChange={(e) => setNewSubmissionInfo(prev => ({ ...prev, submissionMethod: e.target.value }))} />
                  <input type="text" placeholder="투고일정" className="px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={newSubmissionInfo.submissionSchedule} onChange={(e) => setNewSubmissionInfo(prev => ({ ...prev, submissionSchedule: e.target.value }))} />
                  <input type="text" placeholder="런칭 조건" className="px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={newSubmissionInfo.launchConditions} onChange={(e) => setNewSubmissionInfo(prev => ({ ...prev, launchConditions: e.target.value }))} />
                  <input type="text" placeholder="담당자 이름" className="px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={newSubmissionInfo.contactPersonName} onChange={(e) => setNewSubmissionInfo(prev => ({ ...prev, contactPersonName: e.target.value }))} />
                  <input type="text" placeholder="담당자 이메일" className="px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={newSubmissionInfo.contactPersonEmail} onChange={(e) => setNewSubmissionInfo(prev => ({ ...prev, contactPersonEmail: e.target.value }))} />
                  <input type="text" placeholder="연락처" className="px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={newSubmissionInfo.contactNumber} onChange={(e) => setNewSubmissionInfo(prev => ({ ...prev, contactNumber: e.target.value }))} />
                  <input type="text" placeholder="비고" className="px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={newSubmissionInfo.remarks} onChange={(e) => setNewSubmissionInfo(prev => ({ ...prev, remarks: e.target.value }))} />
                </div>
                <div className="mt-3 flex justify-end"><button onClick={handleAddSubmissionInfo} className="px-4 py-2 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 transition-colors duration-150 flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>업체 추가</button></div>
              </div>
            )}

            <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-700 border-r border-gray-200 w-20">업체명</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-700 border-r border-gray-200 w-40">투고 방법</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-700 border-r border-gray-200 w-28">투고일정</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-700 border-r border-gray-200 w-36">런칭 조건</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-700 border-r border-gray-200 w-28">담당자</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-700 border-r border-gray-200 w-40">이메일</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-700 border-r border-gray-200 w-32">연락처</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-700 w-24">비고</th>
                      {isSubmissionEditMode && (<th className="px-3 py-2.5 text-left font-semibold text-gray-700 w-12">관리</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {submissionInfo.map((info, index) => (
                      <tr key={index} className={`border-t border-gray-100 hover:bg-blue-50/30 transition-colors duration-150 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className="px-3 py-2.5 font-medium border-r border-gray-200">{isSubmissionEditMode ? (<input type="text" value={info.companyName} onChange={(e) => handleUpdateSubmissionInfo(index, 'companyName', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" />) : (<div className="font-semibold text-xs text-gray-800">{info.companyName}</div>)}</td>
                        <td className="px-3 py-2.5 text-xs border-r border-gray-200">{isSubmissionEditMode ? (<input type="text" value={info.submissionMethod} onChange={(e) => handleUpdateSubmissionInfo(index, 'submissionMethod', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" />) : (<div className="text-gray-700 leading-relaxed">{info.submissionMethod}</div>)}</td>
                        <td className="px-3 py-2.5 text-xs border-r border-gray-200">{isSubmissionEditMode ? (<input type="text" value={info.submissionSchedule} onChange={(e) => handleUpdateSubmissionInfo(index, 'submissionSchedule', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" />) : (<div className="text-gray-600">{info.submissionSchedule || '-'}</div>)}</td>
                        <td className="px-3 py-2.5 text-xs border-r border-gray-200">{isSubmissionEditMode ? (<input type="text" value={info.launchConditions} onChange={(e) => handleUpdateSubmissionInfo(index, 'launchConditions', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" />) : (<div className="text-gray-700 leading-relaxed">{info.launchConditions || '-'}</div>)}</td>
                        <td className="px-3 py-2.5 text-xs border-r border-gray-200">{isSubmissionEditMode ? (<input type="text" value={info.contactPersonName} onChange={(e) => handleUpdateSubmissionInfo(index, 'contactPersonName', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" />) : (<div className="text-gray-700 font-medium">{info.contactPersonName}</div>)}</td>
                        <td className="px-3 py-2.5 text-xs border-r border-gray-200">{isSubmissionEditMode ? (<input type="text" value={info.contactPersonEmail} onChange={(e) => handleUpdateSubmissionInfo(index, 'contactPersonEmail', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" />) : (<div className="text-gray-600 break-all leading-relaxed">{info.contactPersonEmail}</div>)}</td>
                        <td className="px-3 py-2.5 text-xs border-r border-gray-200">{isSubmissionEditMode ? (<input type="text" value={info.contactNumber} onChange={(e) => handleUpdateSubmissionInfo(index, 'contactNumber', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="연락처" />) : (<div className="text-gray-700">{info.contactNumber ? (<div className="space-y-0.5">{info.contactNumber.split(',').map((contact, idx) => (<div key={idx} className="text-xs leading-tight">{contact.trim()}</div>))}</div>) : (<span className="text-gray-400">-</span>)}</div>)}</td>
                        <td className="px-3 py-2.5 text-xs border-r border-gray-200">{isSubmissionEditMode ? (<input type="text" value={info.remarks} onChange={(e) => handleUpdateSubmissionInfo(index, 'remarks', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" />) : (<div className="text-gray-600">{info.remarks || (<span className="text-gray-400">-</span>)}</div>)}</td>
                        {isSubmissionEditMode && (<td className="px-3 py-2.5 text-center"><button onClick={() => handleDeleteSubmissionInfo(index)} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full p-1 transition-colors duration-150" title="삭제"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : activeMode === 'upload' ? (
        <>
          <div className="space-y-4">
            <div className="p-4 border border-gray-200 rounded-lg bg-gradient-to-r from-gray-50 to-blue-50 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg"><svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg></div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">웹툰 플랫폼별 업로드 정보</h3>
                    <p className="text-xs text-gray-600 mt-1">각 플랫폼의 업로드 방법, 계정 정보, 원고 규격을 확인할 수 있습니다.</p>
                  </div>
                </div>
                <button onClick={() => setIsUploadEditMode(!isUploadEditMode)} className={`px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-2 ${isUploadEditMode ? 'bg-indigo-600 text-white shadow-md hover:bg-indigo-700' : 'bg-gray-600 text-white shadow-md hover:bg-gray-700'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  수정 {isUploadEditMode ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            {isUploadEditMode && (
              <div className="p-4 border border-blue-200 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 mb-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3"><svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg><h4 className="text-sm font-semibold text-gray-700">새 업체 추가</h4></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                  <input type="text" placeholder="업체명" className="px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={newUploadInfo.companyName} onChange={(e) => setNewUploadInfo(prev => ({ ...prev, companyName: e.target.value }))} />
                  <input type="text" placeholder="납품 마지노선" className="px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={newUploadInfo.deliveryDeadline} onChange={(e) => setNewUploadInfo(prev => ({ ...prev, deliveryDeadline: e.target.value }))} />
                  <input type="text" placeholder="원고 등록 링크" className="px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={newUploadInfo.registrationLink} onChange={(e) => setNewUploadInfo(prev => ({ ...prev, registrationLink: e.target.value }))} />
                  <input type="text" placeholder="아이디" className="px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={newUploadInfo.loginId} onChange={(e) => setNewUploadInfo(prev => ({ ...prev, loginId: e.target.value }))} />
                  <input type="text" placeholder="비밀번호" className="px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={newUploadInfo.password} onChange={(e) => setNewUploadInfo(prev => ({ ...prev, password: e.target.value }))} />
                  <input type="text" placeholder="담당자 이름" className="px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={newUploadInfo.contactPersonName} onChange={(e) => setNewUploadInfo(prev => ({ ...prev, contactPersonName: e.target.value }))} />
                  <input type="text" placeholder="담당자 이메일" className="px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={newUploadInfo.contactPersonEmail} onChange={(e) => setNewUploadInfo(prev => ({ ...prev, contactPersonEmail: e.target.value }))} />
                  <input type="text" placeholder="연락처" className="px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={newUploadInfo.contactNumber} onChange={(e) => setNewUploadInfo(prev => ({ ...prev, contactNumber: e.target.value }))} />
                  <input type="text" placeholder="원고 규격" className="px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={newUploadInfo.manuscriptSpec} onChange={(e) => setNewUploadInfo(prev => ({ ...prev, manuscriptSpec: e.target.value }))} />
                  <input type="text" placeholder="표지 배너 규격" className="px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={newUploadInfo.coverBannerSpec} onChange={(e) => setNewUploadInfo(prev => ({ ...prev, coverBannerSpec: e.target.value }))} />
                  <input type="text" placeholder="썸네일 규격" className="px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={newUploadInfo.thumbnailSpec} onChange={(e) => setNewUploadInfo(prev => ({ ...prev, thumbnailSpec: e.target.value }))} />
                </div>
                <div className="mt-3 flex justify-end"><button onClick={handleAddUploadInfo} className="px-4 py-2 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 transition-colors duration-150 flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>업체 추가</button></div>
              </div>
            )}

            <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-700 border-r border-gray-200 w-20">업체명</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-700 border-r border-gray-200 w-32">납품 마지노선</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-700 border-r border-gray-200 w-40">원고 등록 링크</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-700 border-r border-gray-200 w-24">아이디</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-700 border-r border-gray-200 w-24">비밀번호</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-700 border-r border-gray-200 w-28">담당자</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-700 border-r border-gray-200 w-56">이메일</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-700 border-r border-gray-200 w-28">연락처</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-700 border-r border-gray-200 w-20">원고 규격</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-700 border-r border-gray-200 w-28">표지 배너 규격</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-700 w-20">썸네일 규격</th>
                      {isUploadEditMode && (<th className="px-3 py-2.5 text-left font-semibold text-gray-700 w-12">관리</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {uploadInfo.map((info, index) => (
                      <tr key={index} className={`border-t border-gray-100 hover:bg-blue-50/30 transition-colors duration-150 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className="px-3 py-2.5 font-medium border-r border-gray-200">{isUploadEditMode ? (<input type="text" value={info.companyName} onChange={(e) => handleUpdateUploadInfo(index, 'companyName', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" />) : (<div className="font-semibold text-xs text-gray-800">{info.companyName}</div>)}</td>
                        <td className="px-3 py-2.5 text-xs border-r border-gray-200">{isUploadEditMode ? (<input type="text" value={info.deliveryDeadline} onChange={(e) => handleUpdateUploadInfo(index, 'deliveryDeadline', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" />) : (<div className="text-gray-700 leading-relaxed">{info.deliveryDeadline}</div>)}</td>
                        <td className="px-3 py-2.5 text-xs border-r border-gray-200">{isUploadEditMode ? (
                          <input type="text" value={info.registrationLink} onChange={(e) => handleUpdateUploadInfo(index, 'registrationLink', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                        ) : (() => { const { url, note } = extractFirstUrl(info.registrationLink || ''); return (
                          <div className="space-y-1">
                            {url ? (<a href={url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">{url}</a>) : (<span className="text-gray-400">-</span>)}
                            {note && (<div className="text-[11px] text-gray-600 whitespace-pre-line break-words">{note}</div>)}
                          </div>
                        ); })()}</td>
                        <td className="px-3 py-2.5 text-xs border-r border-gray-200">{isUploadEditMode ? (<input type="text" value={info.loginId} onChange={(e) => handleUpdateUploadInfo(index, 'loginId', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" />) : (<div className="text-gray-700 font-mono">{info.loginId}</div>)}</td>
                        <td className="px-3 py-2.5 text-xs border-r border-gray-200">{isUploadEditMode ? (<input type="text" value={info.password} onChange={(e) => handleUpdateUploadInfo(index, 'password', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" />) : (<div className="text-gray-700 font-mono">{info.password}</div>)}</td>
                        <td className="px-3 py-2.5 text-xs border-r border-gray-200">{isUploadEditMode ? (<input type="text" value={info.contactPersonName} onChange={(e) => handleUpdateUploadInfo(index, 'contactPersonName', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" />) : (<div className="text-gray-700 font-medium">{info.contactPersonName}</div>)}</td>
                        <td className="px-3 py-2.5 text-xs border-r border-gray-200">{isUploadEditMode ? (
                          <input type="text" value={info.contactPersonEmail} onChange={(e) => handleUpdateUploadInfo(index, 'contactPersonEmail', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                        ) : (
                          <div className="text-gray-700">
                            {renderEmails(info.contactPersonEmail || '')}
                          </div>
                        )}</td>
                        <td className="px-3 py-2.5 text-xs border-r border-gray-200">{isUploadEditMode ? (<input type="text" value={info.contactNumber} onChange={(e) => handleUpdateUploadInfo(index, 'contactNumber', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" />) : (<div className="text-gray-700">{info.contactNumber ? (<div className="space-y-0.5">{info.contactNumber.split(',').map((contact, idx) => (<div key={idx} className="text-xs leading-tight">{contact.trim()}</div>))}</div>) : (<span className="text-gray-400">-</span>)}</div>)}</td>
                        <td className="px-3 py-2.5 text-xs border-r border-gray-200">{isUploadEditMode ? (<input type="text" value={info.manuscriptSpec} onChange={(e) => handleUpdateUploadInfo(index, 'manuscriptSpec', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" />) : (<div className="text-gray-700 font-mono">{info.manuscriptSpec}</div>)}</td>
                        <td className="px-3 py-2.5 text-xs border-r border-gray-200">{isUploadEditMode ? (<input type="text" value={info.coverBannerSpec} onChange={(e) => handleUpdateUploadInfo(index, 'coverBannerSpec', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" />) : (<div className="text-gray-700 font-mono">{info.coverBannerSpec}</div>)}</td>
                        <td className="px-3 py-2.5 text-xs border-r border-gray-200">{isUploadEditMode ? (<input type="text" value={info.thumbnailSpec} onChange={(e) => handleUpdateUploadInfo(index, 'thumbnailSpec', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent" />) : (<div className="text-gray-700 font-mono">{info.thumbnailSpec}</div>)}</td>
                        {isUploadEditMode && (<td className="px-3 py-2.5 text-center"><button onClick={() => handleDeleteUploadInfo(index)} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full p-1 transition-colors duration-150" title="삭제"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default WebtoonTracker;


