import { useEffect, useState } from 'react';
import { Send, CheckCircle, FileText, ExternalLink, Check, AlertTriangle } from 'lucide-react';
import { api } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';

/* ── Quote Documents Section ── */
export default function QuoteDocumentsSection({ lead, prepGuideIndices = [] }) {
  const [files, setFiles]             = useState(null);
  const [selected, setSelected]       = useState(null);
  const [pricing, setPricing]         = useState({ initial: '', recurring: '', discounted: '' });
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
      index:            selected.index,
      serviceType:      selected.serviceType || null,
      lead:             { name: lead?.name, email: lead?.email, phone: lead?.phone },
      pricing,
      notes,
      address,
      prepGuideIndices
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
