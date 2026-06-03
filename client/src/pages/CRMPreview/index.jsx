import { useEffect, useState, useCallback, useMemo, useRef, startTransition } from 'react';
import { api } from '../../api/client.js';
import { filterConversationLeads, hasConversationSignal } from '../Replies/conversationLeadFilter.js';
import { deriveStats } from './mockData.js';
import PremiumSidebar from './components/PremiumSidebar.jsx';
import PreviewHeader from './components/PreviewHeader.jsx';
import SalesSummaryBar from './components/SalesSummaryBar.jsx';
import DashboardIntelligence from './components/DashboardIntelligence.jsx';
import PipelineSummary from './components/PipelineSummary.jsx';
import LeadPipeline from './components/LeadPipeline.jsx';
import LoadingSkeleton from './components/LoadingSkeleton.jsx';
import './preview.css';

function PreviewToast({ message, onClose }) {
  if (!message) return null;
  return (
    <div
      className="type-body-sm"
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
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        maxWidth: 'min(420px, calc(100vw - 48px))',
      }}
    >
      <span
        className="type-label-md uppercase"
        style={{ color: '#4ade80', flexShrink: 0 }}
      >
        Info
      </span>
      {message}
    </div>
  );
}

function ErrorState({ onRetry, message }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-12">
      <div style={{ background: '#fef2f2', borderRadius: '16px', padding: '16px', display: 'inline-flex' }}>
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#DC2626" strokeWidth="1.5"/><path d="M12 8v4m0 4h.01" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </div>
      <div>
        <p className="font-display font-semibold text-[#0F172A] text-base">Could not load data</p>
        <p className="text-sm text-[#64748B] mt-1 max-w-xl">
          {message || 'The hosted API is reachable, but the dashboard could not load leads or activity data. Check Render logs for the exact API error.'}
        </p>
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
  const [, setActivity] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const loadingRef              = useRef(false);
  const [unreadReplies, setUnreadReplies] = useState(0);
  const [unreadReplyRows, setUnreadReplyRows] = useState(() => new Set());

  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch]             = useState('');
  const [toast, setToast]               = useState(null);
  const pipelineRef = useRef(null);

  const refresh = useCallback(async () => {
    loadingRef.current = true;
    setLoading(true);
    setError(false);
    setErrorMessage('');
    try {
      const [leadsData, activityData] = await Promise.all([
        api.leads.list(),
        api.activity.list(12),
      ]);
      setLeads(leadsData.leads || []);
      setActivity(activityData.log || []);
    } catch (err) {
      setError(true);
      setErrorMessage(err?.message || 'Unknown API error');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // 30-second background leads refresh — no UI state reset, no scraping
  useEffect(() => {
    const interval = setInterval(async () => {
      if (loadingRef.current) return;
      try {
        const data = await api.leads.list();
        startTransition(() => setLeads(data.leads || []));
      } catch { /* ignore — user can manually refresh */ }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const refreshUnreadReplies = useCallback(async (leadList) => {
    const replyLeads = filterConversationLeads(leadList);
    if (!replyLeads.length) {
      setUnreadReplies(0);
      setUnreadReplyRows(new Set());
      return;
    }
    try {
      const { count, rowNumbers } = await api.messages.unreadCount(replyLeads);
      setUnreadReplies(typeof count === 'number' ? count : 0);
      setUnreadReplyRows(new Set(Array.isArray(rowNumbers) ? rowNumbers : []));
    } catch {
      /* keep previous badge on transient errors */
    }
  }, []);

  useEffect(() => {
    if (!leads) return;
    refreshUnreadReplies(leads);
  }, [leads, refreshUnreadReplies]);

  useEffect(() => {
    const handler = () => {
      if (leads) refreshUnreadReplies(leads);
    };
    window.addEventListener('replies-unread-count', handler);
    return () => window.removeEventListener('replies-unread-count', handler);
  }, [leads, refreshUnreadReplies]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, []);

  const handlePreviewAction = useCallback((type) => {
    if (type === 'stop') showToast('Use the Leads page to stop or resume a lead');
    if (type === 'edit') showToast('Use the Leads page to edit lead details');
  }, [showToast]);

  const handleLeadDeleted = useCallback(async (lead) => {
    try {
      await api.leads.delete(lead.row_number, lead.name);
      setLeads(prev => (prev || []).filter(l => l.row_number !== lead.row_number));
    } catch {
      showToast('Could not delete lead — try again');
    }
  }, [showToast]);

  const handleFilterChange = useCallback((filter) => {
    setActiveFilter(filter);
    pipelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  const stats = useMemo(() => leads ? deriveStats(leads) : null, [leads]);

  const isUnreadReply = useCallback((lead) => {
    if (!hasConversationSignal(lead)) return false;
    return unreadReplyRows.has(lead.row_number);
  }, [unreadReplyRows]);

  return (
    <div
      className="crm-preview flex h-screen overflow-hidden"
    >
      <PremiumSidebar
        stats={stats}
        testMode={testMode}
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
        unreadReplies={unreadReplies}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <PreviewHeader onRefresh={refresh} loading={loading} />

        <main className="flex-1 overflow-y-auto w-full">
          {error ? (
            <ErrorState onRetry={refresh} message={errorMessage} />
          ) : loading ? (
            <LoadingSkeleton />
          ) : (
            <div className="bento-shell p-4 lg:p-6 space-y-4 lg:space-y-6 w-full">

              {/* Sales summary bar */}
              <SalesSummaryBar leads={leads ?? []} loading={false} />

              {/* Pipeline Summary — full width */}
              <PipelineSummary stats={stats ?? {}} />

              <DashboardIntelligence
                leads={leads ?? []}
                loading={false}
                isUnreadReply={isUnreadReply}
                onFilterChange={handleFilterChange}
              />

              {/* Lead Pipeline — full width */}
              <div ref={pipelineRef} className="pb-4 xl:pb-5">
                <LeadPipeline
                  leads={leads ?? []}
                  activeFilter={activeFilter}
                  setActiveFilter={setActiveFilter}
                  search={search}
                  setSearch={setSearch}
                  onPreviewAction={handlePreviewAction}
                  onDelete={handleLeadDeleted}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      <PreviewToast message={toast} />
    </div>
  );
}
