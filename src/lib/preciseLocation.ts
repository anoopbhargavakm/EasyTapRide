import type { Coordinates } from '../types';

export interface CalibrationProgress {
  samples: number;
  bestAccuracy: number;
  coords: Coordinates;
}

/**
 * Computes an inverse-variance weighted average across high-precision GPS samples,
 * rejecting coarse cell-tower outliers so current location is tightly calibrated.
 */
function computeCalibratedFix(samples: Coordinates[]): Coordinates {
  if (samples.length === 1) {
    return {
      ...samples[0],
      calibrated: (samples[0].accuracy ?? 999) <= 25,
      samples: 1,
    };
  }

  const bestAcc = Math.min(...samples.map((s) => Math.max(3, s.accuracy ?? 50)));
  // Keep only readings close to the tightest satellite fix
  const tightSamples = samples.filter(
    (s) => Math.max(3, s.accuracy ?? 50) <= Math.max(bestAcc * 1.8, bestAcc + 15)
  );
  const active = tightSamples.length > 0 ? tightSamples : samples;

  let weightSum = 0;
  let latSum = 0;
  let lngSum = 0;

  for (const s of active) {
    const acc = Math.max(3, s.accuracy ?? 50);
    const weight = 1 / (acc * acc);
    weightSum += weight;
    latSum += s.lat * weight;
    lngSum += s.lng * weight;
  }

  return {
    lat: latSum / weightSum,
    lng: lngSum / weightSum,
    accuracy: bestAcc,
    calibrated: bestAcc <= 30 || active.length >= 2,
    samples: samples.length,
  };
}

/**
 * Calibrates device GPS using multi-sample high-accuracy watchPosition filtering.
 * Collects fresh fixes (maximumAge: 0) until tight accuracy (<= 12m with 2+ samples)
 * or timeout (~4.5s) completes.
 */
export function calibratePreciseLocation(
  onProgress?: (progress: CalibrationProgress) => void,
  durationMs = 4500
): Promise<Coordinates | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }

    const collected: Coordinates[] = [];
    let settled = false;
    let watchId: number | null = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (timerId !== null) {
        clearTimeout(timerId);
      }
      if (collected.length === 0) {
        resolve(null);
        return;
      }
      resolve(computeCalibratedFix(collected));
    };

    timerId = setTimeout(finish, durationMs);

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const sample: Coordinates = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        collected.push(sample);

        const currentFix = computeCalibratedFix(collected);
        onProgress?.({
          samples: collected.length,
          bestAccuracy: Math.round(currentFix.accuracy ?? pos.coords.accuracy),
          coords: currentFix,
        });

        // Early exit once GPS has locked tightly onto <= 12m with at least 2 samples
        if (collected.length >= 2 && (currentFix.accuracy ?? 999) <= 12) {
          finish();
        }
      },
      () => {
        if (collected.length > 0) {
          finish();
        } else {
          // Fallback single high-accuracy attempt
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              collected.push({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
              });
              finish();
            },
            () => finish(),
            { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
          );
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: durationMs + 3000,
      }
    );
  });
}
