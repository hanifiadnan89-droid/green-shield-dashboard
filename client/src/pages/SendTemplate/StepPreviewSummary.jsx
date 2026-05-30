export default function StepPreviewSummary({ selectedLead, selectedTemplate }) {
  return (
    <div className="max-w-3xl grid grid-cols-2 gap-4">
      <div className="card p-4">
        <p className="type-label-sm text-gs-muted mb-1 font-normal tracking-normal">Lead</p>
        <p className="type-body-sm font-semibold text-gs-text">{selectedLead.name}</p>
        <p className="type-label-sm text-gs-muted font-normal tracking-normal">{selectedLead.phone}</p>
        {selectedLead.email && (
          <p className="type-label-sm text-gs-muted font-normal tracking-normal">{selectedLead.email}</p>
        )}
      </div>
      <div className={`card p-4 ${selectedTemplate.activeBg}`}>
        <p className="type-label-sm text-gs-muted mb-1 font-normal tracking-normal">Template</p>
        <p className={`type-body-sm font-semibold ${selectedTemplate.accentText}`}>{selectedTemplate.label}</p>
        <p className="type-label-sm text-gs-muted mt-0.5 font-normal tracking-normal">{selectedTemplate.description}</p>
      </div>
    </div>
  );
}
