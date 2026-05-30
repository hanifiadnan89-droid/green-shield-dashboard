import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api/client.js';
import SendStepIndicator from './SendTemplate/SendStepIndicator.jsx';
import SendResultScreen from './SendTemplate/SendResultScreen.jsx';
import StepPickLead from './SendTemplate/StepPickLead.jsx';
import StepChooseTemplate from './SendTemplate/StepChooseTemplate.jsx';
import StepPreviewSummary from './SendTemplate/StepPreviewSummary.jsx';
import StepPreviewDocuments from './SendTemplate/StepPreviewDocuments.jsx';
import StepPreviewFooter from './SendTemplate/StepPreviewFooter.jsx';

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

  function handleTogglePrepGuide(idx) {
    setSelectedPrepGuides(s => {
      const n = new Set(s);
      if (n.has(idx)) n.delete(idx);
      else n.add(idx);
      return n;
    });
  }

  function handleToggleQuote(q) {
    setSelectedQuote(prev => (prev?.type === q.type ? null : q));
  }

  if (result) {
    return <SendResultScreen result={result} onReset={reset} />;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <SendStepIndicator step={step} />

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

        {step === 2 && (
          <StepChooseTemplate
            selectedLead={selectedLead}
            preselected={preselected}
            selectedTemplate={selectedTemplate}
            onChangeLead={() => { setSelectedLead(null); setStep(1); }}
            onSelectTemplate={t => { setSelectedTemplate(t); setStep(3); }}
          />
        )}

        {step === 3 && selectedLead && selectedTemplate && (
          <div className="space-y-6">
            <StepPreviewSummary selectedLead={selectedLead} selectedTemplate={selectedTemplate} />
            <StepPreviewDocuments
              selectedLead={selectedLead}
              selectedPrepGuides={selectedPrepGuides}
              onTogglePrepGuide={handleTogglePrepGuide}
            />
            <StepPreviewFooter
              selectedTemplate={selectedTemplate}
              selectedChannel={selectedChannel}
              onChannelChange={setSelectedChannel}
              quotes={quotes}
              selectedQuote={selectedQuote}
              onToggleQuote={handleToggleQuote}
              testMode={testMode}
              sending={sending}
              stopBlocked={selectedLead?.stop === 'yes'}
              onBack={() => setStep(2)}
              onSend={handleSend}
            />
          </div>
        )}
      </div>
    </div>
  );
}
