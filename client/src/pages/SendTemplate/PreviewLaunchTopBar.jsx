import { motion } from 'motion/react';
import { User, Layers, Clock, Mail, MessageSquare, Phone } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge.jsx';
import { enrichTemplate } from './templateWorkflow.js';
import { getChannelLabel } from './previewSendUtils.js';
import { leadInitials } from './sendLeadUtils.js';

const EASE = [0.22, 1, 0.36, 1];

function SummaryCard({ children, className = '', delay = 0 }) {
  return (
    <motion.div
      className={`send-preview-top-card ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export default function PreviewLaunchTopBar({ selectedLead, selectedTemplate, selectedChannel }) {
  const tmpl = enrichTemplate(selectedTemplate);

  return (
    <div className="send-preview-top">
      <SummaryCard delay={0}>
        <p className="send-preview-top__label">
          <User size={12} className="inline -mt-0.5 mr-1" />
          Customer
        </p>
        <div className="flex items-center gap-3 mt-2">
          <div className="send-preview-top__avatar">{leadInitials(selectedLead?.name)}</div>
          <div className="min-w-0">
            <p className="send-preview-top__title">{selectedLead?.name}</p>
            <p className="send-preview-top__meta flex items-center gap-1.5 mt-1">
              <Phone size={11} />
              {selectedLead?.phone || '—'}
            </p>
            {selectedLead?.email && (
              <p className="send-preview-top__meta flex items-center gap-1.5">
                <Mail size={11} />
                <span className="truncate">{selectedLead.email}</span>
              </p>
            )}
          </div>
        </div>
      </SummaryCard>

      <SummaryCard delay={0.06} className="send-preview-top-card--template">
        <p className="send-preview-top__label">
          <Layers size={12} className="inline -mt-0.5 mr-1" />
          Template
        </p>
        <p className={`send-preview-top__code ${tmpl.accentText}`}>{tmpl.code.toUpperCase()}</p>
        <p className={`send-preview-top__title text-base ${tmpl.accentText}`}>{tmpl.shortName}</p>
        <div className="flex flex-wrap gap-2 mt-2">
          <StatusBadge value={tmpl.code} />
          <span className="send-preview-top__pill">{getChannelLabel(selectedChannel)}</span>
        </div>
      </SummaryCard>

      <SummaryCard delay={0.12}>
        <p className="send-preview-top__label">
          <Clock size={12} className="inline -mt-0.5 mr-1" />
          Workflow
        </p>
        <p className="send-preview-top__title text-base">{tmpl.touchCount} touches</p>
        <p className="send-preview-top__meta mt-1">{tmpl.timelineDays}-day sequence via n8n</p>
        <div className="flex gap-3 mt-3">
          <span className="send-preview-top__channel">
            <MessageSquare size={12} />
            SMS
          </span>
          <span className="send-preview-top__channel">
            <Mail size={12} />
            Email
          </span>
        </div>
      </SummaryCard>
    </div>
  );
}
