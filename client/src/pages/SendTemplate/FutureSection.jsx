import { Sparkles } from 'lucide-react';

/* ── Future Section ── */
export default function FutureSection() {
  return (
    <div className="card flex flex-col gap-0 p-0 overflow-hidden border-dashed">
      <div className="px-4 py-3 border-b border-gs-border flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-gs-purple/12 border border-gs-purple/20">
          <Sparkles size={14} className="text-gs-purple" />
        </div>
        <div>
          <p className="text-gs-text font-semibold text-sm">Coming Soon</p>
          <p className="text-gs-muted text-xs">Future Section</p>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 text-center">
        <div className="w-12 h-12 rounded-xl bg-gs-border/50 border border-gs-border/60 flex items-center justify-center mb-3">
          <Sparkles size={20} className="text-gs-muted" />
        </div>
        <p className="text-gs-muted text-sm font-medium mb-1">Reserved for future use</p>
        <p className="text-gs-muted/60 text-xs leading-relaxed max-w-[160px]">
          This section is ready for your next feature
        </p>
      </div>
    </div>
  );
}
