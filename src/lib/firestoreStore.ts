import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  AssistMember,
  ElderProfile,
  EmergencyContact,
  SavedPlace,
  SharedElderAccount,
} from '../types';
import { auth, db, type User } from './firebaseAuth';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function formatFirestoreUserMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  let inner = raw;
  try {
    const parsed = JSON.parse(raw) as { error?: string };
    if (parsed && typeof parsed.error === 'string') {
      inner = parsed.error;
    }
  } catch {
    // Plain error message
  }

  if (inner.includes("Quota exceeded for quota metric 'Free daily read units per project (free tier database)'")) {
    const dbUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;
    return `Daily free Firebase read quota reached. Quota resets tomorrow, or open your database console: ${dbUrl}`;
  }
  if (inner.includes('Quota exceeded')) {
    return 'Daily free Firebase Firestore quota reached. Your quota resets tomorrow.';
  }
  if (inner.includes('Missing or insufficient permissions')) {
    return 'Could not access this profile right now. Please sign out and sign in again, or verify your Gmail access.';
  }
  return inner;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function sanitizeString(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

export async function testFirestoreConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export async function ensureOwnProfile(user: User): Promise<void> {
  const path = `profiles/${user.uid}`;
  const ref = doc(db, 'profiles', user.uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const emailLower = sanitizeString((user.email || '').toLowerCase(), 200);
      const displayName = sanitizeString(
        user.displayName || emailLower.split('@')[0] || 'My Profile',
        100
      );
      await setDoc(ref, {
        ownerId: user.uid,
        ownerName: displayName || 'My Profile',
        ownerEmail: emailLower,
        sosName: '',
        sosRelationship: '',
        sosPhone: '',
        assistEmails: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToProfile(
  profileId: string,
  onData: (profileMeta: Omit<ElderProfile, 'places' | 'assists'> | null) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `profiles/${profileId}`;
  const ref = doc(db, 'profiles', profileId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const d = snap.data();
      onData({
        id: snap.id,
        ownerId: String(d.ownerId || ''),
        ownerName: String(d.ownerName || 'My Profile'),
        ownerEmail: String(d.ownerEmail || ''),
        assistEmails: Array.isArray(d.assistEmails)
          ? d.assistEmails.filter((e): e is string => typeof e === 'string')
          : [],
        sosContact: {
          name: String(d.sosName || ''),
          relationship: String(d.sosRelationship || ''),
          phone: String(d.sosPhone || ''),
        },
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeToPlaces(
  profileId: string,
  viewerUid: string,
  viewerEmailLower: string,
  isOwner: boolean,
  onData: (places: SavedPlace[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `profiles/${profileId}/places`;
  const col = collection(db, 'profiles', profileId, 'places');
  const q = isOwner
    ? query(col, where('ownerId', '==', viewerUid))
    : query(col, where('assistEmails', 'array-contains', viewerEmailLower));

  return onSnapshot(
    q,
    (snap) => {
      const items: SavedPlace[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          name: String(d.name || ''),
          shortcode: d.shortcode ? String(d.shortcode) : undefined,
          lat: typeof d.lat === 'number' ? d.lat : undefined,
          lng: typeof d.lng === 'number' ? d.lng : undefined,
          addedBy: d.addedBy ? String(d.addedBy) : undefined,
          createdAt: toIsoString(d.createdAt),
        };
      });
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeToAssists(
  profileId: string,
  viewerUid: string,
  viewerEmailLower: string,
  isOwner: boolean,
  onData: (assists: AssistMember[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `profiles/${profileId}/assists`;
  const col = collection(db, 'profiles', profileId, 'assists');
  const q = isOwner
    ? query(col, where('ownerId', '==', viewerUid))
    : query(col, where('assistEmails', 'array-contains', viewerEmailLower));

  return onSnapshot(
    q,
    (snap) => {
      const items: AssistMember[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          name: String(d.name || ''),
          email: String(d.email || ''),
          relationship: String(d.relationship || 'Family Caregiver'),
          phone: d.phone ? String(d.phone) : undefined,
          isSos: Boolean(d.isSos),
          createdAt: toIsoString(d.createdAt),
        };
      });
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeToSharedElderAccounts(
  viewerEmailLower: string,
  ownUid: string,
  onData: (accounts: SharedElderAccount[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'profiles';
  const q = query(
    collection(db, 'profiles'),
    where('assistEmails', 'array-contains', viewerEmailLower)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: SharedElderAccount[] = [];
      for (const docSnap of snap.docs) {
        if (docSnap.id === ownUid) continue;
        const d = docSnap.data();
        list.push({
          profileId: docSnap.id,
          ownerName: String(d.ownerName || 'Elder Account'),
          ownerEmail: d.ownerEmail ? String(d.ownerEmail) : undefined,
        });
      }
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function createPlace(
  profile: ElderProfile,
  payload: {
    name: string;
    shortcode?: string;
    lat?: number;
    lng?: number;
    addedBy?: string;
  }
): Promise<void> {
  const placeId = `place-${Date.now()}`;
  const path = `profiles/${profile.id}/places/${placeId}`;
  const data: Record<string, unknown> = {
    profileId: profile.id,
    ownerId: profile.ownerId,
    assistEmails: profile.assistEmails.slice(0, 10),
    name: sanitizeString(payload.name, 80),
    shortcode: sanitizeString((payload.shortcode || '').toUpperCase(), 16),
    addedBy: sanitizeString(payload.addedBy || '', 100),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (typeof payload.lat === 'number' && typeof payload.lng === 'number') {
    data.lat = payload.lat;
    data.lng = payload.lng;
  }
  try {
    await setDoc(doc(db, 'profiles', profile.id, 'places', placeId), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updatePlace(
  profileId: string,
  placeId: string,
  payload: {
    name: string;
    shortcode?: string;
    lat?: number;
    lng?: number;
  }
): Promise<void> {
  const path = `profiles/${profileId}/places/${placeId}`;
  const data: Record<string, unknown> = {
    name: sanitizeString(payload.name, 80),
    shortcode: sanitizeString((payload.shortcode || '').toUpperCase(), 16),
    updatedAt: serverTimestamp(),
  };
  if (typeof payload.lat === 'number' && typeof payload.lng === 'number') {
    data.lat = payload.lat;
    data.lng = payload.lng;
  }
  try {
    await updateDoc(doc(db, 'profiles', profileId, 'places', placeId), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deletePlace(profileId: string, placeId: string): Promise<void> {
  const path = `profiles/${profileId}/places/${placeId}`;
  try {
    await deleteDoc(doc(db, 'profiles', profileId, 'places', placeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateSosContact(
  profileId: string,
  contact: EmergencyContact
): Promise<void> {
  const path = `profiles/${profileId}`;
  try {
    await updateDoc(doc(db, 'profiles', profileId), {
      sosName: sanitizeString(contact.name, 100),
      sosRelationship: sanitizeString(contact.relationship || 'Emergency Contact', 80),
      sosPhone: sanitizeString(contact.phone, 30),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addAssistMember(
  profile: ElderProfile,
  payload: {
    name: string;
    email: string;
    relationship: string;
    phone?: string;
    isSos?: boolean;
  }
): Promise<void> {
  const cleanEmail = sanitizeString(payload.email.toLowerCase(), 200);
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please enter a valid Gmail address.');
  }
  if (cleanEmail === profile.ownerEmail.toLowerCase()) {
    throw new Error('You already own this profile.');
  }
  if (profile.assistEmails.includes(cleanEmail)) {
    throw new Error(`${cleanEmail} is already added as a caregiver.`);
  }
  if (profile.assistEmails.length >= 10) {
    throw new Error('Maximum of 10 caregivers reached per profile.');
  }

  const nextEmails = [...profile.assistEmails, cleanEmail];
  const assistId = `assist-${Date.now()}`;
  const cleanPhone = sanitizeString((payload.phone || '').replace(/[^\d+]/g, ''), 30);
  const cleanName = sanitizeString(payload.name, 100);
  const cleanRelation = sanitizeString(payload.relationship || 'Family Caregiver', 80);

  const path = `profiles/${profile.id}/assists/${assistId}`;
  try {
    const [placesSnap, assistsSnap] = await Promise.all([
      getDocs(query(collection(db, 'profiles', profile.id, 'places'), where('ownerId', '==', profile.ownerId))),
      getDocs(query(collection(db, 'profiles', profile.id, 'assists'), where('ownerId', '==', profile.ownerId))),
    ]);

    const batch = writeBatch(db);
    const profilePatch: Record<string, unknown> = {
      assistEmails: nextEmails,
      updatedAt: serverTimestamp(),
    };
    if (payload.isSos && cleanPhone) {
      profilePatch.sosName = cleanName;
      profilePatch.sosRelationship = cleanRelation;
      profilePatch.sosPhone = cleanPhone;
    }
    batch.update(doc(db, 'profiles', profile.id), profilePatch);

    for (const pDoc of placesSnap.docs) {
      batch.update(pDoc.ref, {
        assistEmails: nextEmails,
        updatedAt: serverTimestamp(),
      });
    }
    for (const aDoc of assistsSnap.docs) {
      const patch: Record<string, unknown> = {
        assistEmails: nextEmails,
        updatedAt: serverTimestamp(),
      };
      if (payload.isSos) {
        patch.isSos = false;
      }
      batch.update(aDoc.ref, patch);
    }

    batch.set(doc(db, 'profiles', profile.id, 'assists', assistId), {
      profileId: profile.id,
      ownerId: profile.ownerId,
      assistEmails: nextEmails,
      name: cleanName,
      email: cleanEmail,
      relationship: cleanRelation,
      phone: cleanPhone,
      isSos: Boolean(payload.isSos && cleanPhone),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeAssistMember(
  profile: ElderProfile,
  assist: AssistMember
): Promise<void> {
  const nextEmails = profile.assistEmails.filter((e) => e !== assist.email.toLowerCase());
  const path = `profiles/${profile.id}/assists/${assist.id}`;
  try {
    const [placesSnap, assistsSnap] = await Promise.all([
      getDocs(query(collection(db, 'profiles', profile.id, 'places'), where('ownerId', '==', profile.ownerId))),
      getDocs(query(collection(db, 'profiles', profile.id, 'assists'), where('ownerId', '==', profile.ownerId))),
    ]);

    const batch = writeBatch(db);
    const profilePatch: Record<string, unknown> = {
      assistEmails: nextEmails,
      updatedAt: serverTimestamp(),
    };
    if (assist.isSos) {
      profilePatch.sosName = '';
      profilePatch.sosRelationship = '';
      profilePatch.sosPhone = '';
    }
    batch.update(doc(db, 'profiles', profile.id), profilePatch);

    batch.delete(doc(db, 'profiles', profile.id, 'assists', assist.id));

    for (const pDoc of placesSnap.docs) {
      batch.update(pDoc.ref, {
        assistEmails: nextEmails,
        updatedAt: serverTimestamp(),
      });
    }
    for (const aDoc of assistsSnap.docs) {
      if (aDoc.id !== assist.id) {
        batch.update(aDoc.ref, {
          assistEmails: nextEmails,
          updatedAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
