import { FlaskConical, Zap } from 'lucide-react';

const bannerBase =
  'flex items-center gap-2 px-4 py-2 border-b shrink-0 bg-[#080F0A]';

export default function TestModeBanner({ testMode, suppressLiveBanner = false }) {
  if (testMode === null) return null;

  if (testMode) {
    return (
      <div className={`${bannerBase} border-amber-500/25`}>
        <FlaskConical size={14} className="text-amber-400 shrink-0" />
        <span className="text-amber-400 text-[0.625rem] font-extrabold uppercase tracking-[0.12em]">
          Test mode
        </span>
        <span className="text-amber-400/55 text-xs font-normal normal-case tracking-normal">
          — No real messages will be sent. Sheet writes are simulated.
        </span>
      </div>
    );
  }

  if (suppressLiveBanner) return null;

  return (
    <div className={`${bannerBase} border-white/[0.06]`}>
      <span
        className="w-[7px] h-[7px] rounded-full bg-[#4ade80] animate-pulse shrink-0"
        style={{ boxShadow: '0 0 10px #4ade80' }}
        aria-hidden
      />
      <Zap size={13} className="text-[#4ade80] shrink-0" aria-hidden />
      <span className="text-[#4ade80] text-[0.625rem] font-extrabold uppercase tracking-[0.12em]">
        Live mode
      </span>
    </div>
  );
}
