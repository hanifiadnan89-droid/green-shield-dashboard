import { FlaskConical, Zap } from 'lucide-react';

export default function TestModeBanner({ testMode }) {
  if (testMode === null) return null;

  if (testMode) {
    return (
      <div className="bg-amber-50/80 border-b border-amber-200/80 px-4 py-2 flex items-center gap-2 backdrop-blur-md">
        <FlaskConical size={14} className="text-gs-warn shrink-0" />
        <span className="text-gs-warn text-xs font-semibold">TEST MODE</span>
        <span className="text-gs-warn/60 text-xs">— No real messages will be sent. Sheet writes are simulated.</span>
      </div>
    );
  }

  return (
    <div className="bg-green-50/80 border-b border-green-200/80 px-4 py-2 flex items-center gap-2 backdrop-blur-md">
      <span className="w-1.5 h-1.5 rounded-full bg-gs-accent animate-pulse shrink-0" />
      <Zap size={13} className="text-gs-accent shrink-0" />
      <span className="text-gs-accent text-xs font-semibold tracking-wide">LIVE MODE</span>
    </div>
  );
}
