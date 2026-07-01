import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../../api/client.js';
import PipelineSummary from './components/PipelineSummary.jsx';
import CommandLoadingSkeleton from './components/PipelineSummary/CommandLoadingSkeleton.jsx';
import { loadCRMPreviewDashboard } from './loadCRMPreviewDashboard.js';
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
  const [dashboardStats, setDashboardStats] = useState(null);
  const [pipelineMetrics, setPipelineMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    setErrorMessage('');

    try {
      const dashboard = await loadCRMPreviewDashboard(api);
      setLeads(dashboard.leads || []);
      setDashboardStats(dashboard.stats || null);
      setPipelineMetrics(dashboard.pipelineMetrics || null);
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

  const stats = useMemo(() => dashboardStats, [dashboardStats]);

  return (
    <div className="crm-preview crm-preview--command flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden">
      <main className="gs-command-main__scroll gs-command-main__scroll--fit flex-1 overflow-hidden overflow-x-hidden min-h-0">
        {error ? (
          <ErrorState onRetry={refresh} message={errorMessage} />
        ) : loading ? (
          <CommandLoadingSkeleton />
        ) : (
          <PipelineSummary
            stats={stats ?? {}}
            leads={leads ?? []}
            pipelineMetrics={pipelineMetrics}
            onRefresh={refresh}
          />
        )}
      </main>
    </div>
  );
}
