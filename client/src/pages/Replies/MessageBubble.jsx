import { motion } from 'motion/react';
import { Mail, MessageSquare } from 'lucide-react';
import { formatThreadTime } from './threadUtils.js';

export default function MessageBubble({ msg, index = 0 }) {
  const isOut = msg.dir === 'out';
  const timeStr = formatThreadTime(msg.ts);
  const ChannelIcon = msg.channel === 'email' ? Mail : MessageSquare;

  if (msg.isTemplate) {
    return (
      <motion.div
        className="flex justify-center my-2"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: index * 0.03 }}
      >
        <div
          className="replies-template-pill"
          style={{
            backgroundColor: `${msg.color}12`,
            borderColor: `${msg.color}35`,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: msg.color }} aria-hidden />
          <span className="type-label-sm font-semibold leading-snug" style={{ color: msg.color }}>
            {msg.text}
          </span>
          {timeStr && (
            <span className="type-label-sm text-gs-muted ml-1 shrink-0 normal-case tracking-normal">
              {timeStr}
            </span>
          )}
        </div>
      </motion.div>
    );
  }

  const senderLabel = isOut
    ? `You · ${msg.channel === 'email' ? 'Email' : 'SMS'}`
    : `${msg.sender || 'Customer'} · ${msg.channel === 'email' ? 'Email' : 'SMS'}`;

  return (
    <motion.div
      className={`flex flex-col mb-3 max-w-[min(100%,520px)] ${isOut ? 'items-end ml-auto' : 'items-start'}`}
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.24, delay: Math.min(index * 0.04, 0.35), ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={`flex items-center gap-1 mb-1 type-label-sm text-gs-muted ${isOut ? 'flex-row-reverse' : ''}`}>
        <ChannelIcon size={10} className="shrink-0 opacity-70" aria-hidden />
        <span>{senderLabel}</span>
        {timeStr && <span className="opacity-80">· {timeStr.split(' · ').pop()}</span>}
      </div>
      <motion.div
        className={isOut ? 'replies-bubble-out' : 'replies-bubble-in'}
        whileHover={{ scale: 1.005 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      >
        {msg.text}
      </motion.div>
      {msg.status && isOut && (
        <span className="type-label-sm text-gs-muted mt-1 mr-1 capitalize">{msg.status}</span>
      )}
    </motion.div>
  );
}
