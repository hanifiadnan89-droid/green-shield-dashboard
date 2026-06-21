import { Maximize2, Minimize2 } from 'lucide-react';

export default function IntakeMapExpandButton({
  isExpanded = false,
  onClick,
  className = '',
}) {
  if (!onClick) return null;

  return (
    <button
      type="button"
      className={`intake-map-expand-btn ${className}`.trim()}
      onClick={onClick}
      aria-label={isExpanded ? 'Close expanded map' : 'Expand map'}
      title={isExpanded ? 'Close expanded map' : 'Expand map'}
    >
      {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
    </button>
  );
}
