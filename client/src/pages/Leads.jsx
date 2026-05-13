import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Search, RefreshCw, Send, StopCircle, PlayCircle,
  Filter, X, Edit3, User
} from 'lucide-react';
import { api } from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LeadDetailPanel from '../components/LeadDetailPanel.jsx';

const STATUS_OPTIONS = ['', 'archived', 'active', 'replied', 'stopped'];
const NOTE_OPTIONS   = ['', 'ag', 'na', 'rit', 't/m', 'iq'];
const BOOL_OPTIONS   = ['', 'yes'];

const CATEGORY_META = {
  replies:    { label: 'Replies',     desc: 'Leads that replied via SMS or email, or have replied status' },
  sent:       { label: 'Sent',        desc: 'Leads that have been sent a template' },
  errors:     { label: 'Errors',      desc: 'Leads with an error or failed send' },
  stopped:    { label: 'Stopped',     desc: 'Leads with follow-ups stopped' },
  inprogress: { label: 'In Progress', desc: 'Active leads still waiting for a response' },
};

function applyCategoryFilter(leads, category) {
  if (!category) return leads;
  switch (category) {
    case 'replies':
      return leads.filter(l =>
        (l.sms_reply && l.sms_reply.trim()) ||
        (l.email_reply && l.email_reply.trim()) ||
        l.status === 'replied'
      );
    case 'sent':
      return leads.filter(l => l.sent && l.sent.trim() && l.sent !== 'imported');
    case 'errors':
      return leads.filter(l =>
        (l.error && l.error.trim()) ||
        l.status === 'error' ||
        l.status === 'email_failed'
      );
    case 'stopped':
      return leads.filter(l => l.stop === 'yes' || l.status === 'stopped');
    case 'inprogress':
      return leads.filter(l => {
        if (l.stop === 'yes' || l.status === 'stopped') return false;
        if (l.status === 'replied' || (l.sms_reply && l.sms_reply.trim()) || (l.email_reply && l.email_reply.trim())) return false;
        if ((l.error && l.error.trim()) || l.status === 'error' || l.status === 'email_failed') return false;
        return true;
      });
    default: return leads;
  }
}

function EditModal({ lead, onClose, onSave }) {
  const [form, setForm] = useState({ ...lead });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try { await onSave(form); onClose(); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gs-card border border-gs-border rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gs-border">
          <h3 className="font-semibold text-gs-text">Edit Lead — {lead.name}</h3>
          <button onClick={onClose} className="text-gs-muted hover:text-gs-text cursor-pointer"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {['name', 'email', 'phone', 'notes', 'status'].map(field => (
            <div key={field}>
              <label className="label">{field}</label>
              <input className="input" value={form[field] || ''} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label className="label">stop</label>
            <select className="select" value={form.stop || ''} onChange={e => setForm(p => ({ ...p, stop: e.target.value }))}>
              <option value="">No</option>
              <option value="yes">Yes — stop follow-ups</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gs-border">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving && <Spinner size={14} />} Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Leads() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category     = searchParams.get('category') || '';
  const categoryMeta = CATEGORY_META[category] || null;

  const [leads, setLeads]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filters, setFilters]         = useState({ status: '', notes: '', stop: '', error: '', sms_reply: '', email_reply: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [editLead, setEditLead]       = useState(null);
  const [detailLead, setDetailLead]   = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [toast, setToast]             = useState(null);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function load() {
    setLoading(true);
    try {
      const { leads } = await api.leads.list();
      setLeads(leads || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let result = applyCategoryFilter(leads, category);
    result = result.filter(lead => {
      if (search) {
        const q = search.toLowerCase();
        const match = ['name', 'email', 'phone', 'notes', 'status', 'sms_reply', 'email_reply'].some(
          f => (lead[f] || '').toLowerCase().includes(q)
        );
        if (!match) return false;
      }
      for (const [key, val] of Object.entries(filters)) {
        if (val && (lead[key] || '').toLowerCase() !== val.toLowerCase()) return false;
      }
      return true;
    });
    return [...result].sort((a, b) => b.row_number - a.row_number);
  }, [leads, search, filters, category]);

  async function handleStop(lead) {
    setActionLoading(p => ({ ...p, [`stop_${lead.row_number}`]: true }));
    try {
      const isStopped = lead.stop === 'yes';
      if (isStopped) {
        await api.leads.unstop(lead.row_number, lead.name);
        showToast(`${lead.name} — stop removed`);
      } else {
        await api.leads.stop(lead.row_number, lead.name);
        showToast(`${lead.name} — stop set. No more follow-ups.`, 'warn');
      }
      await load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(p => ({ ...p, [`stop_${lead.row_number}`]: false }));
    }
  }

  async function handleSaveEdit(form) {
    await api.leads.update(form.row_number, form);
    showToast(`${form.name} updated`);
    await load();
  }

  const activeFilters = Object.values(filters).filter(Boolean).length;

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {categoryMeta && (
        <div className="px-6 py-3 border-b border-gs-border flex items-center gap-3"
             style={{ background: 'rgba(34,197,94,0.04)' }}>
          <span className="w-1 h-6 rounded-full bg-gs-accent shrink-0" />
          <div>
            <h1 className="text-sm font-semibold text-gs-text">{categoryMeta.label}</h1>
            <p className="text-gs-muted text-xs">{categoryMeta.desc}</p>
          </div>
          <Link to="/leads" className="ml-auto text-xs text-gs-muted hover:text-gs-accent transition-colors flex items-center gap-1">
            ← All leads
          </Link>
        </div>
      )}

      <div className="px-6 py-4 border-b border-gs-border flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gs-muted" />
            <input
              className="input pl-8"
              placeholder="Search name, phone, email, notes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowFilters(p => !p)}
            className={`btn-ghost text-xs gap-1.5 ${activeFilters ? 'border-gs-accent text-gs-accent' : ''}`}
          >
            <Filter size={13} />
            Filters {activeFilters > 0 && `(${activeFilters})`}
          </button>
          {activeFilters > 0 && (
            <button
              onClick={() => setFilters({ status: '', notes: '', stop: '', error: '', sms_reply: '', email_reply: '' })}
              className="text-gs-muted text-xs hover:text-gs-text"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gs-muted text-xs">{filtered.length} leads</span>
          <button onClick={load} className="btn-ghost text-xs gap-1.5">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="px-6 py-3 border-b border-gs-border bg-gs-card/50 flex flex-wrap gap-3">
          {[
            { key: 'status',      label: 'Status',         options: STATUS_OPTIONS },
            { key: 'notes',       label: 'Notes/Template', options: NOTE_OPTIONS   },
            { key: 'stop',        label: 'Stopped',        options: BOOL_OPTIONS   },
            { key: 'sms_reply',   label: 'SMS Reply',      options: BOOL_OPTIONS   },
            { key: 'email_reply', label: 'Email Reply',    options: BOOL_OPTIONS   }
          ].map(({ key, label, options }) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="label">{label}</label>
              <select
                className="select py-1.5 text-xs w-32"
                value={filters[key]}
                onChange={e => setFilters(p => ({ ...p, [key]: e.target.value }))}
              >
                {options.map(o => <option key={o} value={o}>{o || 'Any'}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className={`mx-6 mt-3 px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 ${
          toast.type === 'error' ? 'bg-gs-danger/20 text-gs-danger' :
          toast.type === 'warn'  ? 'bg-gs-warn/20  text-gs-warn'   :
          'bg-gs-accent/20 text-gs-accent'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={User}
            title="No leads found"
            desc={search ? 'Try a different search term' : categoryMeta ? 'No leads found for this category.' : 'No leads in the sheet yet'}
          />
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-gs-bg">
              <tr className="border-b border-gs-border">
                <th className="th">Name</th>
                <th className="th">Phone</th>
                <th className="th">Email</th>
                <th className="th">Notes</th>
                <th className="th">Status</th>
                <th className="th">Sent</th>
                <th className="th">Stop</th>
                <th className="th">SMS</th>
                <th className="th">Email</th>
                <th className="th">Error</th>
                <th className="th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(lead => (
                <tr
                  key={lead.row_number}
                  className="table-row cursor-pointer"
                  onClick={() => setDetailLead(lead)}
                >
                  <td className="td font-medium">{lead.name || <span className="text-gs-muted">—</span>}</td>
                  <td className="td font-mono text-xs">{lead.phone || '—'}</td>
                  <td className="td text-xs text-gs-muted max-w-[140px] truncate">{lead.email || '—'}</td>
                  <td className="td"><StatusBadge value={lead.notes} /></td>
                  <td className="td"><StatusBadge value={lead.status} /></td>
                  <td className="td text-xs text-gs-muted">
                    {lead.sent === 'imported' ? <span className="text-gs-muted">imported</span> :
                     lead.sent ? new Date(lead.sent).toLocaleDateString() : '—'}
                  </td>
                  <td className="td">{lead.stop === 'yes' && <StatusBadge value="yes" />}</td>
                  <td className="td">{lead.sms_reply === 'yes' && <StatusBadge value="yes" />}</td>
                  <td className="td">{lead.email_reply === 'yes' && <StatusBadge value="yes" />}</td>
                  <td className="td max-w-[120px]">
                    {lead.error && (
                      <span className="text-gs-danger text-xs truncate block" title={lead.error}>⚠ {lead.error}</span>
                    )}
                  </td>
                  <td className="td" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => navigate('/send', { state: { lead } })}
                        className="p-1.5 rounded hover:bg-gs-accent/20 text-gs-accent cursor-pointer"
                        title="Send template"
                      >
                        <Send size={13} />
                      </button>
                      <button
                        onClick={() => handleStop(lead)}
                        disabled={actionLoading[`stop_${lead.row_number}`]}
                        className={`p-1.5 rounded cursor-pointer ${lead.stop === 'yes' ? 'hover:bg-gs-accent/20 text-gs-accent' : 'hover:bg-gs-danger/20 text-gs-danger'}`}
                        title={lead.stop === 'yes' ? 'Remove stop' : 'Set stop'}
                      >
                        {actionLoading[`stop_${lead.row_number}`]
                          ? <Spinner size={13} />
                          : lead.stop === 'yes' ? <PlayCircle size={13} /> : <StopCircle size={13} />}
                      </button>
                      <button
                        onClick={() => setEditLead(lead)}
                        className="p-1.5 rounded hover:bg-gs-border text-gs-muted cursor-pointer"
                        title="Edit"
                      >
                        <Edit3 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editLead && (
        <EditModal lead={editLead} onClose={() => setEditLead(null)} onSave={handleSaveEdit} />
      )}

      {detailLead && (
        <LeadDetailPanel lead={detailLead} onClose={() => setDetailLead(null)} />
      )}
    </div>
  );
}
