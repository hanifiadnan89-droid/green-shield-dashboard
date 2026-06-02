import { motion } from 'motion/react';

export default function UnreadPulseBadge({ show }) {
  if (!show) return null;
  return (
    <motion.span
      className="replies-unread-dot"
      aria-hidden
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{
        scale: [1, 1.15, 1],
        opacity: [1, 0.85, 1],
        boxShadow: [
          '0 0 0 0 rgba(22, 163, 74, 0.35)',
          '0 0 0 6px rgba(22, 163, 74, 0)',
          '0 0 0 0 rgba(22, 163, 74, 0)',
        ],
      }}
      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}
