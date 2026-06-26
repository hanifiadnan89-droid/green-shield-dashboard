import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Archive, CheckCircle2, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { api } from '../api/client.js';
import './ErrorCenter/error-center.css';

const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];
const STATUSES = ['new', 'investigating', 'resolved', 'ignored'];
const SOURCES = ['frontend', 'backend', 'api', 'ai', 'sheets', 'n8n', 'twilio', 'gmail', 'fieldroutes', 'pdf', 'kb', 'signing', 'route-finder'];

function formatDateTime(value) {
  if (!value) return 'Unknown';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function titleCase(value) {
  return String(value || '').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function MetadataBlock({ value }) {
  if (!value) return <p className="ec-empty-detail">No metadata recorded.</p>;
  return <pre className="ec-code">{JSON.stringify(value, null, 2)}</pre>;
}

export default function ErrorCenter() {
  const [errors, setErrors] = useState([]);
  const [summary, setSummary] = useState({ total: 0, critical: 0, unresolved: 0, last24Hours: 0 });
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [similarErrors, setSimilarErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [filters, setFilters] = useState({
    severity: '',
    status: '',
    source: '',
    module: '',
    date: '',
    query: '',
  });

  const selected = selectedDetail || errors.find((error) => error.id === selectedId) || errors[0] || null;

  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api.errors.list({ ...filters, limit: 200 });
      setErrors(data.errors || []);
      setSummary(data.summary || summary);
      if (!selectedId && data.errors?.[0]) setSelectedId(data.errors[0].id);
    } catch (err) {
      setLoadError(err.message || 'Error Center unavailable.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.severity, filters.status, filters.source, filters.module, filters.date]);

  useEffect(() => {
    const timer = setTimeout(() => load(), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.query]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedDetail(null);
      return;
    }
    let cancelled = false;
    api.errors.get(selectedId)
      .then((data) => {
        if (!cancelled) {
          setSelectedDetail(data.error);
          setSimilarErrors(data.similarErrors || []);
          setAnalysisError('');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedDetail(null);
          setSimilarErrors([]);
        }
      });
    return () => { cancelled = true; };
  }, [selectedId]);

  const moduleOptions = useMemo(() => {
    return Array.from(new Set(errors.map((error) => error.module).filter(Boolean))).sort();
  }, [errors]);

  async function setStatus(id, status) {
    setActionLoading(`${id}:${status}`);
    try {
      const data = status === 'resolved'
        ? await api.errors.resolve(id)
        : await api.errors.updateStatus(id, status);
      setSelectedDetail(data.error);
      await load();
    } finally {
      setActionLoading('');
    }
  }

  async function archive(id) {
    setActionLoading(`${id}:archive`);
    try {
      await api.errors.archive(id);
      setSelectedId(null);
      setSelectedDetail(null);
      await load();
    } finally {
      setActionLoading('');
    }
  }

  async function analyze(id) {
    setAnalysisLoading(true);
    setAnalysisError('');
    try {
      const data = await api.errors.analyze(id);
      if (data.unavailable) {
        setAnalysisError(data.error || 'AI analysis is unavailable right now.');
        return;
      }
      setSelectedDetail((prev) => prev ? { ...prev, aiAnalysis: data.analysis } : prev);
    } catch (err) {
      setAnalysisError(err.message || 'AI analysis failed.');
    } finally {
      setAnalysisLoading(false);
    }
  }

  function formatDuration(ms) {
    if (!Number.isFinite(ms)) return 'N/A';
    const minutes = Math.round(ms / 60000);
    if (minutes < 60) return `${minutes}m`;
    return `${Math.round(minutes / 60)}h`;
  }

  return (
    <div className="error-center-page">
      <header className="ec-header">
        <div>
          <div className="ec-eyebrow"><ShieldAlert size={15} /> System Observability</div>
          <h1>Error Center</h1>
          <p>Centralized frontend, backend, integration, AI, upload, signing, routing, and Knowledge Base errors.</p>
        </div>
        <button className="ec-icon-button" onClick={load} disabled={loading} title="Refresh errors">
          <RefreshCw size={16} />
        </button>
      </header>

      <section className="ec-metrics" aria-label="Error summary">
        <div className="ec-metric ec-metric--critical"><span>Active Critical</span><strong>{summary.activeCritical ?? summary.critical}</strong></div>
        <div className="ec-metric ec-metric--open"><span>Active High</span><strong>{summary.activeHigh ?? 0}</strong></div>
        <div className="ec-metric"><span>Errors Today</span><strong>{summary.errorsToday ?? summary.last24Hours}</strong></div>
        <div className="ec-metric ec-metric--resolved"><span>Resolved Today</span><strong>{summary.resolvedToday ?? 0}</strong></div>
        <div className="ec-metric"><span>MTTR</span><strong>{formatDuration(summary.mttrMs)}</strong></div>
        <div className="ec-metric"><span>Most Failing Module</span><strong className="ec-metric__text">{summary.mostFailingModule?.value || 'None'}</strong></div>
        <div className="ec-metric"><span>Most Frequent Error</span><strong className="ec-metric__text">{summary.mostFrequentError?.value || 'None'}</strong></div>
        <div className="ec-metric"><span>Trend 24h / 7d</span><strong>{summary.errorTrend?.last24Hours ?? summary.last24Hours} / {summary.errorTrend?.last7Days ?? summary.total}</strong></div>
      </section>

      <section className="ec-filters">
        <label className="ec-search">
          <Search size={15} />
          <input
            value={filters.query}
            onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
            placeholder="Search message, code, module, customer"
          />
        </label>
        <select value={filters.severity} onChange={(event) => setFilters((prev) => ({ ...prev, severity: event.target.value }))}>
          <option value="">All severity</option>
          {SEVERITIES.map((severity) => <option key={severity} value={severity}>{titleCase(severity)}</option>)}
        </select>
        <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
          <option value="">All status</option>
          {STATUSES.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}
        </select>
        <select value={filters.source} onChange={(event) => setFilters((prev) => ({ ...prev, source: event.target.value }))}>
          <option value="">All sources</option>
          {SOURCES.map((source) => <option key={source} value={source}>{titleCase(source)}</option>)}
        </select>
        <select value={filters.module} onChange={(event) => setFilters((prev) => ({ ...prev, module: event.target.value }))}>
          <option value="">All modules</option>
          {moduleOptions.map((module) => <option key={module} value={module}>{module}</option>)}
        </select>
        <input
          type="date"
          value={filters.date}
          onChange={(event) => setFilters((prev) => ({ ...prev, date: event.target.value }))}
        />
      </section>

      {loadError && <div className="ec-load-error">{loadError}</div>}

      <main className="ec-grid">
        <section className="ec-list" aria-label="Errors">
          {loading ? (
            <div className="ec-empty">Loading errors...</div>
          ) : errors.length === 0 ? (
            <div className="ec-empty">No matching errors.</div>
          ) : errors.map((error) => (
            <button
              key={error.id}
              type="button"
              className={`ec-row${selected?.id === error.id ? ' ec-row--active' : ''}`}
              onClick={() => setSelectedId(error.id)}
            >
              <div className="ec-row__top">
                <span className={`ec-badge ec-badge--${error.severity}`}>{error.severity}</span>
                <span className={`ec-status ec-status--${error.status}`}>{error.status}</span>
                <span className="ec-row__time">{formatDateTime(error.lastSeenAt || error.timestamp)}</span>
              </div>
              <div className="ec-row__message">{error.message}</div>
              <div className="ec-row__meta">
                <span>{titleCase(error.source)}</span>
                <span>{error.module || error.page || 'Unknown module'}</span>
                {error.errorCode && <span>{error.errorCode}</span>}
                <span>{error.occurrenceCount || 1}x</span>
              </div>
            </button>
          ))}
        </section>

        <aside className="ec-detail" aria-label="Error detail">
          {!selected ? (
            <div className="ec-empty-detail">Select an error to inspect details.</div>
          ) : (
            <>
              <div className="ec-detail__header">
                <div>
                  <div className="ec-detail__badges">
                    <span className={`ec-badge ec-badge--${selected.severity}`}>{selected.severity}</span>
                    <span className={`ec-status ec-status--${selected.status}`}>{selected.status}</span>
                  </div>
                  <h2>{selected.message}</h2>
                  <p>{formatDateTime(selected.timestamp)}</p>
                </div>
                <AlertTriangle size={22} />
              </div>

              <div className="ec-actions">
                <button disabled={actionLoading !== ''} onClick={() => setStatus(selected.id, 'investigating')}>Investigate</button>
                <button disabled={actionLoading !== ''} onClick={() => setStatus(selected.id, 'resolved')}>
                  <CheckCircle2 size={14} /> Resolve
                </button>
                <button disabled={actionLoading !== ''} onClick={() => setStatus(selected.id, 'ignored')}>Ignore</button>
                <button disabled={actionLoading !== ''} onClick={() => archive(selected.id)}>
                  <Archive size={14} /> Archive
                </button>
                <button disabled={analysisLoading} onClick={() => analyze(selected.id)}>
                  {analysisLoading ? 'Analyzing...' : 'Analyze Error'}
                </button>
              </div>

              <dl className="ec-detail-grid">
                <div><dt>Source</dt><dd>{titleCase(selected.source)}</dd></div>
                <div><dt>Module/Page</dt><dd>{selected.module || selected.page || 'Unknown'}</dd></div>
                <div><dt>Endpoint</dt><dd>{selected.endpoint || 'N/A'}</dd></div>
                <div><dt>Code / HTTP</dt><dd>{selected.errorCode || 'N/A'} {selected.httpStatus ? `/${selected.httpStatus}` : ''}</dd></div>
                <div><dt>First Seen</dt><dd>{formatDateTime(selected.firstSeenAt)}</dd></div>
                <div><dt>Last Seen</dt><dd>{formatDateTime(selected.lastSeenAt)}</dd></div>
                <div><dt>Occurrences</dt><dd>{selected.occurrenceCount || 1}</dd></div>
                <div><dt>Request ID</dt><dd>{selected.requestId || 'N/A'}</dd></div>
              </dl>

              <section className="ec-detail-section">
                <h3>Deployment Information</h3>
                <dl className="ec-detail-grid">
                  <div><dt>Commit</dt><dd>{selected.deployment?.gitCommitHash || 'Unknown'}</dd></div>
                  <div><dt>App Version</dt><dd>{selected.deployment?.appVersion || 'Unknown'}</dd></div>
                  <div><dt>Deployment ID</dt><dd>{selected.deployment?.deploymentId || 'Unknown'}</dd></div>
                  <div><dt>Environment</dt><dd>{selected.deployment?.environment || 'Unknown'}</dd></div>
                  <div><dt>Host</dt><dd>{selected.deployment?.hostname || selected.deployment?.serverInstance || 'Unknown'}</dd></div>
                  <div><dt>Uptime / Node</dt><dd>{selected.deployment?.processUptimeSeconds ?? 'N/A'}s / {selected.deployment?.nodeVersion || 'N/A'}</dd></div>
                </dl>
              </section>

              <section className="ec-detail-section">
                <h3>AI Error Analysis</h3>
                {analysisError && <p className="ec-empty-detail">{analysisError}</p>}
                {selected.aiAnalysis ? (
                  <div className="ec-analysis">
                    <p><strong>Probable root cause:</strong> {selected.aiAnalysis.probableRootCause || 'N/A'}</p>
                    <p><strong>Confidence:</strong> {selected.aiAnalysis.confidenceLevel || 'N/A'}</p>
                    <p><strong>Affected subsystem:</strong> {selected.aiAnalysis.affectedSubsystem || 'N/A'}</p>
                    <p><strong>Likely regression:</strong> {selected.aiAnalysis.likelyRegression || 'N/A'}</p>
                    <p><strong>Recommended fix:</strong> {selected.aiAnalysis.recommendedFix || 'N/A'}</p>
                    {!!selected.aiAnalysis.recommendedFilesOrModules?.length && (
                      <ul>{selected.aiAnalysis.recommendedFilesOrModules.map((item) => <li key={item}>{item}</li>)}</ul>
                    )}
                    {!!selected.aiAnalysis.troubleshootingChecklist?.length && (
                      <ol>{selected.aiAnalysis.troubleshootingChecklist.map((item) => <li key={item}>{item}</li>)}</ol>
                    )}
                  </div>
                ) : (
                  <p className="ec-empty-detail">No cached analysis yet. Use Analyze Error to generate one.</p>
                )}
              </section>

              <section className="ec-detail-section">
                <h3>Resolution Timeline</h3>
                {selected.timeline?.length ? (
                  <div className="ec-timeline">
                    {[...selected.timeline].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).map((entry, index) => (
                      <div className="ec-timeline__item" key={`${entry.timestamp}-${index}`}>
                        <div className="ec-timeline__time">{formatDateTime(entry.timestamp)}</div>
                        <div className="ec-timeline__body">
                          <strong>{entry.oldStatus || 'created'} {'->'} {entry.newStatus}</strong>
                          <span>{entry.user || 'system'}</span>
                          {entry.note && <p>{entry.note}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="ec-empty-detail">No timeline entries recorded.</p>
                )}
              </section>

              <section className="ec-detail-section">
                <h3>Similar / Related Errors</h3>
                {similarErrors.length ? (
                  <div className="ec-similar">
                    {similarErrors.map((item) => (
                      <button key={item.id} type="button" onClick={() => setSelectedId(item.id)}>
                        <span>{item.message}</span>
                        <small>{item.module || item.source} / {item.occurrenceCount || 1}x / score {item.similarityScore}</small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="ec-empty-detail">No similar errors found.</p>
                )}
              </section>

              <section className="ec-detail-section">
                <h3>Likely Cause</h3>
                <p>{selected.likelyCause || selected.userFacingMessage || 'No likely cause recorded yet.'}</p>
              </section>
              <section className="ec-detail-section">
                <h3>Suggested Fix</h3>
                <p>{selected.suggestedFix || 'Review the source module, endpoint, and metadata for the failing path.'}</p>
              </section>
              <section className="ec-detail-section">
                <h3>Related Lead / Customer</h3>
                <MetadataBlock value={selected.relatedLead || selected.relatedCustomer} />
              </section>
              <section className="ec-detail-section">
                <h3>Stack Trace</h3>
                {selected.stackTrace ? <pre className="ec-code">{selected.stackTrace}</pre> : <p className="ec-empty-detail">No stack trace recorded.</p>}
              </section>
              <section className="ec-detail-section">
                <h3>Metadata</h3>
                <MetadataBlock value={selected.rawMetadata || selected.technicalDetails} />
              </section>
            </>
          )}
        </aside>
      </main>
    </div>
  );
}
