import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, LocateFixed, MapPin, Navigation2, Phone,
  Search, Star, X, MapPinOff, RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getHospitalsByCity, getNearbyHospitals } from '../services/health.service';
import { useLanguage } from '../hooks/useLanguage';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';
import { cn } from '../lib/cn';

const DEFAULT_CENTER = [20.5937, 78.9629];
const DEFAULT_SPECIALTIES = [
  'General Physician', 'Cardiologist', 'Neurologist', 'Orthopedic',
  'Pediatrician', 'ENT', 'Dermatologist', 'Emergency Care',
];
const DISTANCE_OPTIONS = [2, 5, 10, 20, 50, 100, 0];
const SYMPTOM_RESULT_TTL_MS = 30 * 60 * 1000;
const QUICK_CITIES = ['Delhi', 'Mumbai', 'Bangalore', 'Chennai', 'Jalandhar'];

// Haversine distance in km between two lat/lng points
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// Rough travel time estimate (city driving ~30 km/h)
function travelMinutes(distKm) {
  return Math.max(1, Math.round((distKm / 30) * 60));
}

const toSpecialties = (hospital = {}) => {
  if (Array.isArray(hospital.specialties) && hospital.specialties.length) return hospital.specialties;
  return String(hospital.specialization || hospital.specialty || 'General Physician')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const hasCoords = (hospital) =>
  hospital?.latitude &&
  hospital?.longitude &&
  !Number.isNaN(Number(hospital.latitude)) &&
  !Number.isNaN(Number(hospital.longitude));

const osmDirections = (hospital, userLocation) => {
  const to = `${hospital.latitude},${hospital.longitude}`;
  if (userLocation) {
    return `https://www.openstreetmap.org/directions?from=${userLocation.lat},${userLocation.lng}&to=${to}`;
  }
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${hospital.name} ${hospital.city}`)}`;
};

function Rating({ value }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-text-primary dark:text-text-dark">
      <Star className="h-3.5 w-3.5 fill-warning text-warning" />
      {Number(value).toFixed(1)}
    </span>
  );
}

function HospitalCard({ hospital, active, userLocation, onFocus, t }) {
  const specialties = toSpecialties(hospital);
  const directionsUrl = osmDirections(hospital, userLocation);

  // Use backend distance if available; compute client-side as fallback
  const distKm = hospital.distance_km != null
    ? Number(hospital.distance_km)
    : (userLocation && hasCoords(hospital)
      ? haversineKm(userLocation.lat, userLocation.lng, Number(hospital.latitude), Number(hospital.longitude))
      : null);

  const distLabel = distKm != null
    ? `${distKm.toFixed(1)} ${t.kmAway}`
    : `${hospital.city}${hospital.address ? ` · ${hospital.address}` : ''}`;

  const travelLabel = distKm != null ? `~${travelMinutes(distKm)} ${t.minDrive}` : null;

  return (
    <article
      onMouseEnter={onFocus}
      onFocus={onFocus}
      className={cn(
        'rounded-lg border bg-white p-4 shadow-sm transition-all dark:bg-surface-dark',
        active
          ? 'border-primary ring-2 ring-primary/20'
          : 'border-border hover:border-primary/60 dark:border-border-dark',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-text-primary dark:text-text-dark">
            {hospital.name}
          </h3>
          <p className="mt-1 text-xs text-text-muted">{distLabel}</p>
          {travelLabel && (
            <p className="text-xs text-text-subtle">{travelLabel}</p>
          )}
        </div>
        <Rating value={hospital.rating} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {specialties.map((specialty) => (
          <span key={specialty} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {specialty}
          </span>
        ))}
        {hospital.emergency_24h && (
          <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
            {t.emergency24h}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button asChild variant="secondary" size="sm" className="w-full">
          <a href={`tel:${hospital.phone || ''}`}>
            <Phone className="h-3.5 w-3.5" />
            {t.call}
          </a>
        </Button>
        <Button asChild size="sm" className="w-full">
          <a href={directionsUrl} target="_blank" rel="noreferrer">
            <Navigation2 className="h-3.5 w-3.5" />
            {t.directions}
          </a>
        </Button>
      </div>
    </article>
  );
}

function HospitalMap({ hospitals, activeId, userLocation, onSelect, t }) {
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapObj.current) return undefined;

    if (!document.querySelector('link[data-leaflet]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.setAttribute('data-leaflet', '1');
      document.head.appendChild(link);
    }

    let cancelled = false;
    import('leaflet').then((L) => {
      if (cancelled || !mapRef.current || mapObj.current) return;
      mapObj.current = L.map(mapRef.current, { zoomControl: true }).setView(DEFAULT_CENTER, 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(mapObj.current);
    });

    return () => {
      cancelled = true;
      mapObj.current?.remove();
      mapObj.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapObj.current) return;

    import('leaflet').then((L) => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;

      const bounds = [];

      if (userLocation) {
        const userIcon = L.divIcon({
          className: '',
          html: '<div style="width:18px;height:18px;border-radius:999px;background:#2563eb;border:3px solid white;box-shadow:0 0 0 8px rgba(37,99,235,.18)"></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
          .addTo(mapObj.current)
          .bindPopup(t.youAreHere);
        bounds.push([userLocation.lat, userLocation.lng]);
      }

      hospitals.filter(hasCoords).forEach((hospital) => {
        const lat = Number(hospital.latitude);
        const lng = Number(hospital.longitude);
        const isActive = String(hospital.id || hospital.name) === activeId;
        const size = isActive ? 34 : 28;
        const icon = L.divIcon({
          className: '',
          html: `<div style="display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:999px;background:${isActive ? '#0c6259' : '#0f766e'};color:white;border:2px solid white;box-shadow:0 4px 10px rgba(15,23,42,.25);font-size:16px;font-weight:800;transition:all .15s">+</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const distKm = hospital.distance_km != null
          ? Number(hospital.distance_km)
          : (userLocation
            ? haversineKm(userLocation.lat, userLocation.lng, lat, lng)
            : null);

        const marker = L.marker([lat, lng], { icon })
          .addTo(mapObj.current)
          .bindPopup(`
            <strong>${hospital.name}</strong><br/>
            ${distKm != null ? `${distKm.toFixed(1)} ${t.kmAway}<br/>` : ''}
            ${distKm != null ? `~${travelMinutes(distKm)} ${t.minDrive}<br/>` : ''}
            ${toSpecialties(hospital).join(', ')}<br/>
            <a href="tel:${hospital.phone || ''}">${t.call}</a>
          `);
        marker.on('click', () => onSelect(hospital));
        markersRef.current.push(marker);
        bounds.push([lat, lng]);
      });

      if (bounds.length) {
        mapObj.current.fitBounds(bounds, { padding: [40, 40], maxZoom: userLocation ? 13 : 13 });
      } else {
        mapObj.current.setView(DEFAULT_CENTER, 5);
      }
    });
  }, [hospitals, activeId, userLocation, onSelect, t]);

  return <div ref={mapRef} className="h-full min-h-[360px] w-full bg-slate-100 lg:min-h-0" />;
}

export default function HospitalsPage() {
  const { t } = useLanguage();

  const [city, setCity] = useState('');
  const [debouncedCity, setDebouncedCity] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [radius, setRadius] = useState(10);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Geolocation state — separated from generic loading
  const [userLocation, setUserLocation] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [detectedCity, setDetectedCity] = useState('');

  const [activeId, setActiveId] = useState('');
  const [showLocationBanner, setShowLocationBanner] = useState(true);
  const [symptomBanner, setSymptomBanner] = useState(null);

  // Debounce city input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedCity(city.trim()), 400);
    return () => clearTimeout(timer);
  }, [city]);

  // Restore symptom context from recent check
  useEffect(() => {
    try {
      const raw = localStorage.getItem('last_symptom_result');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed?.timestamp || Date.now() - parsed.timestamp > SYMPTOM_RESULT_TTL_MS) return;
      if (parsed.specialist) {
        setSpecialty(parsed.specialist);
        setSymptomBanner(parsed);
      }
    } catch {
      localStorage.removeItem('last_symptom_result');
    }
  }, []);

  const loadHospitals = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = userLocation
        ? await getNearbyHospitals({
          lat: userLocation.lat,
          lng: userLocation.lng,
          radius: radius || 200,
          specialty,
        })
        : await getHospitalsByCity(debouncedCity, specialty);

      // Sort by distance ascending when location is available
      const list = response.data || [];
      if (userLocation) {
        list.sort((a, b) => {
          const da = a.distance_km ?? haversineKm(userLocation.lat, userLocation.lng, Number(a.latitude), Number(a.longitude));
          const db = b.distance_km ?? haversineKm(userLocation.lat, userLocation.lng, Number(b.latitude), Number(b.longitude));
          return da - db;
        });
      }
      setHospitals(list);
    } catch (err) {
      setError(err?.response?.data?.message || t.couldNotLoadHospitals);
    } finally {
      setLoading(false);
    }
  }, [debouncedCity, radius, specialty, userLocation, t]);

  useEffect(() => {
    if (userLocation || debouncedCity) loadHospitals();
  }, [debouncedCity, loadHospitals, userLocation]);

  // Request geolocation with full error handling + optional reverse geocoding
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error(t.geoNotSupported);
      return;
    }

    setGeoLoading(true);
    setGeoError('');

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords;
        setUserLocation({ lat, lng });
        setShowLocationBanner(false);
        setGeoLoading(false);

        // Reverse geocode via Nominatim (best-effort, silent on failure)
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
            { headers: { 'User-Agent': 'HealthBot/1.0' } },
          );
          const data = await res.json();
          const cityName =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            data.address?.county ||
            '';
          if (cityName) setDetectedCity(cityName);
        } catch {
          // Reverse geocoding is optional; do not block on failure
        }
      },
      (positionError) => {
        setGeoLoading(false);
        setShowLocationBanner(true);
        let msg;
        if (positionError.code === 1) {
          // PERMISSION_DENIED
          msg = t.locationDenied;
          toast.error(t.locationPermissionDenied);
        } else if (positionError.code === 3) {
          // TIMEOUT
          msg = t.locationTimeout;
          toast.error(t.locationTimedOut);
        } else {
          // POSITION_UNAVAILABLE
          msg = t.locationUnavailable;
          toast.error(t.couldNotDetectLocation);
        }
        setGeoError(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, [t]);

  const clearLocation = useCallback(() => {
    setUserLocation(null);
    setDetectedCity('');
    setGeoError('');
    setHospitals([]);
    setShowLocationBanner(true);
  }, []);

  const specialties = useMemo(() => {
    const values = new Set(DEFAULT_SPECIALTIES);
    hospitals.forEach((hospital) => toSpecialties(hospital).forEach((item) => values.add(item)));
    return [...values].sort();
  }, [hospitals]);

  // Client-side filter: emergency toggle; radius is handled server-side but we
  // also guard against backend returning out-of-radius records
  const visibleHospitals = useMemo(() => hospitals.filter((hospital) => {
    if (emergencyOnly && !hospital.emergency_24h) return false;
    if (userLocation && radius > 0 && hasCoords(hospital)) {
      const dist = hospital.distance_km != null
        ? Number(hospital.distance_km)
        : haversineKm(userLocation.lat, userLocation.lng, Number(hospital.latitude), Number(hospital.longitude));
      if (dist > radius) return false;
    }
    return true;
  }), [emergencyOnly, hospitals, radius, userLocation]);

  const activeHospital = visibleHospitals.find(
    (hospital) => String(hospital.id || hospital.name) === activeId,
  );

  return (
    <div className="min-h-[calc(100vh-56px)] bg-background dark:bg-background-dark">

      {/* ── Header / filters ─────────────────────────────────────────────── */}
      <div className="border-b border-border bg-white/90 px-4 py-4 dark:border-border-dark dark:bg-surface-dark/90">
        <div className="mx-auto max-w-screen-2xl space-y-3">

          {/* Title row */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-text-primary dark:text-text-dark">
                {t.findHospitals}
              </h1>
              {userLocation && detectedCity ? (
                <p className="text-sm text-text-muted">
                  <span className="font-medium text-primary">{t.locationDetected}: {detectedCity}</span>
                  {' · '}
                  <button
                    type="button"
                    onClick={clearLocation}
                    className="inline-flex items-center gap-1 text-text-muted hover:text-danger transition-colors"
                  >
                    <MapPinOff className="h-3.5 w-3.5" />
                    {t.clearLocation}
                  </button>
                </p>
              ) : (
                <p className="text-sm text-text-muted">{t.searchByCityOrLocation}</p>
              )}
            </div>

            <Button
              type="button"
              onClick={requestLocation}
              loading={geoLoading}
              disabled={geoLoading}
              className="gap-2 shrink-0"
            >
              <LocateFixed className="h-4 w-4" />
              {geoLoading ? t.detectingLocation : t.useMyLocation}
            </Button>
          </div>

          {/* Symptom context banner */}
          {symptomBanner && (
            <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{t.showingForSymptoms}</span>
              <button
                type="button"
                onClick={() => setSymptomBanner(null)}
                className="rounded p-1 hover:bg-primary/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Geolocation error banner */}
          {geoError && (
            <div className="flex flex-col gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger sm:flex-row sm:items-center">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{geoError}</span>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={requestLocation}
                className="gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t.retryLocation}
              </Button>
            </div>
          )}

          {/* Location share nudge banner */}
          {!userLocation && !geoError && showLocationBanner && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm text-text-muted dark:border-border-dark dark:bg-slate-900/30 sm:flex-row sm:items-center">
              <span className="flex-1">{t.shareLocationDesc}</span>
              <Button type="button" variant="secondary" size="sm" onClick={requestLocation} loading={geoLoading}>
                {t.shareLocation}
              </Button>
            </div>
          )}

          {/* Quick city chips — disabled when location is active */}
          {!userLocation && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-text-subtle">{t.quickSearch}:</span>
              {QUICK_CITIES.map((quickCity) => (
                <button
                  key={quickCity}
                  type="button"
                  onClick={() => setCity(quickCity)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    city === quickCity
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-white text-text-primary hover:border-primary/60 hover:text-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark',
                  )}
                >
                  {quickCity}
                </button>
              ))}
            </div>
          )}

          {/* Filter row */}
          <div className="grid gap-2 md:grid-cols-[minmax(180px,1fr)_220px_160px_200px]">

            {/* City search */}
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder={t.cityPlaceholder}
                disabled={Boolean(userLocation)}
                className="h-10 w-full rounded border border-border bg-white pl-9 pr-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-50 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
              />
            </label>

            {/* Specialty filter */}
            <select
              value={specialty}
              onChange={(event) => setSpecialty(event.target.value)}
              className="h-10 rounded border border-border bg-white px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
            >
              <option value="">{t.allSpecialties}</option>
              {specialties.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>

            {/* Emergency toggle */}
            <label className="flex h-10 cursor-pointer items-center gap-2 rounded border border-border bg-white px-3 text-sm text-text-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark">
              <input
                type="checkbox"
                checked={emergencyOnly}
                onChange={(event) => setEmergencyOnly(event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              {t.emergencyOnly}
            </label>

            {/* Radius selector — full range, enabled only with location */}
            <select
              value={radius}
              disabled={!userLocation}
              onChange={(event) => setRadius(Number(event.target.value))}
              className="h-10 rounded border border-border bg-white px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-50 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
            >
              {DISTANCE_OPTIONS.map((km) => (
                <option key={km} value={km}>
                  {km ? `${km} km` : t.anyDistance}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Map + List split layout ──────────────────────────────────────── */}
      <main className="mx-auto grid max-w-screen-2xl gap-0 lg:h-[calc(100vh-220px)] lg:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)]">

        {/* Map panel */}
        <section className="min-h-[380px] overflow-hidden border-b border-border dark:border-border-dark lg:border-b-0 lg:border-r">
          {loading && !visibleHospitals.length ? (
            <div className="h-full min-h-[380px] bg-slate-100 p-4 dark:bg-slate-900/30">
              <Skeleton className="h-full min-h-[340px] rounded-lg" />
            </div>
          ) : (
            <HospitalMap
              hospitals={visibleHospitals}
              activeId={activeId}
              userLocation={userLocation}
              onSelect={(hospital) => setActiveId(String(hospital.id || hospital.name))}
              t={t}
            />
          )}
        </section>

        {/* Hospitals list panel */}
        <aside className="max-h-[calc(100vh-220px)] overflow-y-auto p-4">

          {/* Error state */}
          {error && (
            <div className="mb-3 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
              <Button
                type="button"
                size="sm"
                variant="danger"
                className="mt-3 gap-1.5"
                onClick={loadHospitals}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t.retry}
              </Button>
            </div>
          )}

          {/* Loading skeletons */}
          {loading && (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => (
                <Skeleton key={item} className="h-40 rounded-lg" />
              ))}
            </div>
          )}

          {/* Initial empty state */}
          {!loading && !error && !userLocation && !debouncedCity && (
            <EmptyState
              icon={MapPin}
              title={t.searchHospitalsTitle}
              description={t.enterCityOrLocation}
              className="py-16"
            />
          )}

          {/* No results state */}
          {!loading && !error && (userLocation || debouncedCity) && !visibleHospitals.length && (
            <EmptyState
              icon={AlertCircle}
              title={t.noHospitalsFound}
              description={
                userLocation && radius > 0
                  ? `${t.noHospitalsWithinRadius} ${radius} km. ${t.tryIncreasingRadius}`
                  : t.tryDifferentSearch
              }
              className="py-16"
            />
          )}

          {/* Hospital cards */}
          {!loading && !error && visibleHospitals.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-text-muted">
                <span>
                  {visibleHospitals.length}{' '}
                  {visibleHospitals.length === 1 ? t.hospitalsFoundSingular : t.hospitalsFoundPlural}
                </span>
                {activeHospital && (
                  <span className="truncate text-primary">{activeHospital.name}</span>
                )}
              </div>

              {visibleHospitals.map((hospital) => (
                <HospitalCard
                  key={`${hospital.id || hospital.name}-${hospital.city}`}
                  hospital={hospital}
                  active={String(hospital.id || hospital.name) === activeId}
                  userLocation={userLocation}
                  onFocus={() => setActiveId(String(hospital.id || hospital.name))}
                  t={t}
                />
              ))}
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
