import { motion } from 'motion/react';
import { AlertCircle, Sparkles } from 'lucide-react';
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

  const inputId = `ai-response-${lead.row_number}`;

  return (
    <section className="rc-composer__ai" aria-label="AI response assistant">
      <div className="rc-composer__ai-head">
        <label htmlFor={inputId} className="rc-composer__label rc-composer__label--ai">
          <Sparkles size={12} aria-hidden />
          AI Response Assistant
        </label>
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
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {action.label}
          </motion.button>
        ))}
      </div>

      <div className="rc-composer__ai-field">
        <textarea
          id={inputId}
          rows={2}
          className="rc-composer__textarea"
          placeholder="Describe how you'd like to respond, or pick a quick action above…"
          value={cs.aiPrompt || ''}
          disabled={cs.aiGenerating}
          onChange={e => onPromptChange(lead.row_number, e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="AI response instructions"
        />
        {cs.aiGenerating && (
          <span className="rc-composer__ai-spinner" aria-hidden>
            <Spinner size={14} />
          </span>
        )}
      </div>

      {cs.aiError && (
        <div className="rc-alert-error">
          <AlertCircle size={14} className="shrink-0" aria-hidden />
          {cs.aiError}
        </div>
      )}
    </section>
  );
}
