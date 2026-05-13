import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Search, Send, CheckCircle, XCircle, FileText, ExternalLink,
  ChevronRight, Check, FileQuestion, BookOpen, Sparkles,
  DollarSign, StickyNote, User, AlertTriangle, Image
} from 'lucide-react';
import { api } from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';
import Spinner from '../components/Spinner.jsx';

const TEMPLATES = [
  {
    code: 'ag',   label: 'AG — Agreement Sent',         accentText: 'text-gs-accent',  accentDot: 'bg-gs-accent',  activeBg: 'bg-gs-accent/10 border-gs-accent/30',
    description: 'Follow-up sequence for leads who were sent an agreement. Sends reminder email + SMS, with follow-ups at 2 days and 5 days.',
    sequence: ['Initial agreement follow-up (email + SMS)', '2-day follow-up', '5-day follow-up']
  },
  {
    code: 'na',   label: 'NA — No Answer',              accentText: 'text-gs-warn',    accentDot: 'bg-gs-warn',    activeBg: 'bg-gs-warn/10 border-gs-warn/30',
    description: 'Outreach sequence for no-answer leads. Sends initial contact email + SMS, followed up at 2 and 5 days.',
    sequence: ['Initial no-answer outreach (email + SMS)', '2-day follow-up', '5-day follow-up']
  },
  {
    code: 'rit',  label: 'RIT — Rodent/Insect Triannual', accentText: 'text-gs-info',  accentDot: 'bg-gs-info',    activeBg: 'bg-gs-info/10 border-gs-info/30',
    description: 'Rodent & Insect Triannual service proposal. Sends pricing and service details via email + SMS.',
    sequence: ['RIT service email + SMS', '2-day follow-up', '5-day follow-up']
  },
  {
    code: 't/m',  label: 'T/M — Tick & Mosquito',       accentText: 'text-pink-400',   accentDot: 'bg-pink-400',   activeBg: 'bg-pink-500/10 border-pink-500/30',
    description: 'Tick & Mosquito Monthly service proposal. Sends TMM pricing and details via email + SMS.',
    sequence: ['T/M service email + SMS', '2-day follow-up', '5-day follow-up']
  },
  {
    code: 'iq',   label: 'IQ — Insect Quarterly',       accentText: 'text-gs-purple',  accentDot: 'bg-gs-purple',  activeBg: 'bg-gs-purple/10 border-gs-purple/30',
    description: 'Insect Quarterly service proposal. Sends IQ pricing and service details via email + SMS.',
    sequence: ['IQ service email + SMS', '2-day follow-up', '5-day follow-up']
  }
];

const CHANNELS = [
  { code: 'both',  label: 'SMS + Email', desc: 'Send via both channels (recommended)' },
  { code: 'sms',   label: 'SMS Only',    desc: 'Only send SMS via Twilio'             },
  { code: 'email', label: 'Email Only',  desc: 'Only send Gmail email'                }
];

/* ── Quote Documents Section ── */
function QuoteDocumentsSection({ lead }) {
  const [files, setFiles]             = useState(null);
  const [selected, setSelected]       = useState(null);
  const [pricing, setPricing]         = useState({ initial: '', monthly: '', recurring: '', discounted: '' });
  const [address, setAddress]         = useState({ street: '', cityState: '' });
  const [notes, setNotes]             = useState('');
  const [loading, setLoading]         = useState(true);
  const [generating, setGenerating]   = useState(false);
  const [emailing, setEmailing]       = useState(false);
  const [emailResult, setEmailResult] = useState(null);
  const [genError, setGenError]       = useState(null);
  const [missing, setMissing]         = useState(false);

  useEffect(() => {
    api.documents.quotes().then(data => {
      setFiles(data.quotes || []);
      setMissing(!!data.missing);
    }).catch(() => setFiles([])).finally(() => setLoading(false));
  }, []);

  function buildPayload() {
    return {
      index:       selected.index,
      serviceType: selected.serviceType || null,
      lead:        { name: lead?.name, email: lead?.email, phone: lead?.phone },
      pricing,
      notes,
      address
    };
  }

  async function handleGenerate() {
    if (!selected) return;
    setGenerating(true);
    setGenError(null);
    setEmailResult(null);
    try {
      const res = await fetch('/api/documents/generate-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload())
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const fnMatch = disposition.match(/filename="?([^";\n]+)"?/);
      const filename = fnMatch ? decodeURIComponent(fnMatch[1]) : 'quote.pdf';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleEmail() {
    if (!selected || !lead?.email) return;
    setEmailing(true);
    setGenError(null);
    setEmailResult(null);
    try {
      await api.documents.emailQuote(buildPayload());
      setEmailResult({ ok: true, to: lead.email });
    } catch (err) {
      setEmailResult({ ok: false, error: err.message });
    } finally {
      setEmailing(false);
    }
  }

  return (
    <div className="card flex flex-col gap-0 p-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gs-border flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-gs-accent/12 border border-gs-accent/20">
          <FileText size={14} className="text-gs-accent" />
        </div>
        <div>
          <p className="text-gs-text font-semibold text-sm">Quote Documents</p>
          <p className="text-gs-muted text-xs">~/Desktop/Quotes</p>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3 flex-1">
        {/* File list */}
        {loading ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : missing ? (
          <div className="text-gs-warn text-xs bg-gs-warn/10 border border-gs-warn/20 rounded-lg px-3 py-2 flex items-center gap-2">
            <AlertTriangle size={12} /> Folder not found: ~/Desktop/Quotes
          </div>
        ) : files?.length === 0 ? (
          <p className="text-gs-muted text-xs py-2 text-center">No PDFs found in Quotes folder</p>
        ) : (
          <div className="space-y-1.5">
            {files.map((f) => (
              <button
                key={f.key}
                onClick={() => setSelected(s => s?.key === f.key ? null : f)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs transition-all cursor-pointer ${
                  selected?.key === f.key
                    ? 'bg-gs-accent/12 border border-gs-accent/30 text-gs-accent'
                    : 'bg-gs-bg border border-gs-border text-gs-text hover:border-gs-muted/40'
                }`}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                  selected?.key === f.key ? 'bg-gs-accent border-gs-accent' : 'border-gs-border'
                }`}>
                  {selected?.key === f.key && <Check size={10} className="text-white" />}
                </div>
                <FileText size={12} className="shrink-0 opacity-60" />
                <span className="truncate font-medium">{f.name}</span>
                <span className="ml-auto text-gs-muted shrink-0">{(f.size / 1024).toFixed(0)}KB</span>
              </button>
            ))}
          </div>
        )}

        {/* Customer info preview */}
        {lead && (
          <div className="bg-gs-bg border border-gs-border rounded-lg px-3 py-2.5">
            <p className="text-xs font-semibold text-gs-muted uppercase tracking-widest mb-2">Auto-fill Preview</p>
            <div className="space-y-1">
              {[
                ['Name',  lead.name],
                ['Phone', lead.phone],
                ['Email', lead.email],
              ].map(([label, val]) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span className="text-gs-muted w-12 shrink-0">{label}</span>
                  <span className="text-gs-text truncate">{val || <span className="text-gs-muted/50">—</span>}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Address inputs */}
        <div>
          <p className="text-xs font-semibold text-gs-muted uppercase tracking-widest mb-2">Service Address (optional)</p>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gs-muted mb-1 block">Street</label>
              <input className="input py-1.5 text-xs" placeholder="123 Main St" value={address.street}
                onChange={e => setAddress(p => ({ ...p, street: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gs-muted mb-1 block">City, State Zip</label>
              <input className="input py-1.5 text-xs" placeholder="Portland, ME 04101" value={address.cityState}
                onChange={e => setAddress(p => ({ ...p, cityState: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Pricing inputs */}
        <div>
          <p className="text-xs font-semibold text-gs-muted uppercase tracking-widest mb-2">Pricing</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['initial',    'Initial Quote'],
              ['discounted', 'Discount Amount'],
              ['recurring',  'Recurring/Month'],
              ['monthly',    'Monthly Payment'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="text-xs text-gs-muted mb-1 block">{label}</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gs-muted text-xs">$</span>
                  <input
                    className="input pl-6 py-1.5 text-xs"
                    placeholder="0.00"
                    value={pricing[key]}
                    onChange={e => setPricing(p => ({ ...p, [key]: e.target.value }))}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-semibold text-gs-muted uppercase tracking-widest mb-1.5 block">
            Notes (bottom-right of quote)
          </label>
          <textarea
            className="input text-xs resize-none"
            rows={3}
            placeholder="Add custom notes for this customer's quote..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gs-border space-y-2">
        {genError && (
          <p className="text-gs-danger text-xs bg-red-50 border border-red-200 rounded px-2 py-1">{genError}</p>
        )}
        {emailResult && (
          emailResult.ok
            ? <p className="text-gs-accent text-xs bg-green-50 border border-green-200 rounded px-2 py-1 flex items-center gap-1.5">
                <CheckCircle size={11} /> Quote sent to {emailResult.to}
              </p>
            : <p className="text-gs-danger text-xs bg-red-50 border border-red-200 rounded px-2 py-1">{emailResult.error}</p>
        )}

        {/* Download */}
        <button
          onClick={handleGenerate}
          disabled={!selected || generating || emailing}
          className={`btn w-full justify-center text-xs ${
            selected && !generating && !emailing
              ? 'btn-ghost'
              : 'bg-slate-100 text-gs-muted border border-gs-border cursor-not-allowed'
          }`}
        >
          {generating ? <><Spinner size={12} /> Generating...</> : <><FileText size={12} /> Download PDF</>}
        </button>

        {/* Email to customer — direct from CRM, no n8n */}
        <button
          onClick={handleEmail}
          disabled={!selected || !lead?.email || emailing || generating}
          title={!lead?.email ? 'No email address on this lead' : ''}
          className={`btn w-full justify-center text-xs ${
            selected && lead?.email && !emailing && !generating
              ? 'btn-primary'
              : 'bg-slate-100 text-gs-muted border border-gs-border cursor-not-allowed'
          }`}
        >
          {emailing
            ? <><Spinner size={12} /> Sending...</>
            : <><Send size={12} /> Email Quote to {lead?.email ? lead.name?.split(' ')[0] || 'Customer' : 'Customer'}</>
          }
        </button>

        {!lead?.email && selected && (
          <p className="text-gs-muted text-xs text-center">No email on this lead — can't send directly</p>
        )}

        {selected && (
          <a
            href={api.documents.fileUrl('quotes', selected.index)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 text-gs-info text-xs hover:underline"
          >
            <ExternalLink size={11} /> Preview template: {selected.name}
          </a>
        )}
      </div>
    </div>
  );
}

/* ── Prep Guides Section ── */
function PrepGuidesSection() {
  const [files, setFiles]       = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading]   = useState(true);
  const [missing, setMissing]   = useState(false);

  useEffect(() => {
    api.documents.prepGuides().then(data => {
      setFiles(data.prepGuides || []);
      setMissing(!!data.missing);
    }).catch(() => setFiles([])).finally(() => setLoading(false));
  }, []);

  function toggle(index) {
    setSelected(s => {
      const next = new Set(s);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  }

  return (
    <div className="card flex flex-col gap-0 p-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gs-border flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-gs-info/12 border border-gs-info/20">
          <BookOpen size={14} className="text-gs-info" />
        </div>
        <div>
          <p className="text-gs-text font-semibold text-sm">Prep Guides</p>
          <p className="text-gs-muted text-xs">~/Desktop/Prep Guide</p>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3 flex-1">
        {loading ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : missing ? (
          <div className="text-gs-warn text-xs bg-gs-warn/10 border border-gs-warn/20 rounded-lg px-3 py-2 flex items-center gap-2">
            <AlertTriangle size={12} /> Folder not found: ~/Desktop/Prep Guide
          </div>
        ) : files?.length === 0 ? (
          <p className="text-gs-muted text-xs py-2 text-center">No files found in Prep Guide folder</p>
        ) : (
          <>
            <p className="text-gs-muted text-xs">Select prep guides to attach (optional)</p>
            <div className="space-y-1.5">
              {files.map((f, i) => {
                const isSelected = selected.has(f.index);
                const isPdf  = f.type === 'pdf';
                const FileIcon = isPdf ? FileText : Image;
                return (
                  <button
                    key={i}
                    onClick={() => toggle(f.index)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-gs-info/12 border border-gs-info/30 text-gs-info'
                        : 'bg-gs-bg border border-gs-border text-gs-text hover:border-gs-muted/40'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-gs-info border-gs-info' : 'border-gs-border'
                    }`}>
                      {isSelected && <Check size={10} className="text-black" />}
                    </div>
                    <FileIcon size={12} className="shrink-0 opacity-60" />
                    <span className="truncate font-medium">{f.name}</span>
                    <span className={`ml-auto shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${
                      isPdf ? 'text-gs-muted border-gs-border/60' : 'text-gs-purple border-gs-purple/20 bg-gs-purple/8'
                    }`}>
                      {isPdf ? 'PDF' : 'IMG'}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gs-border">
        {selected.size > 0 ? (
          <p className="text-gs-accent text-xs font-medium flex items-center gap-1.5">
            <CheckCircle size={12} /> {selected.size} guide{selected.size !== 1 ? 's' : ''} selected
          </p>
        ) : (
          <p className="text-gs-muted text-xs">No prep guides selected (optional)</p>
        )}
      </div>
    </div>
  );
}

/* ── Future Section ── */
function FutureSection() {
  return (
    <div className="card flex flex-col gap-0 p-0 overflow-hidden border-dashed">
      <div className="px-4 py-3 border-b border-gs-border flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-gs-purple/12 border border-gs-purple/20">
          <Sparkles size={14} className="text-gs-purple" />
        </div>
        <div>
          <p className="text-gs-text font-semibold text-sm">Coming Soon</p>
          <p className="text-gs-muted text-xs">Future Section</p>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 text-center">
        <div className="w-12 h-12 rounded-xl bg-gs-border/50 border border-gs-border/60 flex items-center justify-center mb-3">
          <Sparkles size={20} className="text-gs-muted" />
        </div>
        <p className="text-gs-muted text-sm font-medium mb-1">Reserved for future use</p>
        <p className="text-gs-muted/60 text-xs leading-relaxed max-w-[160px]">
          This section is ready for your next feature
        </p>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function SendTemplate({ testMode }) {
  const location   = useLocation();
  const preselected = location.state?.lead || null;

  const [step, setStep]                   = useState(preselected ? 2 : 1);
  const [leads, setLeads]                 = useState([]);
  const [leadsLoading, setLeadsLoading]   = useState(false);
  const [search, setSearch]               = useState('');
  const [selectedLead, setSelectedLead]   = useState(preselected);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedChannel, setSelectedChannel]   = useState('both');
  const [quotes, setQuotes]               = useState([]);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [sending, setSending]             = useState(false);
  const [result, setResult]               = useState(null);

  useEffect(() => {
    if (!preselected) {
      setLeadsLoading(true);
      api.leads.list().then(d => setLeads(d.leads || [])).finally(() => setLeadsLoading(false));
    }
    api.drive.quotes().then(d => setQuotes(d.quotes || []));
  }, []);

  const filteredLeads = leads.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return ['name', 'phone', 'email'].some(f => (l[f] || '').toLowerCase().includes(q));
  });

  async function handleSend() {
    if (!selectedLead || !selectedTemplate) return;
    setSending(true);
    setResult(null);
    try {
      const res = await api.send(selectedLead, selectedTemplate.code, selectedChannel);
      setResult({ success: true, ...res });
    } catch (err) {
      setResult({ success: false, error: err.message });
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setStep(1);
    setSelectedLead(null);
    setSelectedTemplate(null);
    setSelectedChannel('both');
    setSelectedQuote(null);
    setResult(null);
    setSearch('');
  }

  const STEPS = [
    { n: 1, label: 'Pick Lead' },
    { n: 2, label: 'Choose Template' },
    { n: 3, label: 'Preview & Send' }
  ];

  if (result) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-5 animate-fade-in-up">
        <div className="max-w-lg mx-auto">
          <div className={`card text-center py-10 ${result.success ? 'border-gs-accent/50' : 'border-gs-danger/50'}`}>
            {result.success
              ? <CheckCircle size={48} className="text-gs-accent mx-auto mb-4" />
              : <XCircle size={48} className="text-gs-danger mx-auto mb-4" />}
            <h2 className="text-xl font-bold text-gs-text mb-2">
              {result.success ? (result.testMode ? 'Test Simulated' : 'Sent!') : 'Send Failed'}
            </h2>
            <p className="text-gs-muted mb-1">{result.message || result.error}</p>
            {result.testMode && (
              <p className="text-gs-warn text-xs mt-2">
                This was a test. Set TEST_MODE=false in .env to send for real.
              </p>
            )}
            <div className="flex gap-3 justify-center mt-6">
              <button onClick={reset} className="btn-ghost">Send Another</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Page header with step indicator */}
      <div className="px-6 py-5 border-b border-gs-border">
        <h1 className="text-lg font-bold text-gs-text mb-4">Send Template</h1>
        <div className="flex items-center gap-0">
          {STEPS.map(({ n, label }) => (
            <div key={n} className="flex items-center">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step > n  ? 'bg-gs-accent text-black' :
                  step === n ? 'bg-transparent border-2 border-gs-accent text-gs-accent' :
                  'bg-gs-border text-gs-muted'
                }`}>
                  {step > n ? <Check size={13} /> : n}
                </div>
                <span className={`text-xs font-medium ${step === n ? 'text-gs-text' : step > n ? 'text-gs-accent' : 'text-gs-muted'}`}>
                  {label}
                </span>
              </div>
              {n < 3 && <div className={`w-8 h-px mx-2 ${step > n ? 'bg-gs-accent' : 'bg-gs-border'}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="px-6 py-5 animate-fade-in-up">

        {/* STEP 1 */}
        {step === 1 && (
          <div className="max-w-3xl space-y-4">
            <div>
              <label className="label">Search Lead</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gs-muted" />
                <input className="input pl-8" placeholder="Name, phone, or email..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            {leadsLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredLeads.map(lead => (
                  <button
                    key={lead.row_number}
                    onClick={() => { setSelectedLead(lead); setStep(2); }}
                    className="w-full text-left card hover:border-gs-accent/50 transition-colors p-4 cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gs-text group-hover:text-gs-accent transition-colors">{lead.name || 'Unknown'}</p>
                        <p className="text-gs-muted text-xs mt-0.5">{lead.phone} {lead.email ? `• ${lead.email}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {lead.stop === 'yes' && <StatusBadge value="stopped" />}
                        <StatusBadge value={lead.notes} />
                        <ChevronRight size={14} className="text-gs-muted" />
                      </div>
                    </div>
                  </button>
                ))}
                {filteredLeads.length === 0 && <p className="text-gs-muted text-sm text-center py-8">No leads match</p>}
              </div>
            )}
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="max-w-3xl space-y-4">
            {selectedLead && (
              <div className="card p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gs-muted mb-0.5">Selected Lead</p>
                  <p className="font-medium text-gs-text">{selectedLead.name}</p>
                  <p className="text-gs-muted text-xs">{selectedLead.phone} {selectedLead.email ? `• ${selectedLead.email}` : ''}</p>
                </div>
                {!preselected && (
                  <button onClick={() => { setSelectedLead(null); setStep(1); }} className="btn-ghost text-xs">Change</button>
                )}
              </div>
            )}
            {selectedLead?.stop === 'yes' && (
              <div className="bg-gs-danger/10 border border-gs-danger/30 rounded-lg px-4 py-3 text-gs-danger text-sm">
                ⚠ This lead has <strong>stop=yes</strong>. Remove the stop flag first before sending.
              </div>
            )}
            <div className="grid gap-3">
              {TEMPLATES.map(t => (
                <button
                  key={t.code}
                  onClick={() => { setSelectedTemplate(t); setStep(3); }}
                  disabled={selectedLead?.stop === 'yes'}
                  className={`card text-left hover:border-opacity-70 transition-all p-4 cursor-pointer group ${
                    selectedTemplate?.code === t.code ? `border ${t.activeBg}` : 'hover:border-gs-muted/50'
                  } ${selectedLead?.stop === 'yes' ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${t.accentDot}`} />
                      <span className={`text-sm font-semibold ${t.accentText}`}>{t.label}</span>
                    </div>
                    <ChevronRight size={14} className="text-gs-muted" />
                  </div>
                  <p className="text-gs-muted text-xs pl-4">{t.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && selectedLead && selectedTemplate && (
          <div className="space-y-6">
            {/* Lead + Template summary */}
            <div className="max-w-3xl grid grid-cols-2 gap-4">
              <div className="card p-4">
                <p className="text-xs text-gs-muted mb-1">Lead</p>
                <p className="font-semibold text-gs-text">{selectedLead.name}</p>
                <p className="text-gs-muted text-xs">{selectedLead.phone}</p>
                {selectedLead.email && <p className="text-gs-muted text-xs">{selectedLead.email}</p>}
              </div>
              <div className={`card p-4 ${selectedTemplate.activeBg}`}>
                <p className="text-xs text-gs-muted mb-1">Template</p>
                <p className={`font-semibold ${selectedTemplate.accentText}`}>{selectedTemplate.label}</p>
                <p className="text-gs-muted text-xs mt-0.5">{selectedTemplate.description}</p>
              </div>
            </div>

            {/* Documents & Attachments */}
            <div>
              <p className="section-label">
                <span className="section-label-bar bg-gs-purple" />
                Documents &amp; Attachments
              </p>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <QuoteDocumentsSection lead={selectedLead} />
                <PrepGuidesSection />
                <FutureSection />
              </div>
            </div>

            {/* Sequence */}
            <div className="max-w-3xl card p-4">
              <p className="label mb-3">Follow-up Sequence (handled by n8n)</p>
              <div className="space-y-2">
                {selectedTemplate.sequence.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div className="w-6 h-6 rounded-full bg-gs-border flex items-center justify-center text-xs text-gs-muted shrink-0">{i + 1}</div>
                    <span className="text-gs-text">{s}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Channel */}
            <div className="max-w-3xl card p-4">
              <p className="label mb-2">Channel</p>
              <div className="grid grid-cols-3 gap-2">
                {CHANNELS.map(c => (
                  <button
                    key={c.code}
                    onClick={() => setSelectedChannel(c.code)}
                    className={`rounded-lg border p-3 text-left transition-all cursor-pointer ${
                      selectedChannel === c.code
                        ? 'bg-gs-accent/10 border-gs-accent/50 text-gs-accent'
                        : 'border-gs-border text-gs-muted hover:border-gs-muted/50'
                    }`}
                  >
                    <p className="text-xs font-semibold mb-0.5">{c.label}</p>
                    <p className="text-xs opacity-70">{c.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Drive quotes (existing) */}
            {quotes.filter(q => q.configured).length > 0 && (
              <div className="max-w-3xl card p-4">
                <p className="label mb-2">Attach Drive Quote (optional)</p>
                <div className="grid grid-cols-2 gap-2">
                  {quotes.map(q => (
                    <button
                      key={q.type}
                      onClick={() => setSelectedQuote(prev => prev?.type === q.type ? null : q)}
                      className={`rounded-lg border p-3 text-left transition-all cursor-pointer ${
                        selectedQuote?.type === q.type
                          ? 'bg-gs-info/10 border-gs-info/50 text-gs-info'
                          : 'border-gs-border text-gs-muted hover:border-gs-muted/50'
                      } ${!q.configured ? 'opacity-40 cursor-not-allowed' : ''}`}
                      disabled={!q.configured}
                    >
                      <div className="flex items-center gap-2">
                        <FileText size={14} />
                        <span className="text-xs font-medium">{q.label}</span>
                      </div>
                      {q.fileName && <p className="text-xs opacity-60 mt-1 truncate">{q.fileName}</p>}
                      {!q.configured && <p className="text-xs opacity-40">Not configured</p>}
                    </button>
                  ))}
                </div>
                {selectedQuote?.url && (
                  <a href={selectedQuote.url} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-gs-info text-xs mt-2 hover:underline">
                    <ExternalLink size={12} /> Open quote in Drive
                  </a>
                )}
              </div>
            )}

            {/* Test mode */}
            {testMode && (
              <div className="max-w-3xl bg-gs-warn/10 border border-gs-warn/30 rounded-lg px-4 py-3 text-gs-warn text-sm">
                <strong>TEST MODE:</strong> This will simulate the send — no real message will be delivered and the sheet will not be updated.
              </div>
            )}

            {/* Actions */}
            <div className="max-w-3xl flex gap-3">
              <button onClick={() => setStep(2)} className="btn-ghost">Back</button>
              <button
                onClick={handleSend}
                disabled={sending || selectedLead?.stop === 'yes'}
                className="btn-primary flex-1"
              >
                {sending ? <><Spinner size={14} /> Sending...</> : <><Send size={14} /> {testMode ? 'Send (Test Mode)' : 'Send Now'}</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
