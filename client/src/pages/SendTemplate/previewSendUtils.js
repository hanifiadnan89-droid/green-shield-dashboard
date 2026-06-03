import { CHANNELS } from './constants.js';

export function parseMoney(value) {
  const n = parseFloat(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isNaN(n) ? 0 : n;
}

export function formatMoney(value) {
  const n = parseMoney(value);
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export function computeFinalQuote(pricing) {
  const initial = parseMoney(pricing?.initial);
  const discount = parseMoney(pricing?.discounted);
  return Math.max(0, initial - discount);
}

export function getChannelLabel(code) {
  return CHANNELS.find(c => c.code === code)?.label || code;
}

export function buildLaunchChecklist({
  selectedLead,
  selectedTemplate,
  selectedPrepGuides,
  quoteDocSelected,
  selectedQuote,
  selectedChannel,
  stopBlocked,
}) {
  const attachments = (selectedPrepGuides?.size > 0) || !!quoteDocSelected || !!selectedQuote;
  return [
    { id: 'lead', label: 'Customer selected', ok: !!selectedLead },
    { id: 'template', label: 'Template selected', ok: !!selectedTemplate },
    { id: 'docs', label: 'Documents ready', ok: attachments, optional: !attachments },
    { id: 'comms', label: 'Communication previewed', ok: !!selectedTemplate },
    { id: 'channel', label: 'Channel configured', ok: !!selectedChannel },
    { id: 'send', label: 'Ready to launch', ok: !stopBlocked && !!selectedChannel && !!selectedTemplate },
  ];
}
