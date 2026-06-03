import { motion } from 'motion/react';
import { FolderOpen } from 'lucide-react';
import QuoteDocumentsSection from './QuoteDocumentsSection.jsx';
import PrepGuidesSection from './PrepGuidesSection.jsx';

const EASE = [0.22, 1, 0.36, 1];

export default function PreviewDocumentsWorkspace({
  selectedLead,
  selectedPrepGuides,
  onTogglePrepGuide,
  onQuoteStateChange,
}) {
  return (
    <motion.section
      className="send-preview-docs"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <header className="send-preview-docs__header">
        <FolderOpen size={16} className="text-gs-accent" />
        <div>
          <h3 className="text-sm font-semibold text-gs-text">Documents &amp; attachments</h3>
          <p className="text-xs text-gs-muted">Quotes, prep guides, pricing, and service address</p>
        </div>
      </header>

      <div className="send-preview-docs__stack">
        <QuoteDocumentsSection
          lead={selectedLead}
          prepGuideIndices={[...selectedPrepGuides]}
          onStateChange={onQuoteStateChange}
          variant="preview"
        />
        <PrepGuidesSection
          selected={selectedPrepGuides}
          onToggle={onTogglePrepGuide}
          variant="preview"
        />
      </div>
    </motion.section>
  );
}
