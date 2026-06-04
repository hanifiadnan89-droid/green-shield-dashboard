import { motion } from 'motion/react';

/** Soft glow pulse for unread conversations (avatar area). */
export default function UnreadPulseBadge({ show }) {
  if (!show) return null;
  return (
    <>
      <motion.span
        className="rc-unread-glow"
        aria-hidden
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{
          opacity: [0.5, 0.15, 0.5],
          scale: [1, 1.4, 1],
        }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.span
        className="rc-unread-dot"
        aria-hidden
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{
          scale: [1, 1.1, 1],
          opacity: 1,
          boxShadow: [
            '0 0 0 0 rgba(74, 222, 128, 0.5)',
            '0 0 0 6px rgba(74, 222, 128, 0)',
            '0 0 0 0 rgba(74, 222, 128, 0)',
          ],
        }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      />
    </>
  );
}
