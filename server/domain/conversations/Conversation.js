function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseTimeMs(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function normalizeMessage(message) {
  if (!message || typeof message !== 'object') return null;
  const direction = message.direction === 'outbound' ? 'outbound' : 'inbound';
  const channel = message.channel === 'email' ? 'email' : 'sms';
  const body = normalizeText(message.body || message.text);
  if (!body) return null;
  return {
    ...message,
    direction,
    channel,
    body,
    ts: message.ts || message.receivedAt || message.timestamp || null,
    receivedAt: message.receivedAt || null,
    sender: message.sender || null,
    status: message.status || null,
    meta: message.meta && typeof message.meta === 'object' ? { ...message.meta } : undefined,
    attachments: Array.isArray(message.attachments) ? [...message.attachments] : [],
    tags: Array.isArray(message.tags) ? [...message.tags] : [],
  };
}

function sortMessages(messages) {
  return [...messages].sort((a, b) => {
    const aMs = parseTimeMs(a.receivedAt || a.ts);
    const bMs = parseTimeMs(b.receivedAt || b.ts);
    if (aMs == null && bMs == null) return 0;
    if (aMs == null) return 1;
    if (bMs == null) return -1;
    return aMs - bMs;
  });
}

function cloneMessage(message) {
  if (!message) return null;
  return {
    ...message,
    meta: message.meta && typeof message.meta === 'object' ? { ...message.meta } : message.meta,
    attachments: Array.isArray(message.attachments) ? [...message.attachments] : [],
    tags: Array.isArray(message.tags) ? [...message.tags] : [],
  };
}

function stableMessageTime(message) {
  return message?.ts || message?.receivedAt || null;
}

function trimBody(body) {
  return normalizeText(body);
}

function isRealReplyText(text) {
  const t = trimBody(text);
  return t.length > 0 && t !== '.' && t !== 'yes';
}

function humanizeStatus(status) {
  const normalized = normalizeText(status).toLowerCase();
  if (!normalized) return 'Active';
  return normalized
    .split(/[\s_-]+/)
    .map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1) : '')
    .join(' ')
    .trim() || 'Active';
}

export class Conversation {
  constructor(messages = [], metadata = {}, lead = null) {
    this._messages = sortMessages((Array.isArray(messages) ? messages : [])
      .map(normalizeMessage)
      .filter(Boolean));
    this._metadata = metadata && typeof metadata === 'object' ? { ...metadata } : {};
    this._lead = lead && typeof lead === 'object' ? { ...lead } : null;
  }

  static fromMessages(messages, metadata = {}, lead = null) {
    return new Conversation(messages, metadata, lead);
  }

  toJSON() {
    return {
      messages: this.messages(),
      metadata: this.metadata(),
      lead: this.lead(),
      channel: this.channel(),
      hasSms: this.hasSms(),
      hasEmail: this.hasEmail(),
      hasInbound: this.hasInbound(),
      hasOutbound: this.hasOutbound(),
      lastMessage: this.lastMessage(),
      lastInbound: this.lastInbound(),
      lastOutbound: this.lastOutbound(),
      latestCustomerMessage: this.latestCustomerMessage(),
      latestAgentMessage: this.latestAgentMessage(),
      lastActivityAt: this.lastActivityAt(),
      firstActivityAt: this.firstActivityAt(),
      summary: this.summary(),
      preview: this.preview(),
      requiresReply: this.requiresReply(),
      customerWaiting: this.customerWaiting(),
      responseTime: this.responseTime(),
      messageCount: this.messageCount(),
      inboundCount: this.inboundCount(),
      outboundCount: this.outboundCount(),
      attachments: this.attachments(),
      tags: this.tags(),
      displayStatus: this.displayStatus(),
      computedStatus: this.computedStatus(),
      unread: this.isUnread(),
      lastReadAt: this.lastReadAt(),
      lastReadInboundKey: this.lastReadInboundKey(),
      readInboundKeys: this.readInboundKeys(),
      lastInboundAt: this.lastInboundAt(),
      lastOutboundAt: this.lastOutboundAt(),
    };
  }

  messages() {
    return this._messages.map(cloneMessage);
  }

  metadata() {
    const meta = this._metadata || {};
    return {
      ...meta,
      readInboundKeys: Array.isArray(meta.readInboundKeys) ? [...meta.readInboundKeys] : [],
      tags: Array.isArray(meta.tags) ? [...meta.tags] : undefined,
    };
  }

  lead() {
    return this._lead ? { ...this._lead } : null;
  }

  channel() {
    if (this.hasSms() && this.hasEmail()) return 'mixed';
    if (this.hasEmail()) return 'email';
    if (this.hasSms()) return 'sms';
    const metaChannel = normalizeText(this._metadata.channel).toLowerCase();
    if (metaChannel) return metaChannel;
    return 'none';
  }

  hasSms() {
    return this._messages.some((message) => message.channel === 'sms')
      || isRealReplyText(this._lead?.sms_reply)
      || normalizeText(this._metadata.channel).toLowerCase() === 'sms';
  }

  hasEmail() {
    return this._messages.some((message) => message.channel === 'email')
      || isRealReplyText(this._lead?.email_reply)
      || normalizeText(this._metadata.channel).toLowerCase() === 'email';
  }

  hasInbound() {
    return this._messages.some((message) => message.direction === 'inbound')
      || isRealReplyText(this._lead?.sms_reply)
      || isRealReplyText(this._lead?.email_reply);
  }

  hasOutbound() {
    return this._messages.some((message) => message.direction === 'outbound');
  }

  lastMessage() {
    const last = this._messages[this._messages.length - 1] || null;
    return cloneMessage(last) || cloneMessage(this._metadata.lastMessage) || null;
  }

  lastInbound() {
    for (let i = this._messages.length - 1; i >= 0; i -= 1) {
      if (this._messages[i].direction === 'inbound') {
        return cloneMessage(this._messages[i]);
      }
    }
    return cloneMessage(this._metadata.lastInbound) || null;
  }

  lastOutbound() {
    for (let i = this._messages.length - 1; i >= 0; i -= 1) {
      if (this._messages[i].direction === 'outbound') {
        return cloneMessage(this._messages[i]);
      }
    }
    return cloneMessage(this._metadata.lastOutbound) || null;
  }

  latestCustomerMessage() {
    return this.lastInbound();
  }

  latestAgentMessage() {
    return this.lastOutbound();
  }

  lastActivityAt() {
    return this._metadata.lastAt
      || this.lastMessage()?.receivedAt
      || this.lastMessage()?.ts
      || this._lead?.updatedAt
      || this._lead?.updated_at
      || this._lead?.sent
      || null;
  }

  firstActivityAt() {
    return this._metadata.firstAt
      || this._messages[0]?.receivedAt
      || this._messages[0]?.ts
      || this._lead?.createdAt
      || this._lead?.sent
      || null;
  }

  messageCount() {
    return this._messages.length;
  }

  inboundCount() {
    return this._messages.filter((message) => message.direction === 'inbound').length;
  }

  outboundCount() {
    return this._messages.filter((message) => message.direction === 'outbound').length;
  }

  attachments() {
    const all = [];
    for (const message of this._messages) {
      if (Array.isArray(message.attachments) && message.attachments.length) {
        all.push(...message.attachments.map((item) => ({ ...item })));
      }
      if (Array.isArray(message.meta?.attachments) && message.meta.attachments.length) {
        all.push(...message.meta.attachments.map((item) => ({ ...item })));
      }
    }
    if (Array.isArray(this._metadata.attachments) && this._metadata.attachments.length) {
      all.push(...this._metadata.attachments.map((item) => ({ ...item })));
    }
    return all;
  }

  tags() {
    const tags = [
      ...(Array.isArray(this._metadata.tags) ? this._metadata.tags : []),
      ...(Array.isArray(this._lead?.tags) ? this._lead.tags : []),
    ];
    return [...new Set(tags.map((tag) => normalizeText(tag)).filter(Boolean))];
  }

  preview() {
    const metaPreview = normalizeText(this._metadata.preview);
    if (metaPreview) return metaPreview;
    const last = this.lastMessage();
    if (last?.body) {
      return last.body.length > 120 ? `${last.body.slice(0, 120)}…` : last.body;
    }
    const leadPreview = normalizeText(this._lead?.sms_reply || this._lead?.email_reply);
    if (leadPreview) {
      return leadPreview.length > 120 ? `${leadPreview.slice(0, 120)}…` : leadPreview;
    }
    return '';
  }

  customerWaiting() {
    const lastCustomer = this.latestCustomerMessage();
    const lastAgent = this.latestAgentMessage();
    if (!lastAgent) return false;
    if (!lastCustomer) return true;
    const customerMs = parseTimeMs(lastCustomer.receivedAt || lastCustomer.ts) ?? 0;
    const agentMs = parseTimeMs(lastAgent.receivedAt || lastAgent.ts) ?? 0;
    return agentMs > customerMs;
  }

  requiresReply() {
    const lastCustomer = this.latestCustomerMessage();
    const lastAgent = this.latestAgentMessage();
    if (!lastCustomer) return false;
    if (!lastAgent) return true;
    const customerMs = parseTimeMs(lastCustomer.receivedAt || lastCustomer.ts) ?? 0;
    const agentMs = parseTimeMs(lastAgent.receivedAt || lastAgent.ts) ?? 0;
    return customerMs > agentMs;
  }

  responseTime() {
    const customer = this.latestCustomerMessage();
    const agent = this.latestAgentMessage();
    if (!customer && !agent) return null;
    const customerMs = parseTimeMs(customer?.receivedAt || customer?.ts);
    const agentMs = parseTimeMs(agent?.receivedAt || agent?.ts);
    const awaitingReply = this.requiresReply();
    const waitingOnCustomer = this.customerWaiting();

    if (customerMs != null && agentMs != null) {
      return {
        ms: Math.abs(agentMs - customerMs),
        awaitingReply,
        waitingOnCustomer,
        from: customerMs <= agentMs ? 'customer' : 'agent',
        to: customerMs <= agentMs ? 'agent' : 'customer',
      };
    }

    const lastAt = parseTimeMs(this.lastActivityAt());
    if (lastAt != null) {
      return {
        ms: Date.now() - lastAt,
        awaitingReply,
        waitingOnCustomer,
        from: awaitingReply ? 'customer' : (waitingOnCustomer ? 'agent' : null),
        to: awaitingReply ? 'agent' : (waitingOnCustomer ? 'customer' : null),
      };
    }

    return null;
  }

  lastReadAt() {
    return this._metadata.lastReadAt
      || this._lead?.replies_last_read_at
      || null;
  }

  lastReadInboundKey() {
    return this._metadata.lastReadInboundKey ?? null;
  }

  readInboundKeys() {
    return Array.isArray(this._metadata.readInboundKeys) ? [...this._metadata.readInboundKeys] : [];
  }

  lastInboundAt() {
    return stableMessageTime(this.lastInbound());
  }

  lastOutboundAt() {
    return stableMessageTime(this.lastOutbound());
  }

  isUnread() {
    const latestInbound = this.lastInbound();
    if (!latestInbound) return false;
    const latestKey = `${latestInbound.channel === 'email' ? 'email' : 'sms'}|${latestInbound.ts || ''}|${trimBody(latestInbound.body)}`;
    const readKeys = this.readInboundKeys();
    if (readKeys.includes(latestKey)) return false;

    const inboundMs = parseTimeMs(stableMessageTime(latestInbound));
    const readMs = parseTimeMs(this.lastReadAt());
    if (readMs != null && inboundMs != null) {
      return inboundMs > readMs;
    }

    const readKey = this.lastReadInboundKey();
    if (!readKey) return true;
    return readKey !== latestKey;
  }

  computedStatus() {
    if (this.isUnread()) return 'unread';
    if (this.requiresReply()) return 'requires_reply';
    if (this.customerWaiting()) return 'waiting_on_customer';
    if (this.hasInbound()) return 'replied';
    if (this.hasOutbound()) return 'sent';
    return 'empty';
  }

  displayStatus() {
    const status = this.computedStatus();
    const labels = {
      unread: 'Unread',
      requires_reply: 'Requires Reply',
      waiting_on_customer: 'Waiting on Customer',
      replied: 'Replied',
      sent: 'Sent',
      empty: 'No Messages',
    };
    return labels[status] || humanizeStatus(status);
  }

  summary() {
    return {
      preview: this.preview(),
      lastAt: this.lastActivityAt(),
      lastMessage: this.lastMessage(),
      lastInbound: this.lastInbound(),
      lastOutbound: this.lastOutbound(),
      lastInboundAt: this.lastInboundAt(),
      lastOutboundAt: this.lastOutboundAt(),
      firstActivityAt: this.firstActivityAt(),
      messageCount: this.messageCount(),
      inboundCount: this.inboundCount(),
      outboundCount: this.outboundCount(),
      hasSms: this.hasSms(),
      hasEmail: this.hasEmail(),
      hasInbound: this.hasInbound(),
      hasOutbound: this.hasOutbound(),
      channel: this.channel(),
      unread: this.isUnread(),
      requiresReply: this.requiresReply(),
      customerWaiting: this.customerWaiting(),
      responseTime: this.responseTime(),
      computedStatus: this.computedStatus(),
      displayStatus: this.displayStatus(),
    };
  }
}

export default Conversation;
