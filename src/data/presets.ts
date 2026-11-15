import type { Coordinates, EmergencyContact, SavedPlace, VehicleType } from '../types';

const OLC_ALPHABET = '23456789CFGHJMPQRVWX';
const OLC_PAIR_RESOLUTIONS = [20.0, 1.0, 0.05, 0.0025, 0.000125];

function decodeFullPlusCode(fullCode: string): Coordinates | null {
  const clean = fullCode.replace('+', '').toUpperCase();
  if (clean.length < 8) return null;
  let lat = -90;
  let lng = -180;
  for (let i = 0; i < Math.min(clean.length, 10); i += 2) {
    const latIdx = OLC_ALPHABET.indexOf(clean[i]);
    const lngIdx = OLC_ALPHABET.indexOf(clean[i + 1]);
    if (latIdx === -1 || lngIdx === -1) return null;
    const res = OLC_PAIR_RESOLUTIONS[i / 2];
    lat += latIdx * res;
    lng += lngIdx * res;
  }
  const pairCount = Math.min(clean.length, 10) / 2;
  const finalRes = OLC_PAIR_RESOLUTIONS[pairCount - 1];
  return {
    lat: lat + finalRes / 2,
    lng: lng + finalRes / 2,
  };
}

function encodePrefix(lat: number, lng: number, pairs: number): string {
  let remLat = lat + 90;
  let remLng = lng + 180;
  let out = '';
  for (let i = 0; i < pairs; i++) {
    const res = OLC_PAIR_RESOLUTIONS[i];
    const latDigit = Math.min(19, Math.max(0, Math.floor(remLat / res)));
    const lngDigit = Math.min(19, Math.max(0, Math.floor(remLng / res)));
    remLat -= latDigit * res;
    remLng -= lngDigit * res;
    out += OLC_ALPHABET[latDigit] + OLC_ALPHABET[lngDigit];
  }
  return out;
}

export function resolvePlusCode(
  codeRaw: string | undefined,
  refCoords: Coordinates | null
): Coordinates | null {
  if (!codeRaw) return null;
  const trimmed = codeRaw.trim().toUpperCase();
  if (!trimmed.includes('+')) return null;
  const [beforePlus, afterPlus] = trimmed.split('+');
  if (!beforePlus || !afterPlus || afterPlus.length < 2) return null;

  // Full 8+ char prefix code
  if (beforePlus.length === 8) {
    return decodeFullPlusCode(trimmed);
  }

  // Short Plus Code (4 chars before '+', e.g. WG7Q+J5) recovered near device location
  if (beforePlus.length === 4 && refCoords) {
    const prefix = encodePrefix(refCoords.lat, refCoords.lng, 2);
    const candidate = decodeFullPlusCode(`${prefix}${beforePlus}+${afterPlus}`);
    if (!candidate) return null;
    const resolution = 1.0;
    let bestLat = candidate.lat;
    let bestLng = candidate.lng;
    if (refCoords.lat - bestLat > resolution / 2) bestLat += resolution;
    else if (bestLat - refCoords.lat > resolution / 2) bestLat -= resolution;
    if (refCoords.lng - bestLng > resolution / 2) bestLng += resolution;
    else if (bestLng - refCoords.lng > resolution / 2) bestLng -= resolution;
    return { lat: bestLat, lng: bestLng };
  }

  return null;
}

export function calculateDistanceKm(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  const straightKm = 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  // Multiply by ~1.3 road winding factor for realistic street distance
  return Math.max(0.5, Number((straightKm * 1.3).toFixed(1)));
}

export interface RideProviderOffer {
  id: 'uber' | 'ola' | 'rapido' | 'namma-yatri';
  name: string;
  vehicleLabel: string;
  priceRange: string;
  etaText: string;
  url: string;
  accentBg: string;
  accentText: string;
}

export function resolveFullPlusCode(
  codeRaw: string | undefined,
  refCoords: Coordinates | null
): string | null {
  if (!codeRaw) return null;
  const trimmed = codeRaw.trim().toUpperCase();
  if (!trimmed.includes('+')) return null;
  const [beforePlus, afterPlus] = trimmed.split('+');
  if (!beforePlus || !afterPlus || afterPlus.length < 2) return null;
  if (beforePlus.length === 8) return trimmed;
  if (beforePlus.length === 4 && refCoords) {
    const resolved = resolvePlusCode(trimmed, refCoords);
    if (!resolved) return null;
    const prefix = encodePrefix(resolved.lat, resolved.lng, 2);
    return `${prefix}${beforePlus}+${afterPlus}`;
  }
  return null;
}

export function buildRideOffers(
  place: SavedPlace,
  vehicle: VehicleType,
  coords: Coordinates | null
): { offers: RideProviderOffer[]; distanceKm: number | null } {
  const dropCoords: Coordinates | null =
    typeof place.lat === 'number' && typeof place.lng === 'number'
      ? { lat: place.lat, lng: place.lng }
      : resolvePlusCode(place.shortcode, coords);

  const distanceKm =
    coords && dropCoords ? calculateDistanceKm(coords, dropCoords) : null;

  const fullPlusCode = resolveFullPlusCode(place.shortcode, coords);
  const destinationLabel =
    fullPlusCode ||
    place.shortcode ||
    (dropCoords ? `${dropCoords.lat.toFixed(6)},${dropCoords.lng.toFixed(6)}` : place.name);

  const encodedAddr = encodeURIComponent(destinationLabel);
  const encodedName = encodeURIComponent(place.name);
  const hasCoords = Boolean(coords);
  const latStr = coords ? coords.lat.toFixed(6) : '';
  const lngStr = coords ? coords.lng.toFixed(6) : '';

  const hasDropCoords = Boolean(dropCoords);
  const dropLatStr = dropCoords ? dropCoords.lat.toFixed(6) : '';
  const dropLngStr = dropCoords ? dropCoords.lng.toFixed(6) : '';

  const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location${
    hasCoords ? `&pickup[latitude]=${latStr}&pickup[longitude]=${lngStr}` : ''
  }&dropoff[formatted_address]=${encodedAddr}&dropoff[nickname]=${encodedName}${
    hasDropCoords ? `&dropoff[latitude]=${dropLatStr}&dropoff[longitude]=${dropLngStr}` : ''
  }&vehicle=${vehicle}`;

  const olaCategory = vehicle === 'auto' ? 'auto' : 'mini';
  const olaUrl = `https://book.olacabs.com/?serviceType=p2p&pickup=current_location${
    hasCoords ? `&lat=${latStr}&lng=${lngStr}` : ''
  }&drop_name=${encodedName}&drop_address=${encodedAddr}${
    hasDropCoords ? `&drop_lat=${dropLatStr}&drop_lng=${dropLngStr}` : ''
  }&category=${olaCategory}`;

  const rapidoPickup = hasCoords ? `${latStr},${lngStr}` : 'current_location';
  const rapidoDrop = hasDropCoords ? `${dropLatStr},${dropLngStr}` : destinationLabel;
  const rapidoUrl = `https://www.rapido.bike/ride?pickup=${encodeURIComponent(
    rapidoPickup
  )}&drop=${encodeURIComponent(rapidoDrop)}&drop_name=${encodedName}&vehicle=${vehicle}`;

  const nammaVehicle = vehicle === 'auto' ? 'AUTO_RICKSHAW' : 'CAB';
  const nammaUrl = `https://nammayatri.in/open?pickup=current_location${
    hasCoords ? `&pickupLat=${latStr}&pickupLng=${lngStr}` : ''
  }&destination=${encodedAddr}&destinationName=${encodedName}${
    hasDropCoords ? `&dropLat=${dropLatStr}&dropLng=${dropLngStr}` : ''
  }&vehicle=${nammaVehicle}`;

  const formatFare = (base: number, perKm: number, spread: number) => {
    if (distanceKm === null) {
      return vehicle === 'auto'
        ? `Est. ₹${base} – ₹${base + 45}`
        : `Est. ₹${base + 25} – ₹${base + 95}`;
    }
    const extraKm = Math.max(0, distanceKm - 2);
    const low = Math.round((base + extraKm * perKm) / 5) * 5;
    const high = Math.round((low + spread) / 5) * 5;
    return `Est. ₹${low} – ₹${high}`;
  };

  const offers: RideProviderOffer[] =
    vehicle === 'auto'
      ? [
          {
            id: 'namma-yatri',
            name: 'Namma Yatri',
            vehicleLabel: 'Direct Auto',
            priceRange: formatFare(30, 15, 15),
            etaText: '3 min away',
            url: nammaUrl,
            accentBg: 'bg-[#2B4C7E]',
            accentText: 'text-white',
          },
          {
            id: 'rapido',
            name: 'Rapido',
            vehicleLabel: 'Rapido Auto',
            priceRange: formatFare(32, 15, 15),
            etaText: '4 min away',
            url: rapidoUrl,
            accentBg: 'bg-[#9A5B13]',
            accentText: 'text-white',
          },
          {
            id: 'uber',
            name: 'Uber',
            vehicleLabel: 'Uber Auto',
            priceRange: formatFare(35, 16, 20),
            etaText: '4 min away',
            url: uberUrl,
            accentBg: 'bg-[#171A18]',
            accentText: 'text-white',
          },
          {
            id: 'ola',
            name: 'Ola',
            vehicleLabel: 'Ola Auto',
            priceRange: formatFare(35, 16, 20),
            etaText: '5 min away',
            url: olaUrl,
            accentBg: 'bg-[#1F5144]',
            accentText: 'text-white',
          },
        ]
      : [
          {
            id: 'uber',
            name: 'Uber',
            vehicleLabel: 'Uber Go',
            priceRange: formatFare(65, 22, 30),
            etaText: '4 min away',
            url: uberUrl,
            accentBg: 'bg-[#171A18]',
            accentText: 'text-white',
          },
          {
            id: 'ola',
            name: 'Ola',
            vehicleLabel: 'Ola Mini',
            priceRange: formatFare(68, 22, 30),
            etaText: '5 min away',
            url: olaUrl,
            accentBg: 'bg-[#1F5144]',
            accentText: 'text-white',
          },
          {
            id: 'rapido',
            name: 'Rapido',
            vehicleLabel: 'Rapido Cab',
            priceRange: formatFare(60, 20, 25),
            etaText: '5 min away',
            url: rapidoUrl,
            accentBg: 'bg-[#9A5B13]',
            accentText: 'text-white',
          },
          {
            id: 'namma-yatri',
            name: 'Namma Yatri',
            vehicleLabel: 'Direct Cab',
            priceRange: formatFare(62, 21, 25),
            etaText: '6 min away',
            url: nammaUrl,
            accentBg: 'bg-[#2B4C7E]',
            accentText: 'text-white',
          },
        ];

  return { offers, distanceKm };
}

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export interface ParsedVoiceCommand {
  vehicle: VehicleType;
  place: SavedPlace | null;
  providerId?: RideProviderOffer['id'];
}

export function parseVoiceRideCommand(
  transcriptRaw: string,
  places: SavedPlace[]
): ParsedVoiceCommand {
  const lower = transcriptRaw.toLowerCase().trim();

  const vehicle: VehicleType =
    /\b(cab|car|taxi|mini|sedan|suv)\b/.test(lower) ? 'cab' : 'auto';

  let providerId: RideProviderOffer['id'] | undefined;
  if (/\buber\b/.test(lower)) providerId = 'uber';
  else if (/\bola\b/.test(lower)) providerId = 'ola';
  else if (/\brapido\b/.test(lower)) providerId = 'rapido';
  else if (/\bnamma\b/.test(lower)) providerId = 'namma-yatri';

  // Direct substring match first (longest name wins)
  const sortedPlaces = [...places].sort((a, b) => b.name.length - a.name.length);
  for (const place of sortedPlaces) {
    const cleanName = place.name.trim().toLowerCase();
    const cleanCode = place.shortcode?.trim().toLowerCase() ?? '';
    if (cleanName && lower.includes(cleanName)) {
      return { vehicle, place, providerId };
    }
    if (cleanCode && lower.replace(/\s+/g, '').includes(cleanCode)) {
      return { vehicle, place, providerId };
    }
  }

  // Fuzzy match against spoken words after removing command filler words
  const stopWords = new Set([
    'book',
    'ride',
    'auto',
    'rickshaw',
    'cab',
    'car',
    'taxi',
    'to',
    'for',
    'me',
    'a',
    'an',
    'the',
    'please',
    'go',
    'take',
    'open',
    'in',
    'on',
    'via',
    'with',
    'uber',
    'ola',
    'rapido',
    'namma',
    'yatri',
  ]);
  const spokenTokens = lower
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !stopWords.has(w));

  let bestPlace: SavedPlace | null = null;
  let bestScore = Infinity;

  for (const place of places) {
    const placeWords = place.name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    for (const spoken of spokenTokens) {
      for (const pWord of placeWords) {
        if (spoken === pWord || pWord.startsWith(spoken) || spoken.startsWith(pWord)) {
          return { vehicle, place, providerId };
        }
        const maxDist = Math.max(spoken.length, pWord.length) >= 4 ? 2 : 1;
        const dist = editDistance(spoken, pWord);
        if (dist <= maxDist && dist < bestScore) {
          bestScore = dist;
          bestPlace = place;
        }
      }
    }
  }

  return { vehicle, place: bestPlace, providerId };
}

export function buildSosLinks(
  contact: EmergencyContact,
  coords: Coordinates | null
): {
  telUrl: string;
  smsUrl: string;
  whatsappUrl: string;
  mapsUrl: string | null;
  message: string;
} {
  const cleanPhone = contact.phone.replace(/[^\d+]/g, '');
  const whatsappDigits = cleanPhone.replace(/[^\d]/g, '');
  const mapsUrl = coords
    ? `https://maps.google.com/?q=${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}`
    : null;
  const message = coords
    ? `SOS! I need urgent help. My current GPS location is: ${mapsUrl} (Coordinates: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`
    : `SOS! I need urgent help right now. Please call me immediately.`;

  return {
    telUrl: `tel:${cleanPhone}`,
    smsUrl: `sms:${cleanPhone}?body=${encodeURIComponent(message)}`,
    whatsappUrl: `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(message)}`,
    mapsUrl,
    message,
  };
}
