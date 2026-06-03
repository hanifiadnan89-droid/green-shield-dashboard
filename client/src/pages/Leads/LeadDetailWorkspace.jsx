import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Phone, Mail, Send, Hash, CheckCircle, XCircle, Calendar, Clock,
} from 'lucide-react';
import { api } from '../../api/client.js';
import { hasRealReply } from '../CRMPreview/mockData.js';
import { getAvatarStyle, getInitials } from '../CRMPreview/mockData.js';
import LeadStatusPill from './LeadStatusPill.jsx';

const KNOWN_KEYS = new Set([
  'name', 'email', 'phone', 'notes', 'status', 'sent', 'stop',
  'sms_reply', 'email_reply', 'error', 'row_number',
]);

function FieldRow({ label, children }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gs-border/40 last:border-0">
      <span className="text-gs-muted text-xs w-28 shrink-0 pt-0.5">{label}</span>
      <div className="text-gs-text text-sm flex-1 break-words">{children}</div>
    </div>
  );
}

export default function LeadDetailWorkspace({ lead, onClose }) {
  const navigate = useNavigate();
  const [activity, setActivity] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

  useEffect(() => {
    setLoadingActivity(true);
    api.activity.list(50).then(data => {
      const entries = (data.log || []).filter(e =>
        e.leadName && e.leadName.toLowerCase() === lead.name?.toLowerCase()
      );
      setActivity(entries.slice(0, 10));
    }).catch(() => {}).finally(() => setLoadingActivity(false));
  }, [lead.name]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sentDate = lead.sent && lead.sent !== 'imported' ? new Date(lead.sent) : null;
  const daysInSystem = sentDate
    ? Math.floor((Date.now() - sentDate.getTime()) / 86400000)
    : null;
  const extraKeys = Object.keys(lead).filter(k => !KNOWN_KEYS.has(k));
  const avatar = getAvatarStyle(lead.name);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="leads-workspace-layer"
        className="fixed inset-0 z-[60]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
      <motion.div
        className="leads-workspace-backdrop absolute inset-0"
        onClick={onClose}
      />
      <motion.div
        className="leads-workspace absolute inset-0 z-[1] flex flex-col"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        role="dialog"
        aria-modal="true"
        aria-label={`Lead details: ${lead.name}`}
      >
        <header className="leads-workspace__header">
          <motion.div
            layoutId={`lead-avatar-${lead.row_number}`}
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: avatar.bg, color: avatar.text, border: `1px solid ${avatar.text}22` }}
          >
            {getInitials(lead.name)}
          </motion.div>
          <div className="flex-1 min-w-0">
            <motion.h2
              layoutId={`lead-name-${lead.row_number}`}
              className="text-xl sm:text-2xl font-bold text-gs-text truncate"
            >
              {lead.name || 'Unknown Lead'}
            </motion.h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-gs-muted text-xs flex items-center gap-1">
                <Hash size={11} /> Row {lead.row_number}
              </span>
              {lead.status && (
                <LeadStatusPill value={lead.status} layoutId={`lead-status-${lead.row_number}`} />
              )}
              {lead.notes && <LeadStatusPill value={lead.notes} />}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="leads-btn-icon shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="leads-workspace__body">
          <div className="leads-workspace__grid">
            <section className="leads-workspace__card">
              <h3 className="leads-workspace__card-title">Contact</h3>
              <FieldRow label="Phone">
                {lead.phone
                  ? <span className="font-mono text-sm flex items-center gap-2"><Phone size={14} className="text-gs-muted" />{lead.phone}</span>
                  : <span className="text-gs-muted">—</span>}
              </FieldRow>
              <FieldRow label="Email">
                {lead.email
                  ? <span className="font-mono text-xs break-all flex items-start gap-2"><Mail size={14} className="text-gs-muted shrink-0 mt-0.5" />{lead.email}</span>
                  : <span className="text-gs-muted">—</span>}
              </FieldRow>
              {lead.address && <FieldRow label="Address">{lead.address}</FieldRow>}
            </section>

            <section className="leads-workspace__card">
              <h3 className="leads-workspace__card-title">Status & follow-up</h3>
              <FieldRow label="Stop">
                {lead.stop === 'yes'
                  ? <span className="text-gs-danger text-xs font-semibold">Yes — follow-ups stopped</span>
                  : <span className="text-gs-muted text-xs">No</span>}
              </FieldRow>
              <FieldRow label="SMS reply">
                {hasRealReply(lead.sms_reply)
                  ? <span className="text-gs-accent text-xs font-semibold flex items-center gap-1"><CheckCircle size={12} /> Replied</span>
                  : <span className="text-gs-muted text-xs">None</span>}
              </FieldRow>
              <FieldRow label="Email reply">
                {hasRealReply(lead.email_reply)
                  ? <span className="text-gs-accent text-xs font-semibold flex items-center gap-1"><CheckCircle size={12} /> Replied</span>
                  : <span className="text-gs-muted text-xs">None</span>}
              </FieldRow>
              {lead.error && (
                <FieldRow label="Error">
                  <span className="text-gs-danger text-xs">{lead.error}</span>
                </FieldRow>
              )}
            </section>

            <section className="leads-workspace__card">
              <h3 className="leads-workspace__card-title">Timeline</h3>
              <FieldRow label="First sent">
                {sentDate ? (
                  <span className="flex items-center gap-2">
                    <Calendar size={14} className="text-gs-muted" />
                    {sentDate.toLocaleDateString()}
                    <span className="text-gs-muted text-xs">({daysInSystem}d ago)</span>
                  </span>
                ) : lead.sent === 'imported' ? 'Imported' : '—'}
              </FieldRow>
              {daysInSystem !== null && (
                <FieldRow label="In system">
                  <span className="flex items-center gap-2">
                    <Clock size={14} className="text-gs-muted" />
                    {daysInSystem} day{daysInSystem !== 1 ? 's' : ''}
                  </span>
                </FieldRow>
              )}
            </section>

            <section className="leads-workspace__card">
              <h3 className="leads-workspace__card-title">Recent activity</h3>
              {loadingActivity ? (
                <p className="text-gs-muted text-xs">Loading…</p>
              ) : activity.length === 0 ? (
                <p className="text-gs-muted text-xs">No activity recorded for this lead</p>
              ) : (
                <ul className="space-y-2">
                  {activity.map(entry => (
                    <li key={entry.id} className="flex items-start gap-2 text-xs py-2 border-b border-gs-border/30 last:border-0">
                      {entry.status === 'error'
                        ? <XCircle size={12} className="text-gs-danger mt-0.5 shrink-0" />
                        : <CheckCircle size={12} className="text-gs-accent mt-0.5 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <span className="font-medium capitalize">{entry.action?.replace(/_/g, ' ')}</span>
                        {entry.template && (
                          <span className="ml-1.5 text-gs-info font-mono uppercase text-[10px]">{entry.template}</span>
                        )}
                      </div>
                      <span className="text-gs-muted shrink-0">
                        {entry.timestamp ? new Date(entry.timestamp).toLocaleDateString() : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {extraKeys.length > 0 && (
              <section className="leads-workspace__card lg:col-span-2">
                <h3 className="leads-workspace__card-title">Additional info</h3>
                {extraKeys.map(k => (
                  <FieldRow key={k} label={k.replace(/_/g, ' ')}>{lead[k] || '—'}</FieldRow>
                ))}
              </section>
            )}
          </div>
        </div>

        <footer className="leads-workspace__footer">
          <button
            type="button"
            onClick={() => { onClose(); navigate('/send', { state: { lead } }); }}
            className="btn-primary text-sm gap-2"
          >
            <Send size={14} /> Send template
          </button>
          <button type="button" onClick={onClose} className="btn-ghost text-sm">Close</button>
        </footer>
      </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
