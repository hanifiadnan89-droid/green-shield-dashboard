import { resolveGoogleSheetsConfig } from '../integrationResolver.js';
import { getLeads } from '../sheets.js';
import { Lead } from '../../domain/leads/Lead.js';
import {
  filterLeadsForUser,
  getLeadVisibilityScope,
  isScopedLeadAccessEnabled,
} from '../leadAccess.js';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseTimeMs(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function getLeadUpdatedMs(lead) {
  return parseTimeMs(lead?.updatedAt)
    ?? parseTimeMs(lead?.updated_at)
    ?? parseTimeMs(lead?.ownership?.updatedAt)
    ?? parseTimeMs(lead?.sent)
    ?? parseTimeMs(lead?.createdAt)
    ?? parseTimeMs(lead?.ownership?.createdAt)
    ?? parseTimeMs(lead?.replies_last_read_at)
    ?? parseTimeMs(lead?.updatedAt);
}

function enrichLead(context, lead, queryName, sheetsConfig) {
  const entity = Lead.fromRaw(lead, context);
  const base = entity.toJSON();
  return {
    ...base,
    computedStatus: entity.computedStatus(),
    futureSafeMetadata: {
      queryName,
      source: 'crmData.leadQueries',
      visibilityMode: getLeadVisibilityScope(context).scope,
      featureFlagState: {
        SCOPED_LEAD_ACCESS_ENABLED: isScopedLeadAccessEnabled(),
      },
      configuredSheets: {
        source: sheetsConfig.source,
        configured: sheetsConfig.configured,
      },
      computedAt: new Date().toISOString(),
    },
  };
}

function recordQueryMetrics({
  queryName,
  executionTimeMs,
  leadCount,
  context,
}) {
  if (process.env.NODE_ENV !== 'development') return;
  console.log('[crmData.leadQueries]', JSON.stringify({
    queryName,
    executionTimeMs,
    leadCount,
    visibilityMode: getLeadVisibilityScope(context).scope,
    featureFlagState: {
      SCOPED_LEAD_ACCESS_ENABLED: isScopedLeadAccessEnabled(),
    },
  }));
}

async function loadLeadRows(context) {
  const sheetsConfig = resolveGoogleSheetsConfig(context);
  const rows = await getLeads(context);
  return { sheetsConfig, rows: Array.isArray(rows) ? rows : [] };
}

export async function getVisibleLeads(context) {
  const startedAt = Date.now();
  const { sheetsConfig, rows } = await loadLeadRows(context);
  const visibleRows = filterLeadsForUser(context, rows);
  const leads = visibleRows.map((lead) => enrichLead(context, lead, 'getVisibleLeads', sheetsConfig));
  recordQueryMetrics({
    queryName: 'getVisibleLeads',
    executionTimeMs: Date.now() - startedAt,
    leadCount: leads.length,
    context,
  });
  return leads;
}

export async function getLeadByRowNumber(context, rowNumber) {
  const startedAt = Date.now();
  const leads = await getVisibleLeads(context);
  const normalizedRow = Number.parseInt(String(rowNumber ?? '').trim(), 10);
  const lead = leads.find((item) => Number.parseInt(String(item.row_number), 10) === normalizedRow) || null;
  recordQueryMetrics({
    queryName: 'getLeadByRowNumber',
    executionTimeMs: Date.now() - startedAt,
    leadCount: lead ? 1 : 0,
    context,
  });
  return lead;
}

export async function searchVisibleLeads(context, query) {
  const startedAt = Date.now();
  const normalized = normalizeText(query).toLowerCase();
  const leads = await getVisibleLeads(context);
  if (!normalized) {
    recordQueryMetrics({
      queryName: 'searchVisibleLeads',
      executionTimeMs: Date.now() - startedAt,
      leadCount: leads.length,
      context,
    });
    return leads;
  }
  const filtered = leads.filter((lead) => {
    const haystack = [
      lead.name,
      lead.email,
      lead.phone,
      lead.phone_formatted,
      lead.reason,
      lead.notes,
      lead.status,
      lead.computedStatus,
      lead.ownerUserId,
      lead.createdBy,
      lead.updatedBy,
    ].map((value) => normalizeText(value).toLowerCase()).join(' | ');
    return haystack.includes(normalized);
  });
  recordQueryMetrics({
    queryName: 'searchVisibleLeads',
    executionTimeMs: Date.now() - startedAt,
    leadCount: filtered.length,
    context,
  });
  return filtered;
}

export async function getLeadStatistics(context) {
  const startedAt = Date.now();
  const leads = await getVisibleLeads(context);
  const statusCounts = leads.reduce((acc, lead) => {
    const key = Lead.fromRaw(lead, context).computedStatus();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const stats = {
    total: leads.length,
    visible: leads.length,
    owned: leads.filter((lead) => {
      const ownership = Lead.fromRaw(lead, context).getOwnership();
      return normalizeText(ownership?.ownerUserId) === normalizeText(context?.userId);
    }).length,
    statusCounts,
    visibilityMode: getLeadVisibilityScope(context).scope,
    featureFlagState: {
      SCOPED_LEAD_ACCESS_ENABLED: isScopedLeadAccessEnabled(),
    },
  };
  recordQueryMetrics({
    queryName: 'getLeadStatistics',
    executionTimeMs: Date.now() - startedAt,
    leadCount: leads.length,
    context,
  });
  return stats;
}

export async function getRecentlyUpdatedLeads(context, limit = 10) {
  const startedAt = Date.now();
  const leads = await getVisibleLeads(context);
  const sorted = [...leads].sort((a, b) => {
    const aMs = getLeadUpdatedMs(a) ?? 0;
    const bMs = getLeadUpdatedMs(b) ?? 0;
    if (aMs !== bMs) return bMs - aMs;
    const aRow = Number.parseInt(String(a.row_number ?? 0), 10);
    const bRow = Number.parseInt(String(b.row_number ?? 0), 10);
    return bRow - aRow;
  });
  const recent = sorted.slice(0, limit);
  recordQueryMetrics({
    queryName: 'getRecentlyUpdatedLeads',
    executionTimeMs: Date.now() - startedAt,
    leadCount: recent.length,
    context,
  });
  return recent;
}

export function getComputedStatus(lead, context = null) {
  return Lead.fromRaw(lead, context).computedStatus();
}

export { enrichLead };
