import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { MapPin, Search, Loader2, CheckCircle, AlertCircle, RotateCcw, Navigation, RefreshCw, Route } from 'lucide-react';
import RouteFinderScoringSkeleton from './RouteFinderCommandSkeleton.jsx';
import { api } from '../../../api/client.js';
import StatusBadge from './RouteStatusBadge.jsx';
import RouteMatchResults from './RouteMatchResults.jsx';
import AuthStatusBanner from './RouteAuthBanner.jsx';
import RouteFinderJobDetails from './RouteFinder/RouteFinderJobDetails.jsx';
import { buildDateMetas } from './RouteFinder/routeFinderDates.js';
import { TIME_PREFS, FOUR_HOUR_SLOTS, TWO_HOUR_SLOTS } from './RouteFinder/routeFinderConstants.js';
import { getDatePillTitle } from './RouteFinder/getDatePillTitle.js';
import { buildRouteDateHelperText } from './RouteFinder/buildRouteDateHelperText.js';
import { resolveTimeWindowPref } from './RouteFinder/resolveTimeWindowPref.js';
import { useRouteFinderBackgroundRefresh } from './RouteFinder/useRouteFinderBackgroundRefresh.js';
import {
  SCORING_MODES,
  buildRouteFinderLead,
  detectRouteArea,
  scoreSingleDate,
  scoreBestAvailable,
} from '../../../utils/routeFinderScoring.js';

function routeFinderDebug(label, detail) {
  if (import.meta.env.DEV) {
    console.debug(`[RouteFinder] ${label}`, detail);
  }
}
import {
  fetchAddressSuggestions,
  lookupAddress,
  describeGeocodeError,
  geocodeFromSuggestion,
  resolveFromSuggestCache,
} from '../../../utils/geocodeClient.js';

const SUGGEST_DEBOUNCE_MS = 900;

function RouteSection({ page, children, className = '' }) {
  if (!page) return children;
  return (
    <section className={['route-finder-section', className].filter(Boolean).join(' ')}>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main widget — sub-components in RouteStatusBadge, RouteResultCard, RouteAuthBanner
// ---------------------------------------------------------------------------
export default function RouteFinderWidget({ variant = 'embedded' }) {
  const isPage = variant === 'page';
  // Date selection
  const DATE_METAS = useMemo(() => buildDateMetas(), []);
  const DATE_KEYS  = useMemo(() => DATE_METAS.map(d => d.key), [DATE_METAS]);

  const [activeDate, setActiveDate]           = useState(null);
  const [dateStatus, setDateStatus]           = useState({});
  const [authInfo, setAuthInfo]               = useState({ status: 'unknown' });
  const [activeTechnicians, setActiveTechnicians] = useState(null);
  const [dateLoadStatus, setDateLoadStatus]   = useState('idle'); // idle|loading|error
  const [dateLoadError, setDateLoadError]     = useState('');
  const [statusMountError, setStatusMountError] = useState(null);
  const [refreshAllPending, setRefreshAllPending] = useState(false);

  // Address
  const [addressInput, setAddressInput]   = useState('');
  const [geocode, setGeocode]             = useState(null);
  const [geocodeStatus, setGeocodeStatus] = useState('idle');
  const [geocodeError, setGeocodeError]   = useState('');
  const [suggestError, setSuggestError]   = useState('');
  const [isEditing, setIsEditing]         = useState(false);

  // Address autocomplete
  const [suggestions, setSuggestions]         = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);

  // Scoring mode
  const [scoringMode, setScoringMode] = useState(SCORING_MODES.SINGLE_DATE);

  // Job details
  const [serviceTypeId, setServiceTypeId] = useState('');
  const [customDurationMinutes, setCustomDurationMinutes] = useState('45');
  const [customerName, setCustomerName] = useState('');
  const [jobNotes, setJobNotes] = useState('');
  const [callAheadRequired, setCallAheadRequired] = useState(false);
  const [jobValidationErrors, setJobValidationErrors] = useState([]);

  // Time preference
  const [timePref, setTimePref]         = useState(null);
  const [specificSlot, setSpecificSlot] = useState(null);

  // Scoring
  const [scoringStatus, setScoringStatus] = useState('idle');
  const [scoringError, setScoringError]   = useState('');
  const [results, setResults]             = useState(null);

  const geocodeCacheRef       = useRef({});
  const suggestCacheRef       = useRef({});
  const suggestDebounceRef    = useRef(null);
  const suggestRequestIdRef   = useRef(0);
  const suppressBlurRef       = useRef(false);
  const pollRef            = useRef(null);
  const dateKeysRef     = useRef(DATE_KEYS);
  useEffect(() => { dateKeysRef.current = DATE_KEYS; }, [DATE_KEYS]);
  const activeDateRef   = useRef(activeDate);
  useEffect(() => { activeDateRef.current = activeDate; }, [activeDate]);
  const payloadRequestRef = useRef(0);
  const scoreRequestRef = useRef(0);

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

  const refreshRouteStatus = useCallback(async () => {
    const statusData = await api.routes.status();
    applyStatusData(statusData);
    return statusData;
  }, [applyStatusData]);

  const handleLoginRefreshStarted = useCallback(async () => {
    const statusData = await refreshRouteStatus();
    if (statusData?._auth?.status === 'ok') {
      const needsLoad = DATE_KEYS.some(d => {
        const s = statusData[d]?.status;
        return !s || s === 'missing';
      });
      if (needsLoad) {
        api.routes.preload(false).catch(() => {});
        setDateStatus(prev => {
          const next = { ...prev };
          DATE_KEYS.forEach(d => {
            const status = next[d]?.status;
            if (!status || status === 'missing') {
              next[d] = { ...(next[d] || {}), status: 'refreshing' };
            }
          });
          return next;
        });
        startPolling();
      }
    }
    return statusData;
  }, [DATE_KEYS, refreshRouteStatus, startPolling]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const reloadActiveDatePayload = useCallback(async (statusData) => {
    const date = activeDateRef.current;
    if (!date || !statusData) return;
    if (statusData[date]?.status !== 'cached') return;
    const requestId = ++payloadRequestRef.current;
    try {
      const data = await api.routes.payload(date);
      if (requestId !== payloadRequestRef.current) return;
      setActiveTechnicians(data.technicians || []);
      routeFinderDebug('active date payload reloaded', { date, techs: data.technicians?.length ?? 0 });
    } catch (err) {
      console.warn('[RouteFinder] silent payload reload failed:', err?.message);
    }
  }, []);

  useRouteFinderBackgroundRefresh({
    applyStatusData,
    startPolling,
    reloadActiveDatePayload,
    getPriorityDates: () => (activeDateRef.current ? [activeDateRef.current] : []),
  });

  // ---------------------------------------------------------------------------
  // On mount: load status, trigger preload for missing dates
  // ---------------------------------------------------------------------------
  const loadInitialRouteStatus = useCallback(async () => {
    try {
      try {
        const auth = await api.routes.authStatus();
        if (auth?.status) {
          setAuthInfo(prev => ({
            ...prev,
            status: auth.status,
            lastCheck: auth.lastCheck,
            message: auth.message,
            lastCheckFormatted: auth.lastCheck
              ? new Date(auth.lastCheck).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
              : prev.lastCheckFormatted,
          }));
        }
      } catch (authErr) {
        console.warn('[RouteFinder] auth status read failed:', authErr?.message);
      }

      const statusData = await api.routes.status();
      applyStatusData(statusData);
      setStatusMountError(null);

      const needsLoad = DATE_KEYS.some(d => {
        const s = statusData[d]?.status;
        return !s || s === 'missing';
      });
      const authStatus = statusData._auth?.status;
      const canPreload = authStatus === 'ok' || authStatus === 'unknown';

      if (needsLoad && canPreload) {
        api.routes.preload(false).catch(() => {});
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
      } else {
        const anyRefreshing = DATE_KEYS.some(d => statusData[d]?.status === 'refreshing');
        if (anyRefreshing) startPolling();
      }
    } catch (err) {
      setStatusMountError(err?.message || 'Route status unavailable');
      try {
        const auth = await api.routes.authStatus();
        if (auth?.status) {
          setAuthInfo(prev => ({
            ...prev,
            status: auth.status,
            lastCheck: auth.lastCheck,
            message: auth.message,
          }));
        }
      } catch { /* ignore */ }
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

    setDateLoadStatus('loading');
    setDateLoadError('');
    try {
      const data = await api.routes.payload(date);
      if (requestId !== payloadRequestRef.current) return;
      setActiveTechnicians(data.technicians || []);
      setDateLoadStatus('idle');
      setDateLoadError('');
    } catch (err) {
      if (requestId !== payloadRequestRef.current) return;
      setDateLoadStatus('error');
      setActiveTechnicians(null);
      const message = err?.message || 'Failed to load route data';
      setDateLoadError(message);
      console.warn('[RouteFinderWidget] payload load failed:', message);
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
      setRefreshAllPending(true);
      setDateStatus(prev => {
        const next = { ...prev };
        DATE_KEYS.forEach(d => { next[d] = { ...(next[d] || {}), status: 'refreshing' }; });
        return next;
      });
      startPolling();
    } catch { /* ignore */ }
  }, [DATE_KEYS, startPolling]);

  const anyDateRefreshing = DATE_KEYS.some(d => dateStatus[d]?.status === 'refreshing');
  const authNeedsLogin = authInfo.status === 'needs_login';
  const hasCachedDate = DATE_KEYS.some(d => dateStatus[d]?.status === 'cached');

  useEffect(() => {
    if (!anyDateRefreshing) {
      setRefreshAllPending(false);
    }
  }, [anyDateRefreshing]);

  const routeDateHelperText = buildRouteDateHelperText({
    authNeedsLogin,
    anyDateRefreshing,
    refreshAllPending,
    hasCachedDate,
  });

  // ---------------------------------------------------------------------------
  // Address autocomplete
  // ---------------------------------------------------------------------------
  const fetchSuggestions = useCallback(async (query) => {
    const trimmed = query.trim();
    if (trimmed.length < 4) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSuggestError('');
      return;
    }

    const cacheKey = trimmed.toLowerCase();
    if (suggestCacheRef.current[cacheKey]) {
      const formatted = suggestCacheRef.current[cacheKey];
      setSuggestions(formatted);
      setShowSuggestions(formatted.length > 0);
      setActiveSuggestion(-1);
      setSuggestError(
        formatted.length === 0
          ? 'No matches — try city and state, e.g. 24 Morning St, Portland, ME 04101'
          : '',
      );
      return;
    }

    const requestId = ++suggestRequestIdRef.current;
    try {
      const formatted = await fetchAddressSuggestions(trimmed);
      if (requestId !== suggestRequestIdRef.current) return;
      suggestCacheRef.current[cacheKey] = formatted;
      setSuggestions(formatted);
      setShowSuggestions(formatted.length > 0);
      setActiveSuggestion(-1);
      setSuggestError(
        formatted.length === 0
          ? 'No matches — try city and state, e.g. 24 Morning St, Portland, ME 04101'
          : '',
      );
    } catch (err) {
      if (requestId !== suggestRequestIdRef.current) return;
      console.warn('[geocode] suggest failed:', err);
      setSuggestions([]);
      setShowSuggestions(false);
      setSuggestError(describeGeocodeError(err));
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
    setIsEditing(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Geocode
  // ---------------------------------------------------------------------------
  const doGeocode = useCallback(async (addr, suggestionOverride = null) => {
    const trimmed = addr.trim();
    if (!trimmed) return;
    if (geocodeCacheRef.current[trimmed]) {
      setGeocode(geocodeCacheRef.current[trimmed]);
      setGeocodeStatus('success');
      setResults(null);
      setScoringStatus('idle');
      setTimePref(null);
      setSpecificSlot(null);
      setIsEditing(false);
      return;
    }

    const fromSuggestion = suggestionOverride
      ? geocodeFromSuggestion(suggestionOverride)
      : resolveFromSuggestCache(trimmed, suggestCacheRef.current, suggestions);
    if (fromSuggestion) {
      geocodeCacheRef.current[trimmed] = fromSuggestion;
      setGeocode(fromSuggestion);
      setGeocodeStatus('success');
      setResults(null);
      setScoringStatus('idle');
      setTimePref(null);
      setSpecificSlot(null);
      setIsEditing(false);
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setGeocodeStatus('loading');
    setGeocodeError('');
    setSuggestError('');
    setResults(null);
    setScoringStatus('idle');
    setTimePref(null);
    setSpecificSlot(null);
    try {
      const result = await lookupAddress(trimmed);
      geocodeCacheRef.current[trimmed] = result;
      setGeocode(result);
      setGeocodeStatus('success');
      setIsEditing(false);
    } catch (err) {
      console.warn('[geocode] lookup failed:', err);
      setGeocodeStatus('error');
      setGeocodeError(describeGeocodeError(err));
    }
  }, [suggestions]);

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
  const buildLeadForScoring = useCallback((latLng, prefStr, date) => {
    const routeArea = detectRouteArea(latLng.full || latLng.display || '');
    const built = buildRouteFinderLead({
      lat: latLng.lat,
      lng: latLng.lng,
      address: latLng.full || latLng.display || '',
      customerName,
      notes: jobNotes,
      callAheadRequired,
      serviceTypeId,
      customDurationMinutes: serviceTypeId === 'custom-duration' ? customDurationMinutes : null,
      timeWindowPreference: prefStr,
      routeArea,
      date: date ?? null,
    });
    if (!built.valid) {
      setJobValidationErrors(built.errors);
      return null;
    }
    setJobValidationErrors([]);
    return built.lead;
  }, [
    customerName,
    jobNotes,
    callAheadRequired,
    serviceTypeId,
    customDurationMinutes,
  ]);

  const runScore = useCallback(async () => {
    const pref = resolveTimeWindowPref(timePref, specificSlot);
    if (!geocode || !pref || !serviceTypeId) return;

    const requestId = ++scoreRequestRef.current;
    setScoringStatus('loading');
    setScoringError('');

    try {
      if (scoringMode === SCORING_MODES.SINGLE_DATE) {
        if (!activeTechnicians?.length) return;
        const lead = buildLeadForScoring(geocode, pref, activeDateRef.current);
        if (!lead) {
          setScoringStatus('idle');
          return;
        }
        routeFinderDebug('single-date search started', { date: activeDateRef.current, lead });
        const scored = scoreSingleDate(activeTechnicians, lead, 3);
        if (requestId !== scoreRequestRef.current) return;
        setResults(scored);
        setScoringStatus('done');
        return;
      }

      const leadBase = buildLeadForScoring(geocode, pref, null);
      if (!leadBase) {
        setScoringStatus('idle');
        return;
      }
      routeFinderDebug('best-available search started', { lead: leadBase });
      const scored = await scoreBestAvailable({
        leadBase,
        dateMetas: DATE_METAS,
        dateStatus,
        fetchPayload: (date) => api.routes.payload(date),
        topN: 3,
        maxExtra: 5,
      });
      if (requestId !== scoreRequestRef.current) return;
      setResults(scored);
      setScoringStatus('done');
    } catch (err) {
      if (requestId !== scoreRequestRef.current) return;
      setScoringStatus('error');
      setScoringError(err.message || 'Scoring failed');
      routeFinderDebug('search failed', err.message);
    }
  }, [
    geocode,
    timePref,
    specificSlot,
    serviceTypeId,
    scoringMode,
    activeTechnicians,
    buildLeadForScoring,
    DATE_METAS,
    dateStatus,
  ]);

  const timeWindowPref = resolveTimeWindowPref(timePref, specificSlot);

  const maybeRunScore = useCallback(() => {
    const pref = resolveTimeWindowPref(timePref, specificSlot);
    const hasJob = geocodeStatus === 'success' && geocode && serviceTypeId && pref;
    const singleReady = scoringMode === SCORING_MODES.SINGLE_DATE
      && activeDate && activeTechnicians?.length;
    const bestReady = scoringMode === SCORING_MODES.BEST_AVAILABLE
      && DATE_KEYS.some(d => dateStatus[d]?.status === 'cached');

    routeFinderDebug('search check', {
      mode: scoringMode,
      date: activeDate,
      hasJob,
      singleReady,
      bestReady,
    });

    if (!hasJob) return;
    if (scoringMode === SCORING_MODES.SINGLE_DATE && !singleReady) return;
    if (scoringMode === SCORING_MODES.BEST_AVAILABLE && !bestReady) return;
    runScore();
  }, [
    activeDate,
    geocodeStatus,
    geocode,
    activeTechnicians,
    timePref,
    specificSlot,
    serviceTypeId,
    scoringMode,
    dateStatus,
    DATE_KEYS,
    runScore,
  ]);

  useEffect(() => {
    maybeRunScore();
  }, [maybeRunScore]);

  const handleTimePrefSelect = useCallback((key) => {
    setTimePref(key);
    setSpecificSlot(null);
    setResults(null);
    setScoringStatus('idle');
  }, []);

  const handleSpecificSlotSelect = useCallback((slot) => {
    setSpecificSlot(slot);
    setResults(null);
    setScoringStatus('idle');
  }, []);

  const handleReset = () => {
    setAddressInput('');
    setGeocode(null);
    setGeocodeStatus('idle');
    setGeocodeError('');
    setIsEditing(false);
    setServiceTypeId('');
    setCustomDurationMinutes('45');
    setCustomerName('');
    setJobNotes('');
    setCallAheadRequired(false);
    setJobValidationErrors([]);
    setTimePref(null);
    setSpecificSlot(null);
    setResults(null);
    setScoringStatus('idle');
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveSuggestion(-1);
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
  };

  const handleScoringModeChange = useCallback((mode) => {
    setScoringMode(mode);
    setResults(null);
    setScoringStatus('idle');
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div
      className={[
        'section-enter flex flex-col',
        isPage ? 'rf-command rf-command-widget route-finder-widget--page flex-1 min-h-0 w-full relative' : 'p-card h-full',
      ].filter(Boolean).join(' ')}
    >
      {/* Header */}
      <div
        className={[
          'route-finder-toolbar shrink-0 flex items-center justify-between',
          isPage ? '' : 'px-5 pt-4 pb-3 border-b border-black/[0.05]',
        ].join(' ')}
      >
        <div className="flex items-center gap-2">
          <div className={isPage ? 'route-finder-toolbar__icon' : 'w-7 h-7 rounded-lg bg-gs-accent/10 flex items-center justify-center'}>
            <Navigation size={isPage ? 16 : 14} className={isPage ? undefined : 'text-gs-accent'} />
          </div>
          <div>
            {isPage ? (
              <>
                <h1 className="text-base lg:text-lg font-bold text-gs-text m-0 leading-tight">Route Finder</h1>
                <p className="type-label-sm text-slate-400 m-0 mt-0.5 font-normal tracking-normal">
                  FieldRoutes scheduling — best technician for a new stop
                </p>
              </>
            ) : (
              <>
                <h3 className="text-[13px] font-bold text-gs-text m-0 leading-none">Route Finder</h3>
                <p className="type-label-sm text-slate-400 m-0 mt-0.5 font-normal tracking-normal">
                  Find best technician for a new stop
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={anyDateRefreshing}
            aria-busy={anyDateRefreshing}
            className="route-finder-header-action bg-transparent border-0 cursor-pointer text-slate-400 rounded-md flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
            title={anyDateRefreshing ? 'Refreshing all dates…' : 'Refresh all dates from FieldRoutes'}
          >
            <RefreshCw size={13} className={anyDateRefreshing ? 'animate-spin' : ''} />
          </button>
          {(geocode || results) && (
            <button
              type="button"
              onClick={handleReset}
              className="route-finder-header-action bg-transparent border-0 cursor-pointer text-slate-400 rounded-md flex items-center justify-center"
              title="Reset"
            >
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="route-finder-body">
        <div className={isPage ? 'route-finder-page-layout' : undefined}>

        <RouteSection page={isPage}>
        {/* ── FieldRoutes auth status ── */}
        <AuthStatusBanner
          authInfo={authInfo}
          onLoginRefreshStarted={handleLoginRefreshStarted}
          compact={isPage}
        />

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
        </RouteSection>

        <RouteSection page={isPage}>
        {/* ── Scoring mode ── */}
        <div className={isPage ? 'mb-3' : 'mb-3'}>
          <label className={isPage ? 'rf-section-label' : 'type-label-sm uppercase tracking-[0.06em] text-gs-muted block mb-1.5'}>
            Search Mode
          </label>
          <div className="rf-mode-toggle">
            <button
              type="button"
              className={['rf-mode-toggle__btn', scoringMode === SCORING_MODES.SINGLE_DATE ? 'rf-mode-toggle__btn--active' : ''].filter(Boolean).join(' ')}
              onClick={() => handleScoringModeChange(SCORING_MODES.SINGLE_DATE)}
            >
              Single Date
            </button>
            <button
              type="button"
              className={['rf-mode-toggle__btn', scoringMode === SCORING_MODES.BEST_AVAILABLE ? 'rf-mode-toggle__btn--active' : ''].filter(Boolean).join(' ')}
              onClick={() => handleScoringModeChange(SCORING_MODES.BEST_AVAILABLE)}
            >
              Best Available
            </button>
          </div>
          <p className="route-finder-helper type-label-sm text-gs-muted mb-0 mt-1.5 font-normal tracking-normal leading-snug">
            {scoringMode === SCORING_MODES.BEST_AVAILABLE
              ? 'Compares all cached upcoming dates and ranks the best technician + day combinations.'
              : 'Scores routes for one selected date.'}
          </p>
        </div>
        </RouteSection>

        <RouteSection page={isPage}>
        {/* ── Date picker ── */}
        <div className={isPage ? 'mb-0' : 'mb-3.5'}>
          <label className={isPage ? 'rf-section-label' : 'type-label-sm uppercase tracking-[0.06em] text-gs-muted block mb-1.5'}>
            {scoringMode === SCORING_MODES.BEST_AVAILABLE ? 'Cached Route Dates' : 'Route Date'}
          </label>
          {routeDateHelperText && (
            <p className="route-finder-helper type-label-sm text-gs-muted mb-2 font-normal tracking-normal leading-snug m-0">
              {routeDateHelperText}
            </p>
          )}
          <div className="route-date-pill-grid">
            {DATE_METAS.map(({ key, label }) => {
              const s = dateStatus[key] || { status: 'missing' };
              const isCached = s.status === 'cached';
              const isActive = activeDate === key;
              const isLoading = dateLoadStatus === 'loading' && isActive;
              const pillTitle = getDatePillTitle(s.status, s, label);

              return (
                <div key={key} className="route-date-pill-cell">
                  <motion.button
                    type="button"
                    onClick={() => isCached && scoringMode === SCORING_MODES.SINGLE_DATE && handleDateSelect(key)}
                    disabled={!isCached || scoringMode === SCORING_MODES.BEST_AVAILABLE}
                    aria-disabled={!isCached}
                    title={pillTitle}
                    whileHover={isCached && !isActive ? { scale: 1.02 } : undefined}
                    whileTap={isCached ? { scale: 0.98 } : undefined}
                    className={[
                      'route-date-pill-button w-full py-1.5 px-1 rounded-[9px] transition-all duration-150 flex items-center justify-center gap-1',
                      isActive ? 'route-date-pill-button--active' : isCached ? 'route-date-pill-button--cached' : 'route-date-pill-button--idle',
                    ].join(' ')}
                  >
                    {isLoading && (
                      <Loader2
                        size={9}
                        className={[
                          'animate-spin route-date-pill-spinner',
                          isActive ? 'route-date-pill-spinner--on-active' : '',
                        ].filter(Boolean).join(' ')}
                      />
                    )}
                    <span
                      className={[
                        'route-date-pill-label text-[11px] font-bold leading-none',
                        isActive ? 'route-date-pill-label--active' : isCached ? 'route-date-pill-label--cached' : 'route-date-pill-label--idle',
                      ].join(' ')}
                    >
                      {label}
                    </span>
                  </motion.button>
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
            <p className="route-finder-inline-error" role="alert">
              <AlertCircle size={10} className="shrink-0" />
              <span>{dateLoadError || 'Failed to load route data'}</span>
            </p>
          )}
        </div>
        </RouteSection>

        <RouteSection page={isPage} className="route-finder-section--address">
        {/* ── Address input ── */}
        <div className={isPage ? 'mb-0' : 'mb-3'}>
          <label className={isPage ? 'rf-section-label' : 'type-label-sm uppercase tracking-[0.06em] text-gs-muted block mb-[5px]'}>
            Customer Address
          </label>

          {geocodeStatus === 'success' && !isEditing ? (
            <div className={isPage ? 'rf-address-card' : 'rounded-[10px] border border-gs-accent/30 bg-gs-accent/[0.04] px-2.5 py-2 flex items-start gap-[7px]'}>
              <CheckCircle size={isPage ? 16 : 13} className="text-gs-accent mt-px shrink-0" />
              <div className="flex-1 min-w-0">
                <p className={isPage ? 'rf-address-card__text' : 'text-[11px] font-semibold text-gs-text m-0 leading-snug'}>
                  {geocode.full || geocode.display}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className={isPage ? 'rf-address-card__edit' : 'type-label-sm text-gs-accent bg-transparent border-0 cursor-pointer py-px px-1 font-semibold shrink-0 tracking-normal'}
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
                    suggestDebounceRef.current = setTimeout(() => fetchSuggestions(val), SUGGEST_DEBOUNCE_MS);
                  } else {
                    setSuggestions([]);
                    setShowSuggestions(false);
                  }
                }}
                onKeyDown={handleAddressKey}
                placeholder="Start typing an address…"
                className={[
                  'route-address-input w-full box-border py-2 pl-7 pr-9 rounded-[10px] text-xs text-gs-text outline-none',
                  isPage ? 'route-address-input--page' : 'bg-slate-50',
                  geocodeStatus === 'error' ? 'route-address-input--error' : '',
                ].filter(Boolean).join(' ')}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                onBlur={() => {
                  if (suppressBlurRef.current) {
                    suppressBlurRef.current = false;
                    return;
                  }
                  setShowSuggestions(false);
                  // Do not auto-lookup on blur — clicking match cards / elsewhere
                  // used to fire a second Nominatim call and trigger rate limits.
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

              {suggestError && (
                <p className="text-[9px] text-amber-700 mt-1 mb-0 leading-snug" role="status">
                  {suggestError}
                </p>
              )}

              {/* Autocomplete dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-[200] bg-white rounded-[10px] mt-1 border border-black/10 shadow-[0_6px_20px_rgba(0,0,0,0.1)] overflow-hidden">
                  {suggestions.map((s, i) => (
                    <div
                      key={i}
                      onMouseDown={() => { suppressBlurRef.current = true; selectSuggestion(s); }}
                      onMouseEnter={() => setActiveSuggestion(i)}
                      className={[
                        'route-suggest-item py-[7px] px-[11px] cursor-pointer flex items-start gap-2 transition-colors duration-100',
                        i < suggestions.length - 1 ? 'border-b border-black/[0.05]' : '',
                        i === activeSuggestion ? 'route-suggest-item--active' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <MapPin
                        size={11}
                        className={[
                          'route-suggest-icon mt-0.5 shrink-0',
                          i === activeSuggestion ? 'route-suggest-icon--active' : '',
                        ].filter(Boolean).join(' ')}
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
            <p className="route-finder-inline-error" role="alert">
              <AlertCircle size={10} className="shrink-0" />
              <span>{geocodeError}</span>
            </p>
          )}
        </div>

        {geocodeStatus === 'success' && (
          <RouteFinderJobDetails
            isPage={isPage}
            serviceTypeId={serviceTypeId}
            onServiceTypeChange={(id) => {
              setServiceTypeId(id);
              setResults(null);
              setScoringStatus('idle');
            }}
            customDurationMinutes={customDurationMinutes}
            onCustomDurationChange={(v) => {
              setCustomDurationMinutes(v);
              setResults(null);
              setScoringStatus('idle');
            }}
            customerName={customerName}
            onCustomerNameChange={setCustomerName}
            notes={jobNotes}
            onNotesChange={setJobNotes}
            callAheadRequired={callAheadRequired}
            onCallAheadChange={setCallAheadRequired}
            validationErrors={jobValidationErrors}
          />
        )}

        {geocodeStatus === 'success' && serviceTypeId && !timeWindowPref && (
          <p className="route-finder-hint type-label-sm text-gs-muted text-center mt-3 mb-0 font-normal tracking-normal">
            Select a time window to find technician matches
          </p>
        )}

        {geocodeStatus === 'success' && serviceTypeId && (
          <div className="route-time-prefs mt-3 mb-3">
            <div className={`flex gap-2 ${timePref === 'specific' ? 'mb-2.5' : 'mb-0'}`}>
              {TIME_PREFS.map(({ key, label, sub }) => {
                const active = timePref === key;
                return (
                  <motion.button
                    key={key}
                    type="button"
                    onClick={() => handleTimePrefSelect(key)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={[
                      'route-time-btn flex-1 py-2 px-1 rounded-[10px] cursor-pointer text-center transition-all duration-150',
                      active ? 'route-time-btn--active' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className="route-time-btn__label text-xs font-bold leading-none">{label}</div>
                    <div className="route-time-btn__sub text-[9px] mt-0.5">{sub}</div>
                  </motion.button>
                );
              })}
            </div>

            {timePref === 'specific' && (
              <div className="pt-0.5">
                <p className={isPage ? 'rf-section-label mb-2' : 'type-label-sm text-gs-muted mb-[5px] font-normal tracking-normal'}>4-hour slots</p>
                <div className="route-time-slots-row route-time-slots-row--four-hour mb-2">
                  {FOUR_HOUR_SLOTS.map(({ key, label }) => {
                    const active = specificSlot === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSpecificSlotSelect(key)}
                        className={[
                          'route-time-slot-btn route-time-slot-btn--four-hour py-1.5 px-2 rounded-lg text-[11px] font-semibold cursor-pointer transition-all duration-150',
                          active ? 'route-time-slot-btn--active' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p className={isPage ? 'rf-section-label mb-2' : 'type-label-sm text-gs-muted mb-[5px] font-normal tracking-normal'}>2-hour slots</p>
                <div className="route-time-slots-row route-time-slots-row--two-hour">
                  {TWO_HOUR_SLOTS.map(({ key, label }) => {
                    const active = specificSlot === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSpecificSlotSelect(key)}
                        className={[
                          'route-time-slot-btn route-time-slot-btn--grid py-[5px] px-1 rounded-[7px] type-label-sm font-semibold cursor-pointer transition-all duration-150 tracking-normal',
                          active ? 'route-time-slot-btn--active' : '',
                        ].filter(Boolean).join(' ')}
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

        {/* ── No date selected hint ── */}
        {scoringMode === SCORING_MODES.SINGLE_DATE && !activeDate && geocodeStatus === 'success' && serviceTypeId && (
          <p className="route-finder-hint type-label-sm text-gs-muted text-center mb-2.5 font-normal tracking-normal m-0">
            Select a cached date above to see recommendations
          </p>
        )}
        {scoringMode === SCORING_MODES.BEST_AVAILABLE && geocodeStatus === 'success' && serviceTypeId && !hasCachedDate && (
          <p className="route-finder-hint type-label-sm text-gs-muted text-center mb-2.5 font-normal tracking-normal m-0">
            Waiting for cached route data — refresh dates when FieldRoutes auth is connected
          </p>
        )}
        </RouteSection>

        {(scoringStatus === 'loading' || scoringStatus === 'error') && (
        <RouteSection page={isPage}>
        {scoringStatus === 'loading' && (
          isPage ? (
            <RouteFinderScoringSkeleton count={3} />
          ) : (
            <p className="route-finder-loading" aria-live="polite">
              <Loader2 size={12} className="animate-spin text-gs-accent shrink-0" />
              <span>Finding best routes…</span>
            </p>
          )
        )}
        {scoringStatus === 'error' && (
          <p className="route-finder-inline-error" role="alert">
            <AlertCircle size={12} className="shrink-0" />
            <span>{scoringError}</span>
          </p>
        )}
        </RouteSection>
        )}

        {/* ── Results ── */}
        {scoringStatus === 'done' && results && (
        <RouteSection page={isPage} className="route-finder-section--results">
          <div className={isPage ? 'route-finder-results-panel route-finder-overlay-host' : undefined}>
            {/* Route area header (NH / Maine) */}
            {results.routeArea && results.routeArea !== 'general' && (
              <div
                className={[
                  'route-area-banner',
                  results.routeArea === 'new_hampshire' ? 'route-area-banner--nh' : 'route-area-banner--me',
                ].join(' ')}
              >
                {isPage && <Route size={16} className="route-area-banner__icon" aria-hidden />}
                <span className="route-area-banner__title">
                  {results.routeArea === 'new_hampshire' ? 'New Hampshire Route' : 'Maine Route'}
                </span>
                {results.routeArea === 'new_hampshire' && (
                  <span className="route-area-banner__note">Alex Gray only</span>
                )}
              </div>
            )}
            {/* No-safe-route message */}
            {results.noSafeRoute ? (
              <div className="route-finder-no-safe">
                <p className="route-finder-no-safe__message">
                  {results.noSafeRouteMessage}
                </p>
              </div>
            ) : (
              <>
                <div className="route-finder-results-head">
                  <p className="route-finder-results-head__title">
                    {results.mode === SCORING_MODES.BEST_AVAILABLE
                      ? `Best ${results.topMatches.length} Across ${results.datesScored ?? 0} Day${(results.datesScored ?? 0) === 1 ? '' : 's'}`
                      : `Top ${results.topMatches.length} Matches`}
                  </p>
                  <button
                    type="button"
                    disabled={scoringStatus === 'loading'}
                    onClick={() => runScore()}
                    className="route-finder-rescore type-label-sm text-gs-muted bg-transparent border-0 cursor-pointer font-normal tracking-normal disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Run scoring again with current settings"
                  >
                    Re-score
                  </button>
                </div>
                <div
                  onMouseDown={() => { suppressBlurRef.current = true; }}
                  onTouchStart={() => { suppressBlurRef.current = true; }}
                >
                  <RouteMatchResults
                    matches={results.topMatches}
                    additionalMatches={results.additionalMatches ?? []}
                    routeArea={results.routeArea}
                    multiDay={results.mode === SCORING_MODES.BEST_AVAILABLE}
                  />
                </div>
                <p className={isPage ? 'route-finder-footer-summary' : 'type-label-sm text-slate-400 text-center mt-1 font-normal tracking-normal'}>
                  {results.totalRoutesScored} routes scored
                  {results.prefWindow
                    ? ` · ${results.prefWindow.label === 'AT' ? 'best available window' : `${results.prefWindow.startTime}–${results.prefWindow.endTime}`}`
                    : ''}
                  {results.travelProvider ? ` · ${results.travelProvider} travel estimate` : ''}
                </p>
              </>
            )}
          </div>
        </RouteSection>
        )}
        </div>
      </div>
    </div>
  );
}
