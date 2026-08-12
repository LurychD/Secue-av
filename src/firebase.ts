/**
 * Secue - Inicialización de Firebase
 * SPDX-License-Identifier: AGPL-3.0
 */

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";

// Intentamos cargar la configuración de Firebase de variables de entorno de Vite o valores locales de prueba
const firebaseConfig = {
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY || "AIzaSyFakeKey_SecueProductionAV_2026",
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN || "secue-av.firebaseapp.com",
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID || "secue-av",
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET || "secue-av.firebasestorage.app",
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID || "1:1234567890:web:abcdef123456"
};

export const app = initializeApp(firebaseConfig);

// Base de datos Firestore personalizada secue-db
const dbId = (import.meta as any).env.VITE_FIREBASE_DATABASE_ID || "secue-main-db";
export const db = getFirestore(app, dbId);

export const storage = getStorage(app);
export const auth = getAuth(app);

// Configurar persistencia local persistente de sesión en el navegador
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn("Fallo al establecer la persistencia de sesión de Firebase Auth:", err);
});
