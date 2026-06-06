import { useLayoutEffect, useRef } from 'react';

export default function FloatingErrorCard({
  item,
  position,
  onSelect,
  onHoverStart,
  onHoverEnd,
  registerSize,
}) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    registerSize(item.id, width, height);
  }, [item.id, item.floatingTitle, registerSize]);

  const x = position?.x ?? 24;
  const y = position?.y ?? 24;

  return (
    <button
      ref={ref}
      type="button"
      className="activity-floating-card"
      style={{ transform: `translate3d(${x}px, ${y}px, 0)` }}
      onClick={() => onSelect(item)}
      onMouseEnter={() => onHoverStart(item.id)}
      onMouseLeave={() => onHoverEnd()}
      onFocus={() => onHoverStart(item.id)}
      onBlur={() => onHoverEnd()}
    >
      <span className="activity-floating-card__category">{item.errorType}</span>
      <span>{item.floatingTitle || item.label}</span>
    </button>
  );
}
