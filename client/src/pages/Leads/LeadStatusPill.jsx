import { motion } from 'motion/react';

const PILL_CONFIG = {
  active:       { bg: 'rgba(22,163,74,0.12)',  border: 'rgba(22,163,74,0.28)',  text: '#15803d', pulse: true,  label: 'Active' },
  sent:         { bg: 'rgba(22,163,74,0.1)',   border: 'rgba(22,163,74,0.22)',  text: '#15803d', label: 'Sent' },
  replied:      { bg: 'rgba(37,99,235,0.1)',  border: 'rgba(37,99,235,0.25)',  text: '#1d4ed8', label: 'Replied' },
  yes:          { bg: 'rgba(22,163,74,0.1)',   border: 'rgba(22,163,74,0.22)',  text: '#15803d', label: 'Yes' },
  no:           { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.22)',  text: '#b91c1c', label: 'No' },
  stopped:      { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.22)',  text: '#b91c1c', label: 'Stopped' },
  stop:         { bg: 'rgba(217,119,6,0.1)',  border: 'rgba(217,119,6,0.28)',  text: '#b45309', label: 'Stop' },
  error:        { bg: 'rgba(217,119,6,0.12)', border: 'rgba(217,119,6,0.3)',   text: '#b45309', label: 'Error' },
  email_failed: { bg: 'rgba(217,119,6,0.12)', border: 'rgba(217,119,6,0.3)',   text: '#b45309', label: 'Failed' },
  archived:     { bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.22)', text: '#64748b', label: 'Archived' },
  imported:     { bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.22)', text: '#64748b', label: 'Imported' },
  ag:           { bg: 'rgba(22,163,74,0.1)',   border: 'rgba(22,163,74,0.25)',  text: '#15803d', label: 'AG' },
  na:           { bg: 'rgba(217,119,6,0.1)',  border: 'rgba(217,119,6,0.28)',  text: '#b45309', label: 'NA' },
  rit:          { bg: 'rgba(37,99,235,0.1)',  border: 'rgba(37,99,235,0.25)',  text: '#1d4ed8', label: 'RIT' },
  iq:           { bg: 'rgba(147,51,234,0.1)', border: 'rgba(147,51,234,0.25)', text: '#7e22ce', label: 'IQ' },
  't/m':        { bg: 'rgba(236,72,153,0.1)', border: 'rgba(236,72,153,0.25)', text: '#be185d', label: 'T/M' },
};

const FALLBACK = { bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.2)', text: '#64748b' };

export default function LeadStatusPill({ value, layoutId }) {
  if (!value) return <span className="text-gs-muted text-xs">—</span>;

  const key = value.toString().toLowerCase().trim();
  const cfg = PILL_CONFIG[key] || FALLBACK;
  const display = cfg.label || value;

  return (
    <motion.span
      layoutId={layoutId}
      className="leads-status-pill"
      style={{
        backgroundColor: cfg.bg,
        borderColor: cfg.border,
        color: cfg.text,
      }}
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      whileHover={{ scale: 1.04 }}
    >
      {cfg.pulse && (
        <motion.span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: cfg.text }}
          animate={{ opacity: [1, 0.35, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      {display}
    </motion.span>
  );
}
