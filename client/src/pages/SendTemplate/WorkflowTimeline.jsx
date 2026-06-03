import { motion } from 'motion/react';
import { Mail, MessageSquare, User } from 'lucide-react';

const EASE = [0.22, 1, 0.36, 1];

function ChannelIcons({ channels }) {
  if (!channels?.length) return null;
  return (
    <span className="send-workflow-timeline__channels">
      {channels.includes('sms') && <MessageSquare size={11} aria-label="SMS" />}
      {channels.includes('email') && <Mail size={11} aria-label="Email" />}
    </span>
  );
}

export default function WorkflowTimeline({ steps }) {
  if (!steps?.length) return null;

  return (
    <div className="send-workflow-timeline" aria-label="Workflow sequence">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <motion.div
            key={step.id}
            className="send-workflow-timeline__row"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 + index * 0.06, duration: 0.28, ease: EASE }}
          >
            <div className="send-workflow-timeline__rail">
              <motion.div
                className={`send-workflow-timeline__node ${step.isLead ? 'send-workflow-timeline__node--lead' : ''}`}
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1 + index * 0.06, type: 'spring', stiffness: 400, damping: 24 }}
              >
                {step.isLead ? <User size={12} /> : (step.day != null ? `D${step.day}` : '✓')}
              </motion.div>
              {!isLast && <div className="send-workflow-timeline__line" />}
            </div>
            <div className="send-workflow-timeline__content">
              <div className="flex items-center justify-between gap-2">
                <p className="send-workflow-timeline__title">{step.title}</p>
                <ChannelIcons channels={step.channels} />
              </div>
              <p className="send-workflow-timeline__subtitle">{step.subtitle}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
