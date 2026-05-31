import { formatThreadTime } from './threadUtils.js';

export default function ChatMessage({ msg }) {
  const isOut = msg.dir === 'out';
  const timeStr = formatThreadTime(msg.ts);

  if (msg.isTemplate) {
    return (
      <div className="flex justify-center my-1.5">
        <div
          className="inline-flex items-center gap-1.5 max-w-[92%] rounded-full px-3 py-0.5 border"
          style={{
            backgroundColor: `${msg.color}12`,
            borderColor: `${msg.color}30`,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: msg.color }}
            aria-hidden
          />
          <span className="type-label-sm font-semibold leading-snug" style={{ color: msg.color }}>
            {msg.text}
          </span>
          {timeStr && (
            <span className="type-label-sm text-gs-muted ml-0.5 shrink-0 normal-case tracking-normal">
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
        <span className={`chat-bubble-meta ${isOut ? 'mr-1' : 'ml-1'}`}>
          {isOut ? `You · ${timeStr}` : `Customer · ${timeStr}`}
        </span>
      )}
      <div className={isOut ? 'chat-bubble-out' : 'chat-bubble-in'}>
        {msg.text}
      </div>
    </div>
  );
}
