import React, { useState, useMemo, useEffect, ChangeEvent } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Webtoon, SortConfig, SortDirection, SubmissionInfo, UploadInfo } from '../types';
import { INITIAL_WEBTOONS, INITIAL_PLATFORMS, WEBTOON_TYPES, SYNC_GROUPS, DOMESTIC_PLATFORMS, OVERSEAS_PLATFORMS, SUBMISSION_INFO, UPLOAD_INFO } from '../constants';
import EditableCell from './EditableCell';

interface SyncProjectLite { id: string; title: string; status?: string; completedCount?: number; totalEpisodes?: number }

interface WebtoonTrackerProps { syncProjects?: SyncProjectLite[]; onJumpToSchedule?: (projectId: string) => void }

const WebtoonTracker: React.FC<WebtoonTrackerProps> = ({ syncProjects, onJumpToSchedule }) => {
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
  const [activeMode, setActiveMode] = useState<'launch' | 'submission' | 'upload' | 'delivery'>('launch');
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

  // 요일별 보기 필터
  const [dayFilter, setDayFilter] = useState<'all' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'>('all');

  // 납품(Delivery) 전용 탭 상태
  const [deliveryModalDay, setDeliveryModalDay] = useState<'monday'|'tuesday'|'wednesday'|'thursday'|'friday'|'saturday'|'sunday'>('monday');
  const [deliveryTitles, setDeliveryTitles] = useState<string[]>([]);
  const dayLabel: Record<string, string> = { monday: '월', tuesday: '화', wednesday: '수', thursday: '목', friday: '금', saturday: '토', sunday: '일' } as any;
  const [deliveryDetails, setDeliveryDetails] = useState<Array<{ title: string; completedCount?: number; totalEpisodes?: number; commonOpen?: Record<number, string>; commonDue?: Record<number, string>; platforms: Array<{ platformId: string; name: string; status: string; deliveredCount: number; deliveredEpisodes?: Record<number, boolean> }> }>>([]);
  const [isLoadingDelivery, setIsLoadingDelivery] = useState(false);

  const openDeliveryModal = async () => {
    setActiveMode('delivery');
    // 초기 로드
    await refreshDeliveryTitles('monday');
  };

  const refreshDeliveryTitles = async (day: 'monday'|'tuesday'|'wednesday'|'thursday'|'friday'|'saturday'|'sunday') => {
    setDeliveryModalDay(day);
    try {
      // 라이브 작품 제목 중복 제거
      const liveTitles: string[] = Array.from(new Set<string>(webtoons
        .filter(w => w.type.includes('라이브'))
        .map(w => w.title)));
      console.log(`[납품 요일 필터] ${day} 요일 - 라이브 작품들:`, liveTitles);
      
      // 메타 로딩
      const snaps = await Promise.all(liveTitles.map(t => getDoc(doc(db, 'webtoonMeta', t))));
      const titles = liveTitles.filter((t, idx) => {
        const s = snaps[idx];
        const d = s.exists() ? (s.data() as any)?.deliveryDay : undefined;
        console.log(`[납품 요일 필터] ${t} - webtoonMeta deliveryDay:`, d, `요청된 요일: ${day}`);
        return d === day;
      });
      console.log(`[납품 요일 필터] ${day} 요일 매칭된 작품들:`, titles);
      setDeliveryTitles(titles);
      await loadDeliveryDetailsForTitles(titles);
    } catch {
      setDeliveryTitles([]);
      setDeliveryDetails([]);
    }
  };

  // 납품 탭용 세부 정보 로더: 각 작품의 런칭 플랫폼/완성회차/납품카운트
  const loadDeliveryDetailsForTitles = async (titles: string[]) => {
    setIsLoadingDelivery(true);
    try {
      const categories = ['국내비독점 [라이브]', '해외비독점 [라이브]'];
      const result: Array<{ title: string; completedCount?: number; totalEpisodes?: number; commonOpen?: Record<number, string>; commonDue?: Record<number, string>; platforms: Array<{ platformId: string; name: string; status: string; deliveredCount: number }> }> = [];
      for (const title of titles) {
        const matched = syncProjects?.find(p => p.title === title);
        const completed = matched?.completedCount;
        // 총 회차는 일정 탭의 episodeCount와 1회차 시작을 고려해 계산 (startEpisode 기본 1 가정)
        const totalEpisodes: number | undefined = matched?.totalEpisodes || undefined;
        // 현 화면의 런칭 표 상태에서 즉시 동기화: 동일 제목의 라이브 항목들에서 launched 플랫폼을 수집
        const launchedFromState = new Set<string>();
        const matchingWebtoons = webtoons.filter(w => (w.type === '국내비독점 [라이브]' || w.type === '해외비독점 [라이브]') && w.title === title);
        console.log(`[납품] ${title} 매칭된 웹툰:`, matchingWebtoons.length, matchingWebtoons.map(w => ({ id: w.id, type: w.type, platforms: w.platforms })));
        
        matchingWebtoons.forEach(w => {
          Object.entries(w.platforms || {}).forEach(([name, val]) => {
            const status = getActualCellStatus(val as string | undefined);
            console.log(`[납품] ${title} - ${name}: ${val} -> ${status}`);
            if (status === 'launched') {
              const pid = mapPlatformNameToId(name);
              if (pid) {
                launchedFromState.add(pid);
                console.log(`[납품] ${title} 런칭 플랫폼 추가: ${name} (${pid})`);
              }
            }
          });
        });
        console.log(`[납품] ${title} 화면에서 수집된 런칭 플랫폼:`, Array.from(launchedFromState));

        // launchProjects에서 해당 타이틀의 라이브 문서 ID 수집 (백엔드 데이터와 병합)
        const projIds: string[] = [];
        for (const cat of categories) {
          try {
            const qSnap = await getDocs(query(collection(db, 'launchProjects'), where('title', '==', title), where('category', '==', cat)));
            qSnap.docs.forEach(d => projIds.push(d.id));
          } catch {}
        }
        // 런칭 상태 수집 (projectId 기반 + title 기반 호환)
        const statusDocs: any[] = [];
        for (const pid of projIds) {
          try {
            const sSnap = await getDocs(query(collection(db, 'launchStatuses'), where('projectId', '==', pid)));
            sSnap.docs.forEach(d => {
              const data = d.data() as any;
              if (data && categories.includes(String(data.category))) {
                statusDocs.push({ id: d.id, ...data });
              }
            });
          } catch {}
        }
        // 타이틀 기반 잔존 데이터도 조회
        try {
          for (const cat of categories) {
            const sSnap = await getDocs(query(collection(db, 'launchStatuses'), where('projectId', '==', title), where('category', '==', cat)));
            sSnap.docs.forEach(d => statusDocs.push({ id: d.id, ...(d.data() as any) }));
          }
        } catch {}

        // 플랫폼별 최신 상태 집계
        const byPlatform = new Map<string, { status: string }>();
        for (const s of statusDocs) {
          const plat = s.platformId as string;
          const st = s.status as string;
          // 알 수 없는 플랫폼ID는 제외
          if (!PLATFORM_ID_TO_NAME[plat]) continue;
          const prev = byPlatform.get(plat);
          if (!prev) byPlatform.set(plat, { status: st });
          else {
            // 우선순위: launched > pending > rejected > none
            const rank = (v: string) => v === 'launched' ? 3 : v === 'pending' ? 2 : v === 'rejected' ? 1 : 0;
            if (rank(st) > rank(prev.status)) byPlatform.set(plat, { status: st });
          }
        }

        // 런칭(launched) 플랫폼 선택 규칙
        // 1) 화면의 현재 런칭(초록색)이 하나라도 있으면 그것만 신뢰
        // 2) 화면에 없을 때만 백엔드 launched 사용
        const backendLaunched = new Set<string>();
        Array.from(byPlatform.entries())
          .filter(([, v]) => v.status === 'launched')
          .forEach(([platformId]) => backendLaunched.add(platformId));
        let launchedPlatforms = launchedFromState.size > 0 ? launchedFromState : backendLaunched;
        console.log(`[납품] ${title} 최종 런칭 플랫폼 (화면우선):`, Array.from(launchedPlatforms));
        // 설정에서 삭제/숨긴 플랫폼은 제외
        const allowed = new Set(platforms);
        launchedPlatforms = new Set(Array.from(launchedPlatforms).filter(pid => allowed.has(PLATFORM_ID_TO_NAME[pid])));
        console.log(`[납품] ${title} 필터링 후 런칭 플랫폼:`, Array.from(launchedPlatforms));

        const platforms: Array<{ platformId: string; name: string; status: string; deliveredCount: number; deliveredEpisodes?: Record<number, boolean> }> = [];
        for (const pid of Array.from(launchedPlatforms)) {
          const name = PLATFORM_ID_TO_NAME[pid] || pid;
          let deliveredCount = 0;
          let deliveredEpisodes: Record<number, boolean> | undefined = undefined;
          try {
            const dSnap = await getDoc(doc(db, 'deliveries', `${title}::${pid}`));
            if (dSnap.exists()) {
              deliveredCount = Number((dSnap.data() as any)?.count || 0);
              const eps = (dSnap.data() as any)?.episodes;
              if (eps && typeof eps === 'object') {
                deliveredEpisodes = eps as Record<number, boolean>;
              }
            }
          } catch {}
          platforms.push({ platformId: pid, name, status: 'launched', deliveredCount, deliveredEpisodes });
        }
        // 타이틀 공통 일정 (오픈/마감) 로드
        let commonOpen: Record<number, string> | undefined = undefined;
        let commonDue: Record<number, string> | undefined = undefined;
        try {
          const common = await getDoc(doc(db, 'deliveries', `${title}::COMMON`));
          if (common.exists()) {
            const data: any = common.data();
            if (data?.open && typeof data.open === 'object') commonOpen = data.open as Record<number, string>;
            if (data?.due && typeof data.due === 'object') commonDue = data.due as Record<number, string>;
          }
        } catch {}

        result.push({ title, completedCount: completed, totalEpisodes, commonOpen, commonDue, platforms });
      }
      setDeliveryDetails(result);
    } finally {
      setIsLoadingDelivery(false);
    }
  };

  // 납품 카운트 업데이트/저장
  const saveDeliveryCount = async (title: string, platformId: string, count: number) => {
    if (count < 0 || Number.isNaN(count)) count = 0;
    try {
      await setDoc(doc(db, 'deliveries', `${title}::${platformId}`), { title, platformId, count, updatedAt: Date.now() }, { merge: true });
    } catch {}
  };

  const updateLocalDeliveryCount = (title: string, platformId: string, count: number) => {
    setDeliveryDetails(prev => prev.map(d => {
      if (d.title !== title) return d;
      return { ...d, platforms: d.platforms.map(p => p.platformId === platformId ? { ...p, deliveredCount: count < 0 ? 0 : count } : p) };
    }));
  };

  // 회차 토글 저장
  const toggleEpisode = async (title: string, platformId: string, episode: number, checked: boolean) => {
    try {
      await setDoc(doc(db, 'deliveries', `${title}::${platformId}`), {
        title,
        platformId,
        updatedAt: Date.now(),
        episodes: { [episode]: checked }
      }, { merge: true });
    } catch {}
  };

  const updateLocalEpisode = (title: string, platformId: string, episode: number, checked: boolean) => {
    setDeliveryDetails(prev => prev.map(d => {
      if (d.title !== title) return d;
      return {
        ...d,
        platforms: d.platforms.map(p => {
          if (p.platformId !== platformId) return p;
          const next = { ...(p.deliveredEpisodes || {}) };
          if (checked) next[episode] = true; else delete next[episode];
          // count 동기화: 체크된 회차 수
          const newCount = Object.keys(next).length;
          return { ...p, deliveredEpisodes: next, deliveredCount: newCount };
        })
      };
    }));
  };

  // 회차별 납품 예정일 저장
  const saveSchedule = async (title: string, platformId: string, episode: number, dateStr: string) => {
    try {
      await setDoc(doc(db, 'deliveries', `${title}::${platformId}`), {
        title,
        platformId,
        updatedAt: Date.now(),
        schedule: { [episode]: dateStr }
      }, { merge: true });
    } catch {}
  };

  const updateLocalSchedule = (title: string, platformId: string, episode: number, dateStr: string) => {
    setDeliveryDetails(prev => prev.map(d => {
      if (d.title !== title) return d;
      return {
        ...d,
        platforms: d.platforms.map(p => {
          if (p.platformId !== platformId) return p;
          const next = { ...(p.deliveredSchedule || {}) };
          if (dateStr) next[episode] = dateStr; else delete next[episode];
          return { ...p, deliveredSchedule: next };
        })
      };
    }));
  };

  const saveCommonField = async (title: string, field: 'open' | 'due', episode: number, dateStr: string) => {
    try {
      await setDoc(doc(db, 'deliveries', `${title}::COMMON`), {
        title,
        updatedAt: Date.now(),
        [field]: { [episode]: dateStr }
      }, { merge: true });
    } catch {}
  };

  const updateLocalCommonOpen = (title: string, episode: number, dateStr: string) => {
    setDeliveryDetails(prev => prev.map(d => {
      if (d.title !== title) return d;
      const next = { ...(d.commonOpen || {}) };
      if (dateStr) next[episode] = dateStr; else delete next[episode];
      return { ...d, commonOpen: next };
    }));
  };

  const updateLocalCommonDue = (title: string, episode: number, dateStr: string) => {
    setDeliveryDetails(prev => prev.map(d => {
      if (d.title !== title) return d;
      const next = { ...(d.commonDue || {}) };
      if (dateStr) next[episode] = dateStr; else delete next[episode];
      return { ...d, commonDue: next };
    }));
  };

  // 총회차 수정
  const editTotalEpisodes = async (title: string, current?: number) => {
    const input = window.prompt('총 회차를 입력하세요', String(current ?? ''));
    if (input == null) return;
    const n = Number(input);
    if (!Number.isFinite(n) || n <= 0) return alert('유효한 숫자를 입력하세요.');
    try {
      await setDoc(doc(db, 'webtoonMeta', title), { totalEpisodes: n }, { merge: true });
      setDeliveryDetails(prev => prev.map(d => d.title === title ? { ...d, totalEpisodes: n } : d));
    } catch {}
  };

  // 한국어 정렬 헬퍼
  const sortKo = (arr: string[]) => [...arr].sort((a, b) => a.localeCompare(b, 'ko'));

  useEffect(() => {
    setVisiblePlatforms(sortKo(platforms));
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

  // 외부 프로젝트 목록과 동기화 - 라이브 카테고리만 동기화 (완결은 독립적으로 관리)
  useEffect(() => {
    if (!syncProjects) return;
    setWebtoons(prev => {
      const liveTypes = new Set(['국내비독점 [라이브]', '해외비독점 [라이브]']);
      // 기존 비-라이브(=완결 등)는 유지
      const nonLive = prev.filter(w => !liveTypes.has(w.type));
      const result: Webtoon[] = [...nonLive];
      for (const p of syncProjects) {
        const domesticLiveId = `${p.id}-domestic`;
        const overseasLiveId = `${p.id}-overseas`;
        const existingDomestic = prev.find(w => w.id === domesticLiveId && w.type === '국내비독점 [라이브]');
        const existingOverseas = prev.find(w => w.id === overseasLiveId && w.type === '해외비독점 [라이브]');
        result.push(
          existingDomestic ? { ...existingDomestic, title: p.title } : { id: domesticLiveId, title: p.title, type: '국내비독점 [라이브]', platforms: {} }
        );
        result.push(
          existingOverseas ? { ...existingOverseas, title: p.title } : { id: overseasLiveId, title: p.title, type: '해외비독점 [라이브]', platforms: {} }
        );
      }
      return result;
    });
  }, [syncProjects]);

  // Firestore의 launchProjects에서 완결 카테고리 작품을 읽어와 표시 (국내/해외 완결)
  useEffect(() => {
    const loadCompleted = async () => {
      if (!activeCategory || !activeCategory.includes('완결')) return;
      try {
        const qSnap = await getDocs(query(collection(db, 'launchProjects'), where('category', '==', activeCategory)));
        const titles = qSnap.docs.map(d => (d.data().title as string) || '').filter(t => t.trim() !== '');
        // load deliveryDay meta
        const metaSnaps = await Promise.all(titles.map(t => getDoc(doc(db, 'webtoonMeta', t))));
        const titleToDay = new Map<string, string>();
        metaSnaps.forEach((ms, idx) => { const t = titles[idx]; if (ms.exists() && (ms.data() as any)?.deliveryDay) { titleToDay.set(t, (ms.data() as any).deliveryDay); } });
        setWebtoons(prev => {
          // 선택된 완결 카테고리만 교체, 나머지는 유지
          const others = prev.filter(w => w.type !== activeCategory);
          const added = titles.map((title, idx) => ({ id: `completed-${activeCategory}-${idx}`, title, type: activeCategory, platforms: {}, deliveryDay: titleToDay.get(title) } as Webtoon));
          return [...others, ...added];
        });
      } catch {
        // 무시
      }
    };
    void loadCompleted();
  }, [activeCategory]);

  useEffect(() => {
    if (activeCategory) {
      const isOverseas = activeCategory.includes('해외');
      const fallback = isOverseas ? OVERSEAS_PLATFORMS : DOMESTIC_PLATFORMS;
      (async () => {
        try {
          const ref = doc(db, 'settings', 'platforms');
          const snap = await getDoc(ref);
          const key = isOverseas ? 'overseas' : 'domestic';
          const data = snap.exists() ? (snap.data() as any) : null;
          const saved = data?.[key];
          if (saved && Array.isArray(saved.platforms) && saved.platforms.length) {
            const sortedPlatforms = sortKo(saved.platforms);
            const sortedVisible = sortKo(Array.isArray(saved.visible) && saved.visible.length ? saved.visible : saved.platforms);
            setPlatforms(sortedPlatforms);
            setVisiblePlatforms(sortedVisible);
            return;
          }
        } catch {}
        const sortedFallback = sortKo(fallback);
        setPlatforms(sortedFallback);
        setVisiblePlatforms(sortedFallback);
      })();
    }
  }, [activeCategory]);

  // 플랫폼/가시성 변경 시 자동 저장 (카테고리별 공용 저장)
  useEffect(() => {
    if (!activeCategory) return;
    const isOverseas = activeCategory.includes('해외');
    const key = isOverseas ? 'overseas' : 'domestic';
    const timer = setTimeout(async () => {
      try {
        const ref = doc(db, 'settings', 'platforms');
        const current = (await getDoc(ref)).data() || {};
        await setDoc(ref, { ...current, [key]: { platforms: sortKo(platforms), visible: sortKo(visiblePlatforms) } }, { merge: true });
        
        // 삭제된 플랫폼의 런칭 상태를 화면에서 제거
        const removedPlatforms = INITIAL_PLATFORMS.filter(p => !platforms.includes(p));
        if (removedPlatforms.length > 0) {
          console.log(`[플랫폼 정리] 삭제된 플랫폼들:`, removedPlatforms);
          setWebtoons(prev => prev.map(w => {
            const updatedPlatforms = { ...w.platforms };
            removedPlatforms.forEach(platform => {
              if (updatedPlatforms[platform]) {
                console.log(`[플랫폼 정리] ${w.title} - ${platform} 상태 제거:`, updatedPlatforms[platform]);
                delete updatedPlatforms[platform];
              }
            });
            return { ...w, platforms: updatedPlatforms };
          }));
        }
      } catch {}
    }, 400);
    return () => clearTimeout(timer);
  }, [platforms, visiblePlatforms, activeCategory]);

  // Hydrate deliveryDay from Firestore for currently visible titles (라이브/완결 공통)
  useEffect(() => {
    const hydrateDeliveryDays = async () => {
      if (!activeCategory) return;
      try {
        const titles: string[] = Array.from(new Set<string>(webtoons.filter(w => w.type === activeCategory).map(w => w.title)));
        if (titles.length === 0) return;
        const snaps = await Promise.all(titles.map(t => getDoc(doc(db, 'webtoonMeta', t))));
        const titleToDay = new Map<string, string | undefined>();
        snaps.forEach((s, idx) => {
          const t = titles[idx];
          titleToDay.set(t, s.exists() ? (s.data() as any)?.deliveryDay : undefined);
        });
        setWebtoons(prev => prev.map(w => {
          if (w.type !== activeCategory) return w;
          const d = titleToDay.get(w.title);
          if (typeof d === 'string' && d !== w.deliveryDay) {
            return { ...w, deliveryDay: d } as Webtoon;
          }
          return w;
        }));
      } catch {}
    };
    void hydrateDeliveryDays();
  }, [activeCategory, webtoons.length]);

  // Firestore 저장된 런칭 상태를 불러와 셀에 반영 (새로고침 복원)
  useEffect(() => {
    const loadStatuses = async () => {
      if (!activeCategory) return;
      try {
        const snap = await getDocs(query(collection(db, 'launchStatuses'), where('category', '==', activeCategory)));
        const byProject = new Map<string, Array<{ platformId: string; status: string }>>();
        snap.docs.forEach(d => {
          const data: any = d.data();
          const projectId = String(data.projectId || '').trim();
          if (!projectId) return;
          const arr = byProject.get(projectId) || [];
          arr.push({ platformId: data.platformId, status: data.status });
          byProject.set(projectId, arr);
        });
        setWebtoons(prev => prev.map(w => {
          const keysToTry = [w.id, w.title];
          let updates: Array<{ platformId: string; status: string }> | undefined;
          for (const k of keysToTry) { if (byProject.has(k)) { updates = byProject.get(k); break; } }
          if (!updates) return w;
          const next = { ...w.platforms } as Record<string, string | null>;
          for (const u of updates) {
            const name = PLATFORM_ID_TO_NAME[u.platformId];
            if (!name) continue;
            next[name] = u.status === 'launched' ? 'launched:' : u.status === 'pending' ? 'submitted:' : u.status === 'rejected' ? 'rejected:' : '';
          }
          return { ...w, platforms: next };
        }));
      } catch {}
    };
    void loadStatuses();
  }, [activeCategory]);

  // 컴포넌트 마운트 시 두리요 플랫폼 즉시 제거
  useEffect(() => {
    removeDuriPlatform();
  }, []);

  const getActualCellStatus = (value: string | undefined): 'empty' | 'launched' | 'submitted' | 'rejected' => {
    if (!value) return 'empty';
    if (value.startsWith('launched:')) return 'launched';
    if (value.startsWith('submitted:')) return 'submitted';
    if (value.startsWith('rejected:')) return 'rejected';
    return 'empty';
  };

  // 두리요 플랫폼 즉시 제거 함수
  const removeDuriPlatform = () => {
    console.log('[즉시 정리] 두리요 플랫폼 제거 시작');
    setWebtoons(prev => prev.map(w => {
      const updatedPlatforms = { ...w.platforms };
      if (updatedPlatforms['두리요']) {
        console.log(`[즉시 정리] ${w.title} - 두리요 상태 제거:`, updatedPlatforms['두리요']);
        delete updatedPlatforms['두리요'];
      }
      return { ...w, platforms: updatedPlatforms };
    }));
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
    if (dayFilter !== 'all') {
      filtered = filtered.filter(w => {
        const d = w.deliveryDay || '';
        if (d === '매일') return true;
        return d === dayFilter;
      });
    }
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;
        if (sortConfig.key === 'launchStatus') {
          aValue = Object.values(a.platforms).filter(value => getActualCellStatus(value as string) === 'launched').length;
          bValue = Object.values(b.platforms).filter(value => getActualCellStatus(value as string) === 'launched').length;
        } else if (sortConfig.key === 'completedCount') {
          const getCompleted = (w: Webtoon) => {
            const baseId = w.id.replace('-domestic','').replace('-overseas','');
            const matched = syncProjects?.find(p => p.id === baseId);
            return matched?.completedCount ?? 0;
          };
          aValue = getCompleted(a);
          bValue = getCompleted(b);
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
  }, [webtoons, searchTerm, sortConfig, activeCategory, dayFilter]);

  const requestSort = (key: string) => {
    let direction: SortDirection = 'asc';
    if (key === 'launchStatus') {
      direction = 'desc';
      if (sortConfig.key === key && sortConfig.direction === 'desc') {
        direction = 'asc';
      }
    } else if (key === 'completedCount') {
      // 완성 회차는 많은 순이 기본
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

    // Firestore 런칭현황 동기화 (라이브/완결 구분하여 저장)
    try {
      const webtoon = webtoons.find(w => w.id === webtoonId);
      const category = webtoon?.type || '국내비독점 [라이브]';
      const status = getActualCellStatus(value as any);
      const mapped = mapPlatformNameToId(platform);
      if (!mapped) return;
      const statusForLaunch: 'launched' | 'pending' | 'rejected' | 'none' =
        status === 'launched' ? 'launched' : status === 'submitted' ? 'pending' : status === 'rejected' ? 'rejected' : 'none';
      // 완결 탭에서 생성한 아이템은 임시 id 형태(completed-...)이므로 launchProjects 기준 id를 찾지 않고 key에 title을 사용
      if (webtoon && webtoon.id.startsWith('completed-')) {
        // key: title 기반으로 저장 (프로젝트 id 없이도 유지)
        const key = `${webtoon.title}::${category}::${mapped}`;
        (async () => {
          const q = query(collection(db, 'launchStatuses'), where('key', '==', key));
          const snap = await getDocs(q);
          if (statusForLaunch === 'none') {
            if (!snap.empty) await deleteDoc(snap.docs[0].ref);
            // 과거 import에서 launchProjects 문서ID 기반으로 저장된 잔여키도 정리
            try {
              const lp = await getDocs(query(collection(db, 'launchProjects'), where('title', '==', webtoon.title), where('category', '==', category)));
              for (const d of lp.docs) {
                const legacyKey = `${d.id}::${category}::${mapped}`;
                const legacySnap = await getDocs(query(collection(db, 'launchStatuses'), where('key', '==', legacyKey)));
                if (!legacySnap.empty) await deleteDoc(legacySnap.docs[0].ref);
              }
            } catch {}
            return;
          }
          if (snap.empty) {
            await addDoc(collection(db, 'launchStatuses'), { key, projectId: webtoon.title, platformId: mapped, category, status: statusForLaunch, timestamp: Date.now() });
            // launchProjects 문서ID 기반 상태도 함께 업서트하여 호환성 유지
            try {
              const lp = await getDocs(query(collection(db, 'launchProjects'), where('title', '==', webtoon.title), where('category', '==', category)));
              for (const d of lp.docs) {
                const legacyKey = `${d.id}::${category}::${mapped}`;
                const legacySnap = await getDocs(query(collection(db, 'launchStatuses'), where('key', '==', legacyKey)));
                if (legacySnap.empty) {
                  await addDoc(collection(db, 'launchStatuses'), { key: legacyKey, projectId: d.id, platformId: mapped, category, status: statusForLaunch, timestamp: Date.now() });
                } else {
                  await updateDoc(legacySnap.docs[0].ref, { status: statusForLaunch, timestamp: Date.now() });
                }
              }
            } catch {}
          } else {
            await updateDoc(snap.docs[0].ref, { status: statusForLaunch, timestamp: Date.now() });
            // legacy 키도 반영
            try {
              const lp = await getDocs(query(collection(db, 'launchProjects'), where('title', '==', webtoon.title), where('category', '==', category)));
              for (const d of lp.docs) {
                const legacyKey = `${d.id}::${category}::${mapped}`;
                const legacySnap = await getDocs(query(collection(db, 'launchStatuses'), where('key', '==', legacyKey)));
                if (legacySnap.empty) {
                  await addDoc(collection(db, 'launchStatuses'), { key: legacyKey, projectId: d.id, platformId: mapped, category, status: statusForLaunch, timestamp: Date.now() });
                } else {
                  await updateDoc(legacySnap.docs[0].ref, { status: statusForLaunch, timestamp: Date.now() });
                }
              }
            } catch {}
          }
        })();
      } else {
        // 라이브 항목: 기본 키(id)로 저장/삭제하되, 과거 타이틀 기반 잔여 키도 함께 정리
        if (statusForLaunch === 'none' && webtoon) {
          (async () => {
            const titleKey = `${webtoon.title}::${category}::${mapped}`;
            const legacy = await getDocs(query(collection(db, 'launchStatuses'), where('key', '==', titleKey)));
            if (!legacy.empty) await deleteDoc(legacy.docs[0].ref);
          })();
        }
        void upsertLaunchStatus(webtoonId, category, mapped, statusForLaunch);
      }
    } catch (err) {
      // ignore syncing error silently
    }
  };

  // 플랫폼 한글명 -> LaunchStatus 플랫폼 ID 매핑
  const PLATFORM_NAME_TO_ID: Record<string, string> = {
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
  const PLATFORM_ID_TO_NAME: Record<string, string> = Object.fromEntries(Object.entries(PLATFORM_NAME_TO_ID).map(([k,v])=>[v,k]));
  const mapPlatformNameToId = (name: string): string | null => PLATFORM_NAME_TO_ID[name] || null;

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
    // Persist delivery day by title (shared across sync group)
    try {
      const target = webtoons.find(w => w.id === id);
      const title = target?.title;
      if (title) {
        console.log(`[요일 저장] ${title} - ${deliveryDay} 저장 중...`);
        void setDoc(doc(db, 'webtoonMeta', title), { deliveryDay }, { merge: true });
      }
    } catch (error) {
      console.error('[요일 저장] 오류:', error);
    }
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
    setPlatforms(sortKo([...platforms, newPlatformName]));
    setVisiblePlatforms(sortKo([...visiblePlatforms, newPlatformName]));
    setNewPlatformName('');
  };

  const handleUpdatePlatformName = (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) return;
    if (platforms.includes(newName)) {
      alert('이미 존재하는 플랫폼명입니다.');
      return;
    }
    setPlatforms(sortKo(platforms.map(p => p === oldName ? newName : p)));
    setWebtoons(webtoons.map(w => {
      const newPlatforms = { ...w.platforms } as Record<string, string | null>;
      if (oldName in newPlatforms) {
        (newPlatforms as any)[newName] = newPlatforms[oldName];
        delete (newPlatforms as any)[oldName];
      }
      return { ...w, platforms: newPlatforms };
    }));
    setVisiblePlatforms(prev => sortKo(prev.map(p => p === oldName ? newName : p)));
  };

  const handleDeletePlatform = (platformNameToDelete: string) => {
    if (window.confirm(`정말로 '${platformNameToDelete}' 플랫폼을 삭제하시겠습니까? 모든 관련 데이터가 사라집니다.`)) {
      setPlatforms(sortKo(platforms.filter(p => p !== platformNameToDelete)));
      setVisiblePlatforms(sortKo(visiblePlatforms.filter(p => p !== platformNameToDelete)));
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
    setVisiblePlatforms(prev => {
      const next = checked ? [...prev, name] : prev.filter(p => p !== name);
      return sortKo(Array.from(new Set(next)));
    });
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

  // 날짜 유틸: 'YYYY-MM-DD' 또는 임의 문자열을 'M/D'로 표시
  const formatMonthDay = (v?: string): string => {
    if (!v) return '';
    if (/^\d{1,2}[./-]\d{1,2}$/.test(v)) {
      const [m, d] = v.split(/[./-]/);
      return `${Number(m)}/${Number(d)}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const [y, m, d] = v.split('-').map(Number);
      if (!isNaN(m) && !isNaN(d)) return `${m}/${d}`;
    }
    try {
      const dt = new Date(v);
      if (!isNaN(dt.getTime())) return `${dt.getMonth() + 1}/${dt.getDate()}`;
    } catch {}
    return v;
  };

  const editCommonDate = async (title: string, field: 'open' | 'due', episode: number, current?: string) => {
    const currentMd = formatMonthDay(current || '');
    const input = window.prompt('월/일로 입력 (예: 4/28). 비우면 삭제됩니다.', currentMd);
    if (input === null) return;
    const raw = input.trim();
    const match = raw.match(/^(\d{1,2})[./-](\d{1,2})$/);
    const value = match ? `${Number(match[1])}/${Number(match[2])}` : '';
    if (field === 'open') {
      updateLocalCommonOpen(title, episode, value);
    } else {
      updateLocalCommonDue(title, episode, value);
    }
    await saveCommonField(title, field, episode, value);
  };

  return (
    <div className="bg-white p-1 sm:p-2 rounded-lg">
      <div className="flex justify-end mb-4">
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button onClick={() => setActiveMode('launch')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeMode === 'launch' ? 'text-white shadow' : 'text-gray-600 hover:text-gray-800'}`} style={activeMode === 'launch' ? { backgroundColor: '#00529b' } : {}}>런칭</button>
          {/* 납품 전용 탭 */}
          <button onClick={openDeliveryModal} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeMode === 'delivery' ? 'text-white shadow' : 'text-gray-600 hover:text-gray-800'}`} style={activeMode === 'delivery' ? { backgroundColor: '#00529b' } : {}}>납품</button>
          <button onClick={() => setActiveMode('submission')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeMode === 'submission' ? 'text-white shadow' : 'text-gray-600 hover:text-gray-800'}`} style={activeMode === 'submission' ? { backgroundColor: '#00529b' } : {}}>투고정보</button>
          <button onClick={() => setActiveMode('upload')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeMode === 'upload' ? 'text-white shadow' : 'text-gray-600 hover:text-gray-800'}`} style={activeMode === 'upload' ? { backgroundColor: '#00529b' } : {}}>업로드 정보</button>
        </div>
      </div>

      {/* 납품 전용 탭 콘텐츠 */}
      {activeMode === 'delivery' && (
        <div className="mb-3 p-3 border rounded-xl bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">납품 목록</h3>
            <div />
          </div>
          <div className="flex items-center gap-2 mb-3">
            {(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const).map(d => (
              <button key={d} onClick={() => refreshDeliveryTitles(d)} className={`px-2 py-1 rounded border text-sm ${deliveryModalDay===d? 'bg-blue-600 text-white border-blue-600':'bg-white text-slate-700 border-slate-300'}`}>{dayLabel[d]}</button>
            ))}
          </div>
          <div className="max-h-[60vh] overflow-y-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2 w-[28%]">작품명</th>
                  <th className="text-left px-3 py-2 w-[12%]">완성회차</th>
                  <th className="text-left px-3 py-2">런칭 플랫폼 / 납품회차</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingDelivery ? (
                  <tr><td className="px-3 py-6 text-center text-slate-500" colSpan={3}>불러오는 중...</td></tr>
                ) : deliveryDetails.length === 0 ? (
                  <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={3}>선택한 요일에 해당하는 작품이 없습니다.</td></tr>
                ) : deliveryDetails.map((row, i) => (
                  <tr key={i} className={i%2===0? 'bg-white':'bg-slate-50'}>
                    <td className="px-3 py-2 font-medium align-top">
                      <button
                        className="text-left text-primary-blue hover:underline"
                        onClick={() => {
                          const pid = syncProjects?.find(p => p.title === row.title)?.id;
                          if (pid && onJumpToSchedule) onJumpToSchedule(pid);
                        }}
                        title="일정 탭으로 이동"
                      >
                        {row.title}
                      </button>
                    </td>
                    <td className="px-3 py-2 align-top">{typeof row.completedCount === 'number' ? `${row.completedCount}화` : '-'}</td>
                    <td className="px-3 py-2">
                      {row.platforms.length === 0 ? (
                        <div className="text-slate-500">런칭된 플랫폼이 없습니다.</div>
                      ) : (
                        <div className="space-y-3">
                          {row.platforms.map(p => (
                            <div key={p.platformId}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 text-xs">{p.name}</span>
                              </div>
                              {/* 회차 그리드 */}
                              <div className="flex flex-wrap gap-1">
                                {Array.from({ length: Math.max(0, (row.totalEpisodes || 0)) || Math.max(0, (row.completedCount || 0)) }).map((_, idx) => {
                                  const ep = idx + 1;
                                  const checked = !!(p.deliveredEpisodes && p.deliveredEpisodes[ep]);
                                  return (
                                    <button
                                      key={ep}
                                      className={`w-[28px] h-[28px] rounded text-[11px] border ${checked ? 'bg-green-500 text-white border-green-600' : 'bg-white text-slate-700 border-slate-300'}`}
                                      onClick={() => { updateLocalEpisode(row.title, p.platformId, ep, !checked); void toggleEpisode(row.title, p.platformId, ep, !checked);} }
                                      title={`${ep}화 ${checked ? '납품됨' : '미납품'}`}
                                    >
                                      {ep}
                                    </button>
                                  );
                                })}
                              </div>
                              {/* 회차별 납품 예정일 입력 (공통) */}
                              {p === row.platforms[0] && (
                                <div className="mt-2">
                                  <div className="grid grid-cols-[120px_repeat(12,minmax(24px,1fr))] gap-y-1 items-center">
                                    {/* 헤더 회차 */}
                                    <div></div>
                                    {Array.from({ length: Math.max(0, (row.totalEpisodes || 0)) || Math.max(0, (row.completedCount || 0)) }).map((_, idx) => (
                                      <div key={`h-${idx}`} className="text-[11px] text-slate-600 text-center font-semibold">{idx+1}</div>
                                    ))}
                                    {/* 오픈 일자 */}
                                    <div className="text-xs text-slate-700 font-semibold px-1">오픈 일자</div>
                                    {Array.from({ length: Math.max(0, (row.totalEpisodes || 0)) || Math.max(0, (row.completedCount || 0)) }).map((_, idx) => {
                                      const ep = idx + 1;
                                      const value = (row.commonOpen && row.commonOpen[ep]) || '';
                                      return (
                                        <button
                                          key={`open-${ep}`}
                                          onClick={() => editCommonDate(row.title, 'open', ep, value)}
                                          className="text-[11px] px-1 py-1 rounded border text-slate-700 bg-white hover:bg-slate-50 w-[48px] justify-self-center"
                                          title={`${ep}화 오픈 일자`}
                                        >
                                          {formatMonthDay(value) || '—'}
                                        </button>
                                      );
                                    })}
                                    {/* 마감 일자 */}
                                    <div className="text-xs text-slate-700 font-semibold px-1">마감 일자</div>
                                    {Array.from({ length: Math.max(0, (row.totalEpisodes || 0)) || Math.max(0, (row.completedCount || 0)) }).map((_, idx) => {
                                      const ep = idx + 1;
                                      const value = (row.commonDue && row.commonDue[ep]) || '';
                                      return (
                                        <button
                                          key={`due-${ep}`}
                                          onClick={() => editCommonDate(row.title, 'due', ep, value)}
                                          className="text-[11px] px-1 py-1 rounded border text-slate-700 bg-white hover:bg-slate-50 w-[48px] justify-self-center"
                                          title={`${ep}화 마감 일자`}
                                        >
                                          {formatMonthDay(value) || '—'}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                  <select className="p-2.5 border rounded-md text-sm sm:text-base w-28" value={sortConfig.key} onChange={(e) => requestSort(e.target.value)}>
                    <option value="title">작품명</option>
                    <option value="launchStatus">런칭현황</option>
                    <option value="completedCount">완성회차</option>
                  </select>
                  <button className="px-2.5 py-2.5 border rounded-md text-sm sm:text-base whitespace-nowrap" onClick={() => requestSort(sortConfig.key)}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</button>
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-sm whitespace-nowrap">요일별:</label>
                  <select className="p-2.5 border rounded-md text-sm sm:text-base w-28" value={dayFilter} onChange={(e) => setDayFilter(e.target.value as any)}>
                    <option value="all">전체</option>
                    <option value="monday">월</option>
                    <option value="tuesday">화</option>
                    <option value="wednesday">수</option>
                    <option value="thursday">목</option>
                    <option value="friday">금</option>
                    <option value="saturday">토</option>
                    <option value="sunday">일</option>
                  </select>
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <label className="font-bold text-sm sm:text-base">플랫폼 필터:</label>
                <button onClick={() => setIsPlatformFilterExpanded(!isPlatformFilterExpanded)} className="text-xs sm:text-sm font-medium" style={{ color: '#00529b' }}>{isPlatformFilterExpanded ? '접기 ▲' : '펼치기 ▼'}</button>
              </div>
              {isPlatformFilterExpanded && (
                <div className="mt-1">
                  <div className="flex items-center gap-2 mb-1">
                    <button
                      onClick={() => setVisiblePlatforms(sortKo(platforms))}
                      className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50"
                      title="모든 플랫폼 표시"
                    >
                      전체선택
                    </button>
                    <button
                      onClick={() => setVisiblePlatforms([])}
                      className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50"
                      title="모든 플랫폼 숨김"
                    >
                      전체해제
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-x-2 sm:gap-x-4 gap-y-1 sm:gap-y-2 max-h-24 sm:max-h-32 overflow-y-auto">
                  {platforms.map(p => (
                    <label key={p} className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm">
                      <input type="checkbox" name={p} checked={visiblePlatforms.includes(p)} onChange={handlePlatformVisibilityChange} className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="whitespace-nowrap">{p}</span>
                    </label>
                  ))}
                  </div>
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

          <div className="overflow-x-hidden overflow-y-auto max-h-[70vh] border rounded-md mx-0">
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
                      <div className={`flex ${isEditMode ? 'flex-col items-start' : 'items-center'} gap-1 sm:gap-2`}>
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
                          <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                            <span>유통: {Object.values(webtoon.platforms).filter(value => value && typeof value === 'string' && (value as string).trim() !== '').length}/{visiblePlatforms.length}</span>
                            {webtoon.type.includes('라이브') && (() => {
                              const matched = syncProjects?.find(p => p.id === webtoon.id.replace('-domestic','').replace('-overseas',''));
                              const count = matched?.completedCount ?? undefined;
                              return typeof count === 'number' ? (<span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">완성 {count}화</span>) : null;
                            })()}
                          </div>
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
                      <EditableCell
                        key={`${webtoon.id}-${platform}`}
                        initialValue={webtoon.platforms[platform] || null}
                        onSave={(newValue) => handleCellUpdate(webtoon.id, platform, newValue)}
                        isEditable={true}
                      />
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

      {/* (모달 제거됨) */}
    </div>
  );
};

export default WebtoonTracker;


