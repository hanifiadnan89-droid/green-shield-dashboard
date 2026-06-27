import { useRef, useState } from 'react';
import { Brain } from 'lucide-react';
import { useSalesCoachSession } from '../../hooks/useSalesCoachSession.js';
import { salesCoachApi }         from '../../api/salesCoachApi.js';
import ObjectionCoachForm        from './ObjectionCoachForm.jsx';
import ObjectionCoachResult      from './ObjectionCoachResult.jsx';
import SalesIntelligence         from '../../components/SalesIntelligence.jsx';

function LoadingState() {
  return (
    <div className="oc-loading" role="status" aria-live="polite">
      <div className="oc-loading__head">
        <span className="oc-loading__orb" aria-hidden="true">
          <Brain size={14} aria-hidden="true" />
        </span>
        <div>
          <div className="oc-loading__title">Building the best response</div>
          <div className="oc-loading__hint">Checking Training Center, approved responses, playbooks, and sales principles.</div>
        </div>
      </div>
      <div className="oc-loading__skel oc-loading__skel--w90" />
      <div className="oc-loading__skel oc-loading__skel--w100" />
      <div className="oc-loading__skel oc-loading__skel--w60" />
      <div className="oc-loading__row">
        <div className="oc-loading__skel oc-loading__skel--block" />
        <div className="oc-loading__skel oc-loading__skel--block" />
      </div>
    </div>
  );
}

export default function ObjectionCoach({ onConfidenceUpdate }) {
  const { session, startSession, updateSession } = useSalesCoachSession('objectionCoach');

  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [result,    setResult]    = useState(null);
  const [repEdited, setRepEdited] = useState('');
  const [repQuestion, setRepQuestion] = useState('');
  const [activeCategory, setActiveCategory] = useState('');

  const formRef = useRef(null);

  async function runCoach(formValues) {
    const situation = (formValues.situation || '').trim();
    if (situation.length < 10) {
      setError('Please type at least 10 characters for the objection.');
      return;
    }
    const s = startSession({ situation, serviceType: formValues.service });
    setLoading(true);
    setError(null);
    setResult(null);
    setRepEdited('');
    setRepQuestion(situation);
    if (onConfidenceUpdate) onConfidenceUpdate(null);

    try {
      const data = await salesCoachApi.runModule(
        'objectionCoach',
        {
          situation,
          category:    formValues.category    || null,
          service:     formValues.service     || null,
          personality: formValues.personality || null,
          propertyContext: formValues.showOptional ? {
            address:      (formValues.propAddress || '').trim() || undefined,
            propertyType: (formValues.propType    || '').trim() || undefined,
            notes:        (formValues.propNotes   || '').trim() || undefined,
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
  }

  return (
    <div className="oc-shell">
      <div className="oc-stack">
        <ObjectionCoachForm
          ref={formRef}
          onSubmit={runCoach}
          onCategoryChange={setActiveCategory}
          loading={loading}
          error={error}
        />

        <div className="oc-canvas">
          {!result && !loading && (
            <SalesIntelligence objectionCategory={activeCategory} />
          )}
          {loading && <LoadingState />}
          {result && (
            <ObjectionCoachResult
              result={result}
              repEdited={repEdited}
              onRepEditedChange={setRepEdited}
              sessionId={session?.id || null}
              repQuestion={repQuestion}
            />
          )}
        </div>
      </div>
    </div>
  );
}
