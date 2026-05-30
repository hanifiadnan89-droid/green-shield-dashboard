import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, RefreshCw, Info } from 'lucide-react';
import { api } from '../api/client.js';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { DataTable } from '../components/DataTable/index.js';
import { createFollowupsColumns } from './followupsColumns.jsx';

export default function Followups() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stopLoading, setStopLoading] = useState({});
  const [toast, setToast] = useState(null);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function load() {
    setLoading(true);
    try {
      const { leads: all } = await api.leads.list();
      const pending = (all || []).filter(l => {
        if (l.stop === 'yes') return false;
        if (l.status === 'replied') return false;
        if (l.status === 'archived' && (!l.sent || l.sent === 'imported')) return false;
        if (!l.sent || l.sent === 'imported') return false;
        return true;
      });
      setLeads(pending);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleStop(lead) {
    setStopLoading(p => ({ ...p, [lead.row_number]: true }));
    try {
      await api.leads.stop(lead.row_number, lead.name);
      showToast(`${lead.name} — stopped`);
      await load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setStopLoading(p => ({ ...p, [lead.row_number]: false }));
    }
  }

  const columns = useMemo(
    () => createFollowupsColumns({
      navigate,
      onStop: handleStop,
      stopLoading,
    }),
    [navigate, stopLoading, handleStop]
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-5 bg-gs-bg border-b border-gs-border flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gs-text">Follow-ups</h1>
          <p className="text-gs-muted text-xs mt-0.5">
            Leads sent a template that have not replied or been stopped
          </p>
        </div>
        <button onClick={load} className="btn-ghost text-xs gap-1.5">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="px-6 py-5 animate-fade-in-up">
        {toast && (
          <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium border ${
            toast.type === 'error' ? 'bg-gs-danger/12 text-gs-danger border-gs-danger/30' : 'bg-gs-accent/12 text-gs-accent border-gs-accent/30'
          }`}>{toast.msg}</div>
        )}

        <div className="bg-gs-info/8 border border-gs-info/25 rounded-xl p-4 flex items-start gap-3 mb-5">
          <div className="w-7 h-7 rounded-full bg-gs-info/12 border border-gs-info/30 flex items-center justify-center shrink-0 mt-0.5">
            <Info size={14} className="text-gs-info" />
          </div>
          <p className="text-gs-muted text-sm leading-relaxed">
            <strong className="text-gs-text font-semibold">n8n handles follow-ups automatically</strong> at 2-day and 5-day intervals after you trigger a template.
            If a lead replies or you set stop=yes, n8n will not send further messages.
            This page shows leads still in-flight.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : leads.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No pending follow-ups"
            desc="All sent leads have either replied or been stopped"
          />
        ) : (
          <div className="bg-gs-card rounded-xl border border-gs-border overflow-hidden">
            <DataTable
              columns={columns}
              data={leads}
              getRowId={row => String(row.row_number)}
              stickyHeader={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
