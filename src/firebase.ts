import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCP_6GRpO1-YA6xErDmkdr77msBJeiKqsI",
  authDomain: "gen-lang-client-0267435184.firebaseapp.com",
  projectId: "gen-lang-client-0267435184",
  storageBucket: "gen-lang-client-0267435184.firebasestorage.app",
  messagingSenderId: "187515911432",
  appId: "1:187515911432:web:80c37ea11e7257877280bd"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const db = getFirestore(app, "ai-studio-coachingconnect-7956778d-ae2f-4574-b119-d4af956d4e5e");

const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider };
