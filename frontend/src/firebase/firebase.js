// src/firebase/firebase.js
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCnAGZ0aoEtRNJACBlCSrpKZtwhpZlh9HY",
  authDomain: "sampaguitadeselva.firebaseapp.com",
  projectId: "sampaguitadeselva",
  storageBucket: "sampaguitadeselva.firebasestorage.app",
  messagingSenderId: "109127839177",
  appId: "1:109127839177:web:5e8f7cda1ba855baf1cc18",
  measurementId: "G-6B8RYB56J5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Auth & Provider
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { auth, provider };
