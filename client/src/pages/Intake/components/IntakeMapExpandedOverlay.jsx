import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function IntakeMapExpandedOverlay({
  open,
  onClose,
  toolbar = null,
  children,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="intake-map-expanded-overlay" role="dialog" aria-modal="true" aria-label="Expanded map">
      {toolbar ? (
        <div className="intake-map-expanded-overlay__toolbar">
          {toolbar}
        </div>
      ) : null}
      <div className="intake-map-expanded-overlay__map">
        {children}
      </div>
    </div>,
    document.body,
  );
}
