import { useState, useRef, useCallback } from 'react';
import { MapPin, Search, Loader2, CheckCircle, AlertCircle, RotateCcw, Navigation } from 'lucide-react';
import { api } from '../../../api/client.js';
import { extractRoutePayload } from '../../../utils/fieldRoutesExtractor.js';
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
// Nominatim geocoder
// ---------------------------------------------------------------------------
async function nominatimGeocode(address) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=us`;
  const resp = await fetch(url, { headers: { 'User-Agent': 'GreenShieldDashboard/1.0' } });
  if (!resp.ok) throw new Error('Geocoding service unavailable');
  const data = await resp.json();
  if (!data.length) throw new Error('Address not found');
  const { lat, lon, display_name } = data[0];
  // Shorten display: keep city + state portion
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
function ResultCard({ match, rank }) {
  const rankColors = ['#16A34A', '#3B82F6', '#8B5CF6'];
  const color = rankColors[rank - 1] || '#94A3B8';
  const ins = match.bestInsertion;

  return (
    <div style={{
      borderRadius: 10,
      border: `1px solid ${rank === 1 ? 'rgba(22,163,74,0.25)' : 'rgba(0,0,0,0.07)'}`,
      background: rank === 1 ? 'rgba(22,163,74,0.04)' : '#fff',
      padding: '10px 12px',
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
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

      <ScoreBar score={match.scores.total} />

      {ins && (
        <div style={{ marginTop: 7, display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
          <span style={{ fontSize: 10, color: '#475569' }}>
            <span style={{ fontWeight: 600 }}>Est. arrival</span> {ins.estimatedArrivalTime}
          </span>
          <span style={{ fontSize: 10, color: '#475569' }}>
            <span style={{ fontWeight: 600 }}>Detour</span> {ins.detourMiles} mi
          </span>
          <span style={{ fontSize: 10, color: '#475569' }}>
            <span style={{ fontWeight: 600 }}>Remaining</span> {match.capacity.remainingHours}h
          </span>
          {!ins.viable && (
            <span style={{ fontSize: 10, color: '#F59E0B', fontWeight: 600 }}>⚠ tight</span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
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
  const [addressInput, setAddressInput]   = useState('');
  const [geocode, setGeocode]             = useState(null);   // { lat, lng, display }
  const [geocodeStatus, setGeocodeStatus] = useState('idle'); // idle|loading|success|error
  const [geocodeError, setGeocodeError]   = useState('');
  const [isEditing, setIsEditing]         = useState(false);

  const [timePref, setTimePref]       = useState(null);         // 'AM'|'PM'|'specific'
  const [specificSlot, setSpecificSlot] = useState(null);
  const [specialNotes, setSpecialNotes] = useState('');

  const [scoringStatus, setScoringStatus] = useState('idle');   // idle|loading|done|error
  const [scoringError, setScoringError]   = useState('');
  const [results, setResults]             = useState(null);

  const geocodeCacheRef    = useRef({});
  const techniciansCache   = useRef(null);

  // ---------------------------------------------------------------------------
  // Geocode
  // ---------------------------------------------------------------------------
  const doGeocode = useCallback(async (addr) => {
    const trimmed = addr.trim();
    if (!trimmed) return;

    if (geocodeCacheRef.current[trimmed]) {
      setGeocode(geocodeCacheRef.current[trimmed]);
      setGeocodeStatus('success');
      return;
    }

    setGeocodeStatus('loading');
    setGeocodeError('');
    setResults(null);
    setScoringStatus('idle');
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
    if (e.key === 'Enter') doGeocode(addressInput);
  };

  // ---------------------------------------------------------------------------
  // Score
  // ---------------------------------------------------------------------------
  const handleScore = useCallback(async () => {
    if (!geocode) return;
    const window = timePref === 'specific' ? specificSlot : timePref;
    if (!window) return;

    setScoringStatus('loading');
    setScoringError('');

    try {
      // Load + extract payload once; cache result
      if (!techniciansCache.current) {
        const raw = await api.routes.payload();
        const { result } = extractRoutePayload(raw);
        techniciansCache.current = result.technicians;
      }

      const lead = {
        lat: geocode.lat,
        lng: geocode.lng,
        serviceType: 'Regular Service',
        durationMinutes: 30,
        timeWindowPreference: window,
      };

      const scored = scoreRoutes(techniciansCache.current, lead, 3);
      setResults(scored);
      setScoringStatus('done');
    } catch (err) {
      setScoringStatus('error');
      setScoringError(err.message || 'Scoring failed');
    }
  }, [geocode, timePref, specificSlot]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  const activeWindow = timePref === 'specific' ? specificSlot : timePref;
  const canScore     = geocode && activeWindow;

  const handleReset = () => {
    setAddressInput('');
    setGeocode(null);
    setGeocodeStatus('idle');
    setGeocodeError('');
    setIsEditing(false);
    setTimePref(null);
    setSpecificSlot(null);
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
                <Loader2 size={12} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', animation: 'spin 1s linear infinite' }} />
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

        {/* ── Time preference (shown after geocode success) ── */}
        {geocodeStatus === 'success' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>
              Preferred Arrival Window
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {TIME_PREFS.map(({ key, label, sub }) => {
                const active = timePref === key;
                return (
                  <button
                    key={key}
                    onClick={() => { setTimePref(key); setSpecificSlot(null); setResults(null); setScoringStatus('idle'); }}
                    style={{
                      flex: 1, padding: '7px 4px', borderRadius: 9,
                      border: `1.5px solid ${active ? '#16A34A' : 'rgba(0,0,0,0.1)'}`,
                      background: active ? '#16A34A' : '#fff',
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

            {/* Specific slot picker */}
            {timePref === 'specific' && (
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#64748B', marginBottom: 5 }}>4-hour slots</p>
                <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
                  {FOUR_HOUR_SLOTS.map(({ key, label }) => {
                    const active = specificSlot === key;
                    return (
                      <button
                        key={key}
                        onClick={() => { setSpecificSlot(key); setResults(null); setScoringStatus('idle'); }}
                        style={{
                          flex: 1, padding: '6px 4px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                          border: `1.5px solid ${active ? '#16A34A' : 'rgba(0,0,0,0.1)'}`,
                          background: active ? '#16A34A' : '#fff', color: active ? '#fff' : '#374151',
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
                        onClick={() => { setSpecificSlot(key); setResults(null); setScoringStatus('idle'); }}
                        style={{
                          padding: '5px 8px', borderRadius: 7, fontSize: 10, fontWeight: 600,
                          border: `1.5px solid ${active ? '#16A34A' : 'rgba(0,0,0,0.1)'}`,
                          background: active ? '#16A34A' : '#fff', color: active ? '#fff' : '#374151',
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
        {geocodeStatus === 'success' && timePref && (
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
          </div>
        )}

        {/* ── Find Route button ── */}
        {canScore && scoringStatus !== 'done' && (
          <button
            onClick={handleScore}
            disabled={scoringStatus === 'loading'}
            style={{
              width: '100%', padding: '10px', borderRadius: 10, border: 'none',
              background: scoringStatus === 'loading' ? '#94A3B8' : '#16A34A',
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: scoringStatus === 'loading' ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              transition: 'background 0.15s', marginBottom: 14,
            }}
            onMouseEnter={e => { if (scoringStatus !== 'loading') e.currentTarget.style.background = '#15803d'; }}
            onMouseLeave={e => { if (scoringStatus !== 'loading') e.currentTarget.style.background = '#16A34A'; }}
          >
            {scoringStatus === 'loading'
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Scoring routes...</>
              : <><Navigation size={14} /> Find Best Route</>
            }
          </button>
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
                onClick={() => { setScoringStatus('idle'); setResults(null); }}
                style={{ fontSize: 10, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Re-score
              </button>
            </div>
            {results.topMatches.map(match => (
              <ResultCard key={match.routeId} match={match} rank={match.rank} />
            ))}
            <p style={{ fontSize: 10, color: '#94A3B8', textAlign: 'center', marginTop: 4 }}>
              {results.totalRoutesScored} routes scored · {results.prefWindow.label} window ({results.prefWindow.startTime}–{results.prefWindow.endTime})
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
