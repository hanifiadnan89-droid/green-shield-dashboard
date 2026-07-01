import {
  canEditLead as canEditLeadAccess,
  canViewLead as canViewLeadAccess,
  getLeadVisibilityScope,
} from '../../services/leadAccess.js';
import { getLeadOwner } from '../../services/leadOwnership.js';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNumber(value) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
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

function asLower(value) {
  return normalizeText(value).toLowerCase();
}

export class Lead {
  constructor(rawLead = {}, context = null) {
    this.raw = rawLead && typeof rawLead === 'object' ? { ...rawLead } : {};
    this.context = context || null;
  }

  static fromRaw(rawLead, context = null) {
    return new Lead(rawLead, context);
  }

  rowNumber() {
    return normalizeNumber(this.raw.row_number ?? this.raw.rowNumber);
  }

  name() {
    return normalizeText(this.raw.name);
  }

  email() {
    return normalizeText(this.raw.email);
  }

  phone() {
    return normalizeText(this.raw.phone || this.raw.phone_formatted);
  }

  normalizedStatus() {
    return asLower(this.raw.status);
  }

  computedStatus() {
    if (this.isDeleted()) return 'deleted';
    if (this.isSold()) return 'sold';
    if (this.isStopped()) return 'stopped';
    if (this.hasAnyReply()) return 'replied';
    return this.normalizedStatus() || 'active';
  }

  displayStatus() {
    const status = this.computedStatus();
    const labels = {
      deleted: 'Deleted',
      sold: 'Sold',
      stopped: 'Stopped',
      replied: 'Replied',
      active: 'Active',
    };
    return labels[status] || humanizeStatus(status);
  }

  isDeleted() {
    return asLower(this.raw.deleted) === 'yes';
  }

  isSold() {
    return asLower(this.raw.sold) === 'yes';
  }

  isStopped() {
    return asLower(this.raw.stop) === 'yes' || this.normalizedStatus() === 'stopped';
  }

  hasSmsReply() {
    return normalizeText(this.raw.sms_reply) !== '';
  }

  hasEmailReply() {
    return normalizeText(this.raw.email_reply) !== '';
  }

  hasAnyReply() {
    return this.hasSmsReply() || this.hasEmailReply();
  }

  isActive() {
    return this.computedStatus() === 'active';
  }

  isActionable() {
    return !this.isDeleted() && !this.isSold() && !this.isStopped() && !this.hasAnyReply();
  }

  needsFollowUp() {
    return this.isActionable() && (this.hasPhone() || this.hasEmail());
  }

  hasEmail() {
    return this.email() !== '';
  }

  hasPhone() {
    return this.phone() !== '';
  }

  bestContactMethod() {
    if (this.hasPhone()) return 'sms';
    if (this.hasEmail()) return 'email';
    return 'none';
  }

  getOwnership() {
    return this.raw.ownership || getLeadOwner(this.raw, this.context);
  }

  getVisibility() {
    const visibility = getLeadVisibilityScope(this.context);
    if (!this.context && this.raw.visibility) return this.raw.visibility;
    return {
      canView: canViewLeadAccess(this.context, this.raw),
      canEdit: canEditLeadAccess(this.context, this.raw),
      scope: visibility.scope,
    };
  }

  canView() {
    return canViewLeadAccess(this.context, this.raw);
  }

  canEdit() {
    return canEditLeadAccess(this.context, this.raw);
  }

  toJSON() {
    const ownership = this.getOwnership();
    const visibility = this.getVisibility();
    return {
      ...this.raw,
      ownership,
      visibility,
      organizationId: this.raw.organizationId ?? ownership?.organizationId ?? null,
      ownerUserId: this.raw.ownerUserId ?? ownership?.ownerUserId ?? null,
      createdBy: this.raw.createdBy ?? ownership?.createdBy ?? null,
      updatedBy: this.raw.updatedBy ?? ownership?.updatedBy ?? null,
      createdAt: this.raw.createdAt ?? ownership?.createdAt ?? null,
      updatedAt: this.raw.updatedAt ?? ownership?.updatedAt ?? null,
      normalizedStatus: this.normalizedStatus(),
      computedStatus: this.computedStatus(),
      displayStatus: this.displayStatus(),
      bestContactMethod: this.bestContactMethod(),
    };
  }
}

export function fromRaw(rawLead, context = null) {
  return Lead.fromRaw(rawLead, context);
}

export default Lead;
