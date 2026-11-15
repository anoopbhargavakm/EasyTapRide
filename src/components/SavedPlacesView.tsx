import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Navigation,
  Pencil,
  PhoneCall,
  Plus,
  Trash2,
} from 'lucide-react';
import type { Coordinates, EmergencyContact, SavedPlace } from '../types';

interface SavedPlacesViewProps {
  ownerName: string;
  assistName?: string;
  initialTab?: 'place' | 'sos';
  places: SavedPlace[];
  sosContact: EmergencyContact;
  onRefreshLocation: () => Promise<Coordinates | null>;
  onCreatePlace: (payload: {
    name: string;
    shortcode?: string;
    lat?: number;
    lng?: number;
    addedBy?: string;
  }) => Promise<void>;
  onUpdatePlace: (
    id: string,
    payload: {
      name: string;
      shortcode?: string;
      lat?: number;
      lng?: number;
    }
  ) => Promise<void>;
  onDeletePlace: (id: string) => Promise<void>;
  onUpdateSosContact: (contact: EmergencyContact) => Promise<void>;
}

const ITEMS_PER_PAGE = 4;

export const SavedPlacesView: React.FC<SavedPlacesViewProps> = ({
  ownerName,
  assistName,
  initialTab = 'place',
  places,
  sosContact,
  onRefreshLocation,
  onCreatePlace,
  onUpdatePlace,
  onDeletePlace,
  onUpdateSosContact,
}) => {
  const [leftTab, setLeftTab] = useState<'place' | 'sos'>(initialTab);
  const [page, setPage] = useState(0);

  const [name, setName] = useState('');
  const [shortcode, setShortcode] = useState('');
  const [pinLat, setPinLat] = useState<number | undefined>(undefined);
  const [pinLng, setPinLng] = useState<number | undefined>(undefined);
  const [pinAccuracy, setPinAccuracy] = useState<number | undefined>(undefined);
  const [locatingPin, setLocatingPin] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [error, setError] = useState('');

  // SOS contact form
  const [sosName, setSosName] = useState(sosContact.name);
  const [sosRelation, setSosRelation] = useState(sosContact.relationship);
  const [sosPhone, setSosPhone] = useState(sosContact.phone);
  const [sosSaving, setSosSaving] = useState(false);
  const [sosSavedMsg, setSosSavedMsg] = useState('');
  const [sosError, setSosError] = useState('');
  const placeSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sosSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (placeSavedTimerRef.current !== null) clearTimeout(placeSavedTimerRef.current);
      if (sosSavedTimerRef.current !== null) clearTimeout(sosSavedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setSosName(sosContact.name);
    setSosRelation(sosContact.relationship);
    setSosPhone(sosContact.phone);
  }, [sosContact]);

  useEffect(() => {
    setLeftTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setPage(0);
    setConfirmDeleteId(null);
  }, [ownerName]);

  const totalPages = Math.max(1, Math.ceil(places.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const visiblePlaces = places.slice(
    safePage * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE + ITEMS_PER_PAGE
  );

  const resetPlaceForm = () => {
    setName('');
    setShortcode('');
    setPinLat(undefined);
    setPinLng(undefined);
    setPinAccuracy(undefined);
    setEditingId(null);
    setError('');
  };

  const handleEditClick = (place: SavedPlace) => {
    setLeftTab('place');
    setEditingId(place.id);
    setConfirmDeleteId(null);
    setName(place.name);
    setShortcode(place.shortcode ?? '');
    setPinLat(place.lat);
    setPinLng(place.lng);
    setPinAccuracy(undefined);
    setSavedMsg('');
    setError('');
  };

  const handleUseCurrentGps = async () => {
    setLocatingPin(true);
    setError('');
    const current = await onRefreshLocation();
    setLocatingPin(false);
    if (!current) {
      setError('Could not read device location. Please enter a shortcode instead.');
      return;
    }
    setPinLat(current.lat);
    setPinLng(current.lng);
    setPinAccuracy(current.accuracy ? Math.round(current.accuracy) : undefined);
  };

  const handleSubmitPlace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || (!shortcode.trim() && typeof pinLat !== 'number')) {
      setError('Please enter a place name and shortcode (or tap Pin Current Location).');
      return;
    }
    setSaving(true);
    setError('');
    setSavedMsg('');
    const placeLabel = name.trim();
    try {
      if (editingId) {
        await onUpdatePlace(editingId, {
          name: placeLabel,
          shortcode: shortcode.trim().toUpperCase() || undefined,
          lat: pinLat,
          lng: pinLng,
        });
        setSavedMsg(`Updated "${placeLabel}".`);
      } else {
        await onCreatePlace({
          name: placeLabel,
          shortcode: shortcode.trim().toUpperCase() || undefined,
          lat: pinLat,
          lng: pinLng,
          addedBy: assistName,
        });
        setSavedMsg(`Saved "${placeLabel}" to ${ownerName}.`);
      }
      resetPlaceForm();
      if (placeSavedTimerRef.current !== null) clearTimeout(placeSavedTimerRef.current);
      placeSavedTimerRef.current = setTimeout(() => setSavedMsg(''), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save destination.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async (placeId: string) => {
    try {
      await onDeletePlace(placeId);
      setConfirmDeleteId(null);
      if (editingId === placeId) {
        resetPlaceForm();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete saved place.');
    }
  };

  const handleSaveSos = async (e: React.FormEvent) => {
    e.preventDefault();
    setSosError('');
    setSosSavedMsg('');
    setSosSaving(true);
    try {
      await onUpdateSosContact({
        name: sosName.trim(),
        relationship: sosRelation.trim() || 'Emergency Contact',
        phone: sosPhone.trim(),
      });
      setSosSavedMsg('Emergency contact saved.');
      if (sosSavedTimerRef.current !== null) clearTimeout(sosSavedTimerRef.current);
      sosSavedTimerRef.current = setTimeout(() => setSosSavedMsg(''), 3500);
    } catch (err) {
      setSosError(err instanceof Error ? err.message : 'Could not update emergency contact.');
    } finally {
      setSosSaving(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:overflow-hidden">
      {/* Left Panel: Tabbed Place Editor / SOS Contact */}
      <section className="lg:col-span-5 bg-white border border-[#DCD8CE] rounded-2xl p-4 sm:p-5 flex flex-col gap-3 min-w-0 lg:overflow-hidden">
        <div className="flex items-center gap-1 p-1 bg-[#F7F6F2] rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setLeftTab('place')}
            className={`flex-1 min-h-[42px] rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              leftTab === 'place' ? 'bg-white text-[#171A18] shadow-xs' : 'text-[#4A524D]'
            }`}
          >
            {editingId ? 'Edit Place' : 'Add Place / Name'}
          </button>
          <button
            type="button"
            onClick={() => setLeftTab('sos')}
            className={`flex-1 min-h-[42px] rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              leftTab === 'sos' ? 'bg-white text-[#171A18] shadow-xs' : 'text-[#4A524D]'
            }`}
          >
            SOS Contact
          </button>
        </div>

        {leftTab === 'place' ? (
          <form onSubmit={handleSubmitPlace} className="flex-1 min-h-0 flex flex-col justify-between gap-3 lg:overflow-y-auto">
            <div className="space-y-3 min-w-0">
              <p className="text-sm text-[#4A524D]">
                Saving to <strong className="text-[#171A18]">{ownerName}</strong>
              </p>

              <div className="min-w-0">
                <label className="block text-sm font-semibold text-[#171A18] mb-1">
                  Name on Card (e.g. Home, Hospital)
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full min-w-0 max-w-full box-border min-h-[48px] px-3.5 rounded-xl border border-[#D4D0C5] bg-[#F7F6F2] text-base text-[#171A18]"
                />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-1">
                  <label className="block text-sm font-semibold text-[#171A18]">
                    Plus Code / Shortcode
                  </label>
                  <button
                    type="button"
                    onClick={handleUseCurrentGps}
                    disabled={locatingPin}
                    className="min-h-[36px] px-1 text-sm font-semibold text-[#1B4D3E] hover:underline inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Navigation className="w-4 h-4 shrink-0" />
                    <span>{locatingPin ? 'Calibrating GPS...' : 'Pin Current Location'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  maxLength={16}
                  required={typeof pinLat !== 'number'}
                  value={shortcode}
                  onChange={(e) => setShortcode(e.target.value.toUpperCase())}
                  className="block w-full min-w-0 max-w-full box-border min-h-[48px] px-3.5 rounded-xl border border-[#D4D0C5] bg-[#F7F6F2] text-base font-mono-nums uppercase text-[#171A18]"
                />
                {typeof pinLat === 'number' && typeof pinLng === 'number' && (
                  <p className="mt-1.5 text-sm font-medium text-[#1B4D3E]">
                    GPS location pinned{pinAccuracy ? ` (~${pinAccuracy}m precision)` : ''}
                  </p>
                )}
              </div>

              {error && (
                <p className="text-sm font-medium text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-2.5">
                  {error}
                </p>
              )}
              {savedMsg && (
                <p className="text-sm font-medium text-[#1B4D3E] bg-[#EEF5F2] border border-[#1B4D3E]/30 rounded-xl p-2.5 inline-flex items-center gap-1.5 w-full">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{savedMsg}</span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1 shrink-0">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 min-h-[50px] px-4 rounded-xl bg-[#1B4D3E] hover:bg-[#143B2F] disabled:opacity-60 text-white font-semibold text-base flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-5 h-5" />
                <span>{saving ? 'Saving...' : editingId ? 'Save Changes' : 'Save Place'}</span>
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetPlaceForm}
                  className="min-h-[50px] px-4 rounded-xl border border-[#DCD8CE] text-base font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        ) : (
          <form onSubmit={handleSaveSos} className="flex-1 min-h-0 flex flex-col justify-between gap-3 lg:overflow-y-auto">
            <div className="space-y-3 min-w-0">
              <div className="min-w-0">
                <label className="block text-sm font-semibold text-[#171A18] mb-1">
                  Emergency Contact Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={sosName}
                  onChange={(e) => setSosName(e.target.value)}
                  className="block w-full min-w-0 max-w-full box-border min-h-[48px] px-3.5 rounded-xl border border-[#D4D0C5] bg-[#F7F6F2] text-base text-[#171A18]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="min-w-0">
                  <label className="block text-sm font-semibold text-[#171A18] mb-1">
                    Relationship
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={sosRelation}
                    onChange={(e) => setSosRelation(e.target.value)}
                    className="block w-full min-w-0 max-w-full box-border min-h-[48px] px-3.5 rounded-xl border border-[#D4D0C5] bg-[#F7F6F2] text-base text-[#171A18]"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-sm font-semibold text-[#171A18] mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={30}
                    value={sosPhone}
                    onChange={(e) => setSosPhone(e.target.value)}
                    className="block w-full min-w-0 max-w-full box-border min-h-[48px] px-3.5 rounded-xl border border-[#D4D0C5] bg-[#F7F6F2] text-base font-mono-nums text-[#171A18]"
                  />
                </div>
              </div>

              {sosError && (
                <p className="text-sm font-medium text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-2.5">
                  {sosError}
                </p>
              )}
              {sosSavedMsg && (
                <p className="text-sm font-medium text-[#1B4D3E] bg-[#EEF5F2] border border-[#1B4D3E]/30 rounded-xl p-2.5 inline-flex items-center gap-1.5 w-full">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{sosSavedMsg}</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={sosSaving}
              className="w-full min-h-[50px] px-4 rounded-xl bg-[#171A18] hover:bg-[#2C312E] disabled:opacity-60 text-white font-semibold text-base inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <PhoneCall className="w-5 h-5" />
              <span>{sosSaving ? 'Saving...' : 'Save SOS Contact'}</span>
            </button>
          </form>
        )}
      </section>

      {/* Right Panel: Paginated Saved Names */}
      <section className="lg:col-span-7 bg-white border border-[#DCD8CE] rounded-2xl p-4 sm:p-5 flex flex-col gap-3 min-w-0 lg:overflow-hidden">
        <div className="flex items-center justify-between gap-4 pb-2.5 border-b border-[#E2DFD7] shrink-0">
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#171A18]">
            Saved Places ({places.length})
          </h2>

          {totalPages > 1 && (
            <div className="flex items-center gap-1 bg-[#F7F6F2] border border-[#DCD8CE] rounded-xl p-1">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                aria-label="Previous page"
                className="min-h-[38px] min-w-[38px] rounded-lg flex items-center justify-center disabled:opacity-40 hover:bg-white cursor-pointer"
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
                aria-label="Next page"
                className="min-h-[38px] min-w-[38px] rounded-lg flex items-center justify-center disabled:opacity-40 hover:bg-white cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {places.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-base text-[#4A524D] text-center p-4">
            No saved places yet. Add your first destination using the form.
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[#EEECE6]">
            {visiblePlaces.map((place) => {
              const isConfirming = confirmDeleteId === place.id;
              return (
                <div
                  key={place.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5 min-w-0">
                    <h3 className="text-lg font-semibold text-[#171A18] truncate">
                      {place.name}
                    </h3>
                    <p className="text-sm text-[#3D4440] flex items-center gap-1.5 truncate">
                      <MapPin className="w-4 h-4 text-[#1B4D3E] shrink-0" />
                      <span className="font-mono-nums font-semibold text-[#1B4D3E] truncate">
                        {place.shortcode || 'Pinned GPS Location'}
                      </span>
                      {place.addedBy ? (
                        <span className="text-[#4A524D] truncate">· Added by {place.addedBy}</span>
                      ) : null}
                    </p>
                  </div>

                  {isConfirming ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleConfirmDelete(place.id)}
                        className="min-h-[44px] px-3.5 rounded-xl bg-[#B91C1C] hover:bg-[#991B1B] text-white text-sm font-semibold cursor-pointer"
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="min-h-[44px] px-3.5 rounded-xl border border-[#DCD8CE] text-sm font-semibold text-[#171A18] cursor-pointer"
                      >
                        Keep
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEditClick(place)}
                        className="min-h-[44px] px-3.5 rounded-xl border border-[#DCD8CE] hover:bg-[#F7F6F2] text-sm font-semibold text-[#171A18] inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(place.id)}
                        aria-label={`Remove ${place.name}`}
                        className="min-h-[44px] min-w-[44px] rounded-xl border border-[#DCD8CE] hover:bg-[#FEF2F2] text-[#B91C1C] inline-flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
