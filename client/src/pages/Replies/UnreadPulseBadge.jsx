import { motion } from 'motion/react';

/** Soft glow pulse for unread conversations (avatar area). */
export default function UnreadPulseBadge({ show }) {
  if (!show) return null;
  return (
    <>
      <motion.span
        className="replies-unread-glow"
        aria-hidden
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{
          opacity: [0.45, 0.2, 0.45],
          scale: [1, 1.35, 1],
        }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.span
        className="replies-unread-dot"
        aria-hidden
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{
          scale: [1, 1.08, 1],
          opacity: 1,
          boxShadow: [
            '0 0 0 0 rgba(22, 163, 74, 0.4)',
            '0 0 0 5px rgba(22, 163, 74, 0)',
            '0 0 0 0 rgba(22, 163, 74, 0)',
          ],
        }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      />
    </>
  );
}
