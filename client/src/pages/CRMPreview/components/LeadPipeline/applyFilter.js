import { daysSince } from '../../mockData.js';

export function applyFilter(leads, filter) {
  switch (filter) {
    case 'replied':
      return leads.filter(l => l.sms_reply === 'yes' || l.email_reply === 'yes' || l.status === 'replied');
    case 'sent':
      return leads.filter(l => l.sent && l.sent !== 'imported');
    case 'inprogress':
      return leads.filter(l => {
        if (l.stop === 'yes') return false;
        if (l.status === 'replied' || l.sms_reply === 'yes' || l.email_reply === 'yes') return false;
        if ((l.error && l.error.trim()) || l.status === 'error' || l.status === 'email_failed') return false;
        return !!(l.sent && l.sent !== 'imported');
      });
    case 'errors':
      return leads.filter(l => (l.error && l.error.trim()) || l.status === 'error' || l.status === 'email_failed');
    case 'stopped':
      return leads.filter(l => l.stop === 'yes' || l.status === 'stopped');
    case 'sold':
      return leads.filter(l => l.sold === 'yes');
    case 'day1':
      return leads.filter(l => daysSince(l.sent) === 0);
    case 'day2':
      return leads.filter(l => daysSince(l.sent) === 1);
    case 'day3': {
      return leads.filter(l => { const d = daysSince(l.sent); return d !== null && d >= 2; });
    }
    default:
      return leads;
  }
}
