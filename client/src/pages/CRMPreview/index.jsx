import { useEffect, useState, useCallback, useMemo, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { filterConversationLeads } from '../Replies/conversationLeadFilter.js';
import { loadLegacyViewedKeys } from '../Replies/legacyViewedKeys.js';
import { deriveStats } from './mockData.js';
import PremiumSidebar from './components/PremiumSidebar.jsx';
import PipelineSummary from './components/PipelineSummary.jsx';
import CommandLoadingSkeleton from './components/PipelineSummary/CommandLoadingSkeleton.jsx';
import './preview.css';
import './components/PipelineSummary/pipeline-command.css';

function ErrorState({ onRetry, message }) {
  return (
    <div className="gs-command-error">
      <p className="gs-command-error__title">Could not load dashboard</p>
      <p className="gs-command-error__msg">
        {message || 'Check API connection and try again.'}
      </p>
      <button type="button" className="pc-cta-outline" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

export default function CRMPreview({ testMode }) {
  const navigate = useNavigate();
  const [leads, setLeads] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [unreadReplies, setUnreadReplies] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    setErrorMessage('');

    try {
      const { leads: data } = await api.leads.list();
      setLeads(data || []);
    } catch (err) {
      setError(true);
      setErrorMessage(err?.message || 'Unknown API error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await api.leads.list();

        startTransition(() => {
          setLeads(data.leads || []);
        });
      } catch {
        // Silent background refresh failure.
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const refreshUnreadReplies = useCallback(async (leadList) => {
    const replyLeads = filterConversationLeads(leadList);

    if (!replyLeads.length) {
      setUnreadReplies(0);
      return;
    }

    try {
      const { count } = await api.messages.unreadCount(replyLeads, loadLegacyViewedKeys());
      setUnreadReplies(typeof count === 'number' ? count : 0);
    } catch {
      // Keep previous unread badge if unread count fails.
    }
  }, []);

  useEffect(() => {
    if (!leads) return;
    refreshUnreadReplies(leads);
  }, [leads, refreshUnreadReplies]);

  const handleFilterChange = useCallback((filter) => {
    if (filter === 'all') return;
    navigate(`/leads?category=${filter}`);
  }, [navigate]);

  const stats = useMemo(() => (leads ? deriveStats(leads) : null), [leads]);

  return (
    <div className="crm-preview crm-preview--command flex h-screen overflow-hidden">
      <PremiumSidebar
        stats={stats}
        testMode={testMode}
        activeFilter="all"
        onFilterChange={handleFilterChange}
        unreadReplies={unreadReplies}
      />

      <div className="gs-command-main flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="gs-command-main__scroll flex-1 overflow-y-auto overflow-x-hidden">
          {error ? (
            <ErrorState onRetry={refresh} message={errorMessage} />
          ) : loading ? (
            <CommandLoadingSkeleton />
          ) : (
            <PipelineSummary
              stats={stats ?? {}}
              leads={leads ?? []}
              onRefresh={refresh}
            />
          )}
        </main>
      </div>
    </div>
  );
}