import { Workflow, Webhook, Mail, Database, Clock } from 'lucide-react';

export const N8N_WORKFLOW_BASE = 'https://leadsales.app.n8n.cloud';

export const TYPE_META = {
  webhook:        { icon: Webhook,   label: 'Webhook Trigger',       bg: 'bg-gs-accent/12 border-gs-accent/30',  text: 'text-gs-accent'  },
  imap:           { icon: Mail,      label: 'Email (IMAP) Trigger',  bg: 'bg-gs-info/12 border-gs-info/30',      text: 'text-gs-info'    },
  sheets_trigger: { icon: Database,  label: 'Google Sheets Trigger', bg: 'bg-gs-purple/12 border-gs-purple/30',  text: 'text-gs-purple'  },
  schedule:       { icon: Clock,     label: 'Schedule Trigger',      bg: 'bg-gs-warn/12 border-gs-warn/30',      text: 'text-gs-warn'    },
};

const FALLBACK_META = {
  icon: Workflow,
  label: null,
  bg: 'bg-gs-border/60 border-gs-border',
  text: 'text-gs-muted',
};

export function getWorkflowTypeMeta(type) {
  if (TYPE_META[type]) {
    return TYPE_META[type];
  }
  return {
    ...FALLBACK_META,
    label: type,
  };
}

export function getN8nWorkflowUrl(id) {
  return `${N8N_WORKFLOW_BASE}/workflow/${id}`;
}
