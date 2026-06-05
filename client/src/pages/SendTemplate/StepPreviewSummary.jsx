export default function StepPreviewSummary({ selectedLead, selectedTemplate }) {
  return (
    <div className="max-w-3xl grid grid-cols-2 gap-4">
      <div className="send-command-panel">
        <p className="send-command-panel__label mb-1">Lead</p>
        <p className="type-body-sm font-semibold text-white/90">{selectedLead.name}</p>
        <p className="type-label-sm text-white/45 font-normal tracking-normal">{selectedLead.phone}</p>
        {selectedLead.email && (
          <p className="type-label-sm text-white/45 font-normal tracking-normal">{selectedLead.email}</p>
        )}
      </div>
      <div className="send-command-panel">
        <p className="send-command-panel__label mb-1">Template</p>
        <p className={`type-body-sm font-semibold ${selectedTemplate.accentText}`}>{selectedTemplate.label}</p>
        <p className="type-label-sm text-white/45 mt-0.5 font-normal tracking-normal">{selectedTemplate.description}</p>
      </div>
    </div>
  );
}
