import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Send, FileText, ExternalLink,
  ChevronRight
} from 'lucide-react';
import { api } from '../api/client.js';
import Spinner from '../components/Spinner.jsx';
import { TEMPLATES, CHANNELS } from './SendTemplate/constants.js';
import QuoteDocumentsSection from './SendTemplate/QuoteDocumentsSection.jsx';
import PrepGuidesSection from './SendTemplate/PrepGuidesSection.jsx';
import FutureSection from './SendTemplate/FutureSection.jsx';
import SendStepIndicator from './SendTemplate/SendStepIndicator.jsx';
import SendResultScreen from './SendTemplate/SendResultScreen.jsx';
import StepPickLead from './SendTemplate/StepPickLead.jsx';

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
  const [quotes, setQuotes]                         = useState([]);
  const [selectedQuote, setSelectedQuote]           = useState(null);
  const [selectedPrepGuides, setSelectedPrepGuides] = useState(new Set());
  const [sending, setSending]                       = useState(false);
  const [result, setResult]                         = useState(null);

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
    setSelectedPrepGuides(new Set());
    setResult(null);
    setSearch('');
  }

  function handleSelectLead(lead) {
    setSelectedLead(lead);
    setStep(2);
  }

  if (result) {
    return <SendResultScreen result={result} onReset={reset} />;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <SendStepIndicator step={step} />

      {/* Step content */}
      <div className="px-6 py-5 animate-fade-in-up">

        {step === 1 && (
          <StepPickLead
            search={search}
            onSearchChange={setSearch}
            leadsLoading={leadsLoading}
            filteredLeads={filteredLeads}
            onSelectLead={handleSelectLead}
          />
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
                <QuoteDocumentsSection lead={selectedLead} prepGuideIndices={[...selectedPrepGuides]} />
                <PrepGuidesSection
                  selected={selectedPrepGuides}
                  onToggle={idx => setSelectedPrepGuides(s => {
                    const n = new Set(s);
                    n.has(idx) ? n.delete(idx) : n.add(idx);
                    return n;
                  })}
                />
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
