import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBd2m4syJDiK6huffL0Rv5MX7PFnq8NUNs",
  authDomain: "webtoon-production-tracker.firebaseapp.com",
  projectId: "webtoon-production-tracker",
  storageBucket: "webtoon-production-tracker.appspot.com",
  messagingSenderId: "414177034332",
  appId: "1:414177034332:web:b46b4baee8c3843a0f6699",
  measurementId: "G-4L62QGNLBP"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };
