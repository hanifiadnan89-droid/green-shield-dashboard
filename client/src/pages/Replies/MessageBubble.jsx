import { motion } from 'motion/react';
import { Mail, MessageSquare, CheckCheck } from 'lucide-react';
import { formatThreadTime } from './threadUtils.js';

export default function MessageBubble({ msg, index = 0 }) {
  const isOut = msg.dir === 'out';
  const timeStr = formatThreadTime(msg.ts);
  const ChannelIcon = msg.channel === 'email' ? Mail : MessageSquare;

  if (msg.isTemplate) {
    return (
      <motion.div
        className="rc-template-row"
        initial={{ opacity: 0, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, delay: Math.min(index * 0.03, 0.3), ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="rc-template-pill"
          style={{
            backgroundColor: `${msg.color}14`,
            borderColor: `${msg.color}45`,
          }}
        >
          <span
            className="rc-template-pill__dot"
            style={{ backgroundColor: msg.color }}
            aria-hidden
          />
          <span className="rc-template-pill__text" style={{ color: msg.color }}>
            {msg.text}
          </span>
          {timeStr && (
            <span className="rc-template-pill__time">{timeStr}</span>
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
        delay: Math.min(index * 0.03, 0.35),
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
        whileHover={{ scale: 1.006, y: -1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      >
        <span className="rc-bubble__body">{msg.text}</span>
        {isOut && (
          <CheckCheck size={14} className="rc-bubble__read" aria-label="Sent" />
        )}
      </motion.div>
      {msg.status && isOut && (
        <span className="rc-bubble-status">{msg.status}</span>
      )}
    </motion.div>
  );
}
