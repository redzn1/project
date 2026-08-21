import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  User as FirebaseUserInstance,
} from 'firebase/auth';
import {
  getDatabase,
  ref as rtdbRef,
  set as rtdbSet,
  get as rtdbGet,
  child as rtdbChild,
  update as rtdbUpdate,
} from 'firebase/database';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import { Conversation } from '../types';

// ------------------------------------------
// FIREBASE CONFIGURATION (OFFICIAL PROJECT)
// ------------------------------------------
export const firebaseConfig = {
  apiKey: "AIzaSyDDxB77qLsX2BD6Y0v7JRppPg0V6-m0vfc",
  authDomain: "redzdev.my.id",
  databaseURL: "https://wers-app-d921c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "wers-app-d921c",
  storageBucket: "wers-app-d921c.firebasestorage.app",
  messagingSenderId: "972359834610",
  appId: "1:972359834610:web:f8ef2b41940b66ffb9a96b",
  measurementId: "G-80WE4WL8Z3"
};

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Services
export const auth = getAuth(app);
export const rtdb = getDatabase(app);
export const firestore = getFirestore(app);

// Enforce Persistent Authentication in LocalStorage to eliminate relog loops
try {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('[Firebase] Persistence set warning:', err);
  });
} catch (e) {
  // Safe browser fallback
}

export { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut };

// Helper to sanitize keys for RTDB (replace illegal chars like . # $ [ ])
export const sanitizeKey = (key: string): string => {
  return key.trim().toLowerCase().replace(/[.#$[\]/]/g, '_');
};

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  createdAt: number;
  lastLogin: number;
  photoURL?: string;
  isDev?: boolean;
}

export const DEV_EMAIL = 'dev@lynxie.ai';
export const DEV_PASSWORD = 'DevLAI';

// ------------------------------------------
// 1. SIGNUP: AUTH + RTDB + FIRESTORE
// ------------------------------------------
export async function registerWithFirebase(params: {
  name: string;
  email: string;
  password: string;
}): Promise<AppUser> {
  const { name, email, password } = params;
  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();

  // 1. Create Firebase Auth user
  const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
  const firebaseUser = userCredential.user;

  // 2. Update display name in Auth profile
  try {
    await updateProfile(firebaseUser, {
      displayName: trimmedName,
    });
  } catch (profileErr) {
    console.warn('Could not update Auth profile displayName:', profileErr);
  }

  const now = Date.now();
  const isDevUser = trimmedEmail === DEV_EMAIL;
  const userData = {
    uid: firebaseUser.uid,
    name: trimmedName,
    name_lower: trimmedName.toLowerCase(),
    email: trimmedEmail,
    createdAt: now,
    lastLogin: now,
    isDev: isDevUser,
  };

  // 3. Write User Record to Realtime Database
  try {
    const userDbRef = rtdbRef(rtdb, `users/${firebaseUser.uid}`);
    await rtdbSet(userDbRef, userData);

    // Save index mapping by email and name for quick lookup
    const safeEmailKey = sanitizeKey(trimmedEmail);
    const emailMapRef = rtdbRef(rtdb, `indexes/email_to_uid/${safeEmailKey}`);
    await rtdbSet(emailMapRef, { uid: firebaseUser.uid, name: trimmedName });

    const safeNameKey = sanitizeKey(trimmedName);
    const nameMapRef = rtdbRef(rtdb, `indexes/name_to_uid/${safeNameKey}`);
    await rtdbSet(nameMapRef, { uid: firebaseUser.uid, email: trimmedEmail });
  } catch (rtdbErr) {
    console.warn('[Firebase RTDB] write error during signup:', rtdbErr);
  }

  // 4. Also backup to Cloud Firestore
  try {
    const userDocRef = doc(firestore, 'users', firebaseUser.uid);
    await setDoc(userDocRef, userData, { merge: true });
  } catch (fsErr) {
    console.warn('[Firestore] write error during signup:', fsErr);
  }

  const appUser: AppUser = {
    uid: firebaseUser.uid,
    name: trimmedName,
    email: trimmedEmail,
    createdAt: now,
    lastLogin: now,
    isDev: isDevUser,
  };

  try {
    localStorage.setItem('lynxiee_ai_user_v1', JSON.stringify(appUser));
  } catch {}

  return appUser;
}

// ------------------------------------------
// 2. LOGIN: SUPPORTS EMAIL OR NAME + PASSWORD
// ------------------------------------------
export async function loginWithFirebase(params: {
  identifier: string; // Email or Name
  password: string;
}): Promise<AppUser> {
  const { identifier, password } = params;
  const rawId = identifier.trim();

  // Developer Fast-Pass
  if (rawId.toLowerCase() === DEV_EMAIL && password === DEV_PASSWORD) {
    const devUser: AppUser = {
      uid: 'dev_master_uid',
      name: 'Lead Developer',
      email: DEV_EMAIL,
      createdAt: 1700000000000,
      lastLogin: Date.now(),
      isDev: true,
    };
    try {
      localStorage.setItem('lynxiee_ai_user_v1', JSON.stringify(devUser));
      localStorage.setItem('lynxiee_dev_auth', 'true');
    } catch {}
    return devUser;
  }

  let resolvedEmail = rawId.toLowerCase();

  // Check if identifier is a Username instead of Email
  if (!rawId.includes('@')) {
    const safeName = sanitizeKey(rawId);
    try {
      const dbRef = rtdbRef(rtdb);
      const snapshot = await rtdbGet(rtdbChild(dbRef, `indexes/name_to_uid/${safeName}`));
      if (snapshot.exists()) {
        const val = snapshot.val();
        if (val && val.email) {
          resolvedEmail = val.email;
        }
      }
    } catch (lookupErr) {
      console.warn('RTDB name lookup error:', lookupErr);
    }
  }

  // Sign in to Firebase Auth
  const userCredential = await signInWithEmailAndPassword(auth, resolvedEmail, password);
  const firebaseUser = userCredential.user;

  // Retrieve user metadata from RTDB or Firestore
  let displayName = firebaseUser.displayName || rawId;
  let createdAt = firebaseUser.metadata.creationTime
    ? new Date(firebaseUser.metadata.creationTime).getTime()
    : Date.now();

  try {
    const dbRef = rtdbRef(rtdb);
    const snap = await rtdbGet(rtdbChild(dbRef, `users/${firebaseUser.uid}`));
    if (snap.exists()) {
      const data = snap.val();
      if (data.name) displayName = data.name;
      if (data.createdAt) createdAt = data.createdAt;
      // update last login in RTDB
      await rtdbUpdate(rtdbChild(dbRef, `users/${firebaseUser.uid}`), {
        lastLogin: Date.now(),
      });
    }
  } catch (err) {
    console.warn('Could not sync last login to RTDB:', err);
  }

  const isDev = resolvedEmail === DEV_EMAIL;

  const appUser: AppUser = {
    uid: firebaseUser.uid,
    name: displayName,
    email: firebaseUser.email || resolvedEmail,
    createdAt,
    lastLogin: Date.now(),
    isDev,
  };

  try {
    localStorage.setItem('lynxiee_ai_user_v1', JSON.stringify(appUser));
    if (isDev) {
      localStorage.setItem('lynxiee_dev_auth', 'true');
    }
  } catch {}

  return appUser;
}

// ------------------------------------------
// 3. LOGOUT: CLEARS SESSIONS & CACHE
// ------------------------------------------
export async function logoutFirebase(): Promise<void> {
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('Firebase signOut error:', err);
  }
  try {
    localStorage.removeItem('lynxiee_ai_user_v1');
    localStorage.removeItem('lynxiee_dev_auth');
  } catch {}
}

// ------------------------------------------
// 4. CLOUD CONVERSATIONS BACKUP (RTDB + FIRESTORE)
// ------------------------------------------
export async function syncConversationsToCloud(
  userId: string,
  conversations: Conversation[]
): Promise<void> {
  if (!userId || !conversations) return;

  const sanitizedList = conversations.map((c) => ({
    id: c.id,
    title: c.title || 'New Conversation',
    createdAt: c.createdAt || Date.now(),
    updatedAt: c.updatedAt || Date.now(),
    pinned: Boolean(c.pinned),
    messages: (c.messages || []).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content || '',
      timestamp: m.timestamp || Date.now(),
      model: m.model || '',
      responseTimeMs: m.responseTimeMs || 0,
      error: Boolean(m.error),
    })),
  }));

  // Sync to RTDB
  try {
    const userChatsRef = rtdbRef(rtdb, `user_chats/${userId}`);
    await rtdbSet(userChatsRef, {
      conversations: sanitizedList,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.warn('[Firebase RTDB] Chat sync warning:', err);
  }

  // Backup to Firestore
  try {
    const userChatsDoc = doc(firestore, 'user_chats', userId);
    await setDoc(
      userChatsDoc,
      {
        conversations: sanitizedList,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  } catch (fsErr) {
    console.warn('[Firestore] Chat sync warning:', fsErr);
  }
}

export async function loadCloudConversations(
  userId: string
): Promise<Conversation[] | null> {
  if (!userId) return null;

  try {
    const dbRef = rtdbRef(rtdb);
    const snap = await rtdbGet(rtdbChild(dbRef, `user_chats/${userId}`));
    if (snap.exists()) {
      const data = snap.val();
      if (data && Array.isArray(data.conversations)) {
        return data.conversations;
      }
    }
  } catch (err) {
    console.warn('[Firebase RTDB] Chat load warning:', err);
  }

  // Fallback to Firestore
  try {
    const userChatsDoc = doc(firestore, 'user_chats', userId);
    const docSnap = await getDoc(userChatsDoc);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && Array.isArray(data.conversations)) {
        return data.conversations as Conversation[];
      }
    }
  } catch (fsErr) {
    console.warn('[Firestore] Chat load warning:', fsErr);
  }

  return null;
}
