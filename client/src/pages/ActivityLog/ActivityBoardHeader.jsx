import { Radio } from 'lucide-react';

export default function ActivityBoardHeader({ count, loading }) {
  return (
    <header className="activity-board-header">
      <div>
        <h1 className="activity-board-header__title">Activity Log</h1>
        <p className="activity-board-header__sub">
          Live error command board · {loading ? '…' : count} active item{count === 1 ? '' : 's'}
        </p>
        <p className="activity-board-header__live">
          <span className="activity-board-header__live-dot" aria-hidden />
          <Radio size={12} aria-hidden />
          Error screensaver active
        </p>
      </div>
    </header>
  );
}
