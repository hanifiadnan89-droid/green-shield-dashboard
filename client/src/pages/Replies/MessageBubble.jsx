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
        className="flex justify-center my-3"
        initial={{ opacity: 0, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, delay: Math.min(index * 0.04, 0.3), ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="rc-template-pill"
          style={{
            backgroundColor: `${msg.color}18`,
            borderColor: `${msg.color}40`,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: msg.color }}
            aria-hidden
          />
          <span className="font-semibold leading-snug" style={{ color: msg.color }}>
            {msg.text}
          </span>
          {timeStr && (
            <span className="text-[0.6875rem] opacity-60 shrink-0 ml-1">{timeStr}</span>
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
      className={`rc-bubble-wrap ${isOut ? 'rc-bubble-wrap--out' : 'rc-bubble-wrap--in'}`}
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.28,
        delay: Math.min(index * 0.04, 0.35),
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div className="rc-bubble-meta">
        <ChannelIcon size={11} className="shrink-0 opacity-70" aria-hidden />
        <span>{senderLabel}</span>
        {timeStr && <span className="opacity-75">· {timeStr.split(' · ').pop()}</span>}
      </div>
      <motion.div
        className={`rc-bubble ${isOut ? 'rc-bubble--out' : 'rc-bubble--in'}`}
        whileHover={{ scale: 1.008, y: -1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      >
        {msg.text}
      </motion.div>
      {msg.status && isOut && (
        <span className="rc-bubble-status">{msg.status}</span>
      )}
    </motion.div>
  );
}
