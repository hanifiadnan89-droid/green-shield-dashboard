import { useCallback, useEffect, useRef, useState } from 'react';
import { Brain, RefreshCw, Sparkles } from 'lucide-react';
import { pickInsight, getInsightCount } from '../../../data/salesIntelligence.js';

const FADE_MS = 200;

/**
 * Sales Intelligence — the panel that lives where the empty state used to.
 *
 * Shows one coaching insight at a time, drawn from a library of 350+ original
 * sales psychology insights adapted for pest control. Insights are filtered
 * by the rep's selected objection type (smart filtering), and rotation is
 * tracked via localStorage to avoid repeats.
 *
 * Props:
 *   objectionCategory  current objection-type id from the form (or '')
 */
export default function SalesIntelligence({ objectionCategory = '' }) {
  const [insight, setInsight]     = useState(() => pickInsight({ objectionCategory }));
  const [fading, setFading]       = useState(false);
  const lastCategoryRef           = useRef(objectionCategory);
  const fadeTimerRef              = useRef(null);

  const cycle = useCallback((opts = {}) => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    setFading(true);
    fadeTimerRef.current = setTimeout(() => {
      setInsight((prev) => pickInsight({
        objectionCategory: opts.category ?? objectionCategory,
        excludeId: prev?.id,
      }));
      setFading(false);
    }, FADE_MS);
  }, [objectionCategory]);

  // Re-pick when the selected objection type changes
  useEffect(() => {
    if (lastCategoryRef.current === objectionCategory) return;
    lastCategoryRef.current = objectionCategory;
    cycle({ category: objectionCategory });
  }, [objectionCategory, cycle]);

  useEffect(() => () => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
  }, []);

  if (!insight) return null;

  return (
    <article className="oc-intel" aria-label="Sales intelligence">
      <header className="oc-intel__head">
        <div className="oc-intel__brand">
          <span className="oc-intel__orb" aria-hidden="true">
            <Brain size={12} aria-hidden="true" />
          </span>
          <div className="oc-intel__brand-text">
            <span className="oc-intel__brand-title">
              Sales Intelligence
              <Sparkles size={11} aria-hidden="true" />
            </span>
            <span className="oc-intel__brand-sub">
              AI-powered objection handling, sales psychology, and closing insights built from Green Shield knowledge.
            </span>
          </div>
        </div>
        <button
          type="button"
          className="oc-intel__cycle"
          onClick={() => cycle()}
          aria-label="Show another insight"
          title={`${getInsightCount()} insights in the library`}
        >
          <RefreshCw size={12} aria-hidden="true" />
          <span>New insight</span>
        </button>
      </header>

      <div
        className={`oc-intel__body${fading ? ' oc-intel__body--fading' : ''}`}
        key={insight.id}
        aria-live="polite"
      >
        <span className="oc-intel__category">{insight.category}</span>

        <h2 className="oc-intel__title">{insight.title}</h2>

        <blockquote className="oc-intel__line">
          <span className="oc-intel__quote oc-intel__quote--open" aria-hidden="true">“</span>
          {insight.line}
          <span className="oc-intel__quote oc-intel__quote--close" aria-hidden="true">”</span>
        </blockquote>

        <div className="oc-intel__why">
          <span className="oc-intel__why-label">Why this works</span>
          <p>{insight.whyItWorks}</p>
        </div>

        <footer className="oc-intel__meta">
          <span className="oc-intel__psych">
            <Sparkles size={10} aria-hidden="true" />
            {insight.psychology}
          </span>
          <ul className="oc-intel__tags" aria-label="Insight tags">
            {insight.tags.slice(0, 6).map((tag) => (
              <li key={tag} className="oc-intel__tag">{tag}</li>
            ))}
          </ul>
        </footer>
      </div>
    </article>
  );
}
