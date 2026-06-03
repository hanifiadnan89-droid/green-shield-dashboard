import { useRef } from 'react';
import { Bot, AlertCircle, Sparkles } from 'lucide-react';
import Spinner from '../../components/Spinner.jsx';

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

  return (
    <div className="replies-ai-assistant">
      <div className="replies-ai-assistant__label">
        <Sparkles size={12} className="text-violet-500 shrink-0" aria-hidden />
        <span className="type-label-sm text-gs-muted uppercase tracking-wider">AI Response</span>
      </div>

      <div className="replies-ai-assistant__input-wrap">
        <Bot size={14} className="replies-ai-assistant__icon" aria-hidden />
        <textarea
          ref={inputRef}
          id={`ai-response-${lead.row_number}`}
          rows={2}
          className="replies-ai-assistant__input"
          placeholder="Describe how you'd like to respond…"
          value={cs.aiPrompt || ''}
          disabled={cs.aiGenerating}
          onChange={e => onPromptChange(lead.row_number, e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="AI response instructions"
        />
        {cs.aiGenerating && (
          <span className="replies-ai-assistant__spinner">
            <Spinner size={14} />
          </span>
        )}
      </div>

      <p className="replies-ai-assistant__hint type-label-sm text-gs-muted m-0">
        Press <kbd className="replies-ai-kbd">Enter</kbd> to generate ·{' '}
        <kbd className="replies-ai-kbd">Shift</kbd>+<kbd className="replies-ai-kbd">Enter</kbd> for a new line
      </p>

      {cs.aiError && (
        <div className="reply-alert-error mt-2">
          <AlertCircle size={13} className="shrink-0" />
          {cs.aiError}
        </div>
      )}
    </div>
  );
}
