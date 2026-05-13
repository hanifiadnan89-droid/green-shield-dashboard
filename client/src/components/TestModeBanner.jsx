import { FlaskConical, Zap } from 'lucide-react';

export default function TestModeBanner({ testMode }) {
  if (testMode === null) return null;

  if (testMode) {
    return (
      <div className="bg-gs-warn/10 border-b border-gs-warn/30 px-4 py-2 flex items-center gap-2">
        <FlaskConical size={14} className="text-gs-warn shrink-0" />
        <span className="text-gs-warn text-xs font-semibold">TEST MODE</span>
        <span className="text-gs-warn/60 text-xs">— No real messages will be sent. Sheet writes are simulated.</span>
      </div>
    );
  }

  return (
    <div className="bg-gs-accent/8 border-b border-gs-accent/20 px-4 py-2 flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full bg-gs-accent animate-pulse shrink-0" />
      <Zap size={13} className="text-gs-accent shrink-0" />
      <span className="text-gs-accent text-xs font-semibold tracking-wide">LIVE MODE</span>
    </div>
  );
}
