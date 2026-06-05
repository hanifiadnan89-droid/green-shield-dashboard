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
      <div className="max-w-3xl send-command-panel">
        <p className="send-command-panel__label">
          Follow-up Sequence (handled by n8n)
        </p>
        <div className="space-y-2">
          {selectedTemplate.sequence.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full border border-white/10 bg-black/30 flex items-center justify-center type-label-sm text-white/45 shrink-0 font-normal tracking-normal">
                {i + 1}
              </div>
              <span className="type-body-sm text-white/90">{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Channel */}
      <div className="max-w-3xl send-command-panel">
        <p className="send-command-panel__label">Channel</p>
        <div className="grid grid-cols-3 gap-2">
          {CHANNELS.map(c => (
            <button
              key={c.code}
              type="button"
              onClick={() => onChannelChange(c.code)}
              className={`send-preview-channel text-left ${
                selectedChannel === c.code ? 'send-preview-channel--active' : ''
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
        <div className="max-w-3xl send-command-panel">
          <p className="send-command-panel__label">
            Attach Drive Quote (optional)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {quotes.map(q => (
              <button
                key={q.type}
                type="button"
                onClick={() => onToggleQuote(q)}
                className={`send-preview-drive-quote text-left ${
                  selectedQuote?.type === q.type ? 'send-preview-drive-quote--on' : ''
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
        <div className="max-w-3xl send-command-alert send-command-alert--warn type-body-sm">
          <strong>TEST MODE:</strong> This will simulate the send — no real message will be delivered and the sheet will not be updated.
        </div>
      )}

      {/* Actions */}
      <div className="max-w-3xl flex gap-3">
        <button type="button" onClick={onBack} className="send-command-ghost">
          Back
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={sending || stopBlocked}
          className="send-launch-cta flex-1"
        >
          {sending
            ? <><Spinner size={14} /> Sending...</>
            : <><Send size={14} /> {testMode ? 'Send (Test Mode)' : 'Send Now'}</>}
        </button>
      </div>
    </>
  );
}
