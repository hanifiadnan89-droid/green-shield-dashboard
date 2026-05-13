import { useEffect, useState } from 'react';
import { Activity, RefreshCw, Trash2, CheckCircle, XCircle, FlaskConical } from 'lucide-react';
import { api } from '../api/client.js';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';

const ACTION_LABELS = {
  template_sent: 'Template Sent',
  lead_added: 'Lead Added',
  lead_updated: 'Lead Updated',
  lead_stopped: 'Lead Stopped',
  lead_unstopped: 'Lead Unstopped'
};

export default function ActivityLog() {
  const [log, setLog] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [filter, setFilter] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await api.activity.list(200);
      setLog(data.log || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleClear() {
    if (!confirm('Clear all activity log entries?')) return;
    setClearing(true);
    try {
      await api.activity.clear();
      await load();
    } finally {
      setClearing(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = filter
    ? log.filter(e => {
        const q = filter.toLowerCase();
        return (e.action || '').includes(q) ||
               (e.leadName || '').toLowerCase().includes(q) ||
               (e.template || '').toLowerCase().includes(q) ||
               (e.status || '').includes(q);
      })
    : log;

  function EntryIcon({ entry }) {
    if (entry.status === 'error') {
      return (
        <div className="w-8 h-8 rounded-full bg-gs-danger/12 border border-gs-danger/30 flex items-center justify-center shrink-0">
          <XCircle size={15} className="text-gs-danger" />
        </div>
      );
    }
    if (entry.testMode) {
      return (
        <div className="w-8 h-8 rounded-full bg-gs-warn/12 border border-gs-warn/30 flex items-center justify-center shrink-0">
          <FlaskConical size={15} className="text-gs-warn" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-gs-accent/12 border border-gs-accent/30 flex items-center justify-center shrink-0">
        <CheckCircle size={15} className="text-gs-accent" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-5 bg-gs-bg border-b border-gs-border flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gs-text">Activity Log</h1>
          <p className="text-gs-muted text-xs mt-0.5 font-medium">{total} total entries</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="input py-1.5 text-xs w-40"
            placeholder="Filter log..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          <button onClick={load} className="btn-ghost text-xs gap-1.5">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={handleClear} disabled={clearing} className="btn-danger text-xs gap-1.5">
            {clearing ? <Spinner size={13} /> : <Trash2 size={13} />} Clear
          </button>
        </div>
      </div>

      <div className="px-6 py-4 animate-fade-in-up">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Activity} title="No activity yet" desc="Actions you take in the dashboard will appear here" />
        ) : (
          <div className="space-y-2">
            {filtered.map(entry => (
              <div key={entry.id} className={`bg-gs-card border rounded-xl p-4 flex items-start gap-3 transition-shadow hover:shadow-card-lift border-l-4 ${
                entry.status === 'error' ? 'border-l-gs-danger border-gs-danger/20' :
                entry.testMode ? 'border-l-gs-warn border-gs-warn/20' :
                'border-l-gs-accent border-gs-accent/20'
              }`}>
                <EntryIcon entry={entry} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-gs-text font-semibold text-sm">
                        {ACTION_LABELS[entry.action] || entry.action}
                      </span>
                      {entry.leadName && (
                        <span className="text-gs-muted text-xs">→ {entry.leadName}</span>
                      )}
                      {entry.template && (
                        <span className="bg-gs-info/12 border border-gs-info/30 text-gs-info text-xs px-2 py-0.5 rounded-full font-mono uppercase font-medium">
                          {entry.template}
                        </span>
                      )}
                      {entry.channel && entry.channel !== 'both' && (
                        <span className="bg-gs-border/60 border border-gs-border text-gs-muted text-xs px-2 py-0.5 rounded-full">
                          {entry.channel}
                        </span>
                      )}
                      {entry.testMode && (
                        <span className="bg-gs-warn/12 border border-gs-warn/30 text-gs-warn text-xs px-2 py-0.5 rounded-full font-medium">TEST</span>
                      )}
                    </div>
                    <p className="text-gs-muted text-xs shrink-0 font-medium">
                      {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}
                    </p>
                  </div>
                  {entry.error && (
                    <p className="text-gs-danger text-xs mt-1.5 bg-gs-danger/8 border border-gs-danger/20 rounded px-2 py-1">{entry.error}</p>
                  )}
                  {entry.leadPhone && (
                    <p className="text-gs-muted text-xs mt-1 font-mono">{entry.leadPhone}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
