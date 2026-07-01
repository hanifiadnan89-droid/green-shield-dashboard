import {
  hasRealReply,
  hasSent,
  isError,
  isReplied,
  isStopped,
  daysSince,
  leadName,
  leadRowNumber,
  relativeTime,
  templateKey,
  countInRange,
} from './dashboardUtils.js';

export function buildPriorityLeads(leadEntities) {
  const active = leadEntities.filter((lead) => !isStopped(lead) && !lead.isDeleted());

  const replied = active
    .filter((lead) => isReplied(lead))
    .map((lead) => ({
      ...lead.toJSON(),
      _group: 'replied',
      _reason: lead.hasSmsReply()
        ? 'SMS reply received'
        : lead.hasEmailReply()
          ? 'Email reply received'
          : 'Replied',
      _days: daysSince(lead.raw?.sent),
    }));

  const agreements = active
    .filter((lead) => templateKey(lead) === 'ag' && !isReplied(lead) && !isError(lead) && hasSent(lead))
    .map((lead) => ({
      ...lead.toJSON(),
      _group: 'agreement',
      _reason: 'Agreement sent — awaiting reply',
      _days: daysSince(lead.raw?.sent),
    }))
    .sort((a, b) => (b._days ?? 0) - (a._days ?? 0));

  const noAnswer = active
    .filter((lead) => templateKey(lead) === 'na' && !isReplied(lead) && !isError(lead) && hasSent(lead))
    .map((lead) => ({
      ...lead.toJSON(),
      _group: 'noAnswer',
      _reason: 'No answer — follow-up needed',
      _days: daysSince(lead.raw?.sent),
    }))
    .sort((a, b) => (b._days ?? 0) - (a._days ?? 0));

  const inSequence = active
    .filter((lead) => {
      const key = templateKey(lead);
      return ['rit', 'tm', 'iq'].includes(key) && !isReplied(lead) && !isError(lead) && hasSent(lead) && (daysSince(lead.raw?.sent) ?? 0) >= 2;
    })
    .map((lead) => ({
      ...lead.toJSON(),
      _group: 'inSequence',
      _reason: 'In sequence — follow-up due',
      _days: daysSince(lead.raw?.sent),
    }))
    .sort((a, b) => (b._days ?? 0) - (a._days ?? 0));

  const errors = leadEntities
    .filter((lead) => isError(lead))
    .map((lead) => ({
      ...lead.toJSON(),
      _group: 'error',
      _reason: normalizeText(lead.raw?.error) || 'Send failed',
      _days: daysSince(lead.raw?.sent),
    }));

  const totals = {
    replied: replied.length,
    agreements: agreements.length,
    noAnswer: noAnswer.length,
    inSequence: inSequence.length,
    errors: errors.length,
  };

  return {
    replied: replied.slice(0, 5),
    agreements: agreements.slice(0, 5),
    noAnswer: noAnswer.slice(0, 5),
    inSequence: inSequence.slice(0, 4),
    errors: errors.slice(0, 3),
    totals,
    isEmpty: Object.values(totals).every((value) => value === 0),
  };
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function buildLeadActivitySeries(leadEntities, days) {
  const points = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - i);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const newLeads = countInRange(leadEntities, start, end, () => true, (lead) => lead.raw?.sent ?? null);
    const replies = countInRange(leadEntities, start, end, (lead) => isReplied(lead), (lead) => lead.raw?.sent ?? null);
    const sent = countInRange(leadEntities, start, end, (lead) => hasSent(lead), (lead) => lead.raw?.sent ?? null);

    const followups = leadEntities.filter((lead) => {
      if (!hasSent(lead) || isReplied(lead) || isStopped(lead) || isError(lead)) return false;
      const sentAt = new Date(lead.raw?.sent);
      return !Number.isNaN(sentAt.getTime()) && sentAt < end;
    }).length;

    points.push({
      label: start.toLocaleDateString(undefined, { weekday: 'short' }),
      newLeads,
      replies,
      sent,
      followups,
      total: newLeads + replies + sent,
    });
  }

  return {
    points,
    max: Math.max(...points.map((point) => point.total), 1),
    legend: {
      newLeads: points.reduce((sum, point) => sum + point.newLeads, 0),
      replies: points.reduce((sum, point) => sum + point.replies, 0),
      sentTemplates: points.reduce((sum, point) => sum + point.sent, 0),
      followups: leadEntities.filter((lead) => hasSent(lead) && !isReplied(lead) && !isStopped(lead) && !isError(lead)).length,
    },
  };
}

export function buildTodayActivity(leadEntities, priority) {
  const items = [];

  const sentActivityLabel = (lead) => {
    const code = templateKey(lead);
    const name = leadName(lead);
    if (code === 'ag') return `Agreement Sent – ${name}`;
    if (code === 'iq') return `Quote Created – ${name}`;
    if (code === 'rit') return `Rodent & Insect Triennial – ${name}`;
    if (code === 'tm') return `Tick & Mosquito – ${name}`;
    if (code === 'na') return `No Answer – ${name}`;
    return `Template Sent – ${name}`;
  };

  const replyActivityLabel = (lead) => {
    if (hasRealReply(lead?.email_reply) && !hasRealReply(lead?.sms_reply)) return `Email Reply – ${leadName(lead)}`;
    return `Customer Replied – ${leadName(lead)}`;
  };

  const activityBase = (lead, type, text, ts = lead.raw?.sent) => ({
    id: `${type}-${leadRowNumber(lead) ?? lead.row_number ?? lead.raw?.row_number}`,
    type,
    text,
    time: ts ? relativeTime(ts) : 'Today',
    ts,
    rowNumber: leadRowNumber(lead) ?? lead.row_number ?? lead.raw?.row_number,
    leadName: leadName(lead),
    notes: templateKey(lead),
    replyChannel: type === 'reply'
      ? (hasRealReply(lead?.email_reply) && !hasRealReply(lead?.sms_reply) ? 'email' : 'sms')
      : null,
  });

  for (const lead of priority.replied.slice(0, 2)) {
    items.push(activityBase(lead, 'reply', replyActivityLabel(lead)));
  }

  const recentSent = [...leadEntities]
    .filter((lead) => hasSent(lead))
    .sort((a, b) => new Date(b.raw?.sent) - new Date(a.raw?.sent))
    .slice(0, 2);

  for (const lead of recentSent) {
    items.push(activityBase(lead, 'sent', sentActivityLabel(lead)));
  }

  for (const lead of priority.inSequence.slice(0, 1)) {
    items.push(activityBase(lead, 'overdue', `Follow-up Due – ${leadName(lead)}`));
  }

  for (const lead of leadEntities.filter((item) => !hasSent(item)).slice(0, 1)) {
    items.push(activityBase(lead, 'new', `New Lead Added – ${leadName(lead)}`, null));
  }

  for (const lead of priority.errors.slice(0, 1)) {
    items.push(activityBase(lead, 'error', `Send Issue – ${leadName(lead)}`));
  }

  const moreSent = [...leadEntities]
    .filter((lead) => hasSent(lead))
    .sort((a, b) => new Date(b.raw?.sent) - new Date(a.raw?.sent))
    .slice(2, 5);

  for (const lead of moreSent) {
    items.push(activityBase(lead, 'sent', sentActivityLabel(lead)));
  }

  return items
    .sort((a, b) => {
      const ta = a.ts ? new Date(a.ts).getTime() : Date.now();
      const tb = b.ts ? new Date(b.ts).getTime() : Date.now();
      return tb - ta;
    })
    .slice(0, 12);
}
