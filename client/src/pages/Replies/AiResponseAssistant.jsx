import { useRef } from 'react';
import { motion } from 'motion/react';
import { Bot, AlertCircle, Sparkles } from 'lucide-react';
import Spinner from '../../components/Spinner.jsx';

const QUICK_ACTIONS = [
  { label: 'Professional Reply', prompt: 'Write a professional, concise SMS reply appropriate for a pest control business.' },
  { label: 'Friendly Reply', prompt: 'Write a warm, friendly SMS reply that builds rapport with the customer.' },
  { label: 'Scheduling Reply', prompt: 'Write an SMS reply focused on scheduling an inspection or service visit.' },
  { label: 'Follow-up', prompt: 'Write a polite follow-up SMS for a customer who has not responded recently.' },
  { label: 'Agreement Reminder', prompt: 'Write a brief SMS reminder about a service agreement or next steps.' },
];

export default function AiResponseAssistant({
  lead,
  cardState: cs,
  onPromptChange,
  onSubmit,
}) {
  const inputRef = useRef(null);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!cs.aiGenerating && (cs.aiPrompt || '').trim()) {
        onSubmit(lead);
      }
    }
  }

  function runQuickAction(prompt) {
    if (cs.aiGenerating) return;
    onSubmit(lead, prompt);
  }

  const contextBits = [
    lead.name && `Customer: ${lead.name}`,
    lead.status && `Status: ${lead.status}`,
    lead.phone && `Phone on file`,
  ].filter(Boolean);

  return (
    <div className="rc-ai-panel">
      <div className="rc-ai-panel__head">
        <p className="rc-ai-panel__title">
          <Sparkles size={13} aria-hidden />
          AI Response Assistant
        </p>
        {cs.aiGenerating ? (
          <span className="rc-ai-thinking">
            <Spinner size={12} />
            Thinking…
          </span>
        ) : (
          <span className="rc-ai-online">
            <span className="rc-ai-online__dot" />
            Ready
          </span>
        )}
      </div>

      <div className="rc-ai-quick-actions" role="group" aria-label="Suggested AI actions">
        {QUICK_ACTIONS.map(action => (
          <motion.button
            key={action.label}
            type="button"
            className="rc-ai-action"
            disabled={cs.aiGenerating}
            onClick={() => runQuickAction(action.prompt)}
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.97 }}
          >
            {action.label}
          </motion.button>
        ))}
      </div>

      <div className="rc-ai-input-wrap">
        <Bot size={16} className="rc-ai-input-wrap__icon" aria-hidden />
        <textarea
          ref={inputRef}
          id={`ai-response-${lead.row_number}`}
          rows={2}
          className="rc-ai-input"
          placeholder="Describe how you'd like to respond, or pick a quick action above…"
          value={cs.aiPrompt || ''}
          disabled={cs.aiGenerating}
          onChange={e => onPromptChange(lead.row_number, e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="AI response instructions"
        />
        {cs.aiGenerating && (
          <span className="rc-ai-spinner">
            <Spinner size={14} />
          </span>
        )}
      </div>

      <p className="rc-ai-hint">
        Press <kbd className="rc-ai-kbd">Enter</kbd> to generate ·{' '}
        <kbd className="rc-ai-kbd">Shift</kbd>+<kbd className="rc-ai-kbd">Enter</kbd> for a new line
      </p>

      {contextBits.length > 0 && (
        <p className="rc-ai-context">
          <strong>Context:</strong> {contextBits.join(' · ')}
        </p>
      )}

      {cs.aiError && (
        <div className="rc-alert-error">
          <AlertCircle size={14} className="shrink-0" aria-hidden />
          {cs.aiError}
        </div>
      )}
    </div>
  );
}
