import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { useSalesCoachSession } from '../../hooks/useSalesCoachSession.js';
import { salesCoachApi } from '../../api/salesCoachApi.js';
import ObjectionCoachForm     from './ObjectionCoachForm.jsx';
import ObjectionCoachResult   from './ObjectionCoachResult.jsx';
import ObjectionCoachFeedback from './ObjectionCoachFeedback.jsx';
import ObjectionCoachOutcome  from './ObjectionCoachOutcome.jsx';

function EmptyState() {
  return (
    <div className="oc-empty">
      <div className="oc-empty__icon"><MessageSquare size={40} /></div>
      <div className="oc-empty__title">Ready when you are</div>
      <div className="oc-empty__hint">
        Describe what the customer said, pick a category, and hit Coach Me to get a live sales response.
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="oc-empty">
      <div className="animate-spin w-8 h-8 border-2 border-green-200 border-t-green-600 rounded-full mb-4" />
      <div className="oc-empty__title">Building your response…</div>
      <div className="oc-empty__hint">Pulling from strategy, examples, and outcomes</div>
    </div>
  );
}

/**
 * Objection Coach — Module 1 of Sales Coach.
 *
 * Orchestrates: form → AI call → result display → feedback → outcome.
 * Child components own their own UI state; this component owns API state.
 *
 * Props:
 *   onSessionComplete(session) — optional callback fired when an outcome is saved
 */
export default function ObjectionCoach({ onSessionComplete }) {
  const { session, startSession, updateSession, completeSession } = useSalesCoachSession('objectionCoach');

  // Values from the last submitted form — needed when saving feedback/outcome
  const [lastForm, setLastForm] = useState(null);

  // Result state
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [result,     setResult]     = useState(null);
  const [repEdited,  setRepEdited]  = useState('');

  // Feedback save state (passed down as props)
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackSaved,  setFeedbackSaved]  = useState(false);

  // Outcome save state (passed down as props)
  const [outcomeSaving, setOutcomeSaving] = useState(false);
  const [outcomeSaved,  setOutcomeSaved]  = useState(false);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleFormSubmit = async (formValues) => {
    const s = startSession({ situation: formValues.situation, serviceType: formValues.service });
    setLastForm(formValues);
    setLoading(true);
    setError(null);
    setResult(null);
    setRepEdited('');
    setFeedbackSaved(false);
    setOutcomeSaved(false);

    try {
      const data = await salesCoachApi.runModule(
        'objectionCoach',
        {
          situation:   formValues.situation.trim(),
          category:    formValues.category    || null,
          service:     formValues.service     || null,
          personality: formValues.personality || null,
          propertyContext: formValues.showOptional ? {
            address:      formValues.propAddress.trim() || undefined,
            propertyType: formValues.propType.trim()    || undefined,
            notes:        formValues.propNotes.trim()   || undefined,
          } : {},
          leadContext: {},
        },
        s.id,
      );
      setResult(data);
      setRepEdited(data.recommendedResponse ?? '');
      updateSession({ lastResultSummary: (data.recommendedResponse || '').slice(0, 100) });
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (feedbackType, correction) => {
    if (!result || !lastForm) return;
    setFeedbackSaving(true);
    try {
      await salesCoachApi.saveFeedback({
        repQuestion:         lastForm.situation.trim(),
        recommendedResponse: result.recommendedResponse,
        feedbackType,
        correction:          correction || null,
        serviceType:         lastForm.service || null,
        sessionId:           session?.id,
      });
      setFeedbackSaved(true);
    } catch (_) {
      // Feedback failure is silent — don't interrupt the rep's workflow
    } finally {
      setFeedbackSaving(false);
    }
  };

  const handleOutcome = async ({ outcome, outcomeReason, saleValue, whyItWorked }) => {
    if (!result || !lastForm) return;
    setOutcomeSaving(true);
    try {
      await salesCoachApi.saveOutcome({
        repQuestion:         lastForm.situation.trim(),
        customerObjection:   lastForm.situation.trim(),
        serviceType:         lastForm.service || null,
        recommendedResponse: result.recommendedResponse,
        softerVersion:       result.softerVersion,
        repEditedResponse:   repEdited !== result.recommendedResponse ? repEdited : undefined,
        outcome,
        outcomeReason:       outcomeReason || undefined,
        saleValue:           saleValue ? Number(saleValue) : undefined,
        whyItWorked:         whyItWorked || undefined,
        sessionId:           session?.id,
      });

      setOutcomeSaved(true);
      completeSession(outcome, (result.recommendedResponse || '').slice(0, 100));

      if (onSessionComplete && session) {
        onSessionComplete({
          ...session,
          outcome,
          status:    'completed',
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (_) {
      // Silent — outcome save failure should not block the rep
    } finally {
      setOutcomeSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="oc-workspace">
      {/* Left: form panel */}
      <div className="oc-form-panel">
        <ObjectionCoachForm
          onSubmit={handleFormSubmit}
          loading={loading}
          error={error}
        />
      </div>

      {/* Right: result panel */}
      <div className="oc-result-panel">
        {!result && !loading && <EmptyState />}
        {loading && <LoadingState />}

        {result && (
          <>
            <ObjectionCoachResult
              result={result}
              repEdited={repEdited}
              onRepEditedChange={setRepEdited}
            />
            <ObjectionCoachFeedback
              onFeedback={handleFeedback}
              saved={feedbackSaved}
              saving={feedbackSaving}
            />
            <ObjectionCoachOutcome
              onSave={handleOutcome}
              saved={outcomeSaved}
              saving={outcomeSaving}
            />
          </>
        )}
      </div>
    </div>
  );
}
