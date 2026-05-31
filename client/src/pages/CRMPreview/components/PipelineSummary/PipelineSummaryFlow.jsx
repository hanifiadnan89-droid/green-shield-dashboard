import { useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowUpRight, TrendingUp } from 'lucide-react';
import FlowOverlay from './FlowOverlay.jsx';
import PerformanceEngine from './PerformanceEngine.jsx';
import LivingDataFlow from './LivingDataFlow.jsx';
import KeyMetrics from './KeyMetrics.jsx';

export default function PipelineSummaryFlow({ stats }) {
  const navigate = useNavigate();
  const sectionRef = useRef(null);
  const isScrollingRef = useRef(false);

  // Passive scroll listener — toggles ps-scrolling class via direct DOM (no React re-render).
  // CSS handles all visual degradation during scroll; ref tells canvas to skip drawing.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    let timer = null;
    const onScroll = () => {
      isScrollingRef.current = true;
      el.classList.add('ps-scrolling');
      clearTimeout(timer);
      timer = setTimeout(() => {
        isScrollingRef.current = false;
        el.classList.remove('ps-scrolling');
      }, 150);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(timer); };
  }, []);

  const {
    total = 0,
    replied = 0,
    sentToday = 0,
    errors = 0,
    sold = 0,
    byTemplate = {},
  } = stats;

  const rates = useMemo(() => ({
    reply:      total > 0 ? (replied / total) * 100 : 0,
    noAnswer:   total > 0 ? ((byTemplate.na ?? 0) / total) * 100 : 0,
    agreements: total > 0 ? ((byTemplate.ag ?? 0) / total) * 100 : 0,
    sold:       total > 0 ? (sold / total) * 100 : 0,
  }), [total, replied, byTemplate, sold]);

  const metrics = useMemo(() => ({
    total,
    sentToday,
    replied,
    errors,
    sold,
  }), [total, sentToday, replied, errors, sold]);

  if (total === 0) {
    return (
      <div className="p-card p-card-lift section-enter h-full flex flex-col items-center justify-center text-center p-8">
        <div className="ps-empty__icon">
          <TrendingUp size={20} />
        </div>
        <p className="type-body-sm font-medium text-gs-muted">No lead data yet</p>
        <p className="type-label-sm text-gs-muted/70 mt-1 normal-case tracking-normal">
          <Link to="/send" className="text-gs-accent hover:underline">
            Send your first template
          </Link>{' '}
          to see analytics
        </p>
      </div>
    );
  }

  return (
    <section ref={sectionRef} className="ps-root section-enter">
      <div className="ps-root__glow" />
      <header className="ps-root__header">
        <div>
          <h3 className="type-display-lg font-extrabold text-gs-text">Pipeline Summary</h3>
          <p className="type-body-sm text-gs-muted">
            Lead analytics ·{' '}
            <strong className="text-gs-accent font-semibold">{total.toLocaleString()}</strong>{' '}
            total leads
          </p>
        </div>
        <button
          type="button"
          className="ps-root__view-btn"
          onClick={() => navigate('/leads')}
        >
          View Pipeline <ArrowUpRight size={13} />
        </button>
      </header>

      <div className="ps-main">
        <FlowOverlay isScrollingRef={isScrollingRef} />
        <PerformanceEngine rates={rates} />
        <LivingDataFlow stats={{ total, replied, errors, sold }} />
        <KeyMetrics metrics={metrics} rates={rates} />
      </div>
    </section>
  );
}
