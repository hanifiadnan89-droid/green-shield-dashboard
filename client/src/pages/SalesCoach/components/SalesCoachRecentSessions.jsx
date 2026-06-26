import {
  getModuleLabel,
  getOutcomeLabel,
  getOutcomeEmoji,
  formatSessionTimestamp,
} from '../utils/salesCoachFormatters.js';

function SessionCard({ session }) {
  const emoji   = session.outcome ? getOutcomeEmoji(session.outcome) : null;
  const outcome = session.outcome ? getOutcomeLabel(session.outcome) : null;

  return (
    <div className="sc-session-card">
      <div className="sc-session-card__module">{getModuleLabel(session.module)}</div>
      {session.situation && (
        <div className="sc-session-card__situation">
          {session.situation.length > 90
            ? `${session.situation.slice(0, 90)}…`
            : session.situation}
        </div>
      )}
      <div className="sc-session-card__meta">
        {outcome && (
          <span className="sc-session-card__outcome">
            {emoji} {outcome}
          </span>
        )}
        <span className="sc-session-card__time">
          {formatSessionTimestamp(session.updatedAt || session.createdAt)}
        </span>
      </div>
    </div>
  );
}

export function SalesCoachRecentSessions({ sessions = [], onNewSession }) {
  return (
    <div className="sc-sessions">
      <div className="sc-sessions__header">
        <div className="sc-home-kicker">Recent Sessions</div>
        {sessions.length > 0 && (
          <button className="sc-sessions__new-btn" onClick={onNewSession}>
            + New Session
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="sc-sessions__empty">
          <div className="sc-sessions__empty-title">No recent coaching sessions yet</div>
          <div className="sc-sessions__empty-hint">
            Sessions appear here after your first coaching interaction this visit.
          </div>
        </div>
      ) : (
        <div className="sc-sessions__list">
          {sessions.map(s => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      )}
    </div>
  );
}
