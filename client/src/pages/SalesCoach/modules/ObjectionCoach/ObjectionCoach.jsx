import { useEffect, useRef, useState } from 'react';
import { Brain, History, Sparkles } from 'lucide-react';
import { useSalesCoachSession } from '../../hooks/useSalesCoachSession.js';
import { salesCoachApi }         from '../../api/salesCoachApi.js';
import ObjectionCoachForm        from './ObjectionCoachForm.jsx';
import ObjectionCoachResult      from './ObjectionCoachResult.jsx';

const RECENT_KEY = 'oc.recentObjections';
const RECENT_MAX = 6;

const SEED_RECENTS = [
  { situation: 'Too expensive',      category: 'price' },
  { situation: 'Only want one time', category: 'need' },
  { situation: 'I need to think about it', category: 'think' },
  { situation: 'Already have someone', category: 'competitor' },
  { situation: 'Not interested',     category: 'need' },
];

function loadRecents() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(raw) && raw.length ? raw : SEED_RECENTS;
  } catch { return SEED_RECENTS; }
}

function saveRecents(list) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX))); }
  catch { /* localStorage may be unavailable */ }
}

function chipLabel(text) {
  const t = (text || '').trim();
  return t.length > 36 ? `${t.slice(0, 33).trim()}…` : t;
}

function EmptyState() {
  return (
    <div className="oc-empty">
      <div className="oc-empty__orb" aria-hidden="true">
        <Sparkles size={20} aria-hidden="true" />
      </div>
      <h2 className="oc-empty__title">Coach a live objection</h2>
      <p className="oc-empty__hint">
        Drop the exact words your customer said, pick the service and situation, and get a complete coaching package built from Green Shield knowledge.
      </p>
      <ul className="oc-empty__tips">
        <li><span>1</span> Type or paste the objection — direct quotes work best.</li>
        <li><span>2</span> Add the service and personality if you know them.</li>
        <li><span>3</span> Press <kbd>⌘</kbd><kbd>↵</kbd> or hit <em>Coach Me</em>.</li>
      </ul>
    </div>
  );
}

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
  const [recents,   setRecents]   = useState(loadRecents);

  const formRef = useRef(null);

  // Persist recents whenever they change
  useEffect(() => { saveRecents(recents); }, [recents]);

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

      // Update recents — newest first, dedupe by trimmed text
      setRecents(prev => {
        const without = prev.filter(r =>
          (r.situation || '').trim().toLowerCase() !== situation.toLowerCase());
        return [{
          situation,
          category:    formValues.category    || '',
          service:     formValues.service     || '',
          personality: formValues.personality || '',
        }, ...without].slice(0, RECENT_MAX);
      });
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const handleRecentPick = (item) => {
    if (loading) return;
    formRef.current?.prefill({
      situation:   item.situation || '',
      category:    item.category  || '',
      service:     item.service   || '',
      personality: item.personality || '',
    });
    // Smooth re-run after the prefill commits
    requestAnimationFrame(() => {
      runCoach({
        situation:   item.situation || '',
        category:    item.category  || '',
        service:     item.service   || '',
        personality: item.personality || '',
        showOptional: false,
      });
    });
  };

  return (
    <div className="oc-shell">
      <div className="oc-stack">
        <ObjectionCoachForm
          ref={formRef}
          onSubmit={runCoach}
          loading={loading}
          error={error}
        />

        <div className="oc-canvas">
          {!result && !loading && <EmptyState />}
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

        {recents.length > 0 && (
          <div className="oc-recent">
            <div className="oc-recent__head">
              <History size={12} aria-hidden="true" />
              Recent objections
            </div>
            <div className="oc-recent__list">
              {recents.map((r, i) => (
                <button
                  key={`${r.situation}-${i}`}
                  type="button"
                  className="oc-recent__chip"
                  onClick={() => handleRecentPick(r)}
                  disabled={loading}
                  title={r.situation}
                >
                  {chipLabel(r.situation)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
