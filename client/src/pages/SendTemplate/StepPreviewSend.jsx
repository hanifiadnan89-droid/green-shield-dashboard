import { useState } from 'react';
import { motion } from 'motion/react';
import PreviewLaunchTopBar from './PreviewLaunchTopBar.jsx';
import PreviewDocumentsWorkspace from './PreviewDocumentsWorkspace.jsx';
import PreviewCommunicationCenter from './PreviewCommunicationCenter.jsx';
import PreviewSendSidebar from './PreviewSendSidebar.jsx';

const EASE = [0.22, 1, 0.36, 1];

export default function StepPreviewSend(props) {
  const [quoteState, setQuoteState] = useState(null);

  return (
    <motion.div
      className="send-preview-launch"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <PreviewLaunchTopBar
        selectedLead={props.selectedLead}
        selectedTemplate={props.selectedTemplate}
        selectedChannel={props.selectedChannel}
      />

      <div className="send-preview-launch__workspace">
        <PreviewDocumentsWorkspace
          selectedLead={props.selectedLead}
          selectedPrepGuides={props.selectedPrepGuides}
          onTogglePrepGuide={props.onTogglePrepGuide}
          onQuoteStateChange={setQuoteState}
        />

        <PreviewCommunicationCenter
          selectedLead={props.selectedLead}
          selectedTemplate={props.selectedTemplate}
        />

        <PreviewSendSidebar
          {...props}
          quoteState={quoteState}
        />
      </div>
    </motion.div>
  );
}
