import { useLayoutEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { getItemAgeTier } from './errorItemAge.js';

const RESOLVED_MS = 420;
const FADE_MS = 280;

export default function FloatingErrorCard({
  item,
  position,
  isEntering,
  isHovered,
  reducedMotion,
  onSelect,
  onHoverStart,
  onHoverEnd,
  onRecover,
  registerSize,
}) {
  const wrapRef = useRef(null);
  const valueRef = useRef(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [phase, setPhase] = useState('idle');

  const ageTier = getItemAgeTier(item.dateAdded);
  const x = position?.x ?? 24;
  const y = position?.y ?? 24;
  const isOpen = !item.isComplete;
  const statusLabel = phase === 'resolved' || phase === 'recovering'
    ? 'RESOLVED'
    : isOpen
      ? 'OPEN'
      : 'COMPLETE';
  const originalLabel = item.originalPriceLabel || item.priceLabel || 'No price listed';
  const valueLabel = item.contractValueLabel || 'No contract value found';
  const recoverableAmount = Number.isFinite(item.contractValue) ? item.contractValue : null;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    registerSize(item.id, width, height);
  }, [
    item.id,
    item.customerId,
    item.errorType,
    item.originalPriceLabel,
    item.contractValueLabel,
    actionsOpen,
    phase,
    registerSize,
  ]);

  function handlePointerEnter() {
    if (phase !== 'idle') return;
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

  function handleCompleteClick(e) {
    e.stopPropagation();
    if (phase !== 'idle') return;

    setPhase('resolved');
    setActionsOpen(false);

    const resolvedMs = reducedMotion ? 120 : RESOLVED_MS;
    const fadeMs = reducedMotion ? 80 : FADE_MS;

    window.setTimeout(() => {
      setPhase('recovering');
      const fromRect = valueRef.current?.getBoundingClientRect()
        ?? wrapRef.current?.getBoundingClientRect();

      onRecover?.({
        item,
        amount: recoverableAmount,
        label: recoverableAmount != null
          ? `+$${recoverableAmount.toLocaleString('en-US')}`
          : valueLabel,
        fromRect,
      });
    }, resolvedMs);

    window.setTimeout(() => {
      setPhase('done');
    }, resolvedMs + fadeMs);
  }

  function handleCardClick() {
    if (phase !== 'idle') return;
    onSelect(item);
  }

  const cardClass = [
    'activity-floating-card',
    `activity-floating-card--age-${ageTier}`,
    isEntering && !reducedMotion ? 'activity-floating-card--enter' : '',
    isHovered && phase === 'idle' ? 'activity-floating-card--hover' : '',
    actionsOpen ? 'activity-floating-card--actions' : '',
    phase === 'resolved' ? 'activity-floating-card--resolved' : '',
    phase === 'recovering' || phase === 'done' ? 'activity-floating-card--recovering' : '',
    reducedMotion ? 'activity-floating-card--reduced' : '',
  ].filter(Boolean).join(' ');

  const hideValue = phase === 'recovering' || phase === 'done';

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
        tabIndex={phase === 'idle' ? 0 : -1}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCardClick();
          }
        }}
      >
        <span className="activity-floating-card__dot" aria-hidden />

        {phase === 'resolved' ? (
          <span className="activity-floating-card__resolved-badge" aria-hidden>
            <Check size={14} strokeWidth={3} />
            Resolved
          </span>
        ) : null}

        <div className="activity-floating-card__body">
          <div className="activity-floating-card__row">
            <span className="activity-floating-card__id">{item.customerId || '—'}</span>
            <span
              className={[
                'activity-floating-card__status',
                phase === 'resolved' || phase === 'recovering'
                  ? 'activity-floating-card__status--resolved'
                  : isOpen
                    ? 'activity-floating-card__status--open'
                    : '',
              ].filter(Boolean).join(' ')}
            >
              {statusLabel}
            </span>
          </div>

          {item.customerName ? (
            <p className="activity-floating-card__name">{item.customerName}</p>
          ) : null}

          <p className="activity-floating-card__reason">
            {item.errorType || item.reasonRaw || item.reason || 'Error'}
          </p>

          <div className="activity-floating-card__pricing">
            <span className="activity-floating-card__original">
              Original: {originalLabel}
            </span>
            <span
              ref={valueRef}
              className={`activity-floating-card__value ${hideValue ? 'activity-floating-card__value--hidden' : ''}`}
            >
              Value: {valueLabel}
            </span>
          </div>
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
