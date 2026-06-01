import { describe, it, expect } from 'vitest';
import {
  deriveDashboardIntelligence,
  scoreHotLead,
} from './deriveDashboardIntelligence.js';

const base = {
  row_number: 1,
  name: 'Test Lead',
  stop: '',
  sent: new Date(Date.now() - 3 * 86400000).toISOString(),
  notes: 'na',
  sms_reply: '',
  email_reply: '',
  status: 'active',
  sold: '',
  error: '',
};

describe('deriveDashboardIntelligence', () => {
  it('counts action today as deduped unread SMS + errors', () => {
    const leads = [
      { ...base, row_number: 1, sms_reply: 'yes' },
      { ...base, row_number: 2, error: 'SMTP fail' },
      { ...base, row_number: 3, sms_reply: 'Call me', status: 'replied' },
    ];
    const isUnread = (l) => l.row_number === 1 || l.row_number === 3;
    const intel = deriveDashboardIntelligence(leads, { isUnreadReply: isUnread });
    expect(intel.actionToday).toBe(3);
  });

  it('does not double-count lead that is both unread and error', () => {
    const leads = [{ ...base, row_number: 9, sms_reply: 'Hi', error: 'fail' }];
    const intel = deriveDashboardIntelligence(leads, {
      isUnreadReply: () => true,
    });
    expect(intel.actionToday).toBe(1);
  });

  it('computes sent-to-reply conversion excluding imported', () => {
    const leads = [
      { ...base, row_number: 1, sent: '2024-01-01T00:00:00.000Z', sms_reply: 'yes' },
      { ...base, row_number: 2, sent: '2024-01-02T00:00:00.000Z' },
      { ...base, row_number: 3, sent: 'imported' },
    ];
    const intel = deriveDashboardIntelligence(leads);
    expect(intel.sentCount).toBe(2);
    expect(intel.repliedSentCount).toBe(1);
    expect(intel.sentToReplyPercent).toBe(50);
  });

  it('computes sold rate as sold / sent', () => {
    const leads = [
      { ...base, row_number: 1, sent: '2024-01-01T00:00:00.000Z', sold: 'yes' },
      { ...base, row_number: 2, sent: '2024-01-02T00:00:00.000Z' },
    ];
    const intel = deriveDashboardIntelligence(leads);
    expect(intel.soldCount).toBe(1);
    expect(intel.soldRatePercent).toBe(50);
  });

  it('counts agreements pending like deriveSalesStats', () => {
    const leads = [
      {
        ...base,
        row_number: 1,
        notes: 'ag',
        sent: new Date().toISOString(),
      },
      {
        ...base,
        row_number: 2,
        notes: 'ag',
        sent: new Date().toISOString(),
        sms_reply: 'yes',
      },
    ];
    const intel = deriveDashboardIntelligence(leads);
    expect(intel.agreementsPending).toBe(1);
  });

  it('counts overdue NA at 1+ days and sequence at 2+ days', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
    const leads = [
      { ...base, row_number: 1, notes: 'na', sent: twoDaysAgo },
      { ...base, row_number: 2, notes: 'rit', sent: twoDaysAgo },
      { ...base, row_number: 3, notes: 'na', sent: new Date().toISOString() },
    ];
    const intel = deriveDashboardIntelligence(leads);
    expect(intel.overdueFollowUps).toBe(2);
  });

  it('returns top 5 hot leads by score', () => {
    const leads = Array.from({ length: 8 }, (_, i) => ({
      ...base,
      row_number: i + 1,
      name: `Lead ${i}`,
      error: i === 0 ? 'x' : '',
      sms_reply: i === 1 ? 'unread' : '',
    }));
    const isUnread = (l) => l.row_number === 2;
    const intel = deriveDashboardIntelligence(leads, { isUnreadReply: isUnread });
    expect(intel.hotLeads.length).toBeLessThanOrEqual(5);
    expect(intel.hotLeads[0].lead.row_number).toBe(2);
  });
});

describe('scoreHotLead', () => {
  it('ignores stopped leads', () => {
    const { score } = scoreHotLead({ ...base, stop: 'yes' }, () => false);
    expect(score).toBe(0);
  });

  it('treats free-text SMS as replied but not unread without callback', () => {
    const lead = { ...base, sms_reply: 'Interested!' };
    const { score, reason } = scoreHotLead(lead, () => false);
    expect(score).toBeGreaterThan(0);
    expect(reason).toBe('Customer replied');
  });
});
