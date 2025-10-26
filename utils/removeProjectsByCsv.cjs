const fs = require('fs');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, deleteDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyBd2m4syJDiK6huffL0Rv5MX7PFnq8NUNs',
  authDomain: 'webtoon-production-tracker.firebaseapp.com',
  projectId: 'webtoon-production-tracker',
};

function parseCsv(content){
  const rows=[]; let row=['']; let inQuotes=false;
  for(let i=0;i<content.length;i++){
    const ch=content[i];
    if(ch==='"'){ inQuotes=!inQuotes; continue; }
    if(ch==='\n' && !inQuotes){ rows.push(row); row=['']; continue; }
    if(ch===',' && !inQuotes){ row.push(''); continue; }
    row[row.length-1]+=ch;
  }
  if(row.length>1 || (row[0]&&row[0].trim()!=='')) rows.push(row);
  return rows;
}

(async function(){
  const csvPath = process.argv[2] || 'import.csv';
  const rows = parseCsv(fs.readFileSync(csvPath,'utf8'));
  // collect titles (skip header rows)
  const titles = rows
    .map(r => (r[0]||'').trim())
    .filter(t => t && t !== '작품명' && !t.includes('시리즈') && !t.includes('미스터') && !t.includes('인터넷'));

  const app = initializeApp(firebaseConfig); const db = getFirestore(app);
  let deleted = 0; let checked = 0;
  for(const title of titles){
    const qSnap = await getDocs(query(collection(db,'projects'), where('title','==', title)));
    checked += qSnap.size;
    for(const d of qSnap.docs){
      await deleteDoc(d.ref);
      deleted++;
    }
  }
  console.log(JSON.stringify({titles: titles.length, matched: checked, deleted}));
})().catch(err=>{ console.error(err); process.exit(1); });


