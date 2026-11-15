import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Compass, LogOut, MapPinned, Users, WifiOff } from 'lucide-react';
import { EasyRideView } from './components/EasyRideView';
import { GoogleSignInGate } from './components/GoogleSignInGate';
import { PWAInstallButton } from './components/PWAInstallButton';
import { useOnlineStatus } from './hooks/usePWAInstall';

const SavedPlacesView = lazy(() =>
  import('./components/SavedPlacesView').then((m) => ({ default: m.SavedPlacesView }))
);
const FamilyAssistView = lazy(() =>
  import('./components/FamilyAssistView').then((m) => ({ default: m.FamilyAssistView }))
);
import { googleSignIn, initAuth, logout, type User } from './lib/firebaseAuth';
import {
  addAssistMember,
  createPlace,
  deletePlace,
  ensureOwnProfile,
  formatFirestoreUserMessage,
  removeAssistMember,
  subscribeToAssists,
  subscribeToPlaces,
  subscribeToProfile,
  subscribeToSharedElderAccounts,
  testFirestoreConnection,
  updatePlace,
  updateSosContact,
} from './lib/firestoreStore';
import { calibratePreciseLocation } from './lib/preciseLocation';
import type {
  AssistMember,
  Coordinates,
  ElderProfile,
  EmergencyContact,
  SavedPlace,
  SharedElderAccount,
} from './types';

type TabKey = 'ride' | 'places' | 'assist';

const EMPTY_PROFILE: ElderProfile = {
  id: '',
  ownerId: '',
  ownerName: 'My Profile',
  ownerEmail: '',
  assistEmails: [],
  places: [],
  sosContact: { name: '', relationship: '', phone: '' },
  assists: [],
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('ride');
  const [placesInitialTab, setPlacesInitialTab] = useState<'place' | 'sos'>('place');
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');

  const [ownOwnerName, setOwnOwnerName] = useState('My Profile');
  const [activeProfileId, setActiveProfileId] = useState('');
  const [activeProfileMeta, setActiveProfileMeta] = useState<
    Omit<ElderProfile, 'places' | 'assists'>
  >({
    id: '',
    ownerId: '',
    ownerName: 'My Profile',
    ownerEmail: '',
    assistEmails: [],
    sosContact: { name: '', relationship: '', phone: '' },
  });
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [assists, setAssists] = useState<AssistMember[]>([]);
  const [elderAccounts, setElderAccounts] = useState<SharedElderAccount[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const [coords, setCoords] = useState<Coordinates | null>(null);
  const isOnline = useOnlineStatus();

  const refreshLocation = useCallback(async (): Promise<Coordinates | null> => {
    const calibrated = await calibratePreciseLocation((progress) => {
      setCoords(progress.coords);
    });
    if (calibrated) {
      setCoords(calibrated);
    }
    return calibrated;
  }, []);

  // Boot: test Firestore connection, warm GPS, and attach Firebase Auth listener
  useEffect(() => {
    testFirestoreConnection();
    refreshLocation();

    let watchId: number | null = null;
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setCoords((prev) => {
            const nextLat = pos.coords.latitude;
            const nextLng = pos.coords.longitude;
            const nextAcc = pos.coords.accuracy;
            if (prev) {
              const movedEnough =
                Math.abs(nextLat - prev.lat) > 0.00008 ||
                Math.abs(nextLng - prev.lng) > 0.00008;
              const prevAcc = prev.accuracy ?? 999;
              const improvedEnough = nextAcc < prevAcc * 0.85;
              if (!movedEnough && !improvedEnough) {
                return prev;
              }
              if (nextAcc > prevAcc * 1.25) {
                return prev;
              }
            }
            return {
              lat: nextLat,
              lng: nextLng,
              accuracy: nextAcc,
              calibrated: nextAcc <= 30,
            };
          });
        },
        () => {
          // Non-blocking background watch
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );
    }

    const unsub = initAuth(
      async (user) => {
        setAuthUser(user);
        setAuthError('');
        setLoadingProfile(true);
        try {
          await ensureOwnProfile(user);
          setOwnOwnerName(
            user.displayName || user.email?.split('@')[0] || 'My Profile'
          );
          setActiveProfileId((prev) => prev || user.uid);
        } catch (err) {
          setAuthError(formatFirestoreUserMessage(err));
        } finally {
          setLoadingProfile(false);
          setAuthReady(true);
        }
      },
      () => {
        setAuthUser(null);
        setAuthReady(true);
        setLoadingProfile(false);
        setActiveProfileId('');
        setActiveProfileMeta(EMPTY_PROFILE);
        setPlaces([]);
        setAssists([]);
        setElderAccounts([]);
      }
    );

    return () => {
      unsub();
      if (watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [refreshLocation]);

  // Real-time subscription to shared elder accounts for this user's Gmail
  useEffect(() => {
    if (!authReady || !authUser?.email) return;
    const emailLower = authUser.email.toLowerCase();
    const unsubShared = subscribeToSharedElderAccounts(
      emailLower,
      authUser.uid,
      (accounts) => {
        setElderAccounts(accounts);
      },
      (err) => {
        setAuthError(formatFirestoreUserMessage(err));
      }
    );
    return () => unsubShared();
  }, [authReady, authUser]);

  // Real-time subscriptions for the currently selected profile, places, and assists
  useEffect(() => {
    if (!authReady || !authUser || !activeProfileId) return;

    const emailLower = (authUser.email || '').toLowerCase();
    const isOwner = activeProfileId === authUser.uid;
    setLoadingProfile(true);

    const handleSubError = (err: Error) => {
      setAuthError(formatFirestoreUserMessage(err));
      setLoadingProfile(false);
    };

    const unsubProfile = subscribeToProfile(
      activeProfileId,
      (meta) => {
        if (!meta) {
          // Fallback to own profile if shared profile was removed/revoked
          if (!isOwner) {
            setActiveProfileId(authUser.uid);
          }
          setLoadingProfile(false);
          return;
        }
        setActiveProfileMeta(meta);
        if (meta.id === authUser.uid) {
          setOwnOwnerName(meta.ownerName);
        }
        setLoadingProfile(false);
      },
      handleSubError
    );

    const unsubPlaces = subscribeToPlaces(
      activeProfileId,
      authUser.uid,
      emailLower,
      isOwner,
      (nextPlaces) => setPlaces(nextPlaces),
      handleSubError
    );

    const unsubAssists = subscribeToAssists(
      activeProfileId,
      authUser.uid,
      emailLower,
      isOwner,
      (nextAssists) => setAssists(nextAssists),
      handleSubError
    );

    return () => {
      unsubProfile();
      unsubPlaces();
      unsubAssists();
    };
  }, [activeProfileId, authReady, authUser]);

  const handleGoogleLogin = async () => {
    setAuthBusy(true);
    setAuthError('');
    try {
      await googleSignIn();
    } catch (err) {
      setAuthError(formatFirestoreUserMessage(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setActiveTab('ride');
  };

  const activeProfile: ElderProfile = useMemo(
    () => ({
      ...activeProfileMeta,
      places,
      assists,
    }),
    [activeProfileMeta, places, assists]
  );

  const ownProfileId = authUser?.uid || '';
  const isAssistingOther = Boolean(
    ownProfileId && activeProfileId && activeProfileId !== ownProfileId
  );

  const runFirestoreAction = useCallback(async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      throw new Error(formatFirestoreUserMessage(err));
    }
  }, []);

  const handleCreatePlace = useCallback(
    async (payload: {
      name: string;
      shortcode?: string;
      lat?: number;
      lng?: number;
      addedBy?: string;
    }) => {
      if (!activeProfile.id) return;
      await runFirestoreAction(() =>
        createPlace(activeProfile, {
          ...payload,
          addedBy:
            payload.addedBy ||
            (isAssistingOther
              ? authUser?.displayName || authUser?.email || 'Caregiver'
              : ''),
        })
      );
    },
    [activeProfile, authUser, isAssistingOther, runFirestoreAction]
  );

  const handleUpdatePlace = useCallback(
    async (
      placeId: string,
      payload: {
        name: string;
        shortcode?: string;
        lat?: number;
        lng?: number;
      }
    ) => {
      if (!activeProfile.id) return;
      await runFirestoreAction(() => updatePlace(activeProfile.id, placeId, payload));
    },
    [activeProfile.id, runFirestoreAction]
  );

  const handleDeletePlace = useCallback(
    async (placeId: string) => {
      if (!activeProfile.id) return;
      await runFirestoreAction(() => deletePlace(activeProfile.id, placeId));
    },
    [activeProfile.id, runFirestoreAction]
  );

  const handleUpdateSosContact = useCallback(
    async (contact: EmergencyContact) => {
      if (!activeProfile.id) return;
      await runFirestoreAction(() => updateSosContact(activeProfile.id, contact));
    },
    [activeProfile.id, runFirestoreAction]
  );

  const handleAddAssist = useCallback(
    async (payload: {
      name: string;
      email: string;
      relationship: string;
    }) => {
      if (!activeProfile.id) return;
      await runFirestoreAction(() => addAssistMember(activeProfile, payload));
    },
    [activeProfile, runFirestoreAction]
  );

  const handleRemoveAssist = useCallback(
    async (assist: AssistMember) => {
      if (!activeProfile.id) return;
      await runFirestoreAction(() => removeAssistMember(activeProfile, assist));
    },
    [activeProfile, runFirestoreAction]
  );

  const needsAuth = authReady && !authUser;

  return (
    <div className="min-h-[100dvh] lg:h-[100dvh] flex flex-col lg:overflow-hidden bg-[#F7F6F2] text-[#171A18]">
      {/* Top Bar */}
      <header className="shrink-0 bg-[#F7F6F2] border-b border-[#E2DFD7]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3 sm:gap-8">
          <a
            href="#ride"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('ride');
            }}
            className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-[#171A18] whitespace-nowrap shrink-0"
          >
            EasyTap Ride
          </a>

          {authUser && (
            <nav className="hidden md:flex items-center gap-7 text-base font-medium text-[#4A524D]">
              <button
                type="button"
                onClick={() => setActiveTab('ride')}
                className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  activeTab === 'ride'
                    ? 'text-[#171A18] font-semibold underline underline-offset-8 decoration-2 decoration-[#1B4D3E]'
                    : 'hover:text-[#171A18]'
                }`}
              >
                Easy Ride
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('places')}
                className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  activeTab === 'places'
                    ? 'text-[#171A18] font-semibold underline underline-offset-8 decoration-2 decoration-[#1B4D3E]'
                    : 'hover:text-[#171A18]'
                }`}
              >
                Add Places
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('assist')}
                className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  activeTab === 'assist'
                    ? 'text-[#171A18] font-semibold underline underline-offset-8 decoration-2 decoration-[#1B4D3E]'
                    : 'hover:text-[#171A18]'
                }`}
              >
                Family Assist
              </button>
            </nav>
          )}

          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton />
            {authUser && (
              <button
                type="button"
                onClick={handleSignOut}
                aria-label="Sign out"
                title={authUser.email || 'Sign out'}
                className="min-h-[40px] px-3 rounded-xl border border-[#DCD8CE] bg-white hover:border-[#B91C1C] text-[#171A18] text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Single-Screen Workspace */}
      <main className="flex-1 min-h-0 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 pb-20 md:pb-4 flex flex-col gap-2.5 lg:overflow-hidden">
        {!isOnline && (
          <div className="shrink-0 bg-[#FEF3C7] border border-[#D97706] rounded-xl px-4 py-2 flex items-center gap-2 text-sm font-medium text-[#92400E]">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>Offline — Showing cached names and emergency contact.</span>
          </div>
        )}

        {/* Caregiver Multi-Elder Switcher Strip when linked to >= 1 elder account */}
        {authUser && elderAccounts.length > 0 && (
          <div className="shrink-0 bg-[#EEF5F2] border border-[#1B4D3E] rounded-xl px-3.5 py-2 flex items-center justify-between gap-2 overflow-x-auto">
            <span className="text-sm font-semibold text-[#1B4D3E] whitespace-nowrap shrink-0">
              {isAssistingOther
                ? `Assisting: ${activeProfile.ownerName}`
                : 'Viewing: My Profile'}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveProfileId(ownProfileId)}
                className={`min-h-[36px] px-3 rounded-lg text-sm font-semibold whitespace-nowrap cursor-pointer ${
                  !isAssistingOther
                    ? 'bg-[#1B4D3E] text-white'
                    : 'bg-white border border-[#DCD8CE] text-[#171A18]'
                }`}
              >
                My Profile
              </button>
              {elderAccounts.map((elder) => (
                <button
                  key={elder.profileId}
                  type="button"
                  onClick={() => setActiveProfileId(elder.profileId)}
                  className={`min-h-[36px] px-3 rounded-lg text-sm font-semibold whitespace-nowrap cursor-pointer ${
                    activeProfileId === elder.profileId
                      ? 'bg-[#1B4D3E] text-white'
                      : 'bg-white border border-[#DCD8CE] text-[#171A18]'
                  }`}
                >
                  {elder.ownerName}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col lg:overflow-hidden">
          {!authReady || (authUser && loadingProfile && !activeProfile.id) ? (
            <div className="bg-white border border-[#DCD8CE] rounded-2xl p-6 text-base text-[#4A524D]">
              Loading your profile...
            </div>
          ) : needsAuth ? (
            <GoogleSignInGate
              loading={authBusy}
              error={authError}
              onSignIn={handleGoogleLogin}
            />
          ) : (
            <>
              {authError && (
                <div className="shrink-0 mb-2 bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-4 py-2.5 text-sm font-medium text-[#B91C1C] break-words">
                  {authError}
                </div>
              )}

              {activeTab === 'ride' && (
                <EasyRideView
                  places={activeProfile.places}
                  coords={coords}
                  onRefreshLocation={refreshLocation}
                  sosContact={activeProfile.sosContact}
                  onAddPlaceClick={() => {
                    setPlacesInitialTab('place');
                    setActiveTab('places');
                  }}
                  onSetupSosClick={() => {
                    setPlacesInitialTab('sos');
                    setActiveTab('places');
                  }}
                />
              )}

              {(activeTab === 'places' || activeTab === 'assist') && (
                <Suspense
                  fallback={
                    <div className="bg-white border border-[#DCD8CE] rounded-2xl p-6 text-base text-[#4A524D]">
                      Loading...
                    </div>
                  }
                >
                  {activeTab === 'places' && (
                    <SavedPlacesView
                      ownerName={activeProfile.ownerName}
                      assistName={
                        isAssistingOther
                          ? authUser?.displayName || authUser?.email || 'Caregiver'
                          : undefined
                      }
                      initialTab={placesInitialTab}
                      places={activeProfile.places}
                      sosContact={activeProfile.sosContact}
                      onRefreshLocation={refreshLocation}
                      onCreatePlace={handleCreatePlace}
                      onUpdatePlace={handleUpdatePlace}
                      onDeletePlace={handleDeletePlace}
                      onUpdateSosContact={handleUpdateSosContact}
                    />
                  )}

                  {activeTab === 'assist' && (
                    <FamilyAssistView
                      ownProfileId={ownProfileId}
                      ownOwnerName={ownOwnerName}
                      activeProfileId={activeProfile.id}
                      activeOwnerName={activeProfile.ownerName}
                      assists={activeProfile.assists}
                      elderAccounts={elderAccounts}
                      onSelectAccount={(id) => setActiveProfileId(id)}
                      onAddAssist={handleAddAssist}
                      onRemoveAssist={handleRemoveAssist}
                      onGoToAddPlaces={() => {
                        setPlacesInitialTab('place');
                        setActiveTab('places');
                      }}
                    />
                  )}
                </Suspense>
              )}
            </>
          )}
        </div>
      </main>

      {/* Compact Mobile Bottom Navigation */}
      {authUser && (
        <nav
          aria-label="Mobile navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E2DFD7] grid grid-cols-3 h-15"
        >
          <button
            type="button"
            onClick={() => setActiveTab('ride')}
            className={`flex flex-col items-center justify-center gap-0.5 text-xs font-semibold cursor-pointer ${
              activeTab === 'ride' ? 'text-[#1B4D3E]' : 'text-[#4A524D]'
            }`}
          >
            <Compass className="w-5 h-5" />
            <span>Easy Ride</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('places')}
            className={`flex flex-col items-center justify-center gap-0.5 text-xs font-semibold cursor-pointer ${
              activeTab === 'places' ? 'text-[#1B4D3E]' : 'text-[#4A524D]'
            }`}
          >
            <MapPinned className="w-5 h-5" />
            <span>Add Places</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('assist')}
            className={`flex flex-col items-center justify-center gap-0.5 text-xs font-semibold cursor-pointer ${
              activeTab === 'assist' ? 'text-[#1B4D3E]' : 'text-[#4A524D]'
            }`}
          >
            <Users className="w-5 h-5" />
            <span>Assist</span>
          </button>
        </nav>
      )}
    </div>
  );
}
