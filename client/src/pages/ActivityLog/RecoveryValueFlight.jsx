import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';

const EASE = [0.22, 1, 0.36, 1];

export default function RecoveryValueFlight({
  flight,
  targetRef,
  reducedMotion,
  onComplete,
}) {
  const [targetPoint, setTargetPoint] = useState(null);

  useEffect(() => {
    if (!flight) return undefined;

    if (reducedMotion) {
      onComplete?.();
      return undefined;
    }

    const updateTarget = () => {
      const el = targetRef?.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setTargetPoint({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    };

    updateTarget();
    window.addEventListener('resize', updateTarget);
    window.addEventListener('scroll', updateTarget, true);
    return () => {
      window.removeEventListener('resize', updateTarget);
      window.removeEventListener('scroll', updateTarget, true);
    };
  }, [flight, targetRef, reducedMotion, onComplete]);

  if (!flight || reducedMotion) return null;
  if (!targetPoint) return null;

  const startX = flight.fromRect.left + flight.fromRect.width / 2;
  const startY = flight.fromRect.top + flight.fromRect.height / 2;

  return createPortal(
    <motion.div
      className="activity-recovery-flight"
      initial={{
        x: startX,
        y: startY,
        scale: 1,
        opacity: 1,
      }}
      animate={{
        x: targetPoint.x,
        y: targetPoint.y,
        scale: 0.72,
        opacity: 0.92,
      }}
      transition={{ duration: 0.78, ease: EASE }}
      onAnimationComplete={onComplete}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 60,
        pointerEvents: 'none',
      }}
    >
      <span className="activity-recovery-flight__value">{flight.label}</span>
      <span className="activity-recovery-flight__trail" aria-hidden />
    </motion.div>,
    document.body,
  );
}
