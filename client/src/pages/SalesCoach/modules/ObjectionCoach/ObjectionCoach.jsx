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
    <div className="oc-empty-state">
      <div className="oc-empty-state__icon"><MessageSquare size={40} /></div>
      <div className="oc-empty-state__title">Ready when you are</div>
      <div className="oc-empty-state__hint">
        Describe what the customer said, pick a category, and hit Coach Me to get a live sales response.
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="oc-empty-state">
      <div className="oc-spinner" />
      <div className="oc-empty-state__title">Building your response…</div>
      <div className="oc-empty-state__hint">Pulling from strategy, examples, and outcomes</div>
    </div>
  );
}

export default function ObjectionCoach({ onSessionComplete, onConfidenceUpdate }) {
  const { session, startSession, updateSession, completeSession } = useSalesCoachSession('objectionCoach');

  const [lastForm,       setLastForm]       = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);
  const [result,         setResult]         = useState(null);
  const [repEdited,      setRepEdited]      = useState('');
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackSaved,  setFeedbackSaved]  = useState(false);
  const [outcomeSaving,  setOutcomeSaving]  = useState(false);
  const [outcomeSaved,   setOutcomeSaved]   = useState(false);

  const handleFormSubmit = async (formValues) => {
    const s = startSession({ situation: formValues.situation, serviceType: formValues.service });
    setLastForm(formValues);
    setLoading(true);
    setError(null);
    setResult(null);
    setRepEdited('');
    setFeedbackSaved(false);
    setOutcomeSaved(false);
    if (onConfidenceUpdate) onConfidenceUpdate(null);

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
      if (onConfidenceUpdate) onConfidenceUpdate(data.confidence ?? null);
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
      // Feedback failure is silent
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

  return (
    <div className="oc-layout">
      <div className="oc-body">
        <div className="oc-sidebar">
          <ObjectionCoachForm onSubmit={handleFormSubmit} loading={loading} error={error} />
        </div>
        <div className="oc-results-area">
          {!result && !loading && <EmptyState />}
          {loading && <LoadingState />}
          {result && (
            <ObjectionCoachResult
              result={result}
              repEdited={repEdited}
              onRepEditedChange={setRepEdited}
            />
          )}
        </div>
      </div>

      {result && (
        <div className="oc-footer">
          <div className="oc-footer__panel">
            <div className="oc-footer__label">Was this helpful?</div>
            <ObjectionCoachFeedback
              onFeedback={handleFeedback}
              saved={feedbackSaved}
              saving={feedbackSaving}
            />
          </div>
          <div className="oc-footer__panel">
            <div className="oc-footer__label">Track the Outcome</div>
            <ObjectionCoachOutcome
              onSave={handleOutcome}
              saved={outcomeSaved}
              saving={outcomeSaving}
            />
          </div>
        </div>
      )}
    </div>
  );
}
