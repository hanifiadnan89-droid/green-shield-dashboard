import { CheckCircle, XCircle, FlaskConical } from 'lucide-react';
import { getActivityEntryVariant } from './getActivityEntryVariant.js';

export default function ActivityLogEntryIcon({ entry }) {
  const variant = getActivityEntryVariant(entry);

  if (variant === 'error') {
    return (
      <div className="w-8 h-8 rounded-full bg-gs-danger/12 border border-gs-danger/30 flex items-center justify-center shrink-0">
        <XCircle size={15} className="text-gs-danger" />
      </div>
    );
  }
  if (variant === 'test') {
    return (
      <div className="w-8 h-8 rounded-full bg-gs-warn/12 border border-gs-warn/30 flex items-center justify-center shrink-0">
        <FlaskConical size={15} className="text-gs-warn" />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-gs-accent/12 border border-gs-accent/30 flex items-center justify-center shrink-0">
      <CheckCircle size={15} className="text-gs-accent" />
    </div>
  );
}
