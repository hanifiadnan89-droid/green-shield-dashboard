import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import { TEMPLATES } from './constants.js';
import { getEnrichedTemplates } from './templateWorkflow.js';
import SelectedLeadSummary from './SelectedLeadSummary.jsx';
import TemplateWorkflowCard from './TemplateWorkflowCard.jsx';
import TemplatePreviewPanel from './TemplatePreviewPanel.jsx';

const EASE = [0.22, 1, 0.36, 1];

export default function StepChooseTemplate({
  selectedLead,
  preselected,
  fromIntake = false,
  highlightedTemplate,
  onHighlightTemplate,
  onChangeLead,
  onContinueToPreview,
}) {
  const templates = useMemo(() => getEnrichedTemplates(), []);
  const stopBlocked = selectedLead?.stop === 'yes';
  const [focusedTemplate, setFocusedTemplate] = useState(highlightedTemplate || templates[0] || null);

  useEffect(() => {
    if (highlightedTemplate) setFocusedTemplate(highlightedTemplate);
  }, [highlightedTemplate]);

  useEffect(() => {
    setFocusedTemplate(prev => prev || templates[0] || null);
  }, [templates]);

  function handleFocusTemplate(t) {
    setFocusedTemplate(t);
    onHighlightTemplate?.(t);
  }

  function handleSelectTemplate(t) {
    setFocusedTemplate(t);
    onHighlightTemplate?.(t);
  }

  return (
    <motion.div
      className="send-choose-tmpl"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <SelectedLeadSummary
        lead={selectedLead}
        preselected={preselected || fromIntake}
        onChangeLead={onChangeLead}
      />

      {stopBlocked && (
        <motion.div
          className="send-choose-tmpl__alert"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
        >
          <AlertTriangle size={16} className="shrink-0" />
          <span>
            This lead has <strong>stop=yes</strong>. Remove the stop flag before sending.
          </span>
        </motion.div>
      )}

      <div className="send-choose-tmpl__workspace">
        <div className="send-choose-tmpl__list-panel">
          <div className="send-choose-tmpl__list-header">
            <h3 className="text-sm font-semibold text-gs-text">Workflow templates</h3>
            <p className="text-xs text-gs-muted mt-0.5">
              {TEMPLATES.length} sequences · SMS + email via n8n
            </p>
          </div>

          <LayoutGroup>
            <ul className="send-choose-tmpl__cards" role="list">
              <AnimatePresence mode="popLayout">
                {templates.map((t, index) => (
                  <TemplateWorkflowCard
                    key={t.code}
                    template={t}
                    index={index}
                    selected={focusedTemplate?.code === t.code}
                    disabled={stopBlocked}
                    onSelect={handleSelectTemplate}
                    onHover={handleFocusTemplate}
                  />
                ))}
              </AnimatePresence>
            </ul>
          </LayoutGroup>
        </div>

        <TemplatePreviewPanel
          template={focusedTemplate}
          lead={selectedLead}
          stopBlocked={stopBlocked}
          onContinue={onContinueToPreview}
        />
      </div>
    </motion.div>
  );
}
