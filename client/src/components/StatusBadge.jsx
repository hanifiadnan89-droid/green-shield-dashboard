const CONFIGS = {
  active:       { bg: 'bg-gs-accent/10',  text: 'text-gs-accent-dim', pulse: true  },
  sent:         { bg: 'bg-gs-accent/10',  text: 'text-gs-accent-dim'               },
  replied:      { bg: 'bg-gs-info/10',    text: 'text-gs-info'                     },
  yes:          { bg: 'bg-gs-accent/10',  text: 'text-gs-accent-dim'               },
  no:           { bg: 'bg-gs-danger/10',  text: 'text-gs-danger'                   },
  stopped:      { bg: 'bg-gs-danger/10',  text: 'text-gs-danger'                   },
  error:        { bg: 'bg-gs-warn/10',    text: 'text-gs-warn'                     },
  email_failed: { bg: 'bg-gs-warn/10',    text: 'text-gs-warn'                     },
  archived:     { bg: 'bg-gs-muted/10',   text: 'text-gs-muted'                    },
  imported:     { bg: 'bg-gs-muted/10',   text: 'text-gs-muted'                    },
  ag:           { bg: 'bg-gs-accent/10',  text: 'text-gs-accent-dim'               },
  na:           { bg: 'bg-gs-warn/10',    text: 'text-gs-warn'                     },
  rit:          { bg: 'bg-gs-info/10',    text: 'text-gs-info'                     },
  iq:           { bg: 'bg-gs-purple/10',  text: 'text-gs-purple'                   },
  't/m':        { bg: 'bg-pink-500/10',   text: 'text-pink-500'                    },
};

const FALLBACK = { bg: 'bg-gs-muted/10', text: 'text-gs-muted' };

export default function StatusBadge({ value }) {
  if (!value) return <span className="text-gs-muted text-xs">—</span>;
  const key = value.toString().toLowerCase().trim();
  const cfg = CONFIGS[key] || FALLBACK;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-[3px] rounded-md text-[11px] font-semibold uppercase tracking-[0.04em] ${cfg.bg} ${cfg.text}`}>
      {cfg.pulse && (
        <span className="w-1 h-1 rounded-full bg-gs-accent animate-pulse shrink-0" />
      )}
      {value}
    </span>
  );
}
