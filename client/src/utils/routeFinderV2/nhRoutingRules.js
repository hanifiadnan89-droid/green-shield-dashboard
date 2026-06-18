/**
 * Route Finder V2 — New Hampshire routing rules.
 * Approved technicians and day-of-week sub-region constraints.
 */

import { SCORER_CONFIG } from '../fieldRoutesScorer.js';
import { resolveTownFromAddress } from './profileScoringModifiers.js';
import { inferRouteAreaFromAddress } from './validationExamples.js';

/** @typedef {'nh_monday_wednesday_friday'|'nh_tuesday_thursday'} NhSubRegionKey */

/**
 * @typedef {Object} NhSubRegionRule
 * @property {NhSubRegionKey} key
 * @property {string} label
 * @property {number[]} preferredRouteDays - JS day index: 0=Sun, 1=Mon, ... 6=Sat
 * @property {string[]} towns
 * @property {string} reasonTag
 */

/** @type {string[]} */
export const NH_APPROVED_TECHNICIAN_NAMES = ['Jay Glaude', 'Alex Gray'];

/** @type {string[]} */
export const NH_FORBIDDEN_TECHNICIAN_NAMES = ['Joshua Harrington', 'Dmitri Rovinskinov'];

/** @type {Record<NhSubRegionKey, NhSubRegionRule>} */
export const NH_SUB_REGION_RULES = {
  nh_monday_wednesday_friday: {
    key: 'nh_monday_wednesday_friday',
    label: 'NH Monday/Wednesday/Friday zone',
    preferredRouteDays: [1, 3, 5],
    reasonTag: 'nh-monday-wednesday-friday-zone',
    towns: [
      'Derry',
      'Londonderry',
      'Manchester',
      'Bedford',
      'Goffstown',
      'Auburn',
      'Hudson',
      'Merrimack',
      'Nashua',
      'Salem',
      'Windham',
      'Hampstead',
      'Atkinson',
      'Plaistow',
      'Pelham',
      'Hampton',
      'North Hampton',
      'Seabrook',
      'Rye',
      'Stratham',
      'Epping',
      'Raymond',
      'Candia',
      'Hooksett',
      'Bow',
      'Southern NH Seacoast',
    ],
  },
  nh_tuesday_thursday: {
    key: 'nh_tuesday_thursday',
    label: 'NH Tuesday/Thursday zone',
    preferredRouteDays: [2, 4],
    reasonTag: 'nh-tuesday-thursday-zone',
    towns: [
      'Portsmouth',
      'Dover',
      'Durham',
      'Rochester',
      'Somersworth',
      'Barrington',
      'Farmington',
      'Concord',
      'Laconia',
      'Berlin',
      'Exeter',
      'Newmarket',
      'Lee',
      'Northwood',
      'Milton',
      'Alton',
      'Wolfeboro',
      'Littleton',
      'Whitefield',
    ],
  },
};

/** @type {number} */
export const NH_NON_APPROVED_TECHNICIAN_PENALTY = 100;

/** @type {number} */
export const NH_ROUTE_DAY_MISMATCH_PENALTY = 50;

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TOWN_TO_NH_SUB_REGION = new Map();

function normalizeTown(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

for (const rule of Object.values(NH_SUB_REGION_RULES)) {
  for (const town of rule.towns) {
    TOWN_TO_NH_SUB_REGION.set(normalizeTown(town), rule);
  }
}

/**
 * @param {string|null|undefined} routeArea
 * @returns {boolean}
 */
export function isNewHampshireRouteArea(routeArea) {
  const key = String(routeArea ?? '').trim().toLowerCase();
  return key === 'new_hampshire' || key === 'nh';
}

/**
 * @param {object|null|undefined} lead
 * @returns {boolean}
 */
export function isNewHampshireLead(lead) {
  if (isNewHampshireRouteArea(lead?.routeArea)) return true;
  return inferRouteAreaFromAddress(lead?.address) === 'new_hampshire';
}

/**
 * @param {string|null|undefined} techName
 * @returns {boolean}
 */
export function isNhApprovedTechnician(techName) {
  const normalized = String(techName ?? '').trim().toLowerCase();
  return NH_APPROVED_TECHNICIAN_NAMES.some(
    name => name.toLowerCase() === normalized,
  );
}

/**
 * @param {string|null|undefined} techName
 * @returns {boolean}
 */
export function isNhForbiddenTechnician(techName) {
  const normalized = String(techName ?? '').trim().toLowerCase();
  return NH_FORBIDDEN_TECHNICIAN_NAMES.some(
    name => name.toLowerCase() === normalized,
  );
}

/**
 * @param {string|null|undefined} townOrAddress
 * @returns {NhSubRegionRule|null}
 */
export function resolveNhSubRegionForTown(townOrAddress) {
  const town = resolveTownFromAddress(townOrAddress) ?? townOrAddress;
  const normalized = normalizeTown(town);
  if (!normalized) return null;
  return TOWN_TO_NH_SUB_REGION.get(normalized) ?? null;
}

/**
 * @param {object|null|undefined} lead
 * @returns {NhSubRegionRule|null}
 */
export function resolveNhSubRegionFromLead(lead) {
  if (!isNewHampshireLead(lead)) return null;
  return resolveNhSubRegionForTown(lead?.address)
    ?? resolveNhSubRegionForTown(lead?.town)
    ?? resolveNhSubRegionForTown(lead?.city);
}

/**
 * @param {string|null|undefined} dateKey - YYYY-MM-DD
 * @returns {number|null}
 */
export function resolveJobDayOfWeek(dateKey) {
  if (!dateKey) return null;
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.getDay();
}

/**
 * @param {string|null|undefined} dateKey
 * @param {NhSubRegionRule|null|undefined} subRegion
 * @returns {{ matches: boolean|null, jobDayOfWeek: number|null, preferredRouteDays: number[], warning: string|null }}
 */
export function evaluateNhRouteDayMatch(dateKey, subRegion) {
  const jobDayOfWeek = resolveJobDayOfWeek(dateKey);
  const preferredRouteDays = subRegion?.preferredRouteDays ?? [];

  if (jobDayOfWeek == null || !subRegion) {
    return {
      matches: null,
      jobDayOfWeek,
      preferredRouteDays,
      warning: null,
    };
  }

  const matches = preferredRouteDays.includes(jobDayOfWeek);
  const preferredLabels = preferredRouteDays.map(day => DAY_LABELS[day]).join('/');
  const warning = matches
    ? null
    : `NH sub-region prefers ${preferredLabels} routes; job date is ${DAY_LABELS[jobDayOfWeek]}`;

  return {
    matches,
    jobDayOfWeek,
    preferredRouteDays,
    warning,
  };
}

/**
 * @param {object|null|undefined} lead
 * @returns {object}
 */
export function evaluateLeadNhRoutingContext(lead) {
  if (!isNewHampshireLead(lead)) {
    return {
      applies: false,
      nhSubRegion: null,
      nhSubRegionLabel: null,
      preferredRouteDays: [],
      nhRouteDayMatch: null,
      nhRouteDayWarning: null,
    };
  }

  const subRegion = resolveNhSubRegionFromLead(lead);
  const dayEval = evaluateNhRouteDayMatch(lead?.date, subRegion);

  return {
    applies: true,
    nhSubRegion: subRegion?.key ?? null,
    nhSubRegionLabel: subRegion?.label ?? null,
    preferredRouteDays: dayEval.preferredRouteDays,
    nhRouteDayMatch: dayEval.matches,
    nhRouteDayWarning: dayEval.warning,
    nhSubRegionReasonTag: subRegion?.reasonTag ?? null,
  };
}

/**
 * @param {string|null|undefined} techName
 * @param {object|null|undefined} lead
 * @returns {object}
 */
export function evaluateNhTechnicianRoutingContext(techName, lead) {
  const leadContext = evaluateLeadNhRoutingContext(lead);
  if (!leadContext.applies) {
    return {
      ...leadContext,
      nhApprovedTechnician: null,
    };
  }

  return {
    ...leadContext,
    nhApprovedTechnician: isNhApprovedTechnician(techName),
  };
}

/**
 * V2-only scorer config override: allow Jay Glaude and Alex Gray for NH jobs.
 * @param {object|null|undefined} lead
 * @returns {typeof SCORER_CONFIG|null}
 */
export function getV2ScorerConfigForLead(lead) {
  if (!isNewHampshireLead(lead)) return null;

  return {
    ...SCORER_CONFIG,
    nh: {
      ...SCORER_CONFIG.nh,
      approvedTechNames: [...NH_APPROVED_TECHNICIAN_NAMES],
      approvedTechIds: [...SCORER_CONFIG.nh.approvedTechIds],
    },
  };
}

/**
 * @returns {NhSubRegionRule[]}
 */
export function getAllNhSubRegionRules() {
  return Object.values(NH_SUB_REGION_RULES);
}
