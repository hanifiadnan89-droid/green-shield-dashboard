import { formatThreadTime } from './threadUtils.js';

export default function ChatMessage({ msg }) {
  const isOut = msg.dir === 'out';
  const timeStr = formatThreadTime(msg.ts);

  if (msg.isTemplate) {
    return (
      <div className="flex justify-center my-1.5">
        <div style={{
          background: `${msg.color}12`,
          border: `1px solid ${msg.color}30`,
          borderRadius: '20px',
          padding: '3px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          maxWidth: '92%',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: msg.color, flexShrink: 0 }} />
          <span style={{ fontSize: '11px', color: msg.color, fontWeight: 600, lineHeight: 1.5 }}>
            {msg.text}
          </span>
          {timeStr && (
            <span style={{ fontSize: '10px', color: '#94a3b8', marginLeft: 2, flexShrink: 0 }}>
              {timeStr}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col mb-2 ${isOut ? 'items-end' : 'items-start'}`}>
      {timeStr && (
        <span style={{
          fontSize: '10px', color: '#94a3b8', marginBottom: '3px',
          marginLeft: isOut ? 0 : '4px', marginRight: isOut ? '4px' : 0,
        }}>
          {isOut ? `You · ${timeStr}` : `Customer · ${timeStr}`}
        </span>
      )}
      <div style={{
        maxWidth: '82%',
        padding: '8px 12px',
        borderRadius: isOut ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
        background: isOut
          ? 'linear-gradient(135deg, rgba(22,163,74,0.13), rgba(22,163,74,0.06))'
          : 'rgba(37,99,235,0.07)',
        border: isOut
          ? '1px solid rgba(22,163,74,0.22)'
          : '1px solid rgba(37,99,235,0.16)',
        fontSize: '13px',
        lineHeight: '1.55',
        color: '#0f172a',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {msg.text}
      </div>
    </div>
  );
}
