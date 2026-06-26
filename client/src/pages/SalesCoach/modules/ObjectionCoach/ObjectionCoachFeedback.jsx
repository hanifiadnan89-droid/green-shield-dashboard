import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Star } from 'lucide-react';

export default function ObjectionCoachFeedback({ onFeedback, saved, saving }) {
  const [feedbackType,   setFeedbackType]   = useState(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const [correction,     setCorrection]     = useState('');

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

  if (saved) {
    return <span className="oc-feedback-saved">&#10003; Feedback saved — thanks!</span>;
  }

  return (
    <>
      <div className="oc-feedback-btns">
        <button
          type="button"
          className={`oc-fb-btn oc-fb-btn--helpful${feedbackType === 'thumbs_up' ? ' active' : ''}`}
          disabled={saving}
          onClick={() => handleSelect('thumbs_up')}
        >
          <ThumbsUp size={13} /> Helpful
        </button>
        <button
          type="button"
          className={`oc-fb-btn oc-fb-btn--nothelpful${feedbackType === 'thumbs_down' ? ' active' : ''}`}
          disabled={saving}
          onClick={() => handleSelect('thumbs_down')}
        >
          <ThumbsDown size={13} /> Not Helpful
        </button>
        <button
          type="button"
          className={`oc-fb-btn oc-fb-btn--save${feedbackType === 'save_approved' ? ' active' : ''}`}
          disabled={saving}
          onClick={() => handleSelect('save_approved')}
        >
          <Star size={13} /> Save as Example
        </button>
      </div>

      {showCorrection && (
        <div className="oc-correction">
          <textarea
            className="oc-correction__textarea"
            rows={3}
            placeholder="What would a better response look like? (optional but very helpful)"
            value={correction}
            onChange={e => setCorrection(e.target.value)}
          />
          <button
            type="button"
            className="oc-correction__submit"
            disabled={saving}
            onClick={handleCorrectionSubmit}
          >
            {saving ? 'Saving…' : 'Submit Feedback'}
          </button>
        </div>
      )}
    </>
  );
}
