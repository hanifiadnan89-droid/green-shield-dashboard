import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { MapPin, Search, Loader2, CheckCircle, AlertCircle, RotateCcw, Navigation, RefreshCw } from 'lucide-react';
import { api } from '../../../api/client.js';
import { scoreRoutes, detectRouteArea } from '../../../utils/fieldRoutesScorer.js';
import StatusBadge from './RouteStatusBadge.jsx';
import ResultCard from './RouteResultCard.jsx';
import AuthStatusBanner from './RouteAuthBanner.jsx';

// ---------------------------------------------------------------------------
// Time slot configuration
// ---------------------------------------------------------------------------
const TIME_PREFS = [
  { key: 'AM', label: 'AM', sub: '8am – 12pm' },
  { key: 'PM', label: 'PM', sub: '12pm – 6pm' },
  { key: 'specific', label: 'Specific', sub: 'choose slot' },
];

const FOUR_HOUR_SLOTS = [
  { key: '8-12',  label: '8am – 12pm' },
  { key: '12-4',  label: '12pm – 4pm' },
];

const TWO_HOUR_SLOTS = [
  { key: '8-10',  label: '8 – 10am' },
  { key: '10-12', label: '10am – 12pm' },
  { key: '12-2',  label: '12 – 2pm' },
  { key: '2-4',   label: '2 – 4pm' },
  { key: '4-6',   label: '4 – 6pm' },
];

// ---------------------------------------------------------------------------
// Date utilities
// ---------------------------------------------------------------------------
function getLocalDateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function buildDateMetas() {
  const metas = [];
  let offset = 0;
  while (metas.length < 6) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    if (d.getDay() !== 0) { // skip Sunday
      const key = getLocalDateStr(offset);
      const label = offset === 0 ? 'Today'
        : offset === 1 ? 'Tomorrow'
        : d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
      metas.push({ key, label });
    }
    offset++;
  }
  return metas;
}

// ---------------------------------------------------------------------------
// Nominatim geocoder
// ---------------------------------------------------------------------------
async function nominatimGeocode(address) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=us`;
  const resp = await fetch(url, { headers: { 'User-Agent': 'GreenShieldDashboard/1.0' } });
  if (!resp.ok) throw new Error('Geocoding service unavailable');
  const data = await resp.json();
  if (!data.length) throw new Error('Address not found');
  const { lat, lon, display_name } = data[0];
  const parts = display_name.split(',').map(s => s.trim());
  const short = parts.slice(0, 3).join(', ');
  return { lat: parseFloat(lat), lng: parseFloat(lon), display: short, full: display_name };
}

// ---------------------------------------------------------------------------
// Main widget — sub-components in RouteStatusBadge, RouteResultCard, RouteAuthBanner
// ---------------------------------------------------------------------------
export default function RouteFinderWidget() {
  // Date selection
  const DATE_METAS = useMemo(() => buildDateMetas(), []);
  const DATE_KEYS  = useMemo(() => DATE_METAS.map(d => d.key), [DATE_METAS]);

  const [activeDate, setActiveDate]           = useState(null);
  const [dateStatus, setDateStatus]           = useState({});
  const [authInfo, setAuthInfo]               = useState({ status: 'checking' });
  const [activeTechnicians, setActiveTechnicians] = useState(null);
  const [dateLoadStatus, setDateLoadStatus]   = useState('idle'); // idle|loading|error
  const [statusMountError, setStatusMountError] = useState(null);

  // Address
  const [addressInput, setAddressInput]   = useState('');
  const [geocode, setGeocode]             = useState(null);
  const [geocodeStatus, setGeocodeStatus] = useState('idle');
  const [geocodeError, setGeocodeError]   = useState('');
  const [isEditing, setIsEditing]         = useState(false);

  // Address autocomplete
  const [suggestions, setSuggestions]         = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);

  // Time preference
  const [timePref, setTimePref]         = useState(null);
  const [specificSlot, setSpecificSlot] = useState(null);
  const [specialNotes, setSpecialNotes] = useState('');

  // Time preference override ("Other" panel)
  const [showOther, setShowOther]         = useState(false);

  // Scoring
  const [scoringStatus, setScoringStatus] = useState('idle');
  const [scoringError, setScoringError]   = useState('');
  const [results, setResults]             = useState(null);

  const geocodeCacheRef    = useRef({});
  const suggestDebounceRef = useRef(null);
  const suppressBlurRef    = useRef(false);
  const pollRef            = useRef(null);
  const bgStatusRef        = useRef(null);
  const dateKeysRef     = useRef(DATE_KEYS);
  useEffect(() => { dateKeysRef.current = DATE_KEYS; }, [DATE_KEYS]);
  const activeDateRef   = useRef(activeDate);
  useEffect(() => { activeDateRef.current = activeDate; }, [activeDate]);
  const payloadRequestRef = useRef(0);

  // ---------------------------------------------------------------------------
  // Helper: splits _auth out of the status response and applies both
  // ---------------------------------------------------------------------------
  const applyStatusData = useCallback((statusData) => {
    const { _auth, ...dateStatuses } = statusData;
    setDateStatus(dateStatuses);
    if (_auth) setAuthInfo(_auth);
  }, []);

  // ---------------------------------------------------------------------------
  // Polling
  // ---------------------------------------------------------------------------
  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const statusData = await api.routes.status();
        applyStatusData(statusData);
        const anyRefreshing = dateKeysRef.current.some(d => statusData[d]?.status === 'refreshing');
        if (!anyRefreshing) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 3000);
  }, [applyStatusData]);

  const refreshRouteStatus = useCallback(async ({ checkAuth = false } = {}) => {
    if (checkAuth) await api.routes.authCheck();
    const statusData = await api.routes.status();
    applyStatusData(statusData);
    return statusData;
  }, [applyStatusData]);

  const handleLoginRefreshStarted = useCallback(async ({ checkAuth = false } = {}) => {
    const statusData = await refreshRouteStatus({ checkAuth });
    if (statusData?._auth?.status === 'ok') {
      api.routes.preload(false).catch(() => {});
      setDateStatus(prev => {
        const next = { ...prev };
        DATE_KEYS.forEach(d => {
          const status = next[d]?.status;
          if (!status || ['missing', 'needs_login', 'failed'].includes(status)) {
            next[d] = { ...(next[d] || {}), status: 'refreshing' };
          }
        });
        return next;
      });
      startPolling();
    }
    return statusData;
  }, [DATE_KEYS, refreshRouteStatus, startPolling]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // 30-second background status refresh — updates date pills + auth status
  useEffect(() => {
    bgStatusRef.current = setInterval(async () => {
      if (pollRef.current) return; // active polling already running
      try {
        const statusData = await api.routes.status();
        applyStatusData(statusData);
      } catch { /* ignore */ }
    }, 30000);
    return () => { if (bgStatusRef.current) clearInterval(bgStatusRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // On mount: load status, trigger preload for missing dates
  // ---------------------------------------------------------------------------
  const loadInitialRouteStatus = useCallback(async () => {
    try {
      const statusData = await api.routes.status();
      applyStatusData(statusData);
      setStatusMountError(null);
      const needsLoad = DATE_KEYS.some(d => {
        const s = statusData[d]?.status;
        return !s || s === 'missing';
      });
      if (needsLoad) {
        api.routes.preload().catch(() => {});
        // Optimistically mark missing dates as refreshing (auth-aware)
        const auth = statusData._auth;
        if (!auth || auth.status === 'ok' || auth.status === 'unknown') {
          setDateStatus(prev => {
            const next = { ...prev };
            DATE_KEYS.forEach(d => {
              if (!next[d] || next[d].status === 'missing') {
                next[d] = { status: 'refreshing' };
              }
            });
            return next;
          });
          startPolling();
        }
      } else {
        const anyRefreshing = DATE_KEYS.some(d => statusData[d]?.status === 'refreshing');
        if (anyRefreshing) startPolling();
      }
    } catch (err) {
      // Server not available — widget still works when routes are offline
      setStatusMountError(err?.message || 'Route status unavailable');
    }
  }, [DATE_KEYS, applyStatusData, startPolling]);

  useEffect(() => {
    loadInitialRouteStatus();
  }, [loadInitialRouteStatus]);

  // ---------------------------------------------------------------------------
  // Date selection
  // ---------------------------------------------------------------------------
  const handleDateSelect = useCallback(async (date) => {
    const requestId = ++payloadRequestRef.current;

    setActiveDate(date);
    setActiveTechnicians(null);
    setResults(null);
    setScoringStatus('idle');
    setTimePref(null);
    setSpecificSlot(null);
    setShowOther(false);

    setDateLoadStatus('loading');
    try {
      const data = await api.routes.payload(date);
      if (requestId !== payloadRequestRef.current) return;
      setActiveTechnicians(data.technicians || []);
      setDateLoadStatus('idle');
    } catch (err) {
      if (requestId !== payloadRequestRef.current) return;
      setDateLoadStatus('error');
      setActiveTechnicians(null);
      console.warn('[RouteFinderWidget] payload load failed:', err.message);
    }
  }, []);

  const handleRefresh = useCallback(async (date) => {
    try {
      await api.routes.refresh(date);
      setDateStatus(prev => ({ ...prev, [date]: { ...(prev[date] || {}), status: 'refreshing' } }));
      if (activeDate === date) {
        setActiveTechnicians(null);
        setResults(null);
        setScoringStatus('idle');
      }
      startPolling();
    } catch { /* ignore */ }
  }, [activeDate, startPolling]);

  const handleRefreshAll = useCallback(async () => {
    try {
      await api.routes.preload(true); // force=true — always re-scrape, ignore cache age
      setDateStatus(prev => {
        const next = { ...prev };
        DATE_KEYS.forEach(d => { next[d] = { ...(next[d] || {}), status: 'refreshing' }; });
        return next;
      });
      startPolling();
    } catch { /* ignore */ }
  }, [DATE_KEYS, startPolling]);

  // ---------------------------------------------------------------------------
  // Address autocomplete
  // ---------------------------------------------------------------------------
  const fetchSuggestions = useCallback(async (query) => {
    if (query.trim().length < 4) { setSuggestions([]); setShowSuggestions(false); return; }
    try {
      // Bias toward ME/NH area (bounded=0 allows results outside viewport too)
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&countrycodes=us&addressdetails=1&viewbox=-73.0,42.5,-69.5,47.5&bounded=0`;
      const resp = await fetch(url, { headers: { 'User-Agent': 'GreenShieldDashboard/1.0' } });
      if (!resp.ok) return;
      const data = await resp.json();
      const formatted = data.map(item => {
        const a = item.address || {};
        const streetNum = a.house_number || '';
        const street    = a.road || a.pedestrian || a.path || '';
        const primary   = [streetNum, street].filter(Boolean).join(' ') ||
                          item.display_name.split(',')[0].trim();
        const city  = a.city || a.town || a.village || a.hamlet || '';
        const state = a.state || '';
        const zip   = a.postcode || '';
        const secondary = [city, [state, zip].filter(Boolean).join(' ')]
                            .filter(Boolean).join(', ');
        const shortDisplay = [primary, secondary].filter(Boolean).join(', ');
        return { primary, secondary, shortDisplay, full: item.display_name,
                 lat: parseFloat(item.lat), lng: parseFloat(item.lon) };
      }).filter(s => s.primary);
      setSuggestions(formatted);
      setShowSuggestions(formatted.length > 0);
      setActiveSuggestion(-1);
    } catch {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, []);

  const selectSuggestion = useCallback((s) => {
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveSuggestion(-1);
    setAddressInput(s.shortDisplay);
    // Use coordinates directly from the suggestion — no second geocode call needed
    const result = { lat: s.lat, lng: s.lng, display: s.shortDisplay, full: s.full };
    geocodeCacheRef.current[s.shortDisplay] = result;
    setGeocode(result);
    setGeocodeStatus('success');
    setResults(null);
    setScoringStatus('idle');
    setTimePref(null);
    setSpecificSlot(null);
    setShowOther(false);
    setIsEditing(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Geocode
  // ---------------------------------------------------------------------------
  const doGeocode = useCallback(async (addr) => {
    const trimmed = addr.trim();
    if (!trimmed) return;
    if (geocodeCacheRef.current[trimmed]) {
      setGeocode(geocodeCacheRef.current[trimmed]);
      setGeocodeStatus('success');
      setResults(null);
      setScoringStatus('idle');
      setTimePref(null);
      setSpecificSlot(null);
      setShowOther(false);
      setIsEditing(false);
      return;
    }
    setGeocodeStatus('loading');
    setGeocodeError('');
    setResults(null);
    setScoringStatus('idle');
    setTimePref(null);
    setSpecificSlot(null);
    setShowOther(false);
    try {
      const result = await nominatimGeocode(trimmed);
      geocodeCacheRef.current[trimmed] = result;
      setGeocode(result);
      setGeocodeStatus('success');
      setIsEditing(false);
    } catch (err) {
      setGeocodeStatus('error');
      setGeocodeError(err.message);
    }
  }, []);

  const handleAddressKey = (e) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestion(prev => Math.min(prev + 1, suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestion(prev => Math.max(prev - 1, -1));
        return;
      }
      if (e.key === 'Enter' && activeSuggestion >= 0) {
        e.preventDefault();
        selectSuggestion(suggestions[activeSuggestion]);
        return;
      }
      if (e.key === 'Escape') {
        setSuggestions([]);
        setShowSuggestions(false);
        setActiveSuggestion(-1);
        return;
      }
    }
    if (e.key === 'Enter') doGeocode(addressInput);
  };

  // ---------------------------------------------------------------------------
  // Scoring
  // ---------------------------------------------------------------------------
  const runScore = useCallback(async (techList, latLng, prefStr = 'AT') => {
    if (!techList?.length || !latLng) return;
    setScoringStatus('loading');
    setScoringError('');
    try {
      const routeArea = detectRouteArea(latLng.full || '');
      const lead = {
        lat: latLng.lat,
        lng: latLng.lng,
        serviceType: 'Regular Service',
        durationMinutes: 30,
        timeWindowPreference: prefStr || 'AT',
        routeArea,
        date: activeDateRef.current,
      };
      const scored = scoreRoutes(techList, lead, 3);
      setResults(scored);
      setScoringStatus('done');
    } catch (err) {
      setScoringStatus('error');
      setScoringError(err.message || 'Scoring failed');
    }
  }, []);

  const handleTimePrefSelect = useCallback((key) => {
    setTimePref(key);
    setSpecificSlot(null);
    if (key !== 'specific' && geocode && activeTechnicians?.length) {
      runScore(activeTechnicians, geocode, key);
    }
  }, [geocode, activeTechnicians, runScore]);

  const handleSpecificSlotSelect = useCallback((slot) => {
    setSpecificSlot(slot);
    if (geocode && activeTechnicians?.length) {
      runScore(activeTechnicians, geocode, slot);
    }
  }, [geocode, activeTechnicians, runScore]);

  // ---------------------------------------------------------------------------
  // Auto-score when both geocode + technicians are ready
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!geocode || !activeTechnicians?.length) return;
    runScore(activeTechnicians, geocode, 'AT');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geocode, activeTechnicians]);

  const handleReset = () => {
    setAddressInput('');
    setGeocode(null);
    setGeocodeStatus('idle');
    setGeocodeError('');
    setIsEditing(false);
    setTimePref(null);
    setSpecificSlot(null);
    setShowOther(false);
    setSpecialNotes('');
    setResults(null);
    setScoringStatus('idle');
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveSuggestion(-1);
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="p-card section-enter flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-black/[0.05] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gs-accent/10 flex items-center justify-center">
            <Navigation size={14} className="text-gs-accent" />
          </div>
          <div>
            <h3 className="text-[13px] font-bold text-gs-text m-0 leading-none">Route Finder</h3>
            <p className="type-label-sm text-slate-400 m-0 mt-0.5 font-normal tracking-normal">
              Find best technician for a new stop
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleRefreshAll}
            className="bg-transparent border-0 cursor-pointer text-slate-400 p-1 rounded-md flex items-center"
            title="Refresh all dates"
          >
            <RefreshCw size={13} />
          </button>
          {(geocode || results) && (
            <button
              type="button"
              onClick={handleReset}
              className="bg-transparent border-0 cursor-pointer text-slate-400 p-1 rounded-md flex items-center"
              title="Reset"
            >
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>

        {/* ── FieldRoutes auth status ── */}
        <AuthStatusBanner authInfo={authInfo} onLoginRefreshStarted={handleLoginRefreshStarted} />

        {statusMountError && (
          <div
            className="mb-2.5 rounded-lg border border-gs-danger/30 bg-gs-danger/[0.05] px-3 py-2 flex items-start justify-between gap-2"
            role="alert"
          >
            <p className="type-label-sm text-gs-danger m-0 flex items-start gap-1 font-normal tracking-normal leading-snug">
              <AlertCircle size={11} className="shrink-0 mt-px" />
              <span>Could not load route cache status. {statusMountError}</span>
            </p>
            <button
              type="button"
              onClick={() => loadInitialRouteStatus()}
              className="type-label-sm text-gs-danger bg-transparent border border-gs-danger/30 rounded-md px-2 py-0.5 font-semibold cursor-pointer shrink-0 tracking-normal"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Date picker ── */}
        <div className="mb-3.5">
          <label className="type-label-sm uppercase tracking-[0.06em] text-gs-muted block mb-1.5">
            Route Date
          </label>
          <div className="route-date-pill-grid">
            {DATE_METAS.map(({ key, label }) => {
              const s = dateStatus[key] || { status: 'missing' };
              const isCached = s.status === 'cached';
              const isActive = activeDate === key;
              const isLoading = dateLoadStatus === 'loading' && isActive;

              return (
                <div key={key} className="route-date-pill-cell">
                  <button
                    type="button"
                    onClick={() => isCached && handleDateSelect(key)}
                    className="w-full py-1.5 px-1 rounded-[9px] transition-all duration-150 flex items-center justify-center gap-1"
                    style={{
                      border: `1.5px solid ${isActive ? '#16A34A' : isCached ? 'rgba(22,163,74,0.3)' : 'rgba(0,0,0,0.08)'}`,
                      background: isActive ? '#16A34A' : isCached ? 'rgba(22,163,74,0.04)' : '#f8fafc',
                      cursor: isCached ? 'pointer' : 'default',
                    }}
                  >
                    {isLoading && <Loader2 size={9} className="animate-spin" style={{ color: isActive ? '#fff' : '#16A34A' }} />}
                    <span
                      className="text-[11px] font-bold leading-none"
                      style={{ color: isActive ? '#fff' : isCached ? '#0F172A' : '#94A3B8' }}
                    >
                      {label}
                    </span>
                  </button>
                  <StatusBadge status={s.status} meta={s} date={key} onRefresh={handleRefresh} />
                </div>
              );
            })}
          </div>

          {activeDate && activeTechnicians !== null && activeTechnicians.length === 0 && dateLoadStatus !== 'loading' && (
            <p className="type-label-sm text-amber-500 mt-1.5 flex items-center gap-1 font-normal tracking-normal">
              <AlertCircle size={10} /> No routes with stops found for this date
            </p>
          )}
          {activeDate && dateLoadStatus === 'error' && (
            <p className="type-label-sm text-gs-danger mt-1.5 flex items-center gap-1 font-normal tracking-normal">
              <AlertCircle size={10} /> Failed to load route data
            </p>
          )}
        </div>

        {/* ── Address input ── */}
        <div className="mb-3">
          <label className="type-label-sm uppercase tracking-[0.06em] text-gs-muted block mb-[5px]">
            Customer Address
          </label>

          {geocodeStatus === 'success' && !isEditing ? (
            <div className="rounded-[10px] border border-gs-accent/30 bg-gs-accent/[0.04] px-2.5 py-2 flex items-start gap-[7px]">
              <CheckCircle size={13} className="text-gs-accent mt-px shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-gs-text m-0 leading-[1.3]">{geocode.display}</p>
                <p className="type-mono text-slate-400 mt-0.5 mb-0">
                  {geocode.lat.toFixed(5)}, {geocode.lng.toFixed(5)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="type-label-sm text-gs-accent bg-transparent border-0 cursor-pointer py-px px-1 font-semibold shrink-0 tracking-normal"
              >
                Edit
              </button>
            </div>
          ) : (
            <div className="relative">
              <MapPin size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 z-[1]" />
              <input
                autoFocus={isEditing}
                value={addressInput}
                onChange={e => {
                  const val = e.target.value;
                  setAddressInput(val);
                  setActiveSuggestion(-1);
                  if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
                  if (val.trim().length >= 4) {
                    suggestDebounceRef.current = setTimeout(() => fetchSuggestions(val), 350);
                  } else {
                    setSuggestions([]);
                    setShowSuggestions(false);
                  }
                }}
                onKeyDown={handleAddressKey}
                placeholder="Start typing an address…"
                className="w-full box-border py-2 pl-7 pr-9 rounded-[10px] text-xs text-gs-text bg-slate-50 outline-none"
                style={{
                  border: `1px solid ${geocodeStatus === 'error' ? 'rgba(220,38,38,0.4)' : 'rgba(0,0,0,0.1)'}`,
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'rgba(22,163,74,0.4)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(22,163,74,0.08)';
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                onBlur={e => {
                  if (suppressBlurRef.current) { suppressBlurRef.current = false; return; }
                  e.target.style.borderColor = geocodeStatus === 'error' ? 'rgba(220,38,38,0.4)' : 'rgba(0,0,0,0.1)';
                  e.target.style.boxShadow = 'none';
                  setShowSuggestions(false);
                  if (addressInput.trim()) doGeocode(addressInput);
                }}
              />
              {geocodeStatus === 'loading' ? (
                <Loader2 size={12} className="animate-spin absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              ) : (
                <button
                  type="button"
                  onClick={() => doGeocode(addressInput)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-transparent border-0 cursor-pointer p-[3px] text-slate-400 flex"
                >
                  <Search size={12} />
                </button>
              )}

              {/* Autocomplete dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-[200] bg-white rounded-[10px] mt-1 border border-black/10 shadow-[0_6px_20px_rgba(0,0,0,0.1)] overflow-hidden">
                  {suggestions.map((s, i) => (
                    <div
                      key={i}
                      onMouseDown={() => { suppressBlurRef.current = true; selectSuggestion(s); }}
                      onMouseEnter={() => setActiveSuggestion(i)}
                      className={`py-[7px] px-[11px] cursor-pointer flex items-start gap-2 transition-colors duration-100 ${
                        i < suggestions.length - 1 ? 'border-b border-black/[0.05]' : ''
                      }`}
                      style={{
                        background: i === activeSuggestion ? 'rgba(22,163,74,0.06)' : '#fff',
                      }}
                    >
                      <MapPin
                        size={11}
                        className="mt-0.5 shrink-0"
                        style={{ color: i === activeSuggestion ? '#16A34A' : '#94A3B8' }}
                      />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gs-text m-0 leading-[1.3] truncate">
                          {s.primary}
                        </p>
                        {s.secondary && (
                          <p className="type-label-sm text-gs-muted mt-px mb-0 truncate font-normal tracking-normal">
                            {s.secondary}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {geocodeStatus === 'error' && (
            <p className="type-label-sm text-gs-danger mt-1 flex items-center gap-1 font-normal tracking-normal">
              <AlertCircle size={10} /> {geocodeError} — try a more complete address
            </p>
          )}
          <p className="type-label-sm text-slate-400 mt-1 font-normal tracking-normal">
            Type to see suggestions · press Enter or ↑↓ to navigate
          </p>
        </div>

        {/* ── Other windows toggle ── */}
        {geocodeStatus === 'success' && (
          <div className={`flex items-center ${showOther ? 'mb-0' : 'mb-2.5'}`}>
            <button
              type="button"
              onClick={() => {
                const closing = showOther;
                setShowOther(o => !o);
                if (closing) {
                  setTimePref(null);
                  setSpecificSlot(null);
                  if (geocode && activeTechnicians?.length) runScore(activeTechnicians, geocode, 'AT');
                }
              }}
              className="bg-transparent border-0 cursor-pointer p-0 text-[11px] text-blue-500 font-semibold flex items-center gap-0.5"
            >
              {showOther ? '▴' : '▾'} Other windows
            </button>
          </div>
        )}

        {/* ── Other: timing preference picker ── */}
        {geocodeStatus === 'success' && showOther && (
          <div className="mb-3 px-3 py-2.5 bg-blue-500/[0.04] rounded-[10px] border border-blue-500/15">
            <div className={`flex gap-1.5 ${timePref === 'specific' ? 'mb-2.5' : 'mb-0'}`}>
              {TIME_PREFS.map(({ key, label, sub }) => {
                const active = timePref === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleTimePrefSelect(key)}
                    className="flex-1 py-[7px] px-1 rounded-[9px] cursor-pointer text-center transition-all duration-150"
                    style={{
                      border: `1.5px solid ${active ? '#3B82F6' : 'rgba(0,0,0,0.1)'}`,
                      background: active ? '#3B82F6' : '#fff',
                    }}
                  >
                    <div className="text-xs font-bold leading-none" style={{ color: active ? '#fff' : '#374151' }}>{label}</div>
                    <div className="text-[9px] mt-0.5" style={{ color: active ? 'rgba(255,255,255,0.75)' : '#94A3B8' }}>{sub}</div>
                  </button>
                );
              })}
            </div>

            {timePref === 'specific' && (
              <div>
                <p className="type-label-sm text-gs-muted mb-[5px] font-normal tracking-normal">4-hour slots</p>
                <div className="flex gap-[5px] mb-2">
                  {FOUR_HOUR_SLOTS.map(({ key, label }) => {
                    const active = specificSlot === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSpecificSlotSelect(key)}
                        className="flex-1 py-1.5 px-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-all duration-150"
                        style={{
                          border: `1.5px solid ${active ? '#3B82F6' : 'rgba(0,0,0,0.1)'}`,
                          background: active ? '#3B82F6' : '#fff',
                          color: active ? '#fff' : '#374151',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p className="type-label-sm text-gs-muted mb-[5px] font-normal tracking-normal">2-hour slots</p>
                <div className="flex flex-wrap gap-[5px]">
                  {TWO_HOUR_SLOTS.map(({ key, label }) => {
                    const active = specificSlot === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSpecificSlotSelect(key)}
                        className="py-[5px] px-2 rounded-[7px] type-label-sm font-semibold cursor-pointer transition-all duration-150 tracking-normal"
                        style={{
                          border: `1.5px solid ${active ? '#3B82F6' : 'rgba(0,0,0,0.1)'}`,
                          background: active ? '#3B82F6' : '#fff',
                          color: active ? '#fff' : '#374151',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Special notes ── */}
        {geocodeStatus === 'success' && (
          <div className="mb-3">
            <label className="type-label-sm uppercase tracking-[0.06em] text-gs-muted block mb-[5px]">
              Special Notes <span className="font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={specialNotes}
              onChange={e => setSpecialNotes(e.target.value)}
              placeholder="e.g. call ahead, gate code, commercial account..."
              rows={2}
              className="w-full box-border py-[7px] px-2.5 rounded-[9px] resize-none border border-black/10 text-[11px] text-gray-700 bg-slate-50 outline-none leading-[1.4]"
              onFocus={e => { e.target.style.borderColor = 'rgba(22,163,74,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(22,163,74,0.08)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.1)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>
        )}

        {/* ── No date selected hint ── */}
        {!activeDate && geocodeStatus === 'success' && (
          <p style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', marginBottom: 10 }}>
            Select a date above to see recommendations
          </p>
        )}

        {/* ── Auto-scoring loading indicator ── */}
        {scoringStatus === 'loading' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: '#64748B', fontSize: 11 }}>
            <Loader2 size={12} className="animate-spin" style={{ color: '#16A34A' }} />
            Finding best routes...
          </div>
        )}

        {scoringStatus === 'error' && (
          <p style={{ fontSize: 11, color: '#DC2626', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertCircle size={12} /> {scoringError}
          </p>
        )}

        {/* ── Results ── */}
        {scoringStatus === 'done' && results && (
          <div>
            {/* Route area header (NH / Maine) */}
            {results.routeArea && results.routeArea !== 'general' && (
              <div style={{
                marginBottom: 8, padding: '5px 10px', borderRadius: 8,
                background: results.routeArea === 'new_hampshire' ? 'rgba(59,130,246,0.06)' : 'rgba(139,92,246,0.06)',
                border: `1px solid ${results.routeArea === 'new_hampshire' ? 'rgba(59,130,246,0.2)' : 'rgba(139,92,246,0.2)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: results.routeArea === 'new_hampshire' ? '#3B82F6' : '#8B5CF6' }}>
                  {results.routeArea === 'new_hampshire' ? 'New Hampshire Route' : 'Maine Route'}
                </span>
                {results.routeArea === 'new_hampshire' && (
                  <span style={{ fontSize: 9, color: '#64748B' }}>Alex Gray only</span>
                )}
              </div>
            )}
            {/* No-safe-route message */}
            {results.noSafeRoute ? (
              <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(220,38,38,0.2)', background: 'rgba(220,38,38,0.04)' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#DC2626', margin: 0, lineHeight: 1.4 }}>
                  {results.noSafeRouteMessage}
                </p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                    Top {results.topMatches.length} Matches
                  </p>
                  <button
                    onClick={() => runScore(activeTechnicians, geocode, timePref === 'specific' ? specificSlot : timePref ?? 'AT')}
                    style={{ fontSize: 10, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Re-score
                  </button>
                </div>
                {results.topMatches.map(match => (
                  <ResultCard key={match.routeId} match={match} rank={match.rank} routeArea={results.routeArea} />
                ))}
                <p className="type-label-sm text-slate-400 text-center mt-1 font-normal tracking-normal">
                  {results.totalRoutesScored} routes scored · {results.prefWindow.label === 'AT' ? 'best available window' : `${results.prefWindow.startTime}–${results.prefWindow.endTime}`}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
