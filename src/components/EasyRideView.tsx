import React, { useEffect, useRef, useState } from 'react';
import {
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  MapPin,
  MessageSquare,
  Mic,
  MicOff,
  Navigation,
  PhoneCall,
  Plus,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';
import {
  buildRideOffers,
  buildSosLinks,
  parseVoiceRideCommand,
  type RideProviderOffer,
} from '../data/presets';
import type {
  Coordinates,
  EmergencyContact,
  SavedPlace,
  VehicleType,
} from '../types';

interface EasyRideViewProps {
  places: SavedPlace[];
  coords: Coordinates | null;
  onRefreshLocation: () => Promise<Coordinates | null>;
  sosContact: EmergencyContact;
  onAddPlaceClick: () => void;
  onSetupSosClick: () => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionInstanceLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstanceLike;

const PLACES_PER_PAGE = 6;

function formatPlaceSubtitle(place: SavedPlace): string {
  if (place.shortcode) return place.shortcode;
  return 'Pinned GPS Location';
}

export const EasyRideView: React.FC<EasyRideViewProps> = ({
  places,
  coords,
  onRefreshLocation,
  sosContact,
  onAddPlaceClick,
  onSetupSosClick,
}) => {
  const [selectedPlace, setSelectedPlace] = useState<SavedPlace | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType | null>(null);
  const [page, setPage] = useState(0);
  const [gpsRefreshing, setGpsRefreshing] = useState(false);

  // Voice booking state
  const [listening, setListening] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState<string>('');
  const [voiceLaunchOffer, setVoiceLaunchOffer] = useState<RideProviderOffer | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const autoLaunchLinkRef = useRef<HTMLAnchorElement | null>(null);

  // Emergency modal state
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [sosBusy, setSosBusy] = useState(false);
  const [sosCoords, setSosCoords] = useState<Coordinates | null>(coords);
  const [lastSosPreparedAt, setLastSosPreparedAt] = useState<string | null>(null);
  const [copiedSosMessage, setCopiedSosMessage] = useState(false);

  const hasSosContact = Boolean(sosContact.name.trim() && sosContact.phone.trim());
  const totalPages = Math.max(1, Math.ceil(places.length / PLACES_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const visiblePlaces = places.slice(
    safePage * PLACES_PER_PAGE,
    safePage * PLACES_PER_PAGE + PLACES_PER_PAGE
  );

  // Keep selectedPlace synced or clear when switching profiles
  useEffect(() => {
    if (!selectedPlace) return;
    const updatedMatch = places.find((p) => p.id === selectedPlace.id);
    if (!updatedMatch) {
      setSelectedPlace(null);
      setSelectedVehicle(null);
      setVoiceLaunchOffer(null);
    } else if (updatedMatch !== selectedPlace) {
      setSelectedPlace(updatedMatch);
    }
  }, [places, selectedPlace]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore cleanup stop errors
      }
    };
  }, []);

  const handleManualGpsRefresh = async () => {
    setGpsRefreshing(true);
    await onRefreshLocation();
    setGpsRefreshing(false);
  };

  const handleSelectPlace = (place: SavedPlace) => {
    setVoiceLaunchOffer(null);
    setVoiceFeedback('');
    if (selectedPlace?.id === place.id) {
      setSelectedPlace(null);
      setSelectedVehicle(null);
      return;
    }
    setSelectedPlace(place);
    setSelectedVehicle(null);
  };

  const handleSelectVehicle = (vehicle: VehicleType) => {
    setSelectedVehicle(vehicle);
    setVoiceLaunchOffer(null);
  };

  const handleVoiceClick = () => {
    if (listening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore
      }
      setListening(false);
      return;
    }

    if (places.length === 0) {
      setVoiceFeedback('Save a place or name first before using voice booking.');
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      setVoiceFeedback('Voice booking is not supported in this browser.');
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = 'en-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 3;

      setListening(true);
      setVoiceLaunchOffer(null);
      setVoiceFeedback('Listening... say "Book Auto to [Name]" or "Book Cab to [Name]"');

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim() ?? '';
        setListening(false);

        if (!transcript) {
          setVoiceFeedback('Did not hear a destination. Please tap Voice and try again.');
          return;
        }

        const parsed = parseVoiceRideCommand(transcript, places);
        if (!parsed.place) {
          setVoiceFeedback(`Heard "${transcript}" — could not match a saved name.`);
          return;
        }

        setSelectedPlace(parsed.place);
        setSelectedVehicle(parsed.vehicle);

        const { offers: matchedOffers } = buildRideOffers(
          parsed.place,
          parsed.vehicle,
          coords
        );
        const chosenOffer =
          (parsed.providerId
            ? matchedOffers.find((o) => o.id === parsed.providerId)
            : undefined) ?? matchedOffers[0];

        if (chosenOffer) {
          setVoiceLaunchOffer(chosenOffer);
          setVoiceFeedback(
            `Heard "${transcript}" → Opening ${chosenOffer.name} (${chosenOffer.vehicleLabel}) to ${parsed.place.name}`
          );
          if (autoLaunchLinkRef.current) {
            autoLaunchLinkRef.current.href = chosenOffer.url;
            autoLaunchLinkRef.current.click();
          }
        }
      };

      recognition.onerror = () => {
        setListening(false);
        setVoiceFeedback('Could not capture voice. Please allow microphone access and try again.');
      };

      recognition.onend = () => {
        setListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setListening(false);
      setVoiceFeedback('Unable to start microphone.');
    }
  };

  const handleEmergencyClick = async () => {
    setEmergencyOpen(true);
    if (!hasSosContact) return;

    setSosBusy(true);
    const freshCoords = (await onRefreshLocation()) ?? coords;
    setSosCoords(freshCoords);
    setLastSosPreparedAt(new Date().toISOString());
    setSosBusy(false);
  };

  const handleCopySos = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSosMessage(true);
      setTimeout(() => setCopiedSosMessage(false), 2000);
    } catch {
      setCopiedSosMessage(false);
    }
  };

  const activeSosCoords = sosCoords ?? coords;
  const sosLinks = buildSosLinks(sosContact, activeSosCoords);
  const { offers, distanceKm } =
    selectedPlace && selectedVehicle
      ? buildRideOffers(selectedPlace, selectedVehicle, coords)
      : { offers: [], distanceKm: null };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2.5 overflow-hidden">
      {/* Hidden anchor for programmatic voice launch */}
      <a
        ref={autoLaunchLinkRef}
        href={voiceLaunchOffer?.url ?? '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      >
        Open Ride App
      </a>

      {/* Header Row: Prompt + GPS status + Top Voice Button + Emergency Button */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2.5">
        <div className="min-w-0 space-y-0.5">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#171A18] tracking-tight leading-tight text-balance">
            Where would you like to go?
          </h1>
          <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-[#4A524D] ${selectedPlace ? 'hidden sm:flex' : ''}`}>
            <span>
              {coords
                ? `GPS pickup ready${coords.accuracy ? ` (~${Math.round(coords.accuracy)}m accuracy)` : ''}`
                : 'Finding your GPS location...'}
            </span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={handleManualGpsRefresh}
              disabled={gpsRefreshing}
              className="text-[#1B4D3E] font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${gpsRefreshing ? 'animate-spin' : ''}`} />
              <span>{gpsRefreshing ? 'Calibrating...' : 'Refresh GPS'}</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {totalPages > 1 && !selectedPlace && (
            <div className="flex items-center gap-1 bg-white border border-[#DCD8CE] rounded-xl p-1">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                aria-label="Previous places"
                className="min-h-[38px] min-w-[38px] rounded-lg flex items-center justify-center disabled:opacity-40 hover:bg-[#F7F6F2] cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-mono-nums font-semibold px-1.5 text-[#3D4440]">
                {safePage + 1}/{totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                aria-label="Next places"
                className="min-h-[38px] min-w-[38px] rounded-lg flex items-center justify-center disabled:opacity-40 hover:bg-[#F7F6F2] cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleVoiceClick}
            className={`min-h-[48px] px-4 sm:px-5 py-2 rounded-xl font-bold text-base flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              listening
                ? 'bg-[#171A18] text-white'
                : 'bg-[#1B4D3E] hover:bg-[#143B2F] text-white'
            }`}
          >
            {listening ? (
              <>
                <MicOff className="w-5 h-5 shrink-0" />
                <span>Listening...</span>
              </>
            ) : (
              <>
                <Mic className="w-5 h-5 shrink-0" />
                <span>Voice</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleEmergencyClick}
            className="min-h-[48px] px-4 sm:px-5 py-2 rounded-xl bg-[#B91C1C] hover:bg-[#991B1B] active:scale-[0.98] text-white font-bold text-base flex items-center gap-2 transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>Emergency</span>
          </button>
        </div>
      </div>

      {/* Compact Voice Feedback / Fallback Open App Bar */}
      {voiceFeedback && (
        <div className="shrink-0 bg-[#EEF5F2] border border-[#1B4D3E] rounded-xl px-4 py-2.5 flex items-center justify-between gap-2 text-sm">
          <span className="text-[#171A18] font-medium truncate">{voiceFeedback}</span>
          <div className="flex items-center gap-2 shrink-0">
            {voiceLaunchOffer && (
              <a
                href={voiceLaunchOffer.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`min-h-[38px] px-3.5 rounded-lg ${voiceLaunchOffer.accentBg} ${voiceLaunchOffer.accentText} text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap`}
              >
                <span>Open {voiceLaunchOffer.name}</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                setVoiceFeedback('');
                setVoiceLaunchOffer(null);
              }}
              aria-label="Dismiss voice message"
              className="min-h-[38px] min-w-[38px] rounded-lg flex items-center justify-center text-[#171A18] hover:bg-white/70 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content — All In-Place on One Screen */}
      {places.length === 0 ? (
        <div className="flex-1 bg-white border border-[#DCD8CE] rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center gap-3">
          <p className="font-display text-2xl sm:text-3xl font-semibold text-[#171A18]">
            No saved places yet
          </p>
          <p className="text-base text-[#4A524D] max-w-md leading-relaxed">
            Tap <strong>Add Places / Names</strong> below to save places like Home, Hospital, or Temple, or ask a Family Assist member to add them for you.
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col gap-2.5 sm:gap-3 overflow-hidden">
          {/* Saved Names Strip / Grid */}
          <div
            className={
              selectedPlace
                ? 'shrink-0 flex items-stretch gap-2 overflow-x-auto pb-0.5'
                : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 content-start overflow-y-auto'
            }
          >
            {(selectedPlace ? places : visiblePlaces).map((place) => {
              const isSelected = selectedPlace?.id === place.id;
              const subtitle = formatPlaceSubtitle(place);
              return (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => handleSelectPlace(place)}
                  className={`text-left rounded-2xl border transition-colors active:scale-[0.99] cursor-pointer ${
                    selectedPlace
                      ? `shrink-0 min-w-[140px] max-w-[220px] px-3.5 py-2.5 ${
                          isSelected
                            ? 'bg-[#EEF5F2] border-2 border-[#1B4D3E]'
                            : 'bg-white border-[#DCD8CE] hover:border-[#1B4D3E]'
                        }`
                      : 'bg-white border-[#DCD8CE] hover:border-[#1B4D3E] hover:bg-[#FAF9F6] p-5 min-h-[116px] flex flex-col justify-between gap-2.5'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    {place.shortcode ? (
                      <div className="text-xs sm:text-sm font-mono-nums font-semibold text-[#1B4D3E] truncate">
                        {place.shortcode}
                      </div>
                    ) : null}
                    <h3
                      className={`font-display font-semibold text-[#171A18] truncate ${
                        selectedPlace ? 'text-lg' : 'text-2xl'
                      }`}
                    >
                      {place.name}
                    </h3>
                  </div>

                  {!selectedPlace && (
                    <div className="flex items-center gap-1.5 text-sm text-[#3D4440]">
                      <MapPin className="w-4 h-4 text-[#1B4D3E] shrink-0" />
                      <span className="truncate font-mono-nums">{subtitle}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Inline Ride Booking & Direct App Launch Panel */}
          {selectedPlace && (
            <section
              aria-label="Book a ride"
              className="flex-1 min-h-0 bg-white border border-[#DCD8CE] rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3 overflow-hidden"
            >
              {/* Route Header */}
              <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-[#E2DFD7] shrink-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#171A18]">
                      Ride to {selectedPlace.name}
                    </h2>
                    {distanceKm !== null && (
                      <span className="text-sm font-mono-nums font-semibold text-[#1B4D3E]">
                        · ~{distanceKm} km
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#4A524D] truncate">
                    From <strong className="text-[#171A18]">Current Location</strong> →{' '}
                    <strong className="text-[#171A18]">
                      {selectedPlace.shortcode || selectedPlace.name}
                    </strong>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedPlace(null);
                    setSelectedVehicle(null);
                    setVoiceLaunchOffer(null);
                  }}
                  aria-label="Change destination"
                  className="min-h-[42px] px-3.5 rounded-xl bg-[#F7F6F2] hover:bg-[#EEECE6] border border-[#DCD8CE] text-sm font-semibold text-[#171A18] shrink-0 whitespace-nowrap cursor-pointer"
                >
                  Change Place
                </button>
              </div>

              {/* Auto or Cab Selection */}
              <div className="grid grid-cols-2 gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSelectVehicle('auto')}
                  className={`min-h-[64px] sm:min-h-[72px] px-4 py-2.5 rounded-2xl border-2 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                    selectedVehicle === 'auto'
                      ? 'border-[#1B4D3E] bg-[#EEF5F2]'
                      : 'border-[#DCD8CE] bg-white hover:border-[#1B4D3E]'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="block font-display text-lg sm:text-xl font-semibold text-[#171A18]">
                      Auto
                    </span>
                    <span className="block text-xs sm:text-sm text-[#4A524D] truncate">
                      {selectedVehicle === 'auto' ? 'Selected · 3-wheeler' : '3-wheeler rickshaw'}
                    </span>
                  </div>
                  {selectedVehicle === 'auto' ? (
                    <Check className="w-6 h-6 text-[#1B4D3E] shrink-0" />
                  ) : (
                    <Navigation className="w-5 h-5 text-[#4A524D] shrink-0" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectVehicle('cab')}
                  className={`min-h-[64px] sm:min-h-[72px] px-4 py-2.5 rounded-2xl border-2 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                    selectedVehicle === 'cab'
                      ? 'border-[#1B4D3E] bg-[#EEF5F2]'
                      : 'border-[#DCD8CE] bg-white hover:border-[#1B4D3E]'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="block font-display text-lg sm:text-xl font-semibold text-[#171A18]">
                      Cab
                    </span>
                    <span className="block text-xs sm:text-sm text-[#4A524D] truncate">
                      {selectedVehicle === 'cab' ? 'Selected · AC car' : 'Air-conditioned car'}
                    </span>
                  </div>
                  {selectedVehicle === 'cab' ? (
                    <Check className="w-6 h-6 text-[#1B4D3E] shrink-0" />
                  ) : (
                    <Car className="w-5 h-5 text-[#4A524D] shrink-0" />
                  )}
                </button>
              </div>

              {/* Rides & Direct Prepopulated App Launch Links */}
              <div className="flex-1 min-h-0 flex flex-col justify-end gap-2">
                {!selectedVehicle ? (
                  <div className="bg-[#F7F6F2] rounded-xl p-5 text-center text-sm sm:text-base text-[#3D4440]">
                    Tap <strong>Auto</strong> or <strong>Cab</strong> above to see rides and estimated prices.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {offers.map((offer) => (
                      <div
                        key={offer.id}
                        className="border border-[#DCD8CE] rounded-2xl p-3 sm:p-4 bg-[#FAF9F6] flex flex-col justify-between gap-2.5"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-baseline justify-between gap-1">
                            <h3 className="font-display text-base sm:text-lg font-semibold text-[#171A18] truncate">
                              {offer.name}
                            </h3>
                            <span className="text-xs text-[#4A524D] whitespace-nowrap">
                              {offer.etaText}
                            </span>
                          </div>
                          <div className="font-mono-nums text-base sm:text-lg font-bold text-[#1B4D3E] truncate">
                            {offer.priceRange}
                          </div>
                          <p className="text-xs text-[#4A524D] truncate">
                            {offer.vehicleLabel}
                          </p>
                        </div>

                        <a
                          href={offer.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`w-full min-h-[44px] px-3 rounded-xl ${offer.accentBg} ${offer.accentText} text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap`}
                        >
                          <span>Book Here</span>
                          <ExternalLink className="w-4 h-4 shrink-0" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Quiet bottom shortcut to Add Places */}
      <div className="shrink-0 flex items-center justify-center">
        <button
          type="button"
          onClick={onAddPlaceClick}
          className="min-h-[44px] px-5 py-2 rounded-xl bg-white border border-[#DCD8CE] hover:border-[#1B4D3E] text-sm sm:text-base font-semibold text-[#171A18] inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#1B4D3E]" />
          <span>Add Places / Names</span>
        </button>
      </div>

      {/* Emergency Dialog */}
      {emergencyOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Emergency Actions"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border-2 border-[#B91C1C] rounded-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xl sm:text-2xl font-bold text-[#991B1B]">
                  {hasSosContact
                    ? `Emergency Contact: ${sosContact.name}`
                    : 'No Emergency Contact Set'}
                </p>
                {hasSosContact ? (
                  <p className="text-sm sm:text-base text-[#3D4440]">
                    Number: <span className="font-mono-nums font-semibold">{sosContact.phone}</span>
                    {sosBusy
                      ? ' · Updating exact GPS...'
                      : activeSosCoords
                      ? ' · Calibrated GPS attached'
                      : ''}
                    {lastSosPreparedAt && !sosBusy
                      ? ` · ${new Date(lastSosPreparedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}`
                      : ''}
                  </p>
                ) : (
                  <p className="text-sm sm:text-base text-[#3D4440]">
                    Save an Emergency (SOS) phone number under <strong>Add Places → SOS Contact</strong> so one tap calls and shares your exact location.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEmergencyOpen(false)}
                aria-label="Close Emergency dialog"
                className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-[#171A18] hover:bg-[#F7F6F2] cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {hasSosContact ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <a
                    href={sosLinks.telUrl}
                    className="min-h-[64px] px-5 py-3.5 rounded-xl bg-[#B91C1C] hover:bg-[#991B1B] text-white font-bold text-lg flex items-center justify-center gap-2.5"
                  >
                    <PhoneCall className="w-6 h-6 shrink-0" />
                    <span>Call {sosContact.name}</span>
                  </a>

                  <a
                    href={sosLinks.smsUrl}
                    className="min-h-[64px] px-5 py-3.5 rounded-xl bg-[#171A18] hover:bg-[#2C312E] text-white font-bold text-lg flex items-center justify-center gap-2.5"
                  >
                    <MessageSquare className="w-6 h-6 shrink-0" />
                    <span>Send Location SMS</span>
                  </a>

                  <a
                    href={sosLinks.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[54px] px-5 py-3 rounded-xl bg-[#1B4D3E] hover:bg-[#143B2F] text-white font-semibold text-base flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-5 h-5 shrink-0" />
                    <span>Send on WhatsApp</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => handleCopySos(sosLinks.message)}
                    className="min-h-[54px] px-5 py-3 rounded-xl border border-[#D4D0C5] hover:bg-[#F7F6F2] text-base font-semibold text-[#171A18] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {copiedSosMessage ? (
                      <>
                        <Check className="w-5 h-5 text-[#1B4D3E]" />
                        <span>Message Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-5 h-5" />
                        <span>Copy Message</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-sm text-[#4A524D] bg-[#F7F6F2] rounded-xl p-3.5 break-words">
                  {sosLinks.message}
                </p>
              </>
            ) : (
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEmergencyOpen(false)}
                  className="min-h-[48px] px-5 rounded-xl border border-[#DCD8CE] text-base font-semibold cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmergencyOpen(false);
                    onSetupSosClick();
                  }}
                  className="min-h-[48px] px-5 rounded-xl bg-[#1B4D3E] hover:bg-[#143B2F] text-white text-base font-semibold cursor-pointer"
                >
                  Set Up SOS Contact
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
