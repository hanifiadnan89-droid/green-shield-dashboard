const CONFIGS = {
  active:       { dot: 'bg-gs-accent',  ring: 'border-gs-accent/30',  bg: 'bg-gs-accent/12',  text: 'text-gs-accent'  },
  replied:      { dot: 'bg-gs-info',    ring: 'border-gs-info/30',    bg: 'bg-gs-info/12',    text: 'text-gs-info'    },
  stopped:      { dot: 'bg-gs-danger',  ring: 'border-gs-danger/30',  bg: 'bg-gs-danger/12',  text: 'text-gs-danger'  },
  error:        { dot: 'bg-gs-danger',  ring: 'border-gs-danger/30',  bg: 'bg-gs-danger/12',  text: 'text-gs-danger'  },
  email_failed: { dot: 'bg-gs-danger',  ring: 'border-gs-danger/30',  bg: 'bg-gs-danger/12',  text: 'text-gs-danger'  },
  archived:     { dot: 'bg-gs-muted',   ring: 'border-gs-muted/20',   bg: 'bg-gs-muted/10',   text: 'text-gs-muted'   },
  imported:     { dot: 'bg-gs-muted',   ring: 'border-gs-muted/20',   bg: 'bg-gs-muted/10',   text: 'text-gs-muted'   },
  sent:         { dot: 'bg-gs-accent',  ring: 'border-gs-accent/30',  bg: 'bg-gs-accent/12',  text: 'text-gs-accent'  },
  yes:          { dot: 'bg-gs-accent',  ring: 'border-gs-accent/30',  bg: 'bg-gs-accent/12',  text: 'text-gs-accent'  },
  no:           { dot: 'bg-gs-danger',  ring: 'border-gs-danger/30',  bg: 'bg-gs-danger/12',  text: 'text-gs-danger'  },
  ag:           { dot: 'bg-gs-accent',  ring: 'border-gs-accent/30',  bg: 'bg-gs-accent/12',  text: 'text-gs-accent'  },
  na:           { dot: 'bg-gs-warn',    ring: 'border-gs-warn/30',    bg: 'bg-gs-warn/12',    text: 'text-gs-warn'    },
  rit:          { dot: 'bg-gs-info',    ring: 'border-gs-info/30',    bg: 'bg-gs-info/12',    text: 'text-gs-info'    },
  'iq':         { dot: 'bg-gs-purple',  ring: 'border-gs-purple/30',  bg: 'bg-gs-purple/12',  text: 'text-gs-purple'  },
  't/m':        { dot: 'bg-pink-400',   ring: 'border-pink-500/30',   bg: 'bg-pink-500/12',   text: 'text-pink-400'   },
};

const FALLBACK = { dot: 'bg-gs-muted', ring: 'border-gs-border', bg: 'bg-gs-border/50', text: 'text-gs-text' };

export default function StatusBadge({ value }) {
  if (!value) return <span className="text-gs-muted text-xs">—</span>;
  const key = value.toString().toLowerCase().trim();
  const cfg = CONFIGS[key] || FALLBACK;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.ring} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {value}
    </span>
  );
}
