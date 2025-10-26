// Utility script to import completed domestic projects from a CSV file
// Usage: node utils/importCompletedCsv.js "C:\\path\\to\\file.csv"

const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { 
  getFirestore, collection, query, where, getDocs, addDoc, doc, updateDoc 
} = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyBd2m4syJDiK6huffL0Rv5MX7PFnq8NUNs',
  authDomain: 'webtoon-production-tracker.firebaseapp.com',
  projectId: 'webtoon-production-tracker',
};

// Basic CSV parser with support for quotes and newlines inside quoted fields
function parseCsv(content) {
  const rows = [];
  let row = [''];
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === '\n' && !inQuotes) {
      rows.push(row);
      row = [''];
      continue;
    }
    if (ch === ',' && !inQuotes) {
      row.push('');
      continue;
    }
    row[row.length - 1] += ch;
  }
  if (row.length > 1 || (row[0] && row[0].trim() !== '')) rows.push(row);
  return rows;
}

function normalizeHeader(h) {
  return (h || '').replace(/\s+/g, '').replace('\uFEFF', '');
}

function detectStatus(value) {
  const v = (value || '').trim();
  if (!v) return null;
  if (/\d{1,2}\/\d{1,2}/.test(v) || v.includes('되어있음')) return 'launched';
  if (v.includes('대기')) return 'pending';
  if (v.includes('보류')) return 'rejected';
  return null;
}

const platformMap = {
  '픽미툰': 'pickme',
  '투믹스': 'toomics',
  '레진': 'lezhin',
  '무툰': 'muto',
  '미툰': 'muto2',
  '애니툰': 'anitoon',
  '큐툰': 'qtoon',
  '네이버시리즈': 'naver-series',
  '케이툰': 'ktoon',
  '블라이스': 'blice',
  '리디북스': 'ridibooks',
  '미스터블루': 'mrblue',
  '봄툰': 'bomtoon',
  '원스토리': 'onestory',
  '코미코': 'comico',
  '북큐브': 'bookcube',
  '만화365': 'manhwa365',
  '구루컴퍼니': 'guru-company',
  '왓챠': 'watcha',
  '북팔': 'bookpal',
  '올툰': 'alltoon',
  '교보E북': 'kyobo-ebook',
  '인터넷만화방': 'internet-manhwabang',
};

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('CSV 파일 경로를 인자로 전달하세요.');
    process.exit(1);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const rows = parseCsv(content);

  // 헤더 탐색 (첫 행에 줄바꿈 포함될 수 있음)
  let header = rows[0] || [];
  // 일부 파일은 헤더가 여러 줄로 나뉠 수 있으므로, "작품명"이 포함된 행을 우선 사용
  for (const r of rows) {
    if ((r[0] || '').includes('작품명')) { header = r; break; }
  }
  const colNames = header.map(c => normalizeHeader((c || '').trim()));

  // 데이터 행만 추출
  const dataRows = rows.filter(r => {
    const t = (r[0] || '').trim();
    if (!t || t === '작품명') return false;
    // 헤더 잔여 줄 제거
    if (t.includes('시리즈') || t.includes('미스터') || t.includes('인터넷')) return false;
    return true;
  });

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  let created = 0, updated = 0, statusCount = 0;

  for (const r of dataRows) {
    const title = (r[0] || '').trim();
    if (!title) continue;

    // 1) 프로젝트 업서트 (완결)
    const qSnap = await getDocs(query(collection(db, 'projects'), where('title', '==', title)));
    let projectId;
    if (qSnap.empty) {
      const docRef = await addDoc(collection(db, 'projects'), {
        title,
        type: 'general',
        team: '0팀',
        processes: [],
        episodeCount: 0,
        statuses: {},
        startEpisode: 1,
        hiddenEpisodes: [],
        hasGeneralCover: false,
        hasAdultCover: false,
        hasLogo: false,
        hasCharacterSheet: false,
        hasSynopsis: false,
        hasProposal: false,
        memo: '',
        lastModified: Date.now(),
        status: 'completed',
      });
      projectId = docRef.id; created++;
    } else {
      const d = qSnap.docs[0];
      projectId = d.id; updated++;
      const pd = d.data();
      if (pd.status !== 'completed') {
        await updateDoc(doc(db, 'projects', projectId), { status: 'completed', lastModified: Date.now() });
      }
    }

    // 2) launchProjects(국내비독점 [완결]) 존재 보장
    const lpSnap = await getDocs(query(
      collection(db, 'launchProjects'),
      where('projectId', '==', projectId),
      where('category', '==', '국내비독점 [완결]')
    ));
    if (lpSnap.empty) {
      await addDoc(collection(db, 'launchProjects'), {
        title, category: '국내비독점 [완결]', status: 'completed', projectId
      });
    }

    // 3) 플랫폼 상태 반영
    for (let ci = 1; ci < r.length && ci < colNames.length; ci++) {
      const headerName = colNames[ci];
      const platformId = platformMap[headerName];
      if (!platformId) continue;
      const st = detectStatus(r[ci]);
      if (!st) continue;
      const key = `${projectId}::국내비독점 [완결]::${platformId}`;
      const sSnap = await getDocs(query(collection(db, 'launchStatuses'), where('key', '==', key)));
      if (sSnap.empty) {
        await addDoc(collection(db, 'launchStatuses'), {
          key, projectId, platformId, category: '국내비독점 [완결]', status: st, timestamp: Date.now()
        });
      } else {
        await updateDoc(sSnap.docs[0].ref, { status: st, timestamp: Date.now() });
      }
      statusCount++;
    }
  }

  console.log(JSON.stringify({ created, updated, statusCount }));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


