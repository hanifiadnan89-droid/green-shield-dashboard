import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Lock,
  RefreshCw,
  ShieldCheck,
  XCircle,
  Zap,
} from 'lucide-react';
import { api } from '../../../api/client.js';
import {
  breakdownToRows,
  buildUsageQueryParams,
  computeSuccessRate,
  countDeprecatedRouteHits,
  describeDbReadinessStatus,
  describeHealthStatus,
  formatDurationMs,
  formatSize,
  formatSuccessRate,
  formatTimestamp,
  isAdminAuthStatus,
  pickMostCommon,
  sanitizeEntriesForDisplay,
  summarizeDbReadiness,
  summarizeStorageStatus,
} from './aiObservabilityHelpers.js';

const SUCCESS_FILTER_OPTIONS = [
  { value: '', label: 'All outcomes' },
  { value: 'true', label: 'Success only' },
  { value: 'false', label: 'Failures only' },
];

const LIMIT_OPTIONS = [25, 50, 100, 200, 500];

const KNOWN_FEATURES = [
  'assist-reply',
  'draft-reply',
  'sales-coach',
  'objection-assist',
  'error-center-analysis',
  'knowledge-base-ingestion',
  'knowledge-base-extraction',
  'embeddings',
  'transcription',
];

const KNOWN_PROVIDERS = ['anthropic', 'openai'];

function HealthBadge({ status }) {
  const { label, tone } = describeHealthStatus(status);
  const toneMap = {
    success: 'bg-green-50 text-gs-accent border-green-200',
    warn: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-gs-danger border-red-200',
    neutral: 'bg-slate-100 text-gs-muted border-slate-200',
  };
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'warn' ? AlertTriangle : tone === 'danger' ? XCircle : Activity;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest border ${toneMap[tone]}`}>
      <Icon size={12} />
      {label}
    </span>
  );
}

function ConfiguredPill({ configured }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider border ${
      configured
        ? 'bg-green-50 text-gs-accent border-green-200'
        : 'bg-slate-100 text-gs-muted border-slate-200'
    }`}>
      {configured ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
      {configured ? 'Configured' : 'Not configured'}
    </span>
  );
}

function StatusPill({ status }) {
  const success = status === 'success';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider border ${
      success
        ? 'bg-green-50 text-gs-accent border-green-200'
        : 'bg-red-50 text-gs-danger border-red-200'
    }`}>
      {success ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
      {status || 'unknown'}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-gs-muted">{label}</p>
          <p className="text-xl font-semibold text-gs-text mt-1">{value}</p>
          {sub ? <p className="text-xs text-gs-muted mt-1">{sub}</p> : null}
        </div>
        {Icon ? <Icon size={18} className="text-gs-muted shrink-0" /> : null}
      </div>
    </div>
  );
}

function BreakdownCard({ title, rows, emptyLabel }) {
  return (
    <div className="card overflow-hidden">
      <h2 className="font-semibold text-gs-text text-sm mb-3">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-xs text-gs-muted">{emptyLabel}</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-gs-border">
              <th className="th">Name</th>
              <th className="th text-right">Count</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, count }) => (
              <tr key={key} className="table-row">
                <td className="td font-medium">{key}</td>
                <td className="td text-right tabular-nums">{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CapabilityRow({ name, capability }) {
  if (!capability) return null;
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-gs-border last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gs-text">{name}</p>
        <p className="text-[11px] text-gs-muted truncate">
          {(capability.provider || '—')} · {(capability.requiredEnv || '—')}
          {capability.usedBy?.length ? ` · used by ${capability.usedBy.join(', ')}` : ''}
        </p>
      </div>
      <ConfiguredPill configured={Boolean(capability.configured)} />
    </div>
  );
}

const CAPABILITY_LABELS = [
  ['chatGeneration', 'Chat generation'],
  ['visionOcr', 'Vision / OCR'],
  ['errorAnalysis', 'Error Center analysis'],
  ['knowledgeBaseIngestion', 'KB ingestion'],
  ['knowledgeBaseExtractionOcr', 'KB OCR extraction'],
  ['transcription', 'Transcription (Whisper)'],
  ['embeddings', 'Embeddings'],
];

export default function AIObservabilityPage() {
  const [health, setHealth] = useState(null);
  const [usage, setUsage] = useState(null);
  const [storage, setStorage] = useState(null);
  const [storageError, setStorageError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  // authState: null = checking, 'admin' = allowed, 'denied' = blocked
  const [authState, setAuthState] = useState(null);
  // Stage 39 — append-only DB readiness banner state.
  const [dbReadiness, setDbReadiness] = useState(null);
  const [dbReadinessLoading, setDbReadinessLoading] = useState(true);
  const [dbReadinessError, setDbReadinessError] = useState('');
  const [filters, setFilters] = useState({
    feature: '',
    provider: '',
    success: '',
    limit: 100,
  });

  const loadDbReadiness = useCallback(async ({ refresh = false } = {}) => {
    setDbReadinessLoading(true);
    setDbReadinessError('');
    try {
      const payload = await api.adminDbAppendOnly.validation({ refresh });
      setDbReadiness(payload);
    } catch (err) {
      setDbReadinessError(err?.message || 'Unable to load append-only DB readiness.');
      // Keep prior dbReadiness in place — operator sees "stale" rather than losing context.
    } finally {
      setDbReadinessLoading(false);
    }
  }, []);

  const loadAll = useCallback(async (activeFilters, { background = false } = {}) => {
    if (background) setRefreshing(true); else setLoading(true);
    setError('');
    setStorageError('');
    try {
      const [healthData, usageData, storageResult] = await Promise.all([
        api.aiObservability.health(),
        api.aiObservability.usage(buildUsageQueryParams(activeFilters)),
        api.aiObservability.storage().catch((err) => ({ __error: err?.message || 'Storage status unavailable.' })),
      ]);
      setHealth(healthData);
      setUsage(usageData);
      if (storageResult && typeof storageResult === 'object' && storageResult.__error) {
        setStorage(null);
        setStorageError(storageResult.__error);
      } else {
        setStorage(storageResult);
      }
    } catch (err) {
      setError(err?.message || 'Could not load AI observability data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await api.auth.status();
        if (cancelled) return;
        if (isAdminAuthStatus(status)) {
          setAuthState('admin');
          loadAll(filters);
          loadDbReadiness();
        } else {
          setAuthState('denied');
          setLoading(false);
        }
      } catch {
        if (cancelled) return;
        setAuthState('denied');
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // Only run once on mount — filter changes are handled by Apply button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = usage?.summary || null;
  const dbReadinessSummary = useMemo(() => summarizeDbReadiness(dbReadiness), [dbReadiness]);
  const dbReadinessCacheLabel = useMemo(() => formatCacheFreshness(dbReadiness?.cache), [dbReadiness]);
  const storageSummary = useMemo(() => summarizeStorageStatus(storage), [storage]);
  const successRate = useMemo(() => computeSuccessRate(summary), [summary]);
  const topFeature = useMemo(() => pickMostCommon(summary?.byFeature), [summary]);
  const topProvider = useMemo(() => pickMostCommon(summary?.byProvider), [summary]);
  const featureRows = useMemo(() => breakdownToRows(summary?.byFeature), [summary]);
  const providerRows = useMemo(() => breakdownToRows(summary?.byProvider), [summary]);
  const errorRows = useMemo(() => breakdownToRows(summary?.byErrorCode), [summary]);
  const entries = useMemo(() => sanitizeEntriesForDisplay(usage?.entries), [usage]);
  const deprecatedHitCount = useMemo(() => countDeprecatedRouteHits(entries), [entries]);

  const availableFeatures = useMemo(() => {
    const set = new Set(KNOWN_FEATURES);
    if (summary?.byFeature) Object.keys(summary.byFeature).forEach((key) => set.add(key));
    return Array.from(set).sort();
  }, [summary]);
  const availableProviders = useMemo(() => {
    const set = new Set(KNOWN_PROVIDERS);
    if (summary?.byProvider) Object.keys(summary.byProvider).forEach((key) => set.add(key));
    return Array.from(set).sort();
  }, [summary]);

  function handleFilterChange(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function handleApplyFilters(e) {
    e?.preventDefault?.();
    loadAll(filters, { background: true });
  }

  function handleResetFilters() {
    const next = { feature: '', provider: '', success: '', limit: 100 };
    setFilters(next);
    loadAll(next, { background: true });
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-5 bg-white border-b border-gs-border flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gs-text tracking-tight">AI Observability</h1>
          <p className="text-gs-muted text-xs mt-0.5">
            Read-only view of AI provider health and recent AI usage. No prompts, transcripts, or model outputs are stored or shown.
          </p>
        </div>
        {authState === 'admin' && (
          <button
            onClick={() => loadAll(filters, { background: true })}
            className="btn-ghost text-xs gap-1.5"
            disabled={loading || refreshing}
          >
            <RefreshCw size={13} className={loading || refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        )}
      </div>

      <div className="px-6 py-5 space-y-5">
        {authState === null && (
          <div className="card text-sm text-gs-muted">Checking permissions…</div>
        )}

        {authState === 'denied' && (
          <div className="card border-amber-200 bg-amber-50/70 flex items-start gap-3" data-testid="ai-observability-access-denied">
            <Lock size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold text-gs-text text-sm">Admin access required</p>
              <p className="text-xs text-gs-muted mt-1">
                AI Observability is restricted to administrators. AI provider health and usage history are not loaded for non-admin users.
              </p>
            </div>
          </div>
        )}

        {authState === 'admin' && error && (
          <div className="card border-red-200 bg-red-50/70 text-gs-danger flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {authState === 'admin' && loading ? (
          <div className="card text-sm text-gs-muted">Loading AI observability…</div>
        ) : authState === 'admin' ? (
          <>
            {/* Provider Health */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-gs-text">Provider health</h2>
                <HealthBadge status={health?.status} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-gs-muted">Anthropic</p>
                      <p className="text-sm font-medium text-gs-text mt-1">{health?.providers?.anthropic?.requiredEnv || 'ANTHROPIC_API_KEY'}</p>
                    </div>
                    <ConfiguredPill configured={Boolean(health?.providers?.anthropic?.configured)} />
                  </div>
                </div>
                <div className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-gs-muted">OpenAI</p>
                      <p className="text-sm font-medium text-gs-text mt-1">{health?.providers?.openai?.requiredEnv || 'OPENAI_API_KEY'}</p>
                    </div>
                    <ConfiguredPill configured={Boolean(health?.providers?.openai?.configured)} />
                  </div>
                </div>
                <div className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-gs-muted">Health generated</p>
                      <p className="text-sm font-medium text-gs-text mt-1">{formatTimestamp(health?.generatedAt)}</p>
                    </div>
                    <ShieldCheck size={18} className="text-gs-muted" />
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="text-sm font-semibold text-gs-text mb-2">Capabilities</h3>
                <div>
                  {CAPABILITY_LABELS.map(([key, label]) => (
                    <CapabilityRow key={key} name={label} capability={health?.capabilities?.[key]} />
                  ))}
                </div>
              </div>
            </section>

            {/* Stage 39 — Append-only DB readiness banner (read-only) */}
            <section className="space-y-2" data-testid="db-readiness-banner">
              {(() => {
                const status = dbReadinessLoading && !dbReadinessSummary
                  ? 'loading'
                  : dbReadinessError && !dbReadinessSummary
                    ? 'error'
                    : dbReadinessSummary?.status || 'unknown';
                const tone = describeDbReadinessStatus(status).tone;
                const toneClasses = tone === 'success'
                  ? 'border-green-200 bg-green-50/70'
                  : tone === 'warn'
                    ? 'border-amber-200 bg-amber-50/70'
                    : tone === 'danger'
                      ? 'border-red-200 bg-red-50/70'
                      : 'border-gs-border';
                const pillClasses = tone === 'success'
                  ? 'bg-green-50 text-gs-accent border-green-200'
                  : tone === 'warn'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : tone === 'danger'
                      ? 'bg-red-50 text-gs-danger border-red-200'
                      : 'bg-slate-100 text-gs-muted border-slate-200';
                const PillIcon = tone === 'success'
                  ? CheckCircle2
                  : tone === 'warn'
                    ? AlertTriangle
                    : tone === 'danger'
                      ? XCircle
                      : Activity;
                const showStaleNotice = Boolean(dbReadinessError && dbReadinessSummary);

                return (
                  <div className={`card border ${toneClasses}`}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest border ${pillClasses}`}>
                            <PillIcon size={12} />
                            {describeDbReadinessStatus(status).label}
                          </span>
                          <h2 className="text-sm font-semibold text-gs-text">Append-only DB readiness</h2>
                        </div>
                        <p className="text-xs text-gs-muted mt-2">
                          {status === 'loading' && 'Checking append-only DB readiness…'}
                          {status === 'error' && !dbReadinessSummary && (dbReadinessError || 'Unable to load append-only DB readiness.')}
                          {dbReadinessSummary && (
                            <span data-testid="db-readiness-summary-line">{dbReadinessSummary.summaryLine}</span>
                          )}
                        </p>
                        {dbReadinessSummary?.reminder && (
                          <p className="text-xs text-gs-text mt-2">{dbReadinessSummary.reminder}</p>
                        )}
                        {(dbReadinessCacheLabel || dbReadinessSummary?.generatedAt) && (
                          <p className="text-[11px] text-gs-muted mt-2">
                            {dbReadinessCacheLabel && <span>{dbReadinessCacheLabel}</span>}
                            {dbReadinessCacheLabel && dbReadinessSummary?.generatedAt && <span> · </span>}
                            {dbReadinessSummary?.generatedAt && (
                              <span>generated {formatTimestamp(dbReadinessSummary.generatedAt)}</span>
                            )}
                          </p>
                        )}
                        {showStaleNotice && (
                          <p className="text-[11px] text-gs-danger mt-2">
                            Refresh failed — showing last result. ({dbReadinessError})
                          </p>
                        )}
                        {dbReadinessSummary && (dbReadinessSummary.failingChecks.length > 0 || dbReadinessSummary.warningChecks.length > 0) && (
                          <ul className="mt-3 space-y-1">
                            {dbReadinessSummary.failingChecks.map((check) => (
                              <li key={`fail-${check.name}`} className="text-[11px] text-gs-danger">
                                <span className="font-semibold uppercase tracking-wider">fail</span>{' · '}
                                <span className="font-mono">{check.name}</span>{' · '}
                                <span>{check.message}</span>
                              </li>
                            ))}
                            {dbReadinessSummary.warningChecks.map((check) => (
                              <li key={`warn-${check.name}`} className="text-[11px] text-amber-700">
                                <span className="font-semibold uppercase tracking-wider">warn</span>{' · '}
                                <span className="font-mono">{check.name}</span>{' · '}
                                <span>{check.message}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn-ghost text-xs gap-1.5"
                        onClick={() => loadDbReadiness({ refresh: true })}
                        disabled={dbReadinessLoading}
                        data-testid="db-readiness-refresh"
                      >
                        <RefreshCw size={13} className={dbReadinessLoading ? 'animate-spin' : ''} />
                        {dbReadinessLoading ? 'Refreshing…' : 'Refresh'}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </section>

            {/* Usage log storage */}
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-gs-text">Usage log storage</h2>
              </div>
              {storageError ? (
                <div className="card border-amber-200 bg-amber-50/70 flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                  <p className="text-sm text-gs-text">Storage status unavailable. <span className="text-gs-muted">{storageError}</span></p>
                </div>
              ) : !storageSummary ? (
                <div className="card text-xs text-gs-muted">Loading storage status…</div>
              ) : (
                <div
                  className={`card border ${
                    storageSummary.tone === 'danger'
                      ? 'border-red-200 bg-red-50/70'
                      : storageSummary.tone === 'warn'
                      ? 'border-amber-200 bg-amber-50/70'
                      : 'border-gs-border'
                  }`}
                  data-testid="ai-observability-storage-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <Database size={18} className={`mt-0.5 shrink-0 ${
                        storageSummary.tone === 'danger' ? 'text-gs-danger'
                          : storageSummary.tone === 'warn' ? 'text-amber-600'
                          : 'text-gs-muted'
                      }`} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gs-text">
                          {storageSummary.writeSafe ? 'Persistence active' : 'Persistence disabled'}
                        </p>
                        <p className="text-xs text-gs-muted mt-1">
                          backend: <span className="font-mono">{storageSummary.backend || '—'}</span>
                          {' · '}source: <span className="font-mono">{storageSummary.source || '—'}</span>
                        </p>
                        {storageSummary.warning ? (
                          <p className="text-xs text-gs-text mt-2">{storageSummary.warning}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <ConfiguredPill configured={Boolean(storageSummary.configured)} />
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider border ${
                        storageSummary.writeSafe
                          ? 'bg-green-50 text-gs-accent border-green-200'
                          : 'bg-red-50 text-gs-danger border-red-200'
                      }`}>
                        {storageSummary.writeSafe ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                        {storageSummary.writeSafe ? 'Write-safe' : 'Not write-safe'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Filters */}
            <section className="card">
              <form className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end" onSubmit={handleApplyFilters}>
                <div>
                  <label className="label" htmlFor="ai-filter-feature">Feature</label>
                  <select
                    id="ai-filter-feature"
                    className="select"
                    value={filters.feature}
                    onChange={(e) => handleFilterChange('feature', e.target.value)}
                  >
                    <option value="">All</option>
                    {availableFeatures.map((feature) => (
                      <option key={feature} value={feature}>{feature}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="ai-filter-provider">Provider</label>
                  <select
                    id="ai-filter-provider"
                    className="select"
                    value={filters.provider}
                    onChange={(e) => handleFilterChange('provider', e.target.value)}
                  >
                    <option value="">All</option>
                    {availableProviders.map((provider) => (
                      <option key={provider} value={provider}>{provider}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="ai-filter-success">Outcome</label>
                  <select
                    id="ai-filter-success"
                    className="select"
                    value={filters.success}
                    onChange={(e) => handleFilterChange('success', e.target.value)}
                  >
                    {SUCCESS_FILTER_OPTIONS.map(({ value, label }) => (
                      <option key={value || 'all'} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="ai-filter-limit">Limit</label>
                  <select
                    id="ai-filter-limit"
                    className="select"
                    value={filters.limit}
                    onChange={(e) => handleFilterChange('limit', Number(e.target.value))}
                  >
                    {LIMIT_OPTIONS.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button type="submit" className="btn-primary text-xs gap-1.5" disabled={refreshing}>
                    Apply
                  </button>
                  <button type="button" className="btn-ghost text-xs" onClick={handleResetFilters}>
                    Reset
                  </button>
                </div>
              </form>
            </section>

            {/* Usage Summary */}
            <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
              <StatCard icon={Zap} label="Total" value={summary?.total ?? 0} />
              <StatCard icon={CheckCircle2} label="Success" value={summary?.success ?? 0} />
              <StatCard icon={XCircle} label="Failure" value={summary?.failure ?? 0} />
              <StatCard label="Success rate" value={formatSuccessRate(successRate)} />
              <StatCard icon={Clock} label="Avg duration" value={formatDurationMs(summary?.averageDurationMs)} />
              <StatCard label="Top feature" value={topFeature?.key || '—'} sub={topFeature ? `${topFeature.count} calls` : null} />
              <StatCard label="Top provider" value={topProvider?.key || '—'} sub={topProvider ? `${topProvider.count} calls` : null} />
              <StatCard icon={AlertTriangle} label="Deprecated hits" value={deprecatedHitCount} sub="Loaded window" />
            </section>

            {/* Breakdowns */}
            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <BreakdownCard title="By feature" rows={featureRows} emptyLabel="No usage recorded yet." />
              <BreakdownCard title="By provider" rows={providerRows} emptyLabel="No usage recorded yet." />
              <BreakdownCard title="By error code" rows={errorRows} emptyLabel="No failures recorded." />
            </section>

            {/* Recent entries */}
            <section className="card overflow-hidden">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="font-semibold text-gs-text text-sm">Recent AI calls</h2>
                <span className="text-xs text-gs-muted">{entries.length} entr{entries.length === 1 ? 'y' : 'ies'}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gs-border">
                      <th className="th">Timestamp</th>
                      <th className="th">Feature</th>
                      <th className="th">Provider</th>
                      <th className="th">Model</th>
                      <th className="th">Endpoint</th>
                      <th className="th">Status</th>
                      <th className="th text-right">Duration</th>
                      <th className="th text-right">Input</th>
                      <th className="th text-right">Output</th>
                      <th className="th">Error code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.length === 0 ? (
                      <tr>
                        <td className="td text-gs-muted" colSpan={10}>No AI calls recorded yet.</td>
                      </tr>
                    ) : entries.map((entry) => (
                      <tr key={entry.id || `${entry.timestamp}-${entry.endpoint}`} className="table-row">
                        <td className="td text-gs-muted whitespace-nowrap">{formatTimestamp(entry.timestamp)}</td>
                        <td className="td font-medium">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span>{entry.feature || '—'}</span>
                              {entry.metadata?.deprecatedRoute ? (
                                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                                  Deprecated
                                </span>
                              ) : null}
                            </div>
                            {entry.metadata?.deprecatedRoute && entry.metadata?.replacementPath ? (
                              <span className="text-[11px] font-normal text-gs-muted">
                                Use {entry.metadata.replacementPath}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="td">{entry.provider || '—'}</td>
                        <td className="td text-gs-muted">{entry.model || '—'}</td>
                        <td className="td text-gs-muted">{entry.endpoint || '—'}</td>
                        <td className="td"><StatusPill status={entry.status} /></td>
                        <td className="td text-right tabular-nums">{formatDurationMs(entry.durationMs)}</td>
                        <td className="td text-right tabular-nums">{formatSize(entry.inputSize)}</td>
                        <td className="td text-right tabular-nums">{formatSize(entry.outputSize)}</td>
                        <td className="td text-gs-muted">{entry.errorCode || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
