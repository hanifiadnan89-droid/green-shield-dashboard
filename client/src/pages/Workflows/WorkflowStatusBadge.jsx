import { XCircle } from 'lucide-react';

export default function WorkflowStatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full font-medium border ${
        active
          ? 'bg-gs-accent/12 border-gs-accent/30 text-gs-accent'
          : 'bg-gs-border/60 border-gs-border text-gs-muted'
      }`}
    >
      {active
        ? <><span className="w-1.5 h-1.5 bg-gs-accent rounded-full inline-block animate-pulse" /> Active</>
        : <><XCircle size={10} /> Inactive</>}
    </span>
  );
}
