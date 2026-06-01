import { getActionLabel } from './constants.js';
import { getActivityEntryVariant } from './getActivityEntryVariant.js';
import ActivityLogEntryIcon from './ActivityLogEntryIcon.jsx';

const BORDER_CLASSES = {
  error: 'border-l-gs-danger border-gs-danger/20',
  test: 'border-l-gs-warn border-gs-warn/20',
  success: 'border-l-gs-accent border-gs-accent/20',
};

export default function ActivityLogEntry({ entry }) {
  const variant = getActivityEntryVariant(entry);

  return (
    <div
      className={`bg-gs-card border rounded-xl p-4 flex items-start gap-3 transition-shadow hover:shadow-card-lift border-l-4 ${BORDER_CLASSES[variant]}`}
    >
      <ActivityLogEntryIcon entry={entry} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gs-text font-semibold text-sm">
              {getActionLabel(entry.action)}
            </span>
            {entry.leadName && (
              <span className="text-gs-muted text-xs">→ {entry.leadName}</span>
            )}
            {entry.template && (
              <span className="bg-gs-info/12 border border-gs-info/30 text-gs-info text-xs px-2 py-0.5 rounded-full font-mono uppercase font-medium">
                {entry.template}
              </span>
            )}
            {entry.channel && entry.channel !== 'both' && (
              <span className="bg-gs-border/60 border border-gs-border text-gs-muted text-xs px-2 py-0.5 rounded-full">
                {entry.channel}
              </span>
            )}
            {entry.testMode && (
              <span className="bg-gs-warn/12 border border-gs-warn/30 text-gs-warn text-xs px-2 py-0.5 rounded-full font-medium">
                TEST
              </span>
            )}
          </div>
          <p className="text-gs-muted text-xs shrink-0 font-medium">
            {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}
          </p>
        </div>
        {entry.error && (
          <p className="text-gs-danger text-xs mt-1.5 bg-gs-danger/8 border border-gs-danger/20 rounded px-2 py-1">
            {entry.error}
          </p>
        )}
        {entry.leadPhone && (
          <p className="text-gs-muted text-xs mt-1 font-mono">{entry.leadPhone}</p>
        )}
      </div>
    </div>
  );
}
