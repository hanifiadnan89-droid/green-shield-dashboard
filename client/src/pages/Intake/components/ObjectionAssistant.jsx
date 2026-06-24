import { useState } from 'react';
import { Clipboard, ClipboardCheck, Loader2, MessageSquare, Sparkles } from 'lucide-react';
import { api } from '../../../api/client.js';

const QUICK_OBJECTIONS = [
  { key: 'expensive',  label: 'Too expensive',           text: "It's too expensive for me right now." },
  { key: 'think',      label: 'Need to think about it',  text: 'I need to think about it.' },
  { key: 'spouse',     label: 'Spouse approval',         text: 'I need to run it by my spouse first.' },
  { key: 'provider',   label: 'Already have a provider', text: 'I already have a pest control company.' },
  { key: 'safe',       label: 'Is it safe?',             text: 'Is the treatment safe for my family and pets?' },
  { key: 'later',      label: 'Call me later',           text: 'Can you call me back later?' },
];

const ACTIONS = [
  { key: 'shorten',  label: 'Shorten' },
  { key: 'softer',   label: 'Make softer' },
  { key: 'stronger', label: 'Stronger close' },
];

export default function ObjectionAssistant({ context = {} }) {
  const [objection, setObjection]       = useState('');
  const [response, setResponse]         = useState('');
  const [loading, setLoading]           = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [copied, setCopied]             = useState(false);
  const [error, setError]               = useState(null);

  async function generate() {
    const text = objection.trim();
    if (!text) return;
    setLoading(true);
    setError(null);
    setResponse('');
    setCopied(false);
    try {
      const data = await api.ai.objectionAssist({ context, objection: text });
      setResponse(data.response || '');
    } catch (err) {
      setError(err.message || 'Failed to generate response.');
    } finally {
      setLoading(false);
    }
  }

  async function runAction(action) {
    if (!response.trim()) return;
    setActionLoading(action);
    setError(null);
    setCopied(false);
    try {
      const data = await api.ai.objectionAssist({
        context,
        objection: objection.trim(),
        action,
        existing_response: response,
      });
      setResponse(data.response || response);
    } catch (err) {
      setError(err.message || 'Failed to transform response.');
    } finally {
      setActionLoading(null);
    }
  }

  async function copy() {
    if (!response) return;
    try {
      await navigator.clipboard.writeText(response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text in textarea
    }
  }

  function selectChip(text) {
    setObjection(text);
    setError(null);
  }

  const busy = loading || actionLoading !== null;

  return (
    <section className="intake-preview-panel__section intake-preview-panel__section--compact">
      <div className="objection-assist">
        <div className="objection-assist__header">
          <MessageSquare size={14} className="objection-assist__header-icon" />
          <span className="objection-assist__header-title">Objection Assistant</span>
          <Sparkles size={11} className="objection-assist__header-sparkle" />
        </div>

        {/* Quick chips */}
        <div className="objection-assist__chips">
          {QUICK_OBJECTIONS.map((q) => (
            <button
              key={q.key}
              type="button"
              onClick={() => selectChip(q.text)}
              className={`objection-assist__chip${objection === q.text ? ' objection-assist__chip--active' : ''}`}
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <input
          className="intake-input objection-assist__input"
          placeholder="Type objection..."
          value={objection}
          onChange={e => { setObjection(e.target.value); setError(null); }}
          onKeyDown={e => { if (e.key === 'Enter' && !busy) generate(); }}
          disabled={busy}
        />

        {/* Generate button */}
        <button
          type="button"
          className="intake-primary-btn objection-assist__generate-btn"
          onClick={generate}
          disabled={!objection.trim() || busy}
        >
          {loading
            ? <><Loader2 size={13} className="animate-spin" /> Generating...</>
            : <><Sparkles size={13} /> Generate Response</>
          }
        </button>

        {/* Error */}
        {error && (
          <p className="objection-assist__error">{error}</p>
        )}

        {/* Response */}
        {response && (
          <>
            <div className="objection-assist__response-wrap">
              <textarea
                className="objection-assist__response"
                value={response}
                onChange={e => { setResponse(e.target.value); setCopied(false); }}
                rows={6}
              />
            </div>

            {/* Action + Copy row */}
            <div className="objection-assist__action-row">
              <div className="objection-assist__actions">
                {ACTIONS.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    className="objection-assist__action-btn"
                    onClick={() => runAction(a.key)}
                    disabled={busy}
                  >
                    {actionLoading === a.key
                      ? <Loader2 size={10} className="animate-spin" />
                      : null
                    }
                    {a.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={`objection-assist__copy-btn${copied ? ' objection-assist__copy-btn--done' : ''}`}
                onClick={copy}
                title="Copy response"
              >
                {copied
                  ? <><ClipboardCheck size={12} /> Copied</>
                  : <><Clipboard size={12} /> Copy</>
                }
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
