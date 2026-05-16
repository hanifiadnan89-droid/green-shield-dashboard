import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { api } from '../../api/client.js';
import { deriveStats } from './mockData.js';
import PremiumSidebar from './components/PremiumSidebar.jsx';
import PreviewHeader from './components/PreviewHeader.jsx';
import SalesSummaryBar from './components/SalesSummaryBar.jsx';
import PriorityQueue from './components/PriorityQueue.jsx';
import PipelineSummary from './components/PipelineSummary.jsx';
import LeadPipeline from './components/LeadPipeline.jsx';
import RouteFinderWidget from './components/RouteFinderWidget.jsx';
import LoadingSkeleton from './components/LoadingSkeleton.jsx';
import './preview.css';

function PreviewToast({ message, onClose }) {
  if (!message) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: '#0f1f12',
        color: '#e2e8f0',
        borderRadius: '12px',
        padding: '12px 20px',
        fontSize: '13px',
        fontWeight: 500,
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        maxWidth: '420px',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: '#4ade80', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
        Info
      </span>
      {message}
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-12">
      <div style={{ background: '#fef2f2', borderRadius: '16px', padding: '16px', display: 'inline-flex' }}>
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#DC2626" strokeWidth="1.5"/><path d="M12 8v4m0 4h.01" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </div>
      <div>
        <p className="font-heading font-semibold text-[#0F172A] text-base">Could not load data</p>
        <p className="text-sm text-[#64748B] mt-1">Check that the dev server is running on port 3001</p>
      </div>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 text-sm font-semibold text-white px-5 py-2.5 rounded-xl cursor-pointer transition-all"
        style={{ background: '#16A34A', boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }}
        onMouseEnter={e => { e.currentTarget.style.background = '#15803d'; }}
        onMouseLeave={e => { e.currentTarget.style.background = '#16A34A'; }}
      >
        Retry
      </button>
    </div>
  );
}

export default function CRMPreview({ testMode }) {
  const [leads, setLeads]       = useState(null);
  const [activity, setActivity] = useState(null); // eslint-disable-line no-unused-vars
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);

  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch]             = useState('');
  const [toast, setToast]               = useState(null);
  const pipelineRef = useRef(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [leadsData, activityData] = await Promise.all([
        api.leads.list(),
        api.activity.list(12),
      ]);
      setLeads(leadsData.leads || []);
      setActivity(activityData.log || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, []);

  const handlePreviewAction = useCallback((type) => {
    if (type === 'stop') showToast('Use the Leads page to stop or resume a lead');
    if (type === 'edit') showToast('Use the Leads page to edit lead details');
  }, [showToast]);

  const handleFilterChange = useCallback((filter) => {
    setActiveFilter(filter);
    pipelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  const stats = useMemo(() => leads ? deriveStats(leads) : null, [leads]);

  return (
    <div
      className="crm-preview flex h-screen overflow-hidden"
      style={{ background: '#f0f4f0' }}
    >
      <PremiumSidebar
        stats={stats}
        testMode={testMode}
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <PreviewHeader onRefresh={refresh} loading={loading} />

        <main className="flex-1 overflow-y-auto">
          {error ? (
            <ErrorState onRetry={refresh} />
          ) : loading ? (
            <LoadingSkeleton />
          ) : (
            <div className="p-6 space-y-5 max-w-[1600px]">

              {/* Sales summary bar */}
              <SalesSummaryBar leads={leads ?? []} loading={false} />

              {/* Priority Work Queue + Pipeline Summary */}
              <div className="grid grid-cols-12 gap-5">
                <div className="col-span-8">
                  <PriorityQueue leads={leads ?? []} loading={false} />
                </div>
                <div className="col-span-4">
                  <PipelineSummary
                    byTemplate={stats?.byTemplate}
                    total={stats?.total ?? 0}
                  />
                </div>
              </div>

              {/* Lead Pipeline + Activity Feed */}
              <div ref={pipelineRef} className="grid grid-cols-12 gap-5 pb-6">
                <div className="col-span-8">
                  <LeadPipeline
                    leads={leads ?? []}
                    activeFilter={activeFilter}
                    setActiveFilter={setActiveFilter}
                    search={search}
                    setSearch={setSearch}
                    onPreviewAction={handlePreviewAction}
                  />
                </div>
                <div className="col-span-4">
                  <RouteFinderWidget />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <PreviewToast message={toast} />
    </div>
  );
}
