import { TEMPLATES } from './constants.js';

/** Enriched workflow metadata for Step 2 UI (previews are representative, not live n8n copy). */
export const TEMPLATE_WORKFLOW_META = {
  ag: {
    shortName: 'Agreement Sent',
    workflowType: 'Agreement follow-up',
    workflowBadge: 'Follow-up',
    touchCount: 3,
    timelineDays: 5,
    channels: ['sms', 'email'],
    smsPreview: 'Hi {{name}}, following up on the service agreement we sent. Reply YES to confirm or call us with questions.',
    emailPreview: {
      subject: 'Your Green Shield service agreement',
      body: 'Hi {{name}},\n\nWe wanted to follow up on the agreement we sent. If you have any questions about coverage or scheduling, reply to this email or text us back.\n\n— Green Shield Team',
    },
    timeline: [
      { day: 0, title: 'Initial outreach', detail: 'SMS + Email', channels: ['sms', 'email'] },
      { day: 2, title: 'Follow-up', detail: 'Reminder SMS', channels: ['sms'] },
      { day: 5, title: 'Final follow-up', detail: 'Closing SMS', channels: ['sms'] },
      { day: null, title: 'Sequence complete', detail: 'Awaiting reply', channels: [] },
    ],
  },
  na: {
    shortName: 'No Answer Follow-Up',
    workflowType: 'No-answer outreach',
    workflowBadge: 'Outreach',
    touchCount: 3,
    timelineDays: 5,
    channels: ['sms', 'email'],
    smsPreview: 'Hi {{name}}, we tried reaching you about your pest control request. Text back when you have a moment.',
    emailPreview: {
      subject: 'Green Shield — we tried to reach you',
      body: 'Hi {{name}},\n\nWe attempted to contact you regarding your inquiry. When convenient, reply here or call our office to schedule service.\n\n— Green Shield Team',
    },
    timeline: [
      { day: 0, title: 'Initial outreach', detail: 'SMS + Email', channels: ['sms', 'email'] },
      { day: 2, title: 'Follow-up', detail: 'Reminder SMS', channels: ['sms'] },
      { day: 5, title: 'Final follow-up', detail: 'Closing SMS', channels: ['sms'] },
      { day: null, title: 'Sequence complete', detail: 'Awaiting reply', channels: [] },
    ],
  },
  rit: {
    shortName: 'Rodent & Insect Triannual',
    workflowType: 'Service proposal',
    workflowBadge: 'Proposal',
    touchCount: 3,
    timelineDays: 5,
    channels: ['sms', 'email'],
    smsPreview: 'Hi {{name}}, your Rodent & Insect Triannual quote from Green Shield is ready. Check your email for details.',
    emailPreview: {
      subject: 'Your RIT service proposal — Green Shield',
      body: 'Hi {{name}},\n\nAttached is your Rodent & Insect Triannual service overview and pricing. Reply if you would like to schedule your first visit.\n\n— Green Shield Team',
    },
    timeline: [
      { day: 0, title: 'Proposal sent', detail: 'SMS + Email', channels: ['sms', 'email'] },
      { day: 2, title: 'Follow-up', detail: 'Reminder SMS', channels: ['sms'] },
      { day: 5, title: 'Final follow-up', detail: 'Closing SMS', channels: ['sms'] },
      { day: null, title: 'Sequence complete', detail: 'Awaiting reply', channels: [] },
    ],
  },
  't/m': {
    shortName: 'Tick & Mosquito',
    workflowType: 'Service proposal',
    workflowBadge: 'Proposal',
    touchCount: 3,
    timelineDays: 5,
    channels: ['sms', 'email'],
    smsPreview: 'Hi {{name}}, your Tick & Mosquito program quote is in your inbox. Green Shield — reply with any questions.',
    emailPreview: {
      subject: 'Tick & Mosquito Monthly — Green Shield',
      body: 'Hi {{name}},\n\nYour Tick & Mosquito Monthly service proposal is ready. Review pricing and seasonal visit schedule in this message.\n\n— Green Shield Team',
    },
    timeline: [
      { day: 0, title: 'Proposal sent', detail: 'SMS + Email', channels: ['sms', 'email'] },
      { day: 2, title: 'Follow-up', detail: 'Reminder SMS', channels: ['sms'] },
      { day: 5, title: 'Final follow-up', detail: 'Closing SMS', channels: ['sms'] },
      { day: null, title: 'Sequence complete', detail: 'Awaiting reply', channels: [] },
    ],
  },
  iq: {
    shortName: 'Insect Quarterly',
    workflowType: 'Service proposal',
    workflowBadge: 'Proposal',
    touchCount: 3,
    timelineDays: 5,
    channels: ['sms', 'email'],
    smsPreview: 'Hi {{name}}, your Insect Quarterly plan details are in your email. Green Shield is here when you are ready.',
    emailPreview: {
      subject: 'Insect Quarterly service — Green Shield',
      body: 'Hi {{name}},\n\nPlease find your Insect Quarterly service proposal and pricing. We can schedule your first treatment at your convenience.\n\n— Green Shield Team',
    },
    timeline: [
      { day: 0, title: 'Proposal sent', detail: 'SMS + Email', channels: ['sms', 'email'] },
      { day: 2, title: 'Follow-up', detail: 'Reminder SMS', channels: ['sms'] },
      { day: 5, title: 'Final follow-up', detail: 'Closing SMS', channels: ['sms'] },
      { day: null, title: 'Sequence complete', detail: 'Awaiting reply', channels: [] },
    ],
  },
};

export function enrichTemplate(template) {
  if (!template) return null;
  const meta = TEMPLATE_WORKFLOW_META[template.code] || {};
  return { ...template, ...meta };
}

export function getEnrichedTemplates() {
  return TEMPLATES.map(enrichTemplate);
}

export function personalizePreview(text, lead) {
  if (!text) return '';
  const name = (lead?.name || 'there').split(/\s+/)[0] || 'there';
  return text.replace(/\{\{name\}\}/g, name);
}

export function getTimelineFlowSteps(template, lead) {
  const meta = TEMPLATE_WORKFLOW_META[template?.code];
  if (!meta?.timeline) return [];
  return [
    { id: 'lead', title: lead?.name || 'Lead', subtitle: 'Selected customer', isLead: true },
    ...meta.timeline.map((step, i) => ({
      id: `step-${i}`,
      day: step.day,
      title: step.title,
      subtitle: step.detail,
      channels: step.channels,
    })),
  ];
}
