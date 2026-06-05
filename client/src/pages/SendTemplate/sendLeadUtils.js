import { TEMPLATES } from './constants.js';

export function leadInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
}

export function getLeadStatusKey(lead) {
  if (lead?.stop === 'yes') return 'stopped';
  if ((lead?.error || '').trim() || lead?.status === 'error' || lead?.status === 'email_failed') {
    return 'error';
  }
  if (lead?.status === 'replied') return 'replied';
  if (lead?.sent && lead.sent !== 'imported') return 'sent';
  return 'new';
}

export function getNotesTemplate(lead) {
  const code = (lead?.notes || '').toLowerCase().trim();
  return TEMPLATES.find(t => t.code === code) || null;
}

export function getSuggestedNextStep(lead) {
  if (lead?.stop === 'yes') {
    return 'Clear the stop flag on this lead before sending a new template sequence.';
  }
  const tmpl = getNotesTemplate(lead);
  const hasSent = lead?.sent && lead.sent !== 'imported';
  if (hasSent && tmpl) {
    return `Continue the ${tmpl.label.split('—')[0].trim()} workflow or choose a different template in step 2.`;
  }
  if (hasSent) {
    return 'Follow-up was started — pick the best matching template for the next touch.';
  }
  if (tmpl) {
    return `Sheet notes suggest ${tmpl.code.toUpperCase()} — confirm or change template in step 2.`;
  }
  return 'Choose a template sequence in step 2 to start SMS and email outreach.';
}

export function getTemplateReadiness(lead) {
  if (lead?.stop === 'yes') {
    return { ready: false, label: 'Blocked', detail: 'Lead is stopped — sending disabled.' };
  }
  const hasPhone = !!(lead?.phone || '').trim();
  const hasEmail = !!(lead?.email || '').trim();
  if (!hasPhone && !hasEmail) {
    return { ready: false, label: 'No contacts', detail: 'Add a phone number or email on the lead sheet.' };
  }
  if (!hasPhone) {
    return { ready: true, label: 'Email ready', detail: 'Email available · SMS unavailable.' };
  }
  if (!hasEmail) {
    return { ready: true, label: 'SMS ready', detail: 'SMS available · email unavailable.' };
  }
  return { ready: true, label: 'Fully ready', detail: 'SMS + email channels available.' };
}

export function formatLeadSent(sent) {
  if (!sent || sent === 'imported') return null;
  const d = new Date(sent);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function daysSinceTouch(sent) {
  if (!sent || sent === 'imported') return null;
  const d = new Date(sent);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

export function getPreferredChannel(lead) {
  const hasPhone = !!(lead?.phone || '').trim();
  const hasEmail = !!(lead?.email || '').trim();
  if (hasPhone && hasEmail) return 'SMS + Email';
  if (hasPhone) return 'SMS';
  if (hasEmail) return 'Email';
  return '—';
}

export function hasReplySignal(lead) {
  const sms = (lead?.sms_reply || '').trim();
  const email = (lead?.email_reply || '').trim();
  return !!(sms && sms.length > 2) || !!(email && email.length > 2);
}
