import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Phone, Mail, User, Calendar, Clock, AlertCircle, CheckCircle, XCircle, MessageSquare, Send, Hash } from 'lucide-react';
import { api } from '../api/client.js';
import StatusBadge from './StatusBadge.jsx';
import { hasRealReply } from '../pages/CRMPreview/mockData.js';

const KNOWN_KEYS = new Set(['name','email','phone','notes','status','sent','stop','sms_reply','email_reply','error','row_number']);

function Field({ label, value, mono }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gs-border/50 last:border-0">
      <span className="text-gs-muted text-xs w-28 shrink-0 pt-0.5">{label}</span>
      <span className={`text-gs-text text-sm flex-1 break-words ${mono ? 'font-mono text-xs' : ''}`}>
        {value || <span className="text-gs-muted/60">—</span>}
      </span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-5">
      <p className="text-xs font-semibold text-gs-muted uppercase tracking-widest mb-2 px-5">{title}</p>
      <div className="px-5">{children}</div>
    </div>
  );
}

export default function LeadDetailPanel({ lead, onClose }) {
  const navigate = useNavigate();
  const [activity, setActivity] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

  useEffect(() => {
    api.activity.list(50).then(data => {
      const entries = (data.log || []).filter(e =>
        e.leadName && e.leadName.toLowerCase() === lead.name?.toLowerCase()
      );
      setActivity(entries.slice(0, 8));
    }).catch(() => {}).finally(() => setLoadingActivity(false));
  }, [lead.name]);

  const sentDate = lead.sent && lead.sent !== 'imported' ? new Date(lead.sent) : null;
  const daysInSystem = sentDate
    ? Math.floor((Date.now() - sentDate.getTime()) / 86400000)
    : null;

  const extraKeys = Object.keys(lead).filter(k => !KNOWN_KEYS.has(k));

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/45 backdrop-blur-md" />

      {/* Panel */}
      <div
        className="w-[420px] border-l border-white/60 flex flex-col h-full shadow-2xl animate-slide-in-right overflow-hidden glass-panel"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gs-border/70 flex items-start justify-between gap-3 bg-white/45 shrink-0">
          <div>
            <h2 className="font-bold text-gs-text text-base">{lead.name || 'Unknown Lead'}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-gs-muted text-xs flex items-center gap-1">
                <Hash size={10} /> Row {lead.row_number}
              </span>
              {lead.status && <StatusBadge value={lead.status} />}
            </div>
          </div>
          <button
            onClick={onClose}
            className="icon-button text-gs-muted hover:text-gs-text p-1.5 shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto py-4">

          {/* Contact */}
          <Section title="Contact">
            <Field label="Phone" value={lead.phone} mono />
            <Field label="Email" value={lead.email} mono />
            {lead.address && <Field label="Address" value={lead.address} />}
          </Section>

          {/* Status & Template */}
          <Section title="Status">
            <Field label="Status" value={lead.status ? <StatusBadge value={lead.status} /> : null} />
            <Field label="Template" value={lead.notes ? <StatusBadge value={lead.notes} /> : null} />
            <Field label="Stop" value={
              lead.stop === 'yes'
                ? <span className="text-gs-danger text-xs font-semibold">Yes — follow-ups stopped</span>
                : <span className="text-gs-muted text-xs">No</span>
            } />
            {lead.error && (
              <Field label="Error" value={
                <span className="text-gs-danger text-xs">{lead.error}</span>
              } />
            )}
          </Section>

          {/* Engagement */}
          <Section title="Engagement">
            <Field label="SMS Reply" value={hasRealReply(lead.sms_reply)
              ? <span className="text-gs-accent text-xs font-semibold flex items-center gap-1"><CheckCircle size={11} /> Replied</span>
              : <span className="text-gs-muted text-xs">None</span>
            } />
            <Field label="Email Reply" value={hasRealReply(lead.email_reply)
              ? <span className="text-gs-accent text-xs font-semibold flex items-center gap-1"><CheckCircle size={11} /> Replied</span>
              : <span className="text-gs-muted text-xs">None</span>
            } />
          </Section>

          {/* Timeline */}
          <Section title="Timeline">
            <Field label="First Sent" value={
              sentDate
                ? <span>{sentDate.toLocaleDateString()} <span className="text-gs-muted text-xs">({daysInSystem}d ago)</span></span>
                : lead.sent === 'imported' ? 'Imported (no send date)' : null
            } />
            {daysInSystem !== null && (
              <Field label="In System" value={
                <span className="text-gs-text">{daysInSystem} day{daysInSystem !== 1 ? 's' : ''}</span>
              } />
            )}
          </Section>

          {/* Extra sheet columns if present */}
          {extraKeys.length > 0 && (
            <Section title="Additional Info">
              {extraKeys.map(k => (
                <Field key={k} label={k.replace(/_/g, ' ')} value={lead[k]} />
              ))}
            </Section>
          )}

          {/* Recent Activity */}
          <Section title="Recent Activity">
            {loadingActivity ? (
              <p className="text-gs-muted text-xs py-2">Loading...</p>
            ) : activity.length === 0 ? (
              <p className="text-gs-muted text-xs py-2">No activity recorded for this lead</p>
            ) : (
              <div className="space-y-2">
                {activity.map(entry => (
                  <div key={entry.id} className={`flex items-start gap-2.5 text-xs py-2 border-b border-gs-border/40 last:border-0`}>
                    {entry.status === 'error'
                      ? <XCircle size={12} className="text-gs-danger mt-0.5 shrink-0" />
                      : entry.testMode
                        ? <span className="w-3 h-3 rounded-full border border-gs-warn bg-gs-warn/20 shrink-0 mt-0.5" />
                        : <CheckCircle size={12} className="text-gs-accent mt-0.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <span className="text-gs-text font-medium capitalize">
                        {entry.action?.replace(/_/g, ' ')}
                      </span>
                      {entry.template && (
                        <span className="ml-1.5 text-gs-info bg-gs-info/12 border border-gs-info/20 px-1.5 py-0.5 rounded font-mono uppercase">
                          {entry.template}
                        </span>
                      )}
                      {entry.testMode && (
                        <span className="ml-1.5 text-gs-warn bg-gs-warn/12 border border-gs-warn/20 px-1.5 py-0.5 rounded">TEST</span>
                      )}
                    </div>
                    <span className="text-gs-muted shrink-0">
                      {entry.timestamp ? new Date(entry.timestamp).toLocaleDateString() : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-gs-border/70 bg-white/40 shrink-0 flex gap-2">
          <button
            onClick={() => { onClose(); navigate('/send', { state: { lead } }); }}
            className="btn-primary text-xs flex-1 justify-center cursor-pointer"
          >
            <Send size={12} /> Send Template
          </button>
          <button onClick={onClose} className="btn-ghost text-xs">Close</button>
        </div>
      </div>
    </div>
  );
}
