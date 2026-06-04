import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../../api/client.js';
import { deriveStats } from './mockData.js';
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

export default function CRMPreview() {
  const [leads, setLeads] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
        setLeads(data.leads || []);
      } catch {
        // Silent background refresh failure.
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(() => (leads ? deriveStats(leads) : null), [leads]);

  return (
    <div className="crm-preview crm-preview--command flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden">
      <main className="gs-command-main__scroll flex-1 overflow-y-auto overflow-x-hidden min-h-0">
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
  );
}
