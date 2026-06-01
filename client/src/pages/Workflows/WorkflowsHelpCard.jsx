import { ExternalLink } from 'lucide-react';
import { N8N_WORKFLOW_BASE } from './constants.js';

export default function WorkflowsHelpCard() {
  return (
    <div className="mt-6 card border-dashed bg-gs-bg">
      <p className="text-gs-muted text-sm mb-2 leading-relaxed">
        <strong className="text-gs-text">To add more workflows:</strong> Build them in n8n, then add their webhook URLs to the dashboard by editing <code className="text-gs-accent text-xs bg-gs-accent/10 border border-gs-accent/25 px-1.5 py-0.5 rounded font-mono">server/services/n8n.js</code>.
      </p>
      <a
        href={N8N_WORKFLOW_BASE}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-gs-accent text-sm hover:underline font-medium"
      >
        <ExternalLink size={13} /> Open n8n dashboard
      </a>
    </div>
  );
}
