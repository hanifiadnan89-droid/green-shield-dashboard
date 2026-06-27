import { useState } from 'react';
import { useSalesCoachSession } from '../../hooks/useSalesCoachSession.js';
import { salesCoachApi } from '../../api/salesCoachApi.js';
import ObjectionCoachForm     from './ObjectionCoachForm.jsx';
import ObjectionCoachResult   from './ObjectionCoachResult.jsx';

function EmptyState() {
  const placeholderResult = {
    recommendedResponse: "I completely understand. Price is important and you want to make the right decision. Once you enter the customer's exact objection, I’ll build a response grounded in Green Shield knowledge.",
    whyThisWorks: 'Acknowledges the concern. Keeps the rep calm. Sets up a value-based answer.',
    bestClosingQuestion: 'If the plan solves the real problem and fits the property, would you be comfortable moving forward today?',
    thingsToAvoid: ["Don't argue", "Don't discount before explaining value", "Don't over-explain"],
    confidence: 92,
    knowledgeSources: [],
  };

  return (
    <ObjectionCoachResult
      result={placeholderResult}
      repEdited={placeholderResult.recommendedResponse}
      onRepEditedChange={() => {}}
      isPlaceholder
    />
  );
}

function LoadingState() {
  return (
    <div className="oc-live-loading">
      <div className="oc-live-loading__bar" />
      <div className="oc-live-loading__content">
        <div className="oc-live-loading__orb" />
        <div>
          <div className="oc-live-loading__title">Building the best response</div>
          <div className="oc-live-loading__hint">Checking Training Center knowledge, approved responses, playbooks, and sales principles.</div>
        </div>
      </div>
      <div className="oc-live-loading__skeleton oc-live-loading__skeleton--wide" />
      <div className="oc-live-loading__skeleton" />
      <div className="oc-live-loading__skeleton oc-live-loading__skeleton--short" />
    </div>
  );
}

export default function ObjectionCoach({ onConfidenceUpdate }) {
  const { startSession, updateSession } = useSalesCoachSession('objectionCoach');

  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);
  const [result,         setResult]         = useState(null);
  const [repEdited,      setRepEdited]      = useState('');

  const handleFormSubmit = async (formValues) => {
    const s = startSession({ situation: formValues.situation, serviceType: formValues.service });
    setLoading(true);
    setError(null);
    setResult(null);
    setRepEdited('');
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
    </div>
  );
}
