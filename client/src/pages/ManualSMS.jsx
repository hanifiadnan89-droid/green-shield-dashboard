import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  MessageSquare, Search, Check, Copy, CheckCircle, ChevronRight,
  Phone, Smartphone, Users, ArrowLeft, AlertTriangle,
} from 'lucide-react';
import { api } from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';
import Spinner from '../components/Spinner.jsx';

const TEMPLATES = [
  {
    code: 'ag',
    label: 'AG — Agreement Sent',
    color: '#16A34A',
    generate: (name) =>
      `Hi ${name ? name.split(' ')[0] : 'there'}, just following up on the pest control agreement we sent over. Let me know if you have any questions or are ready to get started! – Green Shield Pest Solutions (207) 815-2234`,
  },
  {
    code: 'na',
    label: 'NA — No Answer',
    color: '#D97706',
    generate: (name) =>
      `Hi ${name ? name.split(' ')[0] : 'there'}, this is Green Shield Pest Solutions reaching out about pest control services for your property. Give us a call or text back when you have a chance! (207) 815-2234`,
  },
  {
    code: 'rit',
    label: 'RIT — Rodent & Insect',
    color: '#2563EB',
    generate: (name) =>
      `Hi ${name ? name.split(' ')[0] : 'there'}, following up from Green Shield Pest Solutions about our Rodent & Insect Triannual program. It covers mice, rats, ants, spiders & more — 3 visits/year. Interested? Text back or call (207) 815-2234`,
  },
  {
    code: 't/m',
    label: 'T/M — Tick & Mosquito',
    color: '#ec4899',
    generate: (name) =>
      `Hi ${name ? name.split(' ')[0] : 'there'}, it's Green Shield Pest Solutions! Just wanted to follow up on our Tick & Mosquito Monthly program — great for keeping your yard safe all season. Questions? Text or call (207) 815-2234`,
  },
  {
    code: 'iq',
    label: 'IQ — Insect Quarterly',
    color: '#9333EA',
    generate: (name) =>
      `Hi ${name ? name.split(' ')[0] : 'there'}, following up from Green Shield Pest Solutions about our Insect Quarterly plan — covers ants, spiders, wasps & more, 4 times per year. Ready to get started? Text or call (207) 815-2234`,
  },
];

const APPS = ['Burner', 'Work Phone', 'Personal Phone', 'Other'];

function StepIndicator({ step }) {
  const STEPS = [
    { n: 1, label: 'Pick Lead' },
    { n: 2, label: 'Compose SMS' },
    { n: 3, label: 'Mark Sent' },
  ];
  return (
    <div className="flex items-center gap-1">
      {STEPS.map(({ n, label }) => (
        <div key={n} className="flex items-center">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step > n  ? 'bg-gs-accent text-white' :
              step === n ? 'border-2 border-gs-accent text-gs-accent bg-transparent' :
              'bg-gs-border text-gs-muted'
            }`}>
              {step > n ? <Check size={13} /> : n}
            </div>
            <span className={`text-xs font-medium ${
              step === n ? 'text-gs-text' : step > n ? 'text-gs-accent' : 'text-gs-muted'
            }`}>{label}</span>
          </div>
          {n < 3 && <div className={`w-8 h-px mx-2 ${step > n ? 'bg-gs-accent' : 'bg-gs-border'}`} />}
        </div>
      ))}
    </div>
  );
}

function LeadCard({ lead, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left card p-4 cursor-pointer group hover:border-gs-accent/50 transition-all"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gs-text group-hover:text-gs-accent transition-colors text-sm">{lead.name}</p>
          <p className="text-gs-muted text-xs mt-0.5">
            {lead.phone}{lead.email ? ` · ${lead.email}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lead.notes && <StatusBadge value={lead.notes} />}
          <ChevronRight size={14} className="text-gs-muted" />
        </div>
      </div>
    </button>
  );
}

export default function ManualSMS() {
  const location = useLocation();
  const navigate = useNavigate();
  const preselected = location.state?.lead || null;

  const [step, setStep] = useState(preselected ? 2 : 1);
  const [selectedLead, setSelectedLead] = useState(preselected);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [smsText, setSmsText] = useState('');
  const [copied, setCopied] = useState(false);

  const [selectedApp, setSelectedApp] = useState('Burner');
  const [customApp, setCustomApp] = useState('');
  const [number, setNumber] = useState('');
  const [updateSheet, setUpdateSheet] = useState(true);

  const [leads, setLeads]     = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [search, setSearch]   = useState('');
  const [saving, setSaving]   = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (step === 1 && leads.length === 0) {
      setLoadingLeads(true);
      api.leads.list().then(d => setLeads(d.leads || [])).catch(() => {}).finally(() => setLoadingLeads(false));
    }
  }, [step, leads.length]);

  const filteredLeads = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return leads;
    return leads.filter(l =>
      (l.name || '').toLowerCase().includes(q) ||
      (l.phone || '').includes(q) ||
      (l.email || '').toLowerCase().includes(q)
    );
  }, [leads, search]);

  const pickLead = useCallback((lead) => {
    setSelectedLead(lead);
    const match = TEMPLATES.find(t => t.code === (lead.notes || '').toLowerCase());
    if (match) {
      setSelectedTemplate(match);
      setSmsText(match.generate(lead.name));
    } else {
      setSelectedTemplate(null);
      setSmsText('');
    }
    setStep(2);
  }, []);

  const pickTemplate = useCallback((tpl) => {
    setSelectedTemplate(tpl);
    setSmsText(tpl.generate(selectedLead?.name));
  }, [selectedLead]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(smsText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [smsText]);

  const handleMarkSent = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const appLabel = selectedApp === 'Other' ? (customApp.trim() || 'Other') : selectedApp;
      await api.manualSms({
        rowNumber: selectedLead.row_number,
        leadName: selectedLead.name,
        template: selectedTemplate?.code || null,
        smsText,
        app: appLabel,
        number: number.trim() || null,
        updateSheet,
      });
      setDone(true);
    } catch (err) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [selectedLead, selectedTemplate, smsText, selectedApp, customApp, number, updateSheet]);

  function reset() {
    setStep(1);
    setSelectedLead(null);
    setSelectedTemplate(null);
    setSmsText('');
    setCopied(false);
    setSelectedApp('Burner');
    setCustomApp('');
    setNumber('');
    setUpdateSheet(true);
    setDone(false);
    setError(null);
  }

  if (done) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-lg mx-auto mt-10">
          <div className="card text-center py-12 border-gs-accent/40">
            <div className="w-14 h-14 rounded-full bg-gs-accent/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={28} className="text-gs-accent" />
            </div>
            <h2 className="text-xl font-bold text-gs-text mb-1">SMS Logged</h2>
            <p className="text-gs-muted text-sm mb-1">
              Manual SMS to <strong className="text-gs-text">{selectedLead?.name}</strong> has been recorded.
            </p>
            {updateSheet && (
              <p className="text-gs-muted text-xs">Sheet updated with send timestamp.</p>
            )}
            <div className="flex justify-center gap-3 mt-7">
              <button onClick={reset} className="btn-primary text-sm">Send Another</button>
              <button onClick={() => navigate('/')} className="btn-ghost text-sm">Dashboard</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page header */}
      <div className="px-6 py-5 bg-white border-b border-gs-border flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gs-accent/10 border border-green-200 shrink-0">
            <MessageSquare size={18} className="text-gs-accent" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gs-text tracking-tight">Manual SMS</h1>
            <p className="text-gs-muted text-xs mt-0.5">Generate text, copy it, send from your phone, then mark it sent</p>
          </div>
        </div>
        <StepIndicator step={step} />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-2xl mx-auto space-y-5">

          {/* Step 1: Pick Lead */}
          {step === 1 && (
            <div className="card overflow-hidden">
              <div className="px-5 pt-5 pb-4 border-b border-gs-border">
                <h3 className="font-semibold text-gs-text text-sm">Select a Lead</h3>
                <p className="text-gs-muted text-xs mt-0.5">Search by name, phone, or email</p>
              </div>
              <div className="px-5 pt-4 pb-2">
                <div className="relative mb-4">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gs-muted" />
                  <input
                    className="input pl-9 w-full text-sm"
                    placeholder="Search leads..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                {loadingLeads ? (
                  <div className="flex justify-center py-8"><Spinner /></div>
                ) : filteredLeads.length === 0 ? (
                  <p className="text-gs-muted text-sm text-center py-6">No leads found</p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pb-4">
                    {filteredLeads.map(lead => (
                      <LeadCard key={lead.row_number} lead={lead} onClick={() => pickLead(lead)} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Compose SMS */}
          {step === 2 && selectedLead && (
            <>
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-gs-muted" />
                    <span className="text-sm font-semibold text-gs-text">{selectedLead.name}</span>
                    {selectedLead.phone && (
                      <span className="text-xs text-gs-muted font-mono">{selectedLead.phone}</span>
                    )}
                  </div>
                  {!preselected && (
                    <button
                      onClick={() => { setStep(1); setSelectedLead(null); }}
                      className="text-xs text-gs-muted hover:text-gs-text flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft size={11} /> Change
                    </button>
                  )}
                </div>

                {selectedLead.stop === 'yes' && (
                  <div className="flex items-center gap-2 bg-gs-warn/10 border border-gs-warn/30 rounded-lg px-3 py-2.5 text-gs-warn text-xs mb-3">
                    <AlertTriangle size={13} />
                    This lead has <strong>stop = yes</strong>. You can still send manually, but automated sequences are halted.
                  </div>
                )}
              </div>

              {/* Template picker */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gs-text mb-3">Select SMS Template</h3>
                <div className="space-y-2">
                  {TEMPLATES.map(tpl => (
                    <button
                      key={tpl.code}
                      onClick={() => pickTemplate(tpl)}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all cursor-pointer ${
                        selectedTemplate?.code === tpl.code
                          ? 'border-gs-accent/50 bg-gs-accent/8'
                          : 'border-gs-border hover:border-gs-muted/40 bg-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: tpl.color }}
                        />
                        <span className={`font-medium ${selectedTemplate?.code === tpl.code ? 'text-gs-accent' : 'text-gs-text'}`}>
                          {tpl.label}
                        </span>
                        {selectedTemplate?.code === tpl.code && (
                          <Check size={13} className="text-gs-accent ml-auto" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* SMS text composer */}
              {selectedTemplate && (
                <div className="card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gs-text">SMS Message</h3>
                    <span className="text-xs text-gs-muted tabular-nums">{smsText.length} chars</span>
                  </div>
                  <textarea
                    className="input w-full text-sm resize-none"
                    rows={5}
                    value={smsText}
                    onChange={e => setSmsText(e.target.value)}
                    placeholder="SMS message will appear here..."
                  />
                  <div className="flex items-center gap-3 mt-3">
                    <button
                      onClick={handleCopy}
                      className={`btn flex items-center gap-2 text-sm cursor-pointer ${copied ? 'btn-primary' : 'btn-ghost'}`}
                    >
                      {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy to Clipboard</>}
                    </button>
                    <span className="text-xs text-gs-muted">Copy → open your phone app → paste → send</span>
                  </div>
                </div>
              )}

              {selectedTemplate && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setStep(3)}
                    disabled={!smsText.trim()}
                    className="btn-primary text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    I sent it — Mark Sent <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}

          {/* Step 3: Mark Sent */}
          {step === 3 && selectedLead && (
            <>
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Smartphone size={15} className="text-gs-accent" />
                  <h3 className="text-sm font-semibold text-gs-text">Which app did you send from?</h3>
                </div>
                <p className="text-xs text-gs-muted mb-4">This is just for your records — not sent anywhere</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {APPS.map(app => (
                    <button
                      key={app}
                      onClick={() => setSelectedApp(app)}
                      className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all cursor-pointer text-left ${
                        selectedApp === app
                          ? 'bg-gs-accent/10 border-gs-accent/50 text-gs-accent'
                          : 'border-gs-border text-gs-text hover:border-gs-muted/40'
                      }`}
                    >
                      {selectedApp === app && <Check size={12} className="inline mr-1.5 mb-0.5" />}
                      {app}
                    </button>
                  ))}
                </div>
                {selectedApp === 'Other' && (
                  <input
                    className="input w-full text-sm mb-3"
                    placeholder="App name..."
                    value={customApp}
                    onChange={e => setCustomApp(e.target.value)}
                    autoFocus
                  />
                )}
                <div>
                  <label className="label mb-1.5 block">Phone number used (optional)</label>
                  <div className="relative">
                    <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gs-muted" />
                    <input
                      className="input pl-9 w-full text-sm"
                      placeholder="e.g. (207) 555-0100"
                      value={number}
                      onChange={e => setNumber(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gs-text mb-3">Sheet Update</h3>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div
                    className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                      updateSheet ? 'bg-gs-accent border-gs-accent' : 'border-gs-border group-hover:border-gs-muted'
                    }`}
                    onClick={() => setUpdateSheet(v => !v)}
                  >
                    {updateSheet && <Check size={11} className="text-white" />}
                  </div>
                  <div onClick={() => setUpdateSheet(v => !v)}>
                    <p className="text-sm font-medium text-gs-text">Update sheet with send timestamp</p>
                    <p className="text-xs text-gs-muted mt-0.5">Sets the "sent" column in Google Sheets to now, so this lead appears in follow-up tracking</p>
                  </div>
                </label>
              </div>

              {/* Summary */}
              <div className="card p-5 bg-gs-surface/50">
                <h3 className="text-xs font-semibold text-gs-muted uppercase tracking-widest mb-3">Summary</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gs-muted">Lead</span>
                    <span className="text-gs-text font-medium">{selectedLead.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gs-muted">Template</span>
                    <span className="text-gs-text font-medium">{selectedTemplate?.label || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gs-muted">Sent via</span>
                    <span className="text-gs-text font-medium">
                      {selectedApp === 'Other' ? (customApp.trim() || 'Other') : selectedApp}
                      {number.trim() ? ` · ${number.trim()}` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gs-muted">Sheet update</span>
                    <span className={updateSheet ? 'text-gs-accent font-medium' : 'text-gs-muted'}>
                      {updateSheet ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-gs-danger/10 border border-gs-danger/30 rounded-xl px-4 py-3 text-gs-danger text-sm">
                  <AlertTriangle size={14} />
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="btn-ghost text-sm cursor-pointer">
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  onClick={handleMarkSent}
                  disabled={saving}
                  className="btn-primary text-sm flex-1 justify-center cursor-pointer disabled:opacity-60"
                >
                  {saving ? <Spinner size={14} /> : <><CheckCircle size={14} /> Log &amp; Mark Sent</>}
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
