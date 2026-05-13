import { useEffect, useState } from 'react';
import { Workflow, RefreshCw, ExternalLink, XCircle, Webhook, Mail, Database, Clock } from 'lucide-react';
import { api } from '../api/client.js';
import Spinner from '../components/Spinner.jsx';

const TYPE_META = {
  webhook:        { icon: Webhook,   label: 'Webhook Trigger',       bg: 'bg-gs-accent/12 border-gs-accent/30',  text: 'text-gs-accent'  },
  imap:           { icon: Mail,      label: 'Email (IMAP) Trigger',  bg: 'bg-gs-info/12 border-gs-info/30',      text: 'text-gs-info'    },
  sheets_trigger: { icon: Database,  label: 'Google Sheets Trigger', bg: 'bg-gs-purple/12 border-gs-purple/30',  text: 'text-gs-purple'  },
  schedule:       { icon: Clock,     label: 'Schedule Trigger',      bg: 'bg-gs-warn/12 border-gs-warn/30',      text: 'text-gs-warn'    },
};

export default function Workflows() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await api.workflows.list();
      setWorkflows(data.workflows || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-5 bg-gs-bg border-b border-gs-border flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gs-text">Workflows</h1>
          <p className="text-gs-muted text-xs mt-0.5">Your active n8n automation workflows</p>
        </div>
        <button onClick={load} className="btn-ghost text-xs gap-1.5">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="px-6 py-5 animate-fade-in-up">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : (
          <div className="grid gap-4">
            {workflows.map(wf => {
              const meta = TYPE_META[wf.type] || { icon: Workflow, label: wf.type, bg: 'bg-gs-border/60 border-gs-border', text: 'text-gs-muted' };
              const Icon = meta.icon;
              return (
                <div key={wf.id} className="card hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className={`p-2.5 rounded-xl border shrink-0 ${meta.bg}`}>
                        <Icon size={18} className={meta.text} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-1.5">
                          <h3 className="font-semibold text-gs-text">{wf.name}</h3>
                          <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                            wf.active
                              ? 'bg-gs-accent/12 border-gs-accent/30 text-gs-accent'
                              : 'bg-gs-border/60 border-gs-border text-gs-muted'
                          }`}>
                            {wf.active
                              ? <><span className="w-1.5 h-1.5 bg-gs-accent rounded-full inline-block animate-pulse" /> Active</>
                              : <><XCircle size={10} /> Inactive</>}
                          </span>
                        </div>
                        <p className="text-gs-muted text-sm mb-2.5 leading-relaxed">{wf.description}</p>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium ${meta.bg} ${meta.text}`}>
                            {meta.label}
                          </span>
                          {wf.webhookUrl && (
                            <span className="text-xs text-gs-muted font-mono truncate max-w-[300px] bg-gs-bg border border-gs-border px-2 py-0.5 rounded">
                              {wf.webhookUrl}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={`https://leadsales.app.n8n.cloud/workflow/${wf.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-ghost text-xs gap-1.5"
                      >
                        <ExternalLink size={12} /> Open in n8n
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 card border-dashed bg-gs-bg">
          <p className="text-gs-muted text-sm mb-2 leading-relaxed">
            <strong className="text-gs-text">To add more workflows:</strong> Build them in n8n, then add their webhook URLs to the dashboard by editing <code className="text-gs-accent text-xs bg-gs-accent/10 border border-gs-accent/25 px-1.5 py-0.5 rounded font-mono">server/services/n8n.js</code>.
          </p>
          <a href="https://leadsales.app.n8n.cloud" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-gs-accent text-sm hover:underline font-medium">
            <ExternalLink size={13} /> Open n8n dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
