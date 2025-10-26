const fs = require('fs');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, query, where, getDocs, updateDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyBd2m4syJDiK6huffL0Rv5MX7PFnq8NUNs',
  authDomain: 'webtoon-production-tracker.firebaseapp.com',
  projectId: 'webtoon-production-tracker',
};

function parseCsv(content){
  const rows=[]; let row=['']; let inQuotes=false;
  for(let i=0;i<content.length;i++){ const ch=content[i];
    if(ch==='"'){ inQuotes=!inQuotes; continue; }
    if(ch==='\n' && !inQuotes){ rows.push(row); row=['']; continue; }
    if(ch===',' && !inQuotes){ row.push(''); continue; }
    row[row.length-1]+=ch;
  }
  if(row.length>1 || (row[0]&&row[0].trim()!=='')) rows.push(row);
  return rows;
}
const normalizeHeader = h => (h||'').replace(/\s+/g,'').replace('\uFEFF','');
const detectStatus = v => { const s=(v||'').trim(); if(!s) return null; if(/\d{1,2}\/\d{1,2}/.test(s)||s.includes('되어있음')) return 'launched'; if(s.includes('대기')) return 'pending'; if(s.includes('보류')) return 'rejected'; return null; };
const platformMap = {'픽미툰':'pickme','투믹스':'toomics','레진':'lezhin','무툰':'muto','미툰':'muto2','애니툰':'anitoon','큐툰':'qtoon','네이버시리즈':'naver-series','케이툰':'ktoon','블라이스':'blice','리디북스':'ridibooks','미스터블루':'mrblue','봄툰':'bomtoon','원스토리':'onestory','코미코':'comico','북큐브':'bookcube','만화365':'manhwa365','구루컴퍼니':'guru-company','왓챠':'watcha','북팔':'bookpal','올툰':'alltoon','교보E북':'kyobo-ebook','인터넷만화방':'internet-manhwabang'};

(async function(){
  const csvPath = process.argv[2];
  if(!csvPath){ console.error('CSV 경로 필요'); process.exit(1); }
  const rows = parseCsv(fs.readFileSync(csvPath,'utf8'));
  let header = rows.find(r => (r[0]||'').includes('작품명')) || rows[0] || [];
  const colNames = header.map(c => normalizeHeader((c||'').trim()));
  const dataRows = rows.filter(r=>{ const t=(r[0]||'').trim(); if(!t||t==='작품명') return false; if(t.includes('시리즈')||t.includes('미스터')||t.includes('인터넷')) return false; return true; });
  const app = initializeApp(firebaseConfig); const db = getFirestore(app);
  let launchCreated=0, statusUpserts=0;
  for(const r of dataRows){ const title=(r[0]||'').trim(); if(!title) continue;
    const lpQ = await getDocs(query(collection(db,'launchProjects'), where('title','==', title), where('category','==','국내비독점 [완결]')));
    let lpId; if(lpQ.empty){ const docRef=await addDoc(collection(db,'launchProjects'), { title, category:'국내비독점 [완결]', status:'completed' }); lpId=docRef.id; launchCreated++; } else { lpId=lpQ.docs[0].id; await updateDoc(lpQ.docs[0].ref, { status:'completed' }); }
    for(let ci=1; ci<r.length && ci<colNames.length; ci++){ const platId = platformMap[colNames[ci]]; if(!platId) continue; const st=detectStatus(r[ci]); if(!st) continue; const key=`${lpId}::국내비독점 [완결]::${platId}`; const lsQ = await getDocs(query(collection(db,'launchStatuses'), where('key','==', key))); if(lsQ.empty){ await addDoc(collection(db,'launchStatuses'), { key, projectId: lpId, platformId: platId, category:'국내비독점 [완결]', status: st, timestamp: Date.now() }); } else { await updateDoc(lsQ.docs[0].ref, { status: st, timestamp: Date.now() }); } statusUpserts++; }
  }
  console.log(JSON.stringify({launchCreated, statusUpserts}));
})().catch(err=>{ console.error(err); process.exit(1); });


