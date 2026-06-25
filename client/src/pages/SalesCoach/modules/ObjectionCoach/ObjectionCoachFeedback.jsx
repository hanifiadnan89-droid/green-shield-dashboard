import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Star } from 'lucide-react';

/**
 * Feedback widget — thumbs up/down/star + optional correction text.
 *
 * Props:
 *   onFeedback(feedbackType, correction) — async callback; parent handles API call
 *   saved   — true when feedback was successfully saved
 *   saving  — true while the save is in flight
 */
export default function ObjectionCoachFeedback({ onFeedback, saved, saving }) {
  const [feedbackType,    setFeedbackType]    = useState(null);
  const [showCorrection,  setShowCorrection]  = useState(false);
  const [correction,      setCorrection]      = useState('');

  const handleSelect = async (type) => {
    if (saved || saving) return;
    setFeedbackType(type);
    if (type === 'thumbs_down') {
      setShowCorrection(true);
      return;
    }
    await onFeedback(type, null);
  };

  const handleCorrectionSubmit = async () => {
    if (saved || saving) return;
    await onFeedback('thumbs_down', correction.trim() || null);
    setShowCorrection(false);
  };

  return (
    <div className="oc-outcome-section">
      <div className="oc-outcome-title">Was this helpful?</div>

      {saved ? (
        <span className="oc-outcome-saved">&#10003; Feedback saved — thanks!</span>
      ) : (
        <div className="oc-feedback-row">
          <button
            type="button"
            className={`oc-feedback-btn oc-feedback-btn--up ${feedbackType === 'thumbs_up' ? 'border-green-300 bg-green-50 text-green-700' : ''}`}
            disabled={saving}
            onClick={() => handleSelect('thumbs_up')}
          >
            <ThumbsUp size={11} /> Helpful
          </button>
          <button
            type="button"
            className={`oc-feedback-btn oc-feedback-btn--down ${feedbackType === 'thumbs_down' ? 'border-red-300 bg-red-50 text-red-700' : ''}`}
            disabled={saving}
            onClick={() => handleSelect('thumbs_down')}
          >
            <ThumbsDown size={11} /> Not Helpful
          </button>
          <button
            type="button"
            className={`oc-feedback-btn oc-feedback-btn--star ${feedbackType === 'save_approved' ? 'border-yellow-300 bg-yellow-50 text-yellow-800' : ''}`}
            disabled={saving}
            onClick={() => handleSelect('save_approved')}
          >
            <Star size={11} /> Save as Example
          </button>
        </div>
      )}

      {showCorrection && !saved && (
        <div className="flex flex-col gap-2 mt-2">
          <textarea
            className="oc-section__textarea"
            rows={3}
            placeholder="What would a better response look like? (optional but very helpful)"
            value={correction}
            onChange={e => setCorrection(e.target.value)}
            style={{ minHeight: 64 }}
          />
          <button
            type="button"
            className="oc-outcome-save"
            disabled={saving}
            onClick={handleCorrectionSubmit}
          >
            {saving ? 'Saving…' : 'Submit Feedback'}
          </button>
        </div>
      )}
    </div>
  );
}
