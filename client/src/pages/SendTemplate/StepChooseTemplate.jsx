import { ChevronRight } from 'lucide-react';
import { TEMPLATES } from './constants.js';

export default function StepChooseTemplate({
  selectedLead,
  preselected,
  selectedTemplate,
  onChangeLead,
  onSelectTemplate,
}) {
  const stopBlocked = selectedLead?.stop === 'yes';

  return (
    <div className="max-w-3xl space-y-4">
      {selectedLead && (
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="type-label-sm text-gs-muted mb-0.5 font-normal tracking-normal">Selected Lead</p>
            <p className="type-body-sm font-medium text-gs-text">{selectedLead.name}</p>
            <p className="type-label-sm text-gs-muted font-normal tracking-normal">
              {selectedLead.phone}{selectedLead.email ? ` • ${selectedLead.email}` : ''}
            </p>
          </div>
          {!preselected && (
            <button type="button" onClick={onChangeLead} className="btn-ghost type-label-sm tracking-normal">
              Change
            </button>
          )}
        </div>
      )}
      {stopBlocked && (
        <div className="bg-gs-danger/10 border border-gs-danger/30 rounded-lg px-4 py-3 text-gs-danger type-body-sm">
          ⚠ This lead has <strong>stop=yes</strong>. Remove the stop flag first before sending.
        </div>
      )}
      <div className="grid gap-3">
        {TEMPLATES.map(t => (
          <button
            key={t.code}
            type="button"
            onClick={() => onSelectTemplate(t)}
            disabled={stopBlocked}
            className={`card text-left hover:border-opacity-70 transition-all p-4 cursor-pointer group ${
              selectedTemplate?.code === t.code ? `border ${t.activeBg}` : 'hover:border-gs-muted/50'
            } ${stopBlocked ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${t.accentDot}`} />
                <span className={`type-body-sm font-semibold ${t.accentText}`}>{t.label}</span>
              </div>
              <ChevronRight size={14} className="text-gs-muted" />
            </div>
            <p className="type-label-sm text-gs-muted pl-4 font-normal tracking-normal">{t.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
