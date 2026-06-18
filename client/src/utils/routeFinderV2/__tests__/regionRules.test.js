import { describe, it, expect } from 'vitest';
import {
  REGION_RULES,
  SERVICE_AREA_GROUPS,
  getServiceAreaGroup,
  getAllServiceAreaGroups,
  resolveServiceAreaGroupForTown,
  resolveServiceAreaGroupFromAddress,
} from '../regionRules.js';

describe('regionRules', () => {
  it('imports state-level region rules', () => {
    expect(REGION_RULES.maine.label).toBe('Maine');
    expect(REGION_RULES.new_hampshire.label).toBe('New Hampshire');
    expect(REGION_RULES.general.label).toBe('General');
  });

  it('defines major service area groups', () => {
    const labels = getAllServiceAreaGroups().map(group => group.label);
    expect(labels).toEqual(expect.arrayContaining([
      'Southern Maine',
      'Seacoast NH',
      'Greater Portland',
      'Kennebunk / Wells / Sanford area',
      'Brunswick / Midcoast',
      'Oxford / Rumford / Western Maine',
    ]));
    expect(labels).toHaveLength(6);
  });

  it('includes dispatcher town lists for each service area group', () => {
    expect(SERVICE_AREA_GROUPS.southern_maine.towns).toContain('Wells');
    expect(SERVICE_AREA_GROUPS.seacoast_nh.towns).toContain('Portsmouth');
    expect(SERVICE_AREA_GROUPS.greater_portland.towns).toContain('Portland');
    expect(SERVICE_AREA_GROUPS.kennebunk_wells_sanford.towns).toContain('Kennebunk');
    expect(SERVICE_AREA_GROUPS.brunswick_midcoast.towns).toContain('Brunswick');
    expect(SERVICE_AREA_GROUPS.oxford_western.towns).toContain('Lewiston');
  });

  it('exposes bonus and penalty fields on service area groups', () => {
    const group = getServiceAreaGroup('Kennebunk / Wells / Sanford area');
    expect(group).not.toBeNull();
    expect(group.sameTownBonus).toBeGreaterThan(0);
    expect(group.sameRegionBonus).toBeGreaterThan(0);
    expect(group.normalServiceAreaBonus).toBeGreaterThan(0);
    expect(group.outsideRegionPenalty).toBeGreaterThan(0);
  });

  it('resolves towns and addresses to service area groups', () => {
    expect(resolveServiceAreaGroupForTown('Kennebunk')?.label).toBe('Kennebunk / Wells / Sanford area');
    expect(resolveServiceAreaGroupFromAddress('123 Main St, Kennebunk, ME')?.label)
      .toBe('Kennebunk / Wells / Sanford area');
    expect(resolveServiceAreaGroupForTown('Portsmouth')?.label).toBe('Seacoast NH');
  });
});
