export const LIST_LIMIT = 200;

export const ACTION_LABELS = {
  template_sent: 'Template Sent',
  lead_added: 'Lead Added',
  lead_updated: 'Lead Updated',
  lead_stopped: 'Lead Stopped',
  lead_unstopped: 'Lead Unstopped',
  lead_deleted: 'Lead Deleted',
  agreement_signing_sent: 'Agreement Signing Link Sent',
  agreement_signed: 'Agreement Signed',
};

export function getActionLabel(action) {
  return ACTION_LABELS[action] || action;
}
