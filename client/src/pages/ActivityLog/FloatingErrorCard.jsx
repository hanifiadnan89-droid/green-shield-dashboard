import { useLayoutEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { getItemAgeTier } from './errorItemAge.js';

const COMPLETE_MS = 520;

export default function FloatingErrorCard({
  item,
  position,
  isEntering,
  isHovered,
  reducedMotion,
  onSelect,
  onHoverStart,
  onHoverEnd,
  onComplete,
  registerSize,
}) {
  const wrapRef = useRef(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [phase, setPhase] = useState('idle');

  const ageTier = getItemAgeTier(item.dateAdded);
  const x = position?.x ?? 24;
  const y = position?.y ?? 24;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    registerSize(item.id, width, height);
  }, [item.id, item.customerId, item.errorType, actionsOpen, phase, registerSize]);

  function handlePointerEnter() {
    onHoverStart(item.id);
    setActionsOpen(true);
  }

  function handlePointerLeave() {
    onHoverEnd();
    if (phase === 'idle') setActionsOpen(false);
  }

  function handleNotComplete(e) {
    e.stopPropagation();
    setActionsOpen(false);
  }

  async function handleCompleteClick(e) {
    e.stopPropagation();
    if (phase !== 'idle') return;

    setPhase('confirming');
    const confirmMs = reducedMotion ? 80 : 220;
    const exitMs = reducedMotion ? 120 : 300;

    window.setTimeout(() => setPhase('exiting'), confirmMs);
    window.setTimeout(async () => {
      await onComplete(item);
    }, confirmMs + exitMs);
  }

  function handleCardClick() {
    if (phase !== 'idle') return;
    onSelect(item);
  }

  const cardClass = [
    'activity-floating-card',
    `activity-floating-card--age-${ageTier}`,
    isEntering && !reducedMotion ? 'activity-floating-card--enter' : '',
    isHovered ? 'activity-floating-card--hover' : '',
    actionsOpen ? 'activity-floating-card--actions' : '',
    phase === 'confirming' ? 'activity-floating-card--confirming' : '',
    phase === 'exiting' ? 'activity-floating-card--exiting' : '',
    reducedMotion ? 'activity-floating-card--reduced' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={wrapRef}
      className="activity-floating-card-wrap"
      style={{ transform: `translate3d(${x}px, ${y}px, 0)` }}
      onMouseEnter={handlePointerEnter}
      onMouseLeave={handlePointerLeave}
      onFocus={handlePointerEnter}
      onBlur={handlePointerLeave}
    >
      <div
        className={cardClass}
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCardClick();
          }
        }}
      >
        <span className="activity-floating-card__dot" aria-hidden />

        {phase === 'confirming' || phase === 'exiting' ? (
          <span className="activity-floating-card__check" aria-hidden>
            <Check size={16} strokeWidth={3} />
          </span>
        ) : null}

        <div className="activity-floating-card__body">
          <div className="activity-floating-card__row">
            <span className="activity-floating-card__id">{item.customerId || '—'}</span>
            <span className="activity-floating-card__status">{item.status || 'Open'}</span>
          </div>
          <p className="activity-floating-card__reason">
            {item.errorType || item.reasonRaw || item.reason || 'Error'}
          </p>
          {item.customerName ? (
            <p className="activity-floating-card__name">{item.customerName}</p>
          ) : null}
        </div>

        <div
          className={`activity-floating-card__actions ${actionsOpen && phase === 'idle' ? 'activity-floating-card__actions--visible' : ''}`}
          onClick={e => e.stopPropagation()}
        >
          <button
            type="button"
            className="activity-floating-card__action activity-floating-card__action--complete"
            onClick={handleCompleteClick}
          >
            <Check size={12} />
            Complete
          </button>
          <button
            type="button"
            className="activity-floating-card__action activity-floating-card__action--dismiss"
            onClick={handleNotComplete}
          >
            <X size={12} />
            Not Complete
          </button>
        </div>
      </div>
    </div>
  );
}

export { COMPLETE_MS };
