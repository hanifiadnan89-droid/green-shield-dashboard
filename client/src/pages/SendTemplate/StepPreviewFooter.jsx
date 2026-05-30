import { Send, FileText, ExternalLink } from 'lucide-react';
import Spinner from '../../components/Spinner.jsx';
import { CHANNELS } from './constants.js';

export default function StepPreviewFooter({
  selectedTemplate,
  selectedChannel,
  onChannelChange,
  quotes,
  selectedQuote,
  onToggleQuote,
  testMode,
  sending,
  stopBlocked,
  onBack,
  onSend,
}) {
  const configuredQuotes = quotes.filter(q => q.configured);

  return (
    <>
      {/* Sequence */}
      <div className="max-w-3xl card p-4">
        <p className="type-label-sm uppercase tracking-[0.06em] text-gs-muted mb-3 block">
          Follow-up Sequence (handled by n8n)
        </p>
        <div className="space-y-2">
          {selectedTemplate.sequence.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-gs-border flex items-center justify-center type-label-sm text-gs-muted shrink-0 font-normal tracking-normal">
                {i + 1}
              </div>
              <span className="type-body-sm text-gs-text">{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Channel */}
      <div className="max-w-3xl card p-4">
        <p className="type-label-sm uppercase tracking-[0.06em] text-gs-muted mb-2 block">Channel</p>
        <div className="grid grid-cols-3 gap-2">
          {CHANNELS.map(c => (
            <button
              key={c.code}
              type="button"
              onClick={() => onChannelChange(c.code)}
              className={`rounded-lg border p-3 text-left transition-all cursor-pointer ${
                selectedChannel === c.code
                  ? 'bg-gs-accent/10 border-gs-accent/50 text-gs-accent'
                  : 'border-gs-border text-gs-muted hover:border-gs-muted/50'
              }`}
            >
              <p className="type-label-sm font-semibold mb-0.5 tracking-normal">{c.label}</p>
              <p className="type-label-sm opacity-70 font-normal tracking-normal">{c.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Drive quotes (existing) */}
      {configuredQuotes.length > 0 && (
        <div className="max-w-3xl card p-4">
          <p className="type-label-sm uppercase tracking-[0.06em] text-gs-muted mb-2 block">
            Attach Drive Quote (optional)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {quotes.map(q => (
              <button
                key={q.type}
                type="button"
                onClick={() => onToggleQuote(q)}
                className={`rounded-lg border p-3 text-left transition-all cursor-pointer ${
                  selectedQuote?.type === q.type
                    ? 'bg-gs-info/10 border-gs-info/50 text-gs-info'
                    : 'border-gs-border text-gs-muted hover:border-gs-muted/50'
                } ${!q.configured ? 'opacity-40 cursor-not-allowed' : ''}`}
                disabled={!q.configured}
              >
                <div className="flex items-center gap-2">
                  <FileText size={14} />
                  <span className="type-label-sm font-medium tracking-normal">{q.label}</span>
                </div>
                {q.fileName && (
                  <p className="type-label-sm opacity-60 mt-1 truncate font-normal tracking-normal">{q.fileName}</p>
                )}
                {!q.configured && (
                  <p className="type-label-sm opacity-40 font-normal tracking-normal">Not configured</p>
                )}
              </button>
            ))}
          </div>
          {selectedQuote?.url && (
            <a
              href={selectedQuote.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-gs-info type-label-sm mt-2 hover:underline font-normal tracking-normal"
            >
              <ExternalLink size={12} /> Open quote in Drive
            </a>
          )}
        </div>
      )}

      {/* Test mode */}
      {testMode && (
        <div className="max-w-3xl bg-gs-warn/10 border border-gs-warn/30 rounded-lg px-4 py-3 text-gs-warn type-body-sm">
          <strong>TEST MODE:</strong> This will simulate the send — no real message will be delivered and the sheet will not be updated.
        </div>
      )}

      {/* Actions */}
      <div className="max-w-3xl flex gap-3">
        <button type="button" onClick={onBack} className="btn-ghost">
          Back
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={sending || stopBlocked}
          className="btn-primary flex-1"
        >
          {sending
            ? <><Spinner size={14} /> Sending...</>
            : <><Send size={14} /> {testMode ? 'Send (Test Mode)' : 'Send Now'}</>}
        </button>
      </div>
    </>
  );
}
