import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export const initAuth = (
  onAuthenticated: (user: User) => void,
  onSignedOut: () => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      onAuthenticated(user);
    } else {
      onSignedOut();
    }
  });
};

export const googleSignIn = async (): Promise<User> => {
  const result = await signInWithPopup(auth, provider);
  return result.user;
};

export const logout = async (): Promise<void> => {
  await signOut(auth);
};

export type { User };
