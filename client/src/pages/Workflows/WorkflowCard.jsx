import { ExternalLink } from 'lucide-react';
import { getN8nWorkflowUrl, getWorkflowTypeMeta } from './constants.js';
import WorkflowStatusBadge from './WorkflowStatusBadge.jsx';
import WorkflowTypeBadge from './WorkflowTypeBadge.jsx';

export default function WorkflowCard({ workflow: wf }) {
  const meta = getWorkflowTypeMeta(wf.type);
  const Icon = meta.icon;

  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className={`p-2.5 rounded-xl border shrink-0 ${meta.bg}`}>
            <Icon size={18} className={meta.text} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1.5">
              <h3 className="font-semibold text-gs-text">{wf.name}</h3>
              <WorkflowStatusBadge active={wf.active} />
            </div>
            <p className="text-gs-muted text-sm mb-2.5 leading-relaxed">{wf.description}</p>
            <div className="flex items-center gap-3 flex-wrap">
              <WorkflowTypeBadge meta={meta} />
              {wf.webhookUrl && (
                <span className="text-xs text-gs-muted font-mono truncate max-w-[300px] bg-gs-bg border border-gs-border px-2 py-0.5 rounded">
                  {wf.webhookUrl}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={getN8nWorkflowUrl(wf.id)}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost text-xs gap-1.5"
          >
            <ExternalLink size={12} /> Open in n8n
          </a>
        </div>
      </div>
    </div>
  );
}
