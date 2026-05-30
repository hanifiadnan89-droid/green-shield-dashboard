import QuoteDocumentsSection from './QuoteDocumentsSection.jsx';
import PrepGuidesSection from './PrepGuidesSection.jsx';
import FutureSection from './FutureSection.jsx';

export default function StepPreviewDocuments({ selectedLead, selectedPrepGuides, onTogglePrepGuide }) {
  return (
    <div>
      <p className="section-label">
        <span className="section-label-bar bg-gs-purple" />
        Documents &amp; Attachments
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <QuoteDocumentsSection lead={selectedLead} prepGuideIndices={[...selectedPrepGuides]} />
        <PrepGuidesSection selected={selectedPrepGuides} onToggle={onTogglePrepGuide} />
        <FutureSection />
      </div>
    </div>
  );
}
