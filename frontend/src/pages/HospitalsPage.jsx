import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, LocateFixed, MapPin, Navigation2, Phone, Search, Star, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getHospitalsByCity, getNearbyHospitals } from '../services/health.service';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';
import { cn } from '../lib/cn';

const DEFAULT_CENTER = [20.5937, 78.9629];
const DEFAULT_SPECIALTIES = [
  'General Physician', 'Cardiologist', 'Pulmonologist', 'Neurologist', 'Pediatrician',
];
const DISTANCE_OPTIONS = [5, 10, 25, 50, 0];
const SYMPTOM_RESULT_TTL_MS = 30 * 60 * 1000;

const toSpecialties = (hospital = {}) => {
  if (Array.isArray(hospital.specialties) && hospital.specialties.length) return hospital.specialties;
  return String(hospital.specialization || hospital.specialty || 'General Physician')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const hasCoords = (hospital) =>
  hospital?.latitude && hospital?.longitude
  && !Number.isNaN(Number(hospital.latitude))
  && !Number.isNaN(Number(hospital.longitude));

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

function HospitalCard({ hospital, active, userLocation, onFocus }) {
  const specialties = toSpecialties(hospital);
  const directionsUrl = osmDirections(hospital, userLocation);

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
          <p className="mt-1 text-xs text-text-muted">
            {hospital.distance_km != null
              ? `${Number(hospital.distance_km).toFixed(1)} km away`
              : `${hospital.city} - ${hospital.address}`}
          </p>
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
            24h emergency
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button asChild variant="secondary" size="sm" className="w-full">
          <a href={`tel:${hospital.phone || ''}`}>
            <Phone className="h-3.5 w-3.5" />
            Call
          </a>
        </Button>
        <Button asChild size="sm" className="w-full">
          <a href={directionsUrl} target="_blank" rel="noreferrer">
            <Navigation2 className="h-3.5 w-3.5" />
            Directions
          </a>
        </Button>
      </div>
    </article>
  );
}

function HospitalMap({ hospitals, activeId, userLocation, onSelect }) {
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
        attribution: 'OpenStreetMap',
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
          .bindPopup('You are here');
        bounds.push([userLocation.lat, userLocation.lng]);
      }

      hospitals.filter(hasCoords).forEach((hospital) => {
        const lat = Number(hospital.latitude);
        const lng = Number(hospital.longitude);
        const isActive = String(hospital.id || hospital.name) === activeId;
        const icon = L.divIcon({
          className: '',
          html: `<div style="display:grid;place-items:center;width:${isActive ? 34 : 28}px;height:${isActive ? 34 : 28}px;border-radius:999px;background:#0f766e;color:white;border:2px solid white;box-shadow:0 4px 10px rgba(15,23,42,.25);font-weight:800">+</div>`,
          iconSize: [isActive ? 34 : 28, isActive ? 34 : 28],
          iconAnchor: [isActive ? 17 : 14, isActive ? 17 : 14],
        });
        const marker = L.marker([lat, lng], { icon })
          .addTo(mapObj.current)
          .bindPopup(`
            <strong>${hospital.name}</strong><br/>
            ${hospital.distance_km != null ? `${Number(hospital.distance_km).toFixed(1)} km<br/>` : ''}
            ${toSpecialties(hospital).join(', ')}<br/>
            <a href="tel:${hospital.phone || ''}">Call</a>
          `);
        marker.on('click', () => onSelect(hospital));
        markersRef.current.push(marker);
        bounds.push([lat, lng]);
      });

      if (bounds.length) {
        mapObj.current.fitBounds(bounds, { padding: [36, 36], maxZoom: userLocation ? 12 : 13 });
      } else {
        mapObj.current.setView(DEFAULT_CENTER, 5);
      }
    });
  }, [hospitals, activeId, userLocation, onSelect]);

  return <div ref={mapRef} className="h-full min-h-[360px] w-full bg-slate-100 lg:min-h-0" />;
}

export default function HospitalsPage() {
  const [city, setCity] = useState('');
  const [debouncedCity, setDebouncedCity] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [radius, setRadius] = useState(50);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [activeId, setActiveId] = useState('');
  const [showLocationBanner, setShowLocationBanner] = useState(true);
  const [symptomBanner, setSymptomBanner] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedCity(city.trim()), 400);
    return () => clearTimeout(timer);
  }, [city]);

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
      setHospitals(response.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not load hospitals');
    } finally {
      setLoading(false);
    }
  }, [debouncedCity, radius, specialty, userLocation]);

  useEffect(() => {
    if (userLocation || debouncedCity) loadHospitals();
  }, [debouncedCity, loadHospitals, userLocation]);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported in this browser');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserLocation({ lat: coords.latitude, lng: coords.longitude });
        setShowLocationBanner(false);
        setLoading(false);
      },
      () => {
        setShowLocationBanner(true);
        setLoading(false);
        toast.error('Location permission was not granted');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const specialties = useMemo(() => {
    const values = new Set(DEFAULT_SPECIALTIES);
    hospitals.forEach((hospital) => toSpecialties(hospital).forEach((item) => values.add(item)));
    return [...values].sort();
  }, [hospitals]);

  const visibleHospitals = useMemo(() => hospitals.filter((hospital) => {
    if (emergencyOnly && !hospital.emergency_24h) return false;
    return true;
  }), [emergencyOnly, hospitals]);

  const activeHospital = visibleHospitals.find((hospital) => String(hospital.id || hospital.name) === activeId);

  return (
    <div className="min-h-[calc(100vh-56px)] bg-background dark:bg-background-dark">
      <div className="border-b border-border bg-white/90 px-4 py-4 dark:border-border-dark dark:bg-surface-dark/90">
        <div className="mx-auto max-w-screen-2xl space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-text-primary dark:text-text-dark">Find Hospitals</h1>
              <p className="text-sm text-text-muted">Search by city or use your location for nearby care.</p>
            </div>
            <Button type="button" onClick={requestLocation} loading={loading && !debouncedCity} className="gap-2">
              <LocateFixed className="h-4 w-4" />
              Use My Location
            </Button>
          </div>

          {symptomBanner && (
            <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="flex-1">Showing hospitals based on your recent symptom check.</span>
              <button type="button" onClick={() => setSymptomBanner(null)} className="rounded p-1 hover:bg-primary/10">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {!userLocation && showLocationBanner && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm text-text-muted dark:border-border-dark dark:bg-slate-900/30 sm:flex-row sm:items-center">
              <span className="flex-1">Share your location to sort hospitals by distance and enable radius filtering.</span>
              <Button type="button" variant="secondary" size="sm" onClick={requestLocation}>Share Location</Button>
            </div>
          )}

          <div className="grid gap-2 md:grid-cols-[minmax(180px,1fr)_220px_160px_220px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="City, e.g. Phagwara, Ludhiana, Delhi"
                disabled={Boolean(userLocation)}
                className="h-10 w-full rounded border border-border bg-white pl-9 pr-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-50 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
              />
            </label>

            <select
              value={specialty}
              onChange={(event) => setSpecialty(event.target.value)}
              className="h-10 rounded border border-border bg-white px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
            >
              <option value="">All specialties</option>
              {specialties.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>

            <label className="flex h-10 items-center gap-2 rounded border border-border bg-white px-3 text-sm text-text-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-dark">
              <input
                type="checkbox"
                checked={emergencyOnly}
                onChange={(event) => setEmergencyOnly(event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Emergency only
            </label>

            <select
              value={radius}
              disabled={!userLocation}
              onChange={(event) => setRadius(Number(event.target.value))}
              className="h-10 rounded border border-border bg-white px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-50 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark"
            >
              {DISTANCE_OPTIONS.map((km) => (
                <option key={km} value={km}>{km ? `${km} km` : 'Any distance'}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <main className="mx-auto grid max-w-screen-2xl gap-0 lg:h-[calc(100vh-206px)] lg:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)]">
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
            />
          )}
        </section>

        <aside className="max-h-[calc(100vh-206px)] overflow-y-auto p-4">
          {error && (
            <div className="mb-3 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
              <Button type="button" size="sm" variant="danger" className="mt-3" onClick={loadHospitals}>Retry</Button>
            </div>
          )}

          {loading && (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => <Skeleton key={item} className="h-36 rounded-lg" />)}
            </div>
          )}

          {!loading && !error && !userLocation && !debouncedCity && (
            <EmptyState
              icon={MapPin}
              title="Search for hospitals"
              description="Enter a city or share your location to begin."
              className="py-16"
            />
          )}

          {!loading && !error && (userLocation || debouncedCity) && !visibleHospitals.length && (
            <EmptyState
              icon={AlertCircle}
              title="No hospitals found"
              description="Try a different city, specialty, or distance."
              className="py-16"
            />
          )}

          {!loading && !error && visibleHospitals.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-text-muted">
                <span>{visibleHospitals.length} hospital{visibleHospitals.length === 1 ? '' : 's'} found</span>
                {activeHospital && <span className="truncate text-primary">{activeHospital.name}</span>}
              </div>
              {visibleHospitals.map((hospital) => (
                <HospitalCard
                  key={`${hospital.id || hospital.name}-${hospital.city}`}
                  hospital={hospital}
                  active={String(hospital.id || hospital.name) === activeId}
                  userLocation={userLocation}
                  onFocus={() => setActiveId(String(hospital.id || hospital.name))}
                />
              ))}
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
