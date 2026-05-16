import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { MapPin, Search, Loader2, CheckCircle, AlertCircle, RotateCcw, Navigation, RefreshCw } from 'lucide-react';
import { api } from '../../../api/client.js';
import { scoreRoutes } from '../../../utils/fieldRoutesScorer.js';

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
  return [0, 1, 2].map(offset => {
    const key = getLocalDateStr(offset);
    const label = offset === 0 ? 'Today'
      : offset === 1 ? 'Tomorrow'
      : new Date(new Date().setDate(new Date().getDate() + offset))
          .toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
    return { key, label };
  });
}

// ---------------------------------------------------------------------------
// Status badge for each date pill
// ---------------------------------------------------------------------------
const STATUS_CFG = {
  cached:         { label: 'Ready',   color: '#16A34A' },
  refreshing:     { label: 'Loading', color: '#3B82F6', spinning: true },
  failed:         { label: 'Failed',  color: '#DC2626', showRefresh: true },
  needs_login:    { label: 'Login',   color: '#F59E0B', showRefresh: true },
  missing:        { label: '—',       color: '#94A3B8', showRefresh: true },
  not_configured: { label: '—',       color: '#CBD5E1' },
};

function StatusBadge({ status, date, onRefresh }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.missing;
  return (
    <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 14 }}>
      {cfg.spinning
        ? <Loader2 size={9} className="animate-spin" style={{ color: cfg.color }} />
        : <span style={{ fontSize: 9, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
      }
      {cfg.showRefresh && onRefresh && (
        <button
          onClick={() => onRefresh(date)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#94A3B8', lineHeight: 1 }}
          title="Refresh"
        >
          <RefreshCw size={9} />
        </button>
      )}
    </div>
  );
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
// Score bar
// ---------------------------------------------------------------------------
function ScoreBar({ score, max = 100 }) {
  const pct = Math.min(100, Math.max(0, (score / max) * 100));
  const color = score >= 70 ? '#16A34A' : score >= 45 ? '#F59E0B' : '#94A3B8';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 4, borderRadius: 4, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: color, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 24, textAlign: 'right' }}>{score}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result card
// ---------------------------------------------------------------------------
const TIMED_RISK_CFG = {
  none:   { label: '✓ timed safe',    color: '#16A34A' },
  low:    { label: '⚡ low risk',      color: '#F59E0B' },
  medium: { label: '⚠ timed risk',    color: '#F59E0B' },
  high:   { label: '✗ timed conflict', color: '#DC2626' },
};

function ResultCard({ match, rank }) {
  const rankColors = ['#16A34A', '#3B82F6', '#8B5CF6'];
  const color = rankColors[rank - 1] || '#94A3B8';
  const ins = match.bestInsertion;
  const timedCfg = TIMED_RISK_CFG[ins?.timedRisk] ?? TIMED_RISK_CFG.none;

  return (
    <div style={{
      borderRadius: 10,
      border: `1px solid ${rank === 1 ? 'rgba(22,163,74,0.25)' : 'rgba(0,0,0,0.07)'}`,
      background: rank === 1 ? 'rgba(22,163,74,0.04)' : '#fff',
      padding: '10px 12px',
      marginBottom: 8,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        <span style={{
          width: 20, height: 20, borderRadius: '50%', background: color,
          color: '#fff', fontSize: 10, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {rank}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', margin: 0, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {match.techName}
          </p>
          <p style={{ fontSize: 10, color: '#64748B', margin: 0, marginTop: 1 }}>
            Route {match.routeId} · {match.stopCount} stops · {match.nearestStopMiles} mi away
          </p>
        </div>
      </div>

      {/* Suggested window */}
      {ins?.suggestedWindow && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: rank === 1 ? '#16A34A' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {rank === 1 ? 'Recommended: ' : 'Suggested: '}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A' }}>
            {ins.suggestedWindow}
          </span>
          <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 5 }}>
            (arrives {ins.estimatedArrivalTime})
          </span>
        </div>
      )}

      <ScoreBar score={match.scores.total} />

      {/* Insertion path */}
      {ins && (ins.prevStop || ins.nextStop) && (
        <div style={{ marginTop: 6, fontSize: 10, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {ins.prevStop && (
            <span title={ins.prevStop.scheduledArrival}>{ins.prevStop.customerName}</span>
          )}
          {ins.prevStop && <span style={{ color: '#CBD5E1' }}>→</span>}
          <span style={{ color: '#16A34A', fontWeight: 700, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>NEW</span>
          {ins.nextStop && <span style={{ color: '#CBD5E1' }}>→</span>}
          {ins.nextStop && (
            <span title={ins.nextStop.isTimed ? `Timed: ${ins.nextStop.windowLabel}` : ins.nextStop.scheduledArrival}>
              {ins.nextStop.customerName}
              {ins.nextStop.isTimed && <span style={{ color: '#F59E0B', marginLeft: 2 }}>⏱</span>}
            </span>
          )}
        </div>
      )}

      {/* Stats row */}
      {ins && (
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
          <span style={{ fontSize: 10, color: '#475569' }}>
            <span style={{ fontWeight: 600 }}>+Drive</span> {ins.addedDriveTime}
          </span>
          <span style={{ fontSize: 10, color: '#475569' }}>
            <span style={{ fontWeight: 600 }}>+Miles</span> {ins.detourMiles} mi
          </span>
          {ins.serviceDuration && (
            <span style={{ fontSize: 10, color: '#475569' }}>
              <span style={{ fontWeight: 600 }}>Service</span> {ins.serviceDuration}
            </span>
          )}
          <span style={{ fontSize: 10, color: '#475569' }}>
            <span style={{ fontWeight: 600 }}>Cap</span> {match.capacity.remainingHours}h left
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, color: timedCfg.color }}>
            {timedCfg.label}
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, color: ins.eodSafe !== false ? '#16A34A' : '#DC2626' }}>
            {ins.eodSafe !== false ? '✓ by 6 PM' : '⚠ past 6 PM'}
          </span>
          {!ins.viable && (
            <span style={{ fontSize: 10, color: '#F59E0B', fontWeight: 600 }}>⚠ tight gap</span>
          )}
        </div>
      )}

      {/* Reason */}
      {match.reason && (
        <p style={{ fontSize: 10, color: '#64748B', margin: '5px 0 0', lineHeight: 1.4 }}>
          {match.reason}
        </p>
      )}

      {/* Score breakdown */}
      <div style={{ display: 'flex', gap: 10, marginTop: 6, paddingTop: 5, borderTop: '1px solid rgba(0,0,0,0.04)' }}>
        {['geographic', 'travelEfficiency', 'timeWindow', 'capacity'].map(k => {
          const labels = { geographic: 'Geo', travelEfficiency: 'Drive', timeWindow: 'Win', capacity: 'Cap' };
          const v = match.scores[k];
          return (
            <div key={k} style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: v >= 70 ? '#16A34A' : v >= 45 ? '#F59E0B' : '#CBD5E1' }}>{v}</div>
              <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 1 }}>{labels[k]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main widget
// ---------------------------------------------------------------------------
export default function RouteFinderWidget() {
  // Date selection
  const DATE_METAS = useMemo(() => buildDateMetas(), []);
  const DATE_KEYS  = useMemo(() => DATE_METAS.map(d => d.key), [DATE_METAS]);

  const [activeDate, setActiveDate]           = useState(null);
  const [dateStatus, setDateStatus]           = useState({});
  const [activeTechnicians, setActiveTechnicians] = useState(null);
  const [dateLoadStatus, setDateLoadStatus]   = useState('idle'); // idle|loading|error

  // Address
  const [addressInput, setAddressInput]   = useState('');
  const [geocode, setGeocode]             = useState(null);
  const [geocodeStatus, setGeocodeStatus] = useState('idle');
  const [geocodeError, setGeocodeError]   = useState('');
  const [isEditing, setIsEditing]         = useState(false);

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

  const geocodeCacheRef = useRef({});
  const pollRef         = useRef(null);
  const dateKeysRef     = useRef(DATE_KEYS);
  useEffect(() => { dateKeysRef.current = DATE_KEYS; }, [DATE_KEYS]);

  // ---------------------------------------------------------------------------
  // Polling
  // ---------------------------------------------------------------------------
  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const statusData = await api.routes.status();
        setDateStatus(statusData);
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
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ---------------------------------------------------------------------------
  // On mount: load status, trigger preload for missing dates
  // ---------------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const statusData = await api.routes.status();
        setDateStatus(statusData);
        const needsLoad = DATE_KEYS.some(d => {
          const s = statusData[d]?.status;
          return !s || s === 'missing';
        });
        if (needsLoad) {
          api.routes.preload().catch(() => {});
          // Set missing dates to refreshing optimistically
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
      } catch {
        // Server not available — widget still works when routes are offline
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Date selection
  // ---------------------------------------------------------------------------
  const handleDateSelect = useCallback(async (date) => {
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
      setActiveTechnicians(data.technicians || []);
      setDateLoadStatus('idle');
    } catch (err) {
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

  const handleAddressKey = (e) => { if (e.key === 'Enter') doGeocode(addressInput); };

  // ---------------------------------------------------------------------------
  // Scoring
  // ---------------------------------------------------------------------------
  const runScore = useCallback(async (techList, latLng, prefStr = 'AT') => {
    if (!techList?.length || !latLng) return;
    setScoringStatus('loading');
    setScoringError('');
    try {
      const lead = {
        lat: latLng.lat,
        lng: latLng.lng,
        serviceType: 'Regular Service',
        durationMinutes: 30,
        timeWindowPreference: prefStr || 'AT',
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
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="p-card section-enter flex flex-col" style={{ minHeight: 400 }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(22,163,74,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Navigation size={14} style={{ color: '#16A34A' }} />
          </div>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: 0, lineHeight: 1 }}>Route Finder</h3>
            <p style={{ fontSize: 10, color: '#94A3B8', margin: 0, marginTop: 2 }}>Find best technician for a new stop</p>
          </div>
        </div>
        {(geocode || results) && (
          <button
            onClick={handleReset}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}
            title="Reset"
          >
            <RotateCcw size={13} />
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>

        {/* ── Date picker ── */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
            Route Date
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            {DATE_METAS.map(({ key, label }) => {
              const s = dateStatus[key] || { status: 'missing' };
              const isCached = s.status === 'cached';
              const isActive = activeDate === key;
              const isLoading = dateLoadStatus === 'loading' && isActive;

              return (
                <div key={key} style={{ flex: 1, textAlign: 'center' }}>
                  <button
                    onClick={() => isCached && handleDateSelect(key)}
                    style={{
                      width: '100%',
                      padding: '6px 4px',
                      borderRadius: 9,
                      border: `1.5px solid ${isActive ? '#16A34A' : isCached ? 'rgba(22,163,74,0.3)' : 'rgba(0,0,0,0.08)'}`,
                      background: isActive ? '#16A34A' : isCached ? 'rgba(22,163,74,0.04)' : '#f8fafc',
                      cursor: isCached ? 'pointer' : 'default',
                      transition: 'all 0.15s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                  >
                    {isLoading && <Loader2 size={9} className="animate-spin" style={{ color: isActive ? '#fff' : '#16A34A' }} />}
                    <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? '#fff' : isCached ? '#0F172A' : '#94A3B8', lineHeight: 1 }}>
                      {label}
                    </span>
                  </button>
                  <StatusBadge status={s.status} date={key} onRefresh={handleRefresh} />
                </div>
              );
            })}
          </div>

          {activeDate && activeTechnicians !== null && activeTechnicians.length === 0 && dateLoadStatus !== 'loading' && (
            <p style={{ fontSize: 10, color: '#F59E0B', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle size={10} /> No routes with stops found for this date
            </p>
          )}
          {activeDate && dateLoadStatus === 'error' && (
            <p style={{ fontSize: 10, color: '#DC2626', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle size={10} /> Failed to load route data
            </p>
          )}
        </div>

        {/* ── Address input ── */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>
            Customer Address
          </label>

          {geocodeStatus === 'success' && !isEditing ? (
            <div style={{
              borderRadius: 10, border: '1px solid rgba(22,163,74,0.3)', background: 'rgba(22,163,74,0.04)',
              padding: '8px 10px', display: 'flex', alignItems: 'flex-start', gap: 7,
            }}>
              <CheckCircle size={13} style={{ color: '#16A34A', marginTop: 1, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#0F172A', margin: 0, lineHeight: 1.3 }}>{geocode.display}</p>
                <p style={{ fontSize: 10, color: '#94A3B8', margin: '2px 0 0', fontFamily: 'monospace' }}>
                  {geocode.lat.toFixed(5)}, {geocode.lng.toFixed(5)}
                </p>
              </div>
              <button
                onClick={() => setIsEditing(true)}
                style={{ fontSize: 10, color: '#16A34A', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 4px', fontWeight: 600, flexShrink: 0 }}
              >
                Edit
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <MapPin size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input
                autoFocus={isEditing}
                value={addressInput}
                onChange={e => setAddressInput(e.target.value)}
                onKeyDown={handleAddressKey}
                placeholder="e.g. 286 York St, York, ME 03909"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '8px 36px 8px 28px', borderRadius: 10,
                  border: `1px solid ${geocodeStatus === 'error' ? 'rgba(220,38,38,0.4)' : 'rgba(0,0,0,0.1)'}`,
                  fontSize: 12, color: '#0F172A', background: '#f8fafc', outline: 'none',
                }}
                onFocus={e => { e.target.style.borderColor = 'rgba(22,163,74,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(22,163,74,0.08)'; }}
                onBlur={e => {
                  e.target.style.borderColor = geocodeStatus === 'error' ? 'rgba(220,38,38,0.4)' : 'rgba(0,0,0,0.1)';
                  e.target.style.boxShadow = 'none';
                  if (addressInput.trim()) doGeocode(addressInput);
                }}
              />
              {geocodeStatus === 'loading' ? (
                <Loader2 size={12} className="animate-spin" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              ) : (
                <button
                  onClick={() => doGeocode(addressInput)}
                  style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: '#94A3B8', display: 'flex' }}
                >
                  <Search size={12} />
                </button>
              )}
            </div>
          )}

          {geocodeStatus === 'error' && (
            <p style={{ fontSize: 10, color: '#DC2626', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle size={10} /> {geocodeError} — try a more complete address
            </p>
          )}
          <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>Press Enter or click search to look up coordinates</p>
        </div>

        {/* ── Other windows toggle ── */}
        {geocodeStatus === 'success' && (
          <div style={{ marginBottom: showOther ? 0 : 10, display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => {
                const closing = showOther;
                setShowOther(o => !o);
                if (closing) {
                  setTimePref(null);
                  setSpecificSlot(null);
                  if (geocode && activeTechnicians?.length) runScore(activeTechnicians, geocode, 'AT');
                }
              }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontSize: 11, color: '#3B82F6', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 3,
              }}
            >
              {showOther ? '▴' : '▾'} Other windows
            </button>
          </div>
        )}

        {/* ── Other: timing preference picker ── */}
        {geocodeStatus === 'success' && showOther && (
          <div style={{ marginBottom: 12, padding: '10px 12px', background: 'rgba(59,130,246,0.04)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.15)' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: timePref === 'specific' ? 10 : 0 }}>
              {TIME_PREFS.map(({ key, label, sub }) => {
                const active = timePref === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleTimePrefSelect(key)}
                    style={{
                      flex: 1, padding: '7px 4px', borderRadius: 9,
                      border: `1.5px solid ${active ? '#3B82F6' : 'rgba(0,0,0,0.1)'}`,
                      background: active ? '#3B82F6' : '#fff',
                      cursor: 'pointer', textAlign: 'center',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: active ? '#fff' : '#374151', lineHeight: 1 }}>{label}</div>
                    <div style={{ fontSize: 9, color: active ? 'rgba(255,255,255,0.75)' : '#94A3B8', marginTop: 2 }}>{sub}</div>
                  </button>
                );
              })}
            </div>

            {timePref === 'specific' && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#64748B', marginBottom: 5 }}>4-hour slots</p>
                <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
                  {FOUR_HOUR_SLOTS.map(({ key, label }) => {
                    const active = specificSlot === key;
                    return (
                      <button
                        key={key}
                        onClick={() => handleSpecificSlotSelect(key)}
                        style={{
                          flex: 1, padding: '6px 4px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                          border: `1.5px solid ${active ? '#3B82F6' : 'rgba(0,0,0,0.1)'}`,
                          background: active ? '#3B82F6' : '#fff', color: active ? '#fff' : '#374151',
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#64748B', marginBottom: 5 }}>2-hour slots</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {TWO_HOUR_SLOTS.map(({ key, label }) => {
                    const active = specificSlot === key;
                    return (
                      <button
                        key={key}
                        onClick={() => handleSpecificSlotSelect(key)}
                        style={{
                          padding: '5px 8px', borderRadius: 7, fontSize: 10, fontWeight: 600,
                          border: `1.5px solid ${active ? '#3B82F6' : 'rgba(0,0,0,0.1)'}`,
                          background: active ? '#3B82F6' : '#fff', color: active ? '#fff' : '#374151',
                          cursor: 'pointer', transition: 'all 0.15s',
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
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>
              Special Notes <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
            </label>
            <textarea
              value={specialNotes}
              onChange={e => setSpecialNotes(e.target.value)}
              placeholder="e.g. call ahead, gate code, commercial account..."
              rows={2}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '7px 10px', borderRadius: 9, resize: 'none',
                border: '1px solid rgba(0,0,0,0.1)', fontSize: 11, color: '#374151',
                background: '#f8fafc', outline: 'none', lineHeight: 1.4,
              }}
              onFocus={e => { e.target.style.borderColor = 'rgba(22,163,74,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(22,163,74,0.08)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.1)'; e.target.style.boxShadow = 'none'; }}
            />
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { name: 'Start Dashboard',           cmd: 'cd ~/green-shield-dashboard && bash start.sh' },
                { name: 'Login Script',               cmd: 'cd ~/green-shield-dashboard && node scripts/fieldRoutesLogin.mjs' },
                { name: 'Restart Server',            cmd: 'cd ~/green-shield-dashboard/server && npm start' },
              ].map(({ name, cmd }) => (
                <div key={name} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: '#94A3B8', whiteSpace: 'nowrap', flexShrink: 0 }}>{name}</span>
                  <code style={{ fontSize: 9, color: '#475569', background: 'rgba(0,0,0,0.04)', borderRadius: 4, padding: '1px 5px', fontFamily: 'monospace', wordBreak: 'break-all' }}>{cmd}</code>
                </div>
              ))}
            </div>
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
              <ResultCard key={match.routeId} match={match} rank={match.rank} />
            ))}
            <p style={{ fontSize: 10, color: '#94A3B8', textAlign: 'center', marginTop: 4 }}>
              {results.totalRoutesScored} routes scored · {results.prefWindow.label === 'AT' ? 'best available window' : `${results.prefWindow.startTime}–${results.prefWindow.endTime}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
