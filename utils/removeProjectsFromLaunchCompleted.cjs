const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, deleteDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyBd2m4syJDiK6huffL0Rv5MX7PFnq8NUNs',
  authDomain: 'webtoon-production-tracker.firebaseapp.com',
  projectId: 'webtoon-production-tracker',
};

(async function(){
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  // Fetch launchProjects marked as completed (both domestic and overseas)
  const categories = ['국내비독점 [완결]', '해외비독점 [완결]'];
  const titles = new Set();
  for (const cat of categories) {
    const qSnap = await getDocs(query(collection(db, 'launchProjects'), where('category','==', cat)));
    qSnap.forEach(d => { const t = (d.data().title || '').trim(); if (t) titles.add(t); });
  }
  let checked = 0, deleted = 0;
  for (const title of titles) {
    const pSnap = await getDocs(query(collection(db, 'projects'), where('title','==', title)));
    checked += pSnap.size;
    for (const d of pSnap.docs) { await deleteDoc(d.ref); deleted++; }
  }
  console.log(JSON.stringify({ titles: titles.size, matched: checked, deleted }));
})().catch(err => { console.error(err); process.exit(1); });


